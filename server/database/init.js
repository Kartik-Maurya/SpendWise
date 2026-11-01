const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getEncryptionKey, encrypt, verifyEncryption } = require('../utils/encryption');
const { redactDetail } = require('../utils/redact');

const dbPath = process.env.SPENDWISE_DB_PATH
  ? path.resolve(process.env.SPENDWISE_DB_PATH)
  : path.join(__dirname, 'spendwise.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

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
    verifyEncryption();

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
        description_encrypted TEXT,
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

    await run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK (amount > 0),
        category TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const txColumns2 = await all('PRAGMA table_info(transactions)');
    const txColNames2 = txColumns2.map((c) => c.name);
    if (!txColNames2.includes('recurring_id')) {
      await run('ALTER TABLE transactions ADD COLUMN recurring_id INTEGER');
    }

    await run(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

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

    await run(`
      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        year INTEGER NOT NULL,
        income_assumption REAL,
        savings_target REAL,
        objective TEXT NOT NULL DEFAULT 'savings' CHECK (objective IN ('savings', 'overrun')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, month, year)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS budget_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        batch_id TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        category TEXT NOT NULL,
        objective TEXT,
        current_amount REAL,
        proposed_amount REAL NOT NULL,
        delta REAL NOT NULL,
        reason TEXT,
        evidence_json TEXT,
        confidence TEXT,
        status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'applied', 'dismissed')),
        created_at TEXT DEFAULT (datetime('now')),
        applied_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

    if (!txColNames.includes('is_essential')) {
      await run('ALTER TABLE transactions ADD COLUMN is_essential INTEGER');
    }

    if (!txColNames.includes('merchant')) {
      await run('ALTER TABLE transactions ADD COLUMN merchant TEXT');
    }

    const recurringColumns = await all('PRAGMA table_info(recurring_transactions)');
    const recurringColNames = recurringColumns.map((c) => c.name);
    if (!recurringColNames.includes('description_encrypted')) {
      await run('ALTER TABLE recurring_transactions ADD COLUMN description_encrypted TEXT');
    }

    const userColumns = await all('PRAGMA table_info(users)');
    if (!userColumns.some((column) => column.name === 'password_changed_at')) {
      await run('ALTER TABLE users ADD COLUMN password_changed_at TEXT');
    }

    for (const table of ['transactions', 'budgets', 'recurring_transactions', 'plans']) {
      const columns = await all(`PRAGMA table_info(${table})`);
      if (!columns.some((column) => column.name === 'is_demo')) {
        await run(`ALTER TABLE ${table} ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`);
      }
    }

    await run(
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_type_category_date ON transactions(user_id, type, category, date)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_budget_recs_user_period ON budget_recommendations(user_id, year, month)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_recurring_user_active_due ON recurring_transactions(user_id, is_active, next_occurrence)'
    );
    await run(
      'CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs(user_id, created_at)'
    );

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
    let encryptedDescriptions = 0;
    for (const row of rows) {
      if (row.description) {
        const encrypted = encrypt(row.description, encKey);
        await run(
          'UPDATE transactions SET description_encrypted = ?, description = NULL WHERE id = ?',
          [encrypted, row.id]
        );
        encryptedDescriptions += 1;
      }
    }

    await run(
      'UPDATE transactions SET description = NULL WHERE description_encrypted IS NOT NULL AND description IS NOT NULL'
    );

    const recurringRows = await all(
      "SELECT id, description FROM recurring_transactions WHERE description IS NOT NULL AND description <> '' AND description_encrypted IS NULL"
    );
    let encryptedRecurring = 0;
    for (const row of recurringRows) {
      const encrypted = encrypt(row.description, encKey);
      await run(
        "UPDATE recurring_transactions SET description_encrypted = ?, description = '' WHERE id = ?",
        [encrypted, row.id]
      );
      encryptedRecurring += 1;
    }

    const auditRows = await all(
      "SELECT id, detail FROM audit_logs WHERE detail IS NOT NULL AND (detail LIKE '%@%' OR detail LIKE '%₹%')"
    );
    let redactedAuditRows = 0;
    for (const row of auditRows) {
      const redacted = redactDetail(row.detail);
      if (redacted !== row.detail) {
        await run('UPDATE audit_logs SET detail = ? WHERE id = ?', [redacted, row.id]);
        redactedAuditRows += 1;
      }
    }

    console.log('[migration] Database initialized and migrated successfully');
    if (encryptedDescriptions > 0) {
      console.log('[migration] Encrypted %d plaintext transaction description(s)', encryptedDescriptions);
    }
    if (encryptedRecurring > 0) {
      console.log('[migration] Encrypted %d plaintext recurring description(s)', encryptedRecurring);
    }
    if (redactedAuditRows > 0) {
      console.log('[migration] Redacted %d audit detail entr(ies)', redactedAuditRows);
    }
    resolveReady();
  } catch (err) {
    console.error('[migration] Migration failed:', err.message);
    rejectReady(err);
  }
}

migrate();

db.ready = ready;
db.dbPath = dbPath;
module.exports = db;
