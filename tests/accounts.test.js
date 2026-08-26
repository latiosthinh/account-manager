import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, startServer } from '../src/server.js';
import { initDb, closeDb, categoriesRepo, accountsRepo } from '../src/db.js';
import { createSessionToken } from '../src/auth.js';
import { config } from '../src/config.js';

describe('Account API integration test suite', () => {
  let server;
  let baseUrl;
  let authCookie;
  let googleCat;
  let outlookCat;

  before(async () => {
    initDb(':memory:');
    const app = createApp();
    server = await startServer(0, '127.0.0.1', app);
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const token = createSessionToken('admin', config.sessionSecret, 3600);
    authCookie = `${config.cookieName}=${token}`;

    const categories = await categoriesRepo.getAll();
    googleCat = categories.find((c) => c.name === 'Google');
    outlookCat = categories.find((c) => c.name === 'Outlook');
  });

  after(() => {
    if (server) {
      server.close();
    }
    closeDb();
  });

  test('Unauthenticated requests to /api/accounts return 401', async () => {
    const getRes = await fetch(`${baseUrl}/api/accounts`);
    assert.equal(getRes.status, 401);

    const postRes = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '123', categoryId: googleCat.id }),
    });
    assert.equal(postRes.status, 401);

    const putRes = await fetch(`${baseUrl}/api/accounts/any-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'updated@b.com' }),
    });
    assert.equal(putRes.status, 401);

    const deleteRes = await fetch(`${baseUrl}/api/accounts/any-id`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 401);
  });

  test('POST /api/accounts with valid credentials creates account (201)', async () => {
    const res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        email: '  test@example.com  ',
        password: 'superSecretPassword!',
        categoryId: googleCat.id,
        notes: 'Personal account',
      }),
    });

    assert.equal(res.status, 201);
    const created = await res.json();
    assert.ok(created.id);
    assert.equal(created.email, 'test@example.com');
    assert.equal(created.password, 'superSecretPassword!');
    assert.equal(created.category_id, googleCat.id);
    assert.equal(created.category_name, 'Google');
    assert.equal(created.notes, 'Personal account');
    assert.ok(created.created_at);
    assert.ok(created.updated_at);
  });

  test('POST /api/accounts with only password (API key / command) creates item (201)', async () => {
    const res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        password: 'export OPENAI_API_KEY=sk-test-123456',
        categoryId: googleCat.id,
        notes: 'API token environment export',
      }),
    });

    assert.equal(res.status, 201);
    const created = await res.json();
    assert.ok(created.id);
    assert.equal(created.email, '');
    assert.equal(created.password, 'export OPENAI_API_KEY=sk-test-123456');
    assert.equal(created.category_id, googleCat.id);
  });

  test('POST /api/accounts validation errors (400)', async () => {
    // Both missing
    let res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ categoryId: googleCat.id }),
    });
    assert.equal(res.status, 400);

    // Both empty
    res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ email: '   ', password: '', categoryId: googleCat.id }),
    });
    assert.equal(res.status, 400);

    // Missing categoryId
    res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ email: 'test@b.com', password: '123' }),
    });
    assert.equal(res.status, 400);

    // Non-existent categoryId
    res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ email: 'test@b.com', password: '123', categoryId: 'non-existent-uuid' }),
    });
    assert.equal(res.status, 400);

    // Invalid notes (> 2000 chars)
    res = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ email: 'test@b.com', password: '123', categoryId: googleCat.id, notes: 'x'.repeat(2001) }),
    });
    assert.equal(res.status, 400);
  });

  test('GET /api/accounts returns list and filters by categoryId', async () => {
    // Create an Outlook account
    await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        email: 'user@outlook.com',
        password: 'outlookPassword',
        categoryId: outlookCat.id,
      }),
    });

    // 1. Get all accounts
    const allRes = await fetch(`${baseUrl}/api/accounts`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(allRes.status, 200);
    const allAccounts = await allRes.json();
    assert.ok(Array.isArray(allAccounts));
    assert.ok(allAccounts.length >= 2);

    // 2. Filter by Google categoryId
    const googleRes = await fetch(`${baseUrl}/api/accounts?categoryId=${googleCat.id}`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(googleRes.status, 200);
    const googleAccounts = await googleRes.json();
    assert.ok(googleAccounts.every((a) => a.category_id === googleCat.id));
    assert.ok(googleAccounts.some((a) => a.email === 'test@example.com'));

    // 3. Filter by Outlook categoryId
    const outlookRes = await fetch(`${baseUrl}/api/accounts?categoryId=${outlookCat.id}`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(outlookRes.status, 200);
    const outlookAccounts = await outlookRes.json();
    assert.ok(outlookAccounts.every((a) => a.category_id === outlookCat.id));
    assert.ok(outlookAccounts.some((a) => a.email === 'user@outlook.com'));
  });

  test('PUT /api/accounts/:id updates account attributes', async () => {
    const listRes = await fetch(`${baseUrl}/api/accounts?categoryId=${googleCat.id}`, {
      headers: { Cookie: authCookie },
    });
    const [account] = await listRes.json();

    // 1. Update email, password, and notes
    const updateRes = await fetch(`${baseUrl}/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        email: 'newemail@example.com',
        password: 'newPassword123',
        notes: 'Updated note',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.id, account.id);
    assert.equal(updated.email, 'newemail@example.com');
    assert.equal(updated.password, 'newPassword123');
    assert.equal(updated.notes, 'Updated note');
    assert.equal(updated.category_id, googleCat.id);

    // 2. Change category
    const changeCatRes = await fetch(`${baseUrl}/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        categoryId: outlookCat.id,
      }),
    });
    assert.equal(changeCatRes.status, 200);
    const changedCat = await changeCatRes.json();
    assert.equal(changedCat.category_id, outlookCat.id);
    assert.equal(changedCat.category_name, 'Outlook');

    // 3. Update non-existent account -> 404
    const notFoundRes = await fetch(`${baseUrl}/api/accounts/non-existent-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ email: 'test@b.com' }),
    });
    assert.equal(notFoundRes.status, 404);

    // 4. Update with invalid categoryId -> 400
    const invalidCatRes = await fetch(`${baseUrl}/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ categoryId: 'invalid-cat' }),
    });
    assert.equal(invalidCatRes.status, 400);
  });

  test('DELETE /api/accounts/:id removes account and cross-entity guard interaction', async () => {
    // 1. Create a custom category
    const catRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ name: 'Github' }),
    });
    const customCat = await catRes.json();

    // 2. Create account in Github category
    const acctRes = await fetch(`${baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        email: 'dev@github.com',
        password: 'ghp_secretToken',
        categoryId: customCat.id,
      }),
    });
    const acct = await acctRes.json();

    // 3. Category deletion should fail (409)
    const blockCatDel = await fetch(`${baseUrl}/api/categories/${customCat.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(blockCatDel.status, 409);

    // 4. Delete non-existent account -> 404
    const notFoundDel = await fetch(`${baseUrl}/api/accounts/non-existent-id`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(notFoundDel.status, 404);

    // 5. Delete account successfully -> 200
    const delAcctRes = await fetch(`${baseUrl}/api/accounts/${acct.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(delAcctRes.status, 200);

    // 6. Category deletion should now succeed -> 200
    const allowCatDel = await fetch(`${baseUrl}/api/categories/${customCat.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(allowCatDel.status, 200);
  });
});
