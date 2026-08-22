import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, getDb, closeDb, categoriesRepo, accountsRepo } from '../src/db.js';

test('DB in-memory initialization, pragmas, presets, and repos', (t) => {
  const db = initDb(':memory:');

  t.after(() => {
    closeDb();
  });

  const fkPragma = db.prepare('PRAGMA foreign_keys').get();
  assert.strictEqual(fkPragma.foreign_keys, 1, 'Foreign keys pragma must be enabled');

  // Check preset seeding
  const presets = categoriesRepo.getAll();
  assert.strictEqual(presets.length, 2, 'Default presets Google and Outlook must exist');
  const names = presets.map((p) => p.name).sort();
  assert.deepStrictEqual(names, ['Google', 'Outlook']);
  assert.strictEqual(presets[0].is_preset, 1);
  assert.strictEqual(presets[1].is_preset, 1);

  // Category CRUD
  const createdCat = categoriesRepo.create('Banking');
  assert.ok(createdCat.id);
  assert.strictEqual(createdCat.name, 'Banking');
  assert.strictEqual(createdCat.is_preset, 0);

  const fetchedCat = categoriesRepo.getById(createdCat.id);
  assert.strictEqual(fetchedCat.name, 'Banking');

  // Account CRUD
  const createdAcc = accountsRepo.create({
    category_id: createdCat.id,
    email: 'user@bank.com',
    password: 'secretPassword123',
    notes: 'Primary debit account',
  });
  assert.ok(createdAcc.id);
  assert.strictEqual(createdAcc.email, 'user@bank.com');
  assert.strictEqual(createdAcc.password, 'secretPassword123');
  assert.strictEqual(createdAcc.notes, 'Primary debit account');

  const fetchedAcc = accountsRepo.getById(createdAcc.id);
  assert.strictEqual(fetchedAcc.email, 'user@bank.com');
  assert.strictEqual(fetchedAcc.category_name, 'Banking');

  const byCat = accountsRepo.getByCategoryId(createdCat.id);
  assert.strictEqual(byCat.length, 1);
  assert.strictEqual(byCat[0].id, createdAcc.id);

  // Account update
  const updatedAcc = accountsRepo.update(createdAcc.id, {
    email: 'newuser@bank.com',
    password: 'updatedPassword',
    notes: 'Updated note',
  });
  assert.strictEqual(updatedAcc.email, 'newuser@bank.com');
  assert.strictEqual(updatedAcc.password, 'updatedPassword');
  assert.strictEqual(updatedAcc.notes, 'Updated note');

  // Foreign key restriction check: Cannot delete category with linked accounts
  assert.throws(() => {
    categoriesRepo.delete(createdCat.id);
  }, /FOREIGN KEY constraint failed/);

  // Delete account then category
  const accDeleted = accountsRepo.delete(createdAcc.id);
  assert.strictEqual(accDeleted, true);
  assert.strictEqual(accountsRepo.getById(createdAcc.id), undefined);

  const catDeleted = categoriesRepo.delete(createdCat.id);
  assert.strictEqual(catDeleted, true);
  assert.strictEqual(categoriesRepo.getById(createdCat.id), undefined);
});

test('Foreign key prevents inserting account with non-existent category_id', (t) => {
  initDb(':memory:');
  t.after(() => {
    closeDb();
  });

  assert.throws(() => {
    accountsRepo.create({
      category_id: 'non-existent-cat-id',
      email: 'test@example.com',
      password: 'pwd',
    });
  }, /FOREIGN KEY constraint failed/);
});

test('File-based persistence across reconnects and directory creation', (t) => {
  const tmpDir = path.join(os.tmpdir(), `acc-mgr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const dbFilePath = path.join(tmpDir, 'nested', 'test.sqlite');

  // 1. Initialize in newly created nested directory
  const db1 = initDb(dbFilePath);
  assert.ok(fs.existsSync(dbFilePath), 'Database file should be created');

  const walPragma = db1.prepare('PRAGMA journal_mode').get();
  assert.strictEqual(walPragma.journal_mode.toLowerCase(), 'wal', 'File db must use WAL journal mode');

  const cat = categoriesRepo.create('Work');
  const acc = accountsRepo.create({
    category_id: cat.id,
    email: 'work@corp.com',
    password: 'workpassword',
  });

  closeDb();

  // 2. Re-open and verify persistence and idempotent presets
  initDb(dbFilePath);
  t.after(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const categories = categoriesRepo.getAll();
  assert.strictEqual(categories.length, 3, 'Google, Outlook, and Work categories should exist');

  const loadedAcc = accountsRepo.getById(acc.id);
  assert.ok(loadedAcc);
  assert.strictEqual(loadedAcc.email, 'work@corp.com');
  assert.strictEqual(loadedAcc.category_name, 'Work');
});
