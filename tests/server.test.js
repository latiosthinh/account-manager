import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, startServer } from '../src/server.js';
import { requireAuth } from '../src/middleware/auth-middleware.js';
import { config } from '../src/config.js';
import { initDb, closeDb } from '../src/db.js';

test('Server integration and authentication flow', async (t) => {
  initDb(':memory:');
  const app = createApp();

  // Add protected test route before startServer mounts 404 handler
  app.get('/api/test-protected', requireAuth, (req, res) => {
    res.json({ secretData: 'admin-only', user: req.user });
  });

  let server;
  let baseUrl;

  await new Promise(async (resolve) => {
    server = await startServer(0, '127.0.0.1', app);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    closeDb();
  });

  await t.test('GET /api/health returns status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
  });

  await t.test('GET /api/auth/status returns authenticated: false when unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/auth/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.authenticated, false);

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`);
    assert.equal(sessionRes.status, 200);
    const sessionBody = await sessionRes.json();
    assert.equal(sessionBody.authenticated, false);
  });

  await t.test('GET /api/test-protected returns 401 Unauthorized without session', async () => {
    const res = await fetch(`${baseUrl}/api/test-protected`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Unauthorized');
  });

  await t.test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.10',
      },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Invalid admin password');
  });

  await t.test('POST /api/auth/login throttles after 5 failed attempts with HTTP 429', async () => {
    const customHeaders = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.195',
    };

    // 4 initial failures (status 401)
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: customHeaders,
        body: JSON.stringify({ password: 'bad-pass' }),
      });
      assert.equal(res.status, 401);
    }

    // 5th failed attempt triggers 429
    const fifthRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({ password: 'bad-pass' }),
    });
    assert.equal(fifthRes.status, 429);
    const fifthBody = await fifthRes.json();
    assert.ok(fifthBody.retryAfter > 0);
    assert.ok(fifthRes.headers.get('retry-after'));

    // Subsequent attempt is blocked immediately
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({ password: config.adminPassword }),
    });
    assert.equal(blockedRes.status, 429);
  });

  await t.test('POST /api/auth/login with valid password sets HttpOnly cookie and allows access', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.50',
      },
      body: JSON.stringify({ password: config.adminPassword }),
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.ok(setCookie.includes(config.cookieName));
    assert.ok(setCookie.toLowerCase().includes('httponly'));

    // Extract cookie value
    const cookieVal = setCookie.split(';')[0];

    // Status check with cookie
    const statusRes = await fetch(`${baseUrl}/api/auth/status`, {
      headers: { Cookie: cookieVal },
    });
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.authenticated, true);

    // Protected route with cookie
    const protectedRes = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { Cookie: cookieVal },
    });
    assert.equal(protectedRes.status, 200);
    const protectedBody = await protectedRes.json();
    assert.equal(protectedBody.secretData, 'admin-only');
    assert.equal(protectedBody.user.role, 'admin');

    // Logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieVal },
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert.ok(logoutCookie);

    // Protected route after logout (passing cleared cookie)
    const afterLogoutCookie = logoutCookie.split(';')[0];
    const postLogoutRes = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { Cookie: afterLogoutCookie },
    });
    assert.equal(postLogoutRes.status, 401);
  });

  await t.test('GET /api/unmatched returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/unmatched`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Not Found');
  });
});
