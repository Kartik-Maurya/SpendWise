const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { getEncryptionKey, encrypt } = require('../utils/encryption');

const dbPath = path.join(__dirname, 'spendwise.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    process.exit(1);
  }
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

let resolveReady, rejectReady;
const ready = new Promise((res, rej) => {
  resolveReady = res;
  rejectReady = rej;
});

async function migrate() {
  try {
    const encKey = getEncryptionKey();

    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        year INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, category, month, year)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK (amount > 0),
        category TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
        next_occurrence TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const txColumns2 = await all('PRAGMA table_info(transactions)');
    const txColNames2 = txColumns2.map((c) => c.name);
    if (!txColNames2.includes('recurring_id')) {
      await run('ALTER TABLE transactions ADD COLUMN recurring_id INTEGER');
    }

    await run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource TEXT,
        detail TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    const txColumns = await all('PRAGMA table_info(transactions)');
    const txColNames = txColumns.map((c) => c.name);

    if (!txColNames.includes('user_id')) {
      await run('ALTER TABLE transactions ADD COLUMN user_id INTEGER');
    }

    if (!txColNames.includes('description_encrypted')) {
      await run('ALTER TABLE transactions ADD COLUMN description_encrypted TEXT');
    }

    let defaultUser = await get(
      'SELECT id FROM users WHERE email = ?',
      ['local@spendwise.app']
    );
    if (!defaultUser) {
      const hashedPassword = await bcrypt.hash('changeme123', 12);
      const result = await run(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        ['Local User', 'local@spendwise.app', hashedPassword]
      );
      defaultUser = { id: result.lastID };
      console.log('--------------------------------------------------------------');
      console.log('Created default local user for migrated v1 data:');
      console.log('  Email:    local@spendwise.app');
      console.log('  Password: changeme123');
      console.log('  Please log in and change this password immediately.');
      console.log('--------------------------------------------------------------');
    } else {
      console.log('Existing local user found (id=%d), reusing for migrated data.', defaultUser.id);
    }

    await run(
      'UPDATE transactions SET user_id = ? WHERE user_id IS NULL',
      [defaultUser.id]
    );

    const rows = await all(
      "SELECT id, description FROM transactions WHERE description IS NOT NULL AND description_encrypted IS NULL"
    );
    for (const row of rows) {
      if (row.description) {
        const encrypted = encrypt(row.description, encKey);
        await run(
          'UPDATE transactions SET description_encrypted = ?, description = NULL WHERE id = ?',
          [encrypted, row.id]
        );
      }
    }

    await run(
      'UPDATE transactions SET description = NULL WHERE description_encrypted IS NOT NULL AND description IS NOT NULL'
    );

    console.log('[migration] Database initialized and migrated successfully');
    if (rows.length > 0) {
      console.log('[migration] Encrypted %d plaintext descriptions', rows.length);
    }
    resolveReady();
  } catch (err) {
    console.error('[migration] Migration failed:', err.message);
    rejectReady(err);
  }
}

migrate();

db.ready = ready;
module.exports = db;
