import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

let dbInstance = null;

export function initDb(dbPath = config.dbPath) {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Configure pragmas
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      is_preset INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default presets idempotently
  const seedPresets = db.prepare(`
    INSERT INTO categories (id, name, is_preset, created_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(name) DO NOTHING;
  `);

  const now = new Date().toISOString();
  seedPresets.run(crypto.randomUUID(), 'Google', now);
  seedPresets.run(crypto.randomUUID(), 'Outlook', now);

  dbInstance = db;
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export const categoriesRepo = {
  getAll() {
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories ORDER BY is_preset DESC, name ASC').all();
  },

  getAllWithCounts() {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.id, c.name, c.is_preset, c.created_at, COUNT(a.id) AS account_count
      FROM categories c
      LEFT JOIN accounts a ON c.id = a.category_id
      GROUP BY c.id
      ORDER BY c.is_preset DESC, c.name COLLATE NOCASE ASC
    `).all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      is_preset: row.is_preset,
      created_at: row.created_at,
      accountCount: Number(row.account_count),
    }));
  },

  getById(id) {
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories WHERE id = ?').get(id);
  },

  getByName(name) {
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
  },

  create(name) {
    const db = getDb();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare('INSERT INTO categories (id, name, is_preset, created_at) VALUES (?, ?, 0, ?)').run(id, name, createdAt);
    return { id, name, is_preset: 0, created_at: createdAt };
  },

  delete(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export const accountsRepo = {
  getAll() {
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      ORDER BY a.created_at DESC
    `).all();
  },

  getById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `).get(id);
  },

  getByCategoryId(categoryId) {
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      WHERE a.category_id = ?
      ORDER BY a.created_at DESC
    `).all(categoryId);
  },

  create({ category_id, email, password, notes = '' }) {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, category_id, email, password, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, category_id, email, password, notes, now, now);
    return { id, category_id, email, password, notes, created_at: now, updated_at: now };
  },

  update(id, { category_id, email, password, notes }) {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    const updatedCategoryId = category_id !== undefined ? category_id : existing.category_id;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedPassword = password !== undefined ? password : existing.password;
    const updatedNotes = notes !== undefined ? notes : existing.notes;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE accounts
      SET category_id = ?, email = ?, password = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedCategoryId, updatedEmail, updatedPassword, updatedNotes, now, id);

    return this.getById(id);
  },

  delete(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return result.changes > 0;
  },
};
