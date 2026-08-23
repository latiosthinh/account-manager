import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, closeDb, categoriesRepo, accountsRepo } from '../src/db.js';

test('Turso integration with in-memory libsql client', async (t) => {
  // Point TURSO_DATABASE_URL to libsql in-memory URL
  process.env.TURSO_DATABASE_URL = ':memory:';
  process.env.TURSO_AUTH_TOKEN = '';

  const client = initDb();
  assert.ok(client, 'Turso client should be initialized');

  t.after(() => {
    closeDb();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  // Categories CRUD on Turso client
  const createdCat = await categoriesRepo.create('Work');
  assert.ok(createdCat.id);
  assert.strictEqual(createdCat.name, 'Work');
  assert.strictEqual(createdCat.is_preset, 0);

  const fetchedCat = await categoriesRepo.getById(createdCat.id);
  assert.strictEqual(fetchedCat.name, 'Work');

  const fetchedByName = await categoriesRepo.getByName('work');
  assert.strictEqual(fetchedByName.id, createdCat.id);

  // Accounts CRUD on Turso client
  const createdAcc = await accountsRepo.create({
    category_id: createdCat.id,
    email: 'dev@company.com',
    password: 'superSecretPassword',
    notes: 'Dev portal',
  });
  assert.ok(createdAcc.id);
  assert.strictEqual(createdAcc.email, 'dev@company.com');

  const fetchedAcc = await accountsRepo.getById(createdAcc.id);
  assert.strictEqual(fetchedAcc.email, 'dev@company.com');
  assert.strictEqual(fetchedAcc.category_name, 'Work');

  const allWithCounts = await categoriesRepo.getAllWithCounts();
  const workCat = allWithCounts.find(c => c.id === createdCat.id);
  assert.ok(workCat);
  assert.strictEqual(workCat.accountCount, 1);

  // Update account
  const updatedAcc = await accountsRepo.update(createdAcc.id, {
    email: 'newdev@company.com',
    password: 'newPassword123',
    notes: 'Updated notes',
  });
  assert.strictEqual(updatedAcc.email, 'newdev@company.com');
  assert.strictEqual(updatedAcc.password, 'newPassword123');

  // Delete account then category
  const accDeleted = await accountsRepo.delete(createdAcc.id);
  assert.strictEqual(accDeleted, true);
  assert.strictEqual(await accountsRepo.getById(createdAcc.id), null);

  const catDeleted = await categoriesRepo.delete(createdCat.id);
  assert.strictEqual(catDeleted, true);
  assert.strictEqual(await categoriesRepo.getById(createdCat.id), null);
});
