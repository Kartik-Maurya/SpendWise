const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { encrypt, decrypt } = require('../utils/encryption');

const apply = process.argv.includes('--apply');
const dbPath = process.env.SPENDWISE_DB_PATH
  ? path.resolve(process.env.SPENDWISE_DB_PATH)
  : path.join(__dirname, '..', 'database', 'spendwise.db');

function fail(message) {
  console.error(`[reencrypt] ${message}`);
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  fail(
    'Set ENCRYPTION_KEY to the NEW key before rotating. ' +
      'Set ENCRYPTION_KEY_PREVIOUS to the old key(s), comma separated.'
  );
}

const currentKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (currentKey.length !== 32) {
  fail('ENCRYPTION_KEY must decode to exactly 32 bytes.');
}

if (!fs.existsSync(dbPath)) {
  fail(`Database not found at ${dbPath}`);
}

const db = new sqlite3.Database(dbPath);
const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    })
  );
const close = () => new Promise((resolve) => db.close(resolve));

async function hasColumn(table, column) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function collectCiphertextJobs(table, options = {}) {
  const rows = await all(
    `SELECT id, description_encrypted AS value FROM ${table} WHERE description_encrypted IS NOT NULL AND description_encrypted <> ''`
  );
  const jobs = { rotate: [], alreadyCurrent: [], unreadable: [] };

  for (const row of rows) {
    try {
      decrypt(row.value, currentKey);
      jobs.alreadyCurrent.push(row.id);
      continue;
    } catch (err) {
      // Fall through and try every configured key, including previous ones.
    }
    try {
      const plaintext = decrypt(row.value);
      if (plaintext === null || plaintext === '') {
        jobs.unreadable.push(row.id);
        continue;
      }
      jobs.rotate.push({ id: row.id, plaintext });
    } catch (err) {
      jobs.unreadable.push(row.id);
    }
  }

  let legacy = [];
  if (options.legacyDescription) {
    legacy = await all(
      `SELECT id, description FROM ${table} WHERE description IS NOT NULL AND description <> '' AND (description_encrypted IS NULL OR description_encrypted = '')`
    );
  }

  return { ...jobs, legacy };
}

async function main() {
  console.log(`[reencrypt] Database: ${dbPath}`);
  console.log(`[reencrypt] Mode: ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);

  const txHasEncrypted = await hasColumn('transactions', 'description_encrypted');
  const recurringHasEncrypted = await hasColumn('recurring_transactions', 'description_encrypted');

  if (!txHasEncrypted) {
    fail('transactions.description_encrypted does not exist. Start the server once to migrate.');
  }

  const transactions = await collectCiphertextJobs('transactions', {
    legacyDescription: true,
  });
  const recurring = recurringHasEncrypted
    ? await collectCiphertextJobs('recurring_transactions', { legacyDescription: true })
    : { rotate: [], alreadyCurrent: [], unreadable: [], legacy: [] };

  const totalRotate = transactions.rotate.length + recurring.rotate.length;
  const totalLegacy = transactions.legacy.length + recurring.legacy.length;
  const unreadable = [...transactions.unreadable, ...recurring.unreadable];

  console.log(`[reencrypt] Transactions already on the current key: ${transactions.alreadyCurrent.length}`);
  console.log(`[reencrypt] Transaction rows to re-encrypt: ${transactions.rotate.length}`);
  console.log(`[reencrypt] Legacy plaintext transaction rows: ${transactions.legacy.length}`);
  if (recurringHasEncrypted) {
    console.log(`[reencrypt] Recurring rows already on the current key: ${recurring.alreadyCurrent.length}`);
    console.log(`[reencrypt] Recurring rows to re-encrypt: ${recurring.rotate.length}`);
    console.log(`[reencrypt] Legacy plaintext recurring rows: ${recurring.legacy.length}`);
  }
  if (unreadable.length) {
    console.log(`[reencrypt] Rows that no configured key can read: ${unreadable.join(', ')}`);
  }

  if (!totalRotate && !totalLegacy) {
    console.log('[reencrypt] Nothing to do.');
    await close();
    return;
  }

  if (!apply) {
    console.log('[reencrypt] Dry run complete. Nothing was written.');
    await close();
    return;
  }

  if (unreadable.length) {
    fail(
      'Refusing to apply while rows are unreadable. Add the old key to ENCRYPTION_KEY_PREVIOUS and retry.'
    );
  }

  const backupPath = `${dbPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await run('VACUUM INTO ?', [backupPath]);
  console.log(`[reencrypt] Backup written to ${backupPath}`);

  await run('BEGIN IMMEDIATE');
  try {
    for (const job of transactions.rotate) {
      await run('UPDATE transactions SET description_encrypted = ? WHERE id = ?', [
        encrypt(job.plaintext, currentKey),
        job.id,
      ]);
    }
    for (const row of transactions.legacy) {
      await run(
        'UPDATE transactions SET description_encrypted = ?, description = NULL WHERE id = ?',
        [encrypt(row.description, currentKey), row.id]
      );
    }
    for (const job of recurring.rotate) {
      await run('UPDATE recurring_transactions SET description_encrypted = ? WHERE id = ?', [
        encrypt(job.plaintext, currentKey),
        job.id,
      ]);
    }
    for (const row of recurring.legacy) {
      await run(
        "UPDATE recurring_transactions SET description_encrypted = ?, description = '' WHERE id = ?",
        [encrypt(row.description, currentKey), row.id]
      );
    }
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    fail(`Rotation failed and was rolled back: ${err.message}`);
  }

  console.log('[reencrypt] Rotation applied successfully.');
  console.log('[reencrypt] Remove ENCRYPTION_KEY_PREVIOUS after verifying the app can read all descriptions.');
  await close();
}

main().catch(async (err) => {
  console.error('[reencrypt] Failed:', err.message);
  try {
    await close();
  } catch (err2) {
    // ignore
  }
  process.exit(1);
});
