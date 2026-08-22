import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, startServer } from '../src/server.js';
import { initDb, closeDb, accountsRepo } from '../src/db.js';
import { createSessionToken } from '../src/auth.js';
import { config } from '../src/config.js';

describe('Category API integration test suite', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    initDb(':memory:');
    const app = createApp();
    server = await startServer(0, '127.0.0.1', app);
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const token = createSessionToken('admin', config.sessionSecret, 3600);
    authCookie = `${config.cookieName}=${token}`;
  });

  after(() => {
    if (server) {
      server.close();
    }
    closeDb();
  });

  test('Unauthenticated requests to /api/categories return 401', async () => {
    const getRes = await fetch(`${baseUrl}/api/categories`);
    assert.equal(getRes.status, 401);

    const postRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    assert.equal(postRes.status, 401);

    const deleteRes = await fetch(`${baseUrl}/api/categories/some-id`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 401);
  });

  test('GET /api/categories returns presets with accountCount: 0', async () => {
    const res = await fetch(`${baseUrl}/api/categories`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 2);

    const names = data.map((c) => c.name);
    assert.ok(names.includes('Google'));
    assert.ok(names.includes('Outlook'));

    for (const cat of data) {
      assert.equal(typeof cat.accountCount, 'number');
      assert.equal(cat.accountCount, 0);
    }
  });

  test('POST /api/categories creates custom category', async () => {
    const res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ name: '  Discord  ' }),
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, 'Discord');
    assert.equal(created.is_preset, 0);
    assert.ok(created.id);
  });

  test('POST /api/categories validation errors', async () => {
    // Empty name
    let res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(res.status, 400);

    // Non-string
    res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 123 }),
    });
    assert.equal(res.status, 400);

    // Too long (> 50 chars)
    res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 'a'.repeat(51) }),
    });
    assert.equal(res.status, 400);

    // Duplicate name (case-insensitive)
    res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 'google' }),
    });
    assert.equal(res.status, 400);

    res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 'DISCORD' }),
    });
    assert.equal(res.status, 400);
  });

  test('DELETE /api/categories/:id guards against preset, missing, and populated categories', async () => {
    // 1. Fetch categories to get IDs
    const listRes = await fetch(`${baseUrl}/api/categories`, {
      headers: { Cookie: authCookie },
    });
    const categories = await listRes.json();
    const googleCat = categories.find((c) => c.name === 'Google');
    const discordCat = categories.find((c) => c.name === 'Discord');

    // 2. Preset category deletion fails with 400
    const presetDelRes = await fetch(`${baseUrl}/api/categories/${googleCat.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(presetDelRes.status, 400);

    // 3. Non-existent category deletion fails with 404
    const notFoundDelRes = await fetch(`${baseUrl}/api/categories/non-existent-id`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(notFoundDelRes.status, 404);

    // 4. Create account under Discord category -> deletion fails with 409
    await accountsRepo.create({
      category_id: discordCat.id,
      email: 'user@discord.com',
      password: 'password123',
    });

    const populatedDelRes = await fetch(`${baseUrl}/api/categories/${discordCat.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(populatedDelRes.status, 409);

    // 5. Create fresh empty category and delete successfully with 200
    const createTempRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 'Temporary' }),
    });
    const tempCat = await createTempRes.json();

    const deleteTempRes = await fetch(`${baseUrl}/api/categories/${tempCat.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(deleteTempRes.status, 200);

    // Verify it is no longer returned in list
    const afterListRes = await fetch(`${baseUrl}/api/categories`, {
      headers: { Cookie: authCookie },
    });
    const afterCategories = await afterListRes.json();
    assert.equal(afterCategories.some((c) => c.id === tempCat.id), false);
  });
});
