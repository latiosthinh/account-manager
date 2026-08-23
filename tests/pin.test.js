import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { initDb, closeDb } from '../src/db.js';
import { createSessionToken } from '../src/auth.js';
import { config } from '../src/config.js';

test('PIN authentication integration test suite', async (t) => {
  initDb(':memory:');
  const app = createApp();
  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
    closeDb();
  });

  const validSession = createSessionToken({ role: 'admin' }, config.sessionSecret);

  // 1. Unauthenticated request to /api/auth/verify-pin returns 401
  const resUnauth = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '123456' }),
  });
  assert.strictEqual(resUnauth.status, 401);
  const dataUnauth = await resUnauth.json();
  assert.strictEqual(dataUnauth.error, 'Unauthorized. Please log in first.');

  // 2. Set PIN_CODE in config and test verification
  process.env.PIN_CODE = '888888';

  // 3. Authenticated request with invalid PIN returns 401
  const resBadPin = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `${config.cookieName}=${validSession}`,
    },
    body: JSON.stringify({ pin: '000000' }),
  });
  assert.strictEqual(resBadPin.status, 401);
  const dataBadPin = await resBadPin.json();
  assert.strictEqual(dataBadPin.error, 'Invalid PIN code');

  // 4. Authenticated request with valid PIN returns 200
  const resGoodPin = await fetch(`${baseUrl}/api/auth/verify-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `${config.cookieName}=${validSession}`,
    },
    body: JSON.stringify({ pin: '888888' }),
  });
  assert.strictEqual(resGoodPin.status, 200);
  const dataGoodPin = await resGoodPin.json();
  assert.strictEqual(dataGoodPin.success, true);
  assert.strictEqual(dataGoodPin.message, 'PIN verified');

  // 5. GET /api/auth/session reflects hasPin: true
  const resSession = await fetch(`${baseUrl}/api/auth/session`, {
    headers: {
      'Cookie': `${config.cookieName}=${validSession}`,
    },
  });
  const dataSession = await resSession.json();
  assert.strictEqual(dataSession.authenticated, true);
  assert.strictEqual(dataSession.hasPin, true);

  delete process.env.PIN_CODE;
});
