import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

let dbInstance = null;
let tursoClient = null;

export function initDb(dbPath = config.dbPath) {
  if (config.dbUrl) {
    if (!tursoClient) {
      tursoClient = createClient({
        url: config.dbUrl,
        authToken: config.dbAuthToken || undefined,
      });
      // Ensure tables exist on Turso asynchronously
      tursoClient.batch([
        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          is_preset INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );`,
        {
          sql: `INSERT OR IGNORE INTO categories (id, name, is_preset, created_at) VALUES (?, 'Google', 1, ?);`,
          args: [crypto.randomUUID(), new Date().toISOString()]
        },
        {
          sql: `INSERT OR IGNORE INTO categories (id, name, is_preset, created_at) VALUES (?, 'Outlook', 1, ?);`,
          args: [crypto.randomUUID(), new Date().toISOString()]
        }
      ], 'write').catch(console.error);
    }
    return tursoClient;
  }

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
  if (config.dbUrl) {
    if (!tursoClient) return initDb();
    return tursoClient;
  }
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb() {
  if (tursoClient) {
    tursoClient.close();
    tursoClient = null;
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export const categoriesRepo = {
  async getAll() {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute('SELECT id, name, is_preset, created_at FROM categories ORDER BY is_preset DESC, name ASC');
      return res.rows.map(r => ({ id: r.id, name: r.name, is_preset: r.is_preset, created_at: r.created_at }));
    }
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories ORDER BY is_preset DESC, name ASC').all();
  },

  async getAllWithCounts() {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute(`
        SELECT c.id, c.name, c.is_preset, c.created_at, COUNT(a.id) AS account_count
        FROM categories c
        LEFT JOIN accounts a ON c.id = a.category_id
        GROUP BY c.id
        ORDER BY c.is_preset DESC, c.name COLLATE NOCASE ASC
      `);
      return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        is_preset: r.is_preset,
        created_at: r.created_at,
        accountCount: Number(r.account_count || 0),
      }));
    }
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

  async getById(id) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({ sql: 'SELECT id, name, is_preset, created_at FROM categories WHERE id = ?', args: [id] });
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { id: r.id, name: r.name, is_preset: r.is_preset, created_at: r.created_at };
    }
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories WHERE id = ?').get(id);
  },

  async getByName(name) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({ sql: 'SELECT id, name, is_preset, created_at FROM categories WHERE LOWER(name) = LOWER(?)', args: [name] });
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { id: r.id, name: r.name, is_preset: r.is_preset, created_at: r.created_at };
    }
    const db = getDb();
    return db.prepare('SELECT id, name, is_preset, created_at FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
  },

  async create(name) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if (config.dbUrl) {
      const client = getDb();
      await client.execute({
        sql: 'INSERT INTO categories (id, name, is_preset, created_at) VALUES (?, ?, 0, ?)',
        args: [id, name, createdAt]
      });
      return { id, name, is_preset: 0, created_at: createdAt };
    }
    const db = getDb();
    db.prepare('INSERT INTO categories (id, name, is_preset, created_at) VALUES (?, ?, 0, ?)').run(id, name, createdAt);
    return { id, name, is_preset: 0, created_at: createdAt };
  },

  async delete(id) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
      return res.rowsAffected > 0;
    }
    const db = getDb();
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export const accountsRepo = {
  async getAll() {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute(`
        SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
        FROM accounts a
        JOIN categories c ON a.category_id = c.id
        ORDER BY a.created_at DESC
      `);
      return res.rows.map(r => ({
        id: r.id,
        category_id: r.category_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        category_name: r.category_name,
        email: r.email,
        password: r.password,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at
      }));
    }
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      ORDER BY a.created_at DESC
    `).all();
  },

  async getById(id) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({
        sql: `
          SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
          FROM accounts a
          JOIN categories c ON a.category_id = c.id
          WHERE a.id = ?
        `,
        args: [id]
      });
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        category_id: r.category_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        category_name: r.category_name,
        email: r.email,
        password: r.password,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    }
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `).get(id);
  },

  async getByCategoryId(categoryId) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({
        sql: `
          SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
          FROM accounts a
          JOIN categories c ON a.category_id = c.id
          WHERE a.category_id = ?
          ORDER BY a.created_at DESC
        `,
        args: [categoryId]
      });
      return res.rows.map(r => ({
        id: r.id,
        category_id: r.category_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        category_name: r.category_name,
        email: r.email,
        password: r.password,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at
      }));
    }
    const db = getDb();
    return db.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, a.email, a.password, a.notes, a.created_at, a.updated_at
      FROM accounts a
      JOIN categories c ON a.category_id = c.id
      WHERE a.category_id = ?
      ORDER BY a.created_at DESC
    `).all(categoryId);
  },

  async create({ category_id, email, password, notes = '' }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    if (config.dbUrl) {
      const client = getDb();
      await client.execute({
        sql: `INSERT INTO accounts (id, category_id, email, password, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, category_id, email, password, notes, now, now]
      });
      return { id, category_id, categoryId: category_id, email, password, notes, created_at: now, updated_at: now };
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO accounts (id, category_id, email, password, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, category_id, email, password, notes, now, now);
    return { id, category_id, email, password, notes, created_at: now, updated_at: now };
  },

  async update(id, { category_id, email, password, notes }) {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const updatedCategoryId = category_id !== undefined ? category_id : existing.category_id;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedPassword = password !== undefined ? password : existing.password;
    const updatedNotes = notes !== undefined ? notes : existing.notes;
    const now = new Date().toISOString();

    if (config.dbUrl) {
      const client = getDb();
      await client.execute({
        sql: `UPDATE accounts SET category_id = ?, email = ?, password = ?, notes = ?, updated_at = ? WHERE id = ?`,
        args: [updatedCategoryId, updatedEmail, updatedPassword, updatedNotes, now, id]
      });
      return this.getById(id);
    }

    const db = getDb();
    db.prepare(`
      UPDATE accounts
      SET category_id = ?, email = ?, password = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedCategoryId, updatedEmail, updatedPassword, updatedNotes, now, id);

    return this.getById(id);
  },

  async delete(id) {
    if (config.dbUrl) {
      const client = getDb();
      const res = await client.execute({ sql: 'DELETE FROM accounts WHERE id = ?', args: [id] });
      return res.rowsAffected > 0;
    }
    const db = getDb();
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

