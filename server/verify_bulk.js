const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = path.join(__dirname, 'tmp_verify_bulk.db');
const SESSION_DB = path.join(__dirname, 'tmp_verify_bulk-sessions.db');
const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'verify-pass-123';

const checks = [];
let child = null;
let serverLog = '';

function check(name, condition, detail) {
  const ok = Boolean(condition);
  checks.push({ name, ok });
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function makeClient() {
  let cookie = '';

  return async function request(method, route, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(`${BASE}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (typeof response.headers.getSetCookie === 'function') {
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0];
        if (pair.startsWith('spendwise.sid=')) cookie = pair;
      }
    }

    const text = await response.text();
    let data = null;
    if (text && (response.headers.get('content-type') || '').includes('json')) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = text;
      }
    }

    return { status: response.status, data, text };
  };
}

function readDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
      db.all(sql, params, (queryErr, rows) => {
        db.close();
        if (queryErr) reject(queryErr);
        else resolve(rows);
      });
    });
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child && child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}\n${serverLog}`);
    }
    try {
      const response = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch (err) {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server did not become healthy in time');
}

async function seed(client, type, amount, category, date, description) {
  const response = await client('POST', '/api/transactions', {
    type,
    amount,
    category,
    date,
    description,
  });
  if (response.status !== 201) {
    throw new Error(`Seed failed: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function seedRecurring(client, type, amount, category, frequency, nextOccurrence, description) {
  const response = await client('POST', '/api/recurring', {
    type,
    amount,
    category,
    frequency,
    nextOccurrence,
    description,
    isActive: true,
  });
  if (response.status !== 201) {
    throw new Error(`Recurring seed failed: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function run() {
  for (const file of [DB_PATH, SESSION_DB]) {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(`${file}${suffix}`)) fs.rmSync(`${file}${suffix}`);
    }
  }

  child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      SPENDWISE_DB_PATH: DB_PATH,
      PORT: String(PORT),
      SESSION_SECRET: 'verify-only-secret',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverLog += chunk.toString();
  });

  try {
    await waitForHealth();

    const anonymous = makeClient();
    const anonUpdate = await anonymous('PATCH', '/api/transactions/bulk', { ids: [1], date: '2026-01-01' });
    const anonDelete = await anonymous('POST', '/api/transactions/bulk-delete', { ids: [1] });
    const anonRecurringUpdate = await anonymous('PATCH', '/api/recurring/bulk', {
      ids: [1],
      nextOccurrence: '2026-01-01',
    });
    const anonRecurringDelete = await anonymous('POST', '/api/recurring/bulk-delete', { ids: [1] });
    check(
      'bulk endpoints require authentication',
      anonUpdate.status === 401 && anonDelete.status === 401,
      [anonUpdate.status, anonDelete.status]
    );
    check(
      'recurring bulk endpoints require authentication',
      anonRecurringUpdate.status === 401 && anonRecurringDelete.status === 401,
      [anonRecurringUpdate.status, anonRecurringDelete.status]
    );

    const userA = makeClient();
    const registerA = await userA('POST', '/api/auth/register', {
      name: 'Bulk A',
      email: 'bulk-a@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    check('user A registers', registerA.status === 201, registerA.data);

    const userB = makeClient();
    const registerB = await userB('POST', '/api/auth/register', {
      name: 'Bulk B',
      email: 'bulk-b@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    check('user B registers', registerB.status === 201, registerB.data);

    const a1 = await seed(userA, 'expense', 100, 'Food', '2026-10-01', 'A1 lunch');
    const a2 = await seed(userA, 'expense', 200, 'Transport', '2026-10-02', 'A2 bus');
    const a3 = await seed(userA, 'income', 5000, 'Salary', '2026-10-03', 'A3 salary');
    const a4 = await seed(userA, 'expense', 300, 'Food', '2026-10-04', 'A4 dinner');
    const a5 = await seed(userA, 'expense', 400, 'Bills', '2026-10-05', 'A5 power');
    const b1 = await seed(userB, 'expense', 999, 'Food', '2026-10-06', 'B1 private');
    check('seed transactions created', [a1, a2, a3, a4, a5, b1].every((row) => Number.isInteger(row.id)));

    // Future-dated on purpose: authenticated requests run due-recurring materialization,
    // which would otherwise advance these rows and add transactions mid-test.
    const r1 = await seedRecurring(userA, 'expense', 800, 'Food', 'monthly', '2099-10-10', 'R1 groceries');
    const r2 = await seedRecurring(userA, 'expense', 150, 'Transport', 'weekly', '2099-10-12', 'R2 metro');
    const r3 = await seedRecurring(userA, 'income', 6000, 'Salary', 'monthly', '2099-10-01', 'R3 pay');
    const rb1 = await seedRecurring(userB, 'expense', 700, 'Food', 'monthly', '2099-10-15', 'RB1 private');
    check(
      'seed recurring transactions created',
      [r1, r2, r3, rb1].every((row) => Number.isInteger(row.id))
    );

    const beforeRows = await readDb(
      'SELECT id, type, category, date, amount, description_encrypted FROM transactions WHERE user_id = ? ORDER BY id'
    , [registerA.data.user.id]);
    const beforeById = new Map(beforeRows.map((row) => [row.id, row]));

    const emptyIds = await userA('PATCH', '/api/transactions/bulk', { ids: [], date: '2026-09-01' });
    check('empty id list is rejected', emptyIds.status === 400, emptyIds.data);

    const tooMany = await userA('PATCH', '/api/transactions/bulk', {
      ids: Array.from({ length: 501 }, (_, i) => i + 1),
      date: '2026-09-01',
    });
    check('more than 500 ids is rejected', tooMany.status === 400, tooMany.data);

    const noFields = await userA('PATCH', '/api/transactions/bulk', { ids: [a1.id] });
    check('bulk update with no fields is rejected', noFields.status === 400, noFields.data);

    const invalidDate = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a1.id],
      date: '2026-13-40',
    });
    check('invalid date is rejected', invalidDate.status === 400, invalidDate.data);

    const typeConflict = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a1.id, a2.id],
      type: 'income',
    });
    check(
      'type-only update with incompatible categories is rejected',
      typeConflict.status === 400 && /compatible category/i.test(typeConflict.data.error || ''),
      typeConflict.data
    );

    const crossUserUpdate = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a1.id, b1.id],
      date: '2026-09-09',
    });
    check('bulk update rejects another user\'s transaction', crossUserUpdate.status === 404, crossUserUpdate.data);

    const afterCrossUser = await readDb(
      'SELECT id, date FROM transactions WHERE id IN (?, ?) ORDER BY id',
      [a1.id, b1.id]
    );
    check(
      'cross-user update changed nothing',
      afterCrossUser[0].date === '2026-10-01' && afterCrossUser[1].date === '2026-10-06',
      afterCrossUser
    );

    const dateUpdate = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a1.id, a2.id],
      date: '2026-09-15',
    });
    check(
      'date-only bulk update succeeds for both rows',
      dateUpdate.status === 200 &&
        dateUpdate.data.updated === 2 &&
        dateUpdate.data.transactions.length === 2,
      dateUpdate.data
    );

    const afterDate = await readDb(
      'SELECT id, date, amount, description_encrypted FROM transactions WHERE id IN (?, ?) ORDER BY id',
      [a1.id, a2.id]
    );
    check(
      'date-only update preserves amounts and encrypted descriptions',
      afterDate.every(
        (row) =>
          row.date === '2026-09-15' &&
          row.amount === beforeById.get(row.id).amount &&
          row.description_encrypted === beforeById.get(row.id).description_encrypted
      ),
      afterDate
    );

    const promoted = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a1.id],
      type: 'income',
      category: 'Salary',
    });
    check(
      'type and category can be changed together',
      promoted.status === 200 &&
        promoted.data.transactions[0].type === 'income' &&
        promoted.data.transactions[0].category === 'Salary',
      promoted.data
    );

    const mixedCategory = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a2.id, a3.id],
      category: 'Salary',
    });
    check(
      'category-only update across mixed types is rejected',
      mixedCategory.status === 400,
      mixedCategory.data
    );

    const duplicateIds = await userA('PATCH', '/api/transactions/bulk', {
      ids: [a4.id, a4.id],
      category: 'Bills',
    });
    check(
      'duplicate ids collapse to one update',
      duplicateIds.status === 200 && duplicateIds.data.updated === 1,
      duplicateIds.data
    );

    const crossUserDelete = await userA('POST', '/api/transactions/bulk-delete', {
      ids: [a5.id, b1.id],
    });
    check(
      'bulk delete rejects another user\'s transaction',
      crossUserDelete.status === 404,
      crossUserDelete.data
    );

    const remainingAfterCrossDelete = await readDb(
      'SELECT COUNT(*) AS c FROM transactions WHERE id IN (?, ?)',
      [a5.id, b1.id]
    );
    check('cross-user delete removed nothing', remainingAfterCrossDelete[0].c === 2, remainingAfterCrossDelete);

    const deleteResult = await userA('POST', '/api/transactions/bulk-delete', {
      ids: [a2.id, a4.id],
    });
    check(
      'bulk delete removes the selected rows',
      deleteResult.status === 200 && deleteResult.data.deleted === 2,
      deleteResult.data
    );

    const counts = await readDb(
      'SELECT user_id, COUNT(*) AS c FROM transactions GROUP BY user_id ORDER BY user_id'
    );
    check(
      'only user A rows were deleted and user B is intact',
      counts.length === 2 &&
        counts[0].c === 3 &&
        counts[1].c === 1,
      counts
    );

    const auditRows = await readDb(
      "SELECT action, detail FROM audit_logs WHERE user_id = ? AND action IN ('transactions_bulk_updated', 'transactions_bulk_deleted') ORDER BY id",
      [registerA.data.user.id]
    );
    const updateAudits = auditRows.filter((row) => row.action === 'transactions_bulk_updated');
    const deleteAudits = auditRows.filter((row) => row.action === 'transactions_bulk_deleted');
    check('bulk update audits are recorded', updateAudits.length === 3, auditRows);
    check('bulk delete audit is recorded', deleteAudits.length === 1, auditRows);
    check(
      'bulk audit details contain no amounts or emails',
      auditRows.every((row) => !/[₹@]/.test(row.detail || '')),
      auditRows
    );

    const recBefore = await readDb(
      'SELECT id, amount, description_encrypted, frequency, is_active FROM recurring_transactions WHERE user_id = ? ORDER BY id',
      [registerA.data.user.id]
    );
    const recBeforeById = new Map(recBefore.map((row) => [row.id, row]));

    const recEmpty = await userA('PATCH', '/api/recurring/bulk', {
      ids: [],
      nextOccurrence: '2026-09-01',
    });
    check('recurring bulk empty id list is rejected', recEmpty.status === 400, recEmpty.data);

    const recTooMany = await userA('PATCH', '/api/recurring/bulk', {
      ids: Array.from({ length: 501 }, (_, i) => i + 1),
      nextOccurrence: '2026-09-01',
    });
    check('recurring bulk more than 500 ids is rejected', recTooMany.status === 400, recTooMany.data);

    const recNoFields = await userA('PATCH', '/api/recurring/bulk', { ids: [r1.id] });
    check('recurring bulk update with no fields is rejected', recNoFields.status === 400, recNoFields.data);

    const recInvalidDate = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r1.id],
      nextOccurrence: '2026-13-40',
    });
    check('recurring bulk invalid date is rejected', recInvalidDate.status === 400, recInvalidDate.data);

    const recTypeConflict = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r1.id, r2.id],
      type: 'income',
    });
    check(
      'recurring type-only update with incompatible categories is rejected',
      recTypeConflict.status === 400 && /compatible category/i.test(recTypeConflict.data.error || ''),
      recTypeConflict.data
    );

    const recCrossUserUpdate = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r1.id, rb1.id],
      nextOccurrence: '2099-09-09',
    });
    check(
      'recurring bulk update rejects another user\'s schedule',
      recCrossUserUpdate.status === 404,
      recCrossUserUpdate.data
    );

    const recAfterCrossUser = await readDb(
      'SELECT id, next_occurrence FROM recurring_transactions WHERE id IN (?, ?) ORDER BY id',
      [r1.id, rb1.id]
    );
    check(
      'recurring cross-user update changed nothing',
      recAfterCrossUser[0].next_occurrence === '2099-10-10' &&
        recAfterCrossUser[1].next_occurrence === '2099-10-15',
      recAfterCrossUser
    );

    const recNextUpdate = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r1.id, r2.id],
      nextOccurrence: '2099-09-15',
    });
    check(
      'recurring next-occurrence update succeeds for both rows',
      recNextUpdate.status === 200 &&
        recNextUpdate.data.updated === 2 &&
        recNextUpdate.data.recurring.length === 2,
      recNextUpdate.data
    );

    const recAfterNext = await readDb(
      'SELECT id, next_occurrence, amount, description_encrypted, frequency, is_active FROM recurring_transactions WHERE id IN (?, ?) ORDER BY id',
      [r1.id, r2.id]
    );
    check(
      'recurring next-only update preserves amounts, encrypted descriptions, frequency and active state',
      recAfterNext.every(
        (row) =>
          row.next_occurrence === '2099-09-15' &&
          row.amount === recBeforeById.get(row.id).amount &&
          row.description_encrypted === recBeforeById.get(row.id).description_encrypted &&
          row.frequency === recBeforeById.get(row.id).frequency &&
          row.is_active === recBeforeById.get(row.id).is_active
      ),
      recAfterNext
    );

    const recPromoted = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r1.id],
      type: 'income',
      category: 'Salary',
    });
    check(
      'recurring type and category can be changed together',
      recPromoted.status === 200 &&
        recPromoted.data.recurring[0].type === 'income' &&
        recPromoted.data.recurring[0].category === 'Salary',
      recPromoted.data
    );

    const recMixedCategory = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r2.id, r3.id],
      category: 'Salary',
    });
    check(
      'recurring category-only update across mixed types is rejected',
      recMixedCategory.status === 400,
      recMixedCategory.data
    );

    const recDuplicateIds = await userA('PATCH', '/api/recurring/bulk', {
      ids: [r3.id, r3.id],
      category: 'Other Income',
    });
    check(
      'recurring duplicate ids collapse to one update',
      recDuplicateIds.status === 200 && recDuplicateIds.data.updated === 1,
      recDuplicateIds.data
    );

    const recCrossUserDelete = await userA('POST', '/api/recurring/bulk-delete', {
      ids: [r1.id, rb1.id],
    });
    check(
      'recurring bulk delete rejects another user\'s schedule',
      recCrossUserDelete.status === 404,
      recCrossUserDelete.data
    );

    const recRemainingAfterCrossDelete = await readDb(
      'SELECT COUNT(*) AS c FROM recurring_transactions WHERE id IN (?, ?)',
      [r1.id, rb1.id]
    );
    check(
      'recurring cross-user delete removed nothing',
      recRemainingAfterCrossDelete[0].c === 2,
      recRemainingAfterCrossDelete
    );

    const recDelete = await userA('POST', '/api/recurring/bulk-delete', {
      ids: [r2.id, r3.id],
    });
    check(
      'recurring bulk delete removes the selected rows',
      recDelete.status === 200 && recDelete.data.deleted === 2,
      recDelete.data
    );

    const recCounts = await readDb(
      'SELECT user_id, COUNT(*) AS c FROM recurring_transactions GROUP BY user_id ORDER BY user_id'
    );
    check(
      'only user A recurring rows were deleted and user B is intact',
      recCounts.length === 2 && recCounts[0].c === 1 && recCounts[1].c === 1,
      recCounts
    );

    const recAuditRows = await readDb(
      "SELECT action, detail FROM audit_logs WHERE user_id = ? AND action IN ('recurring_bulk_updated', 'recurring_bulk_deleted') ORDER BY id",
      [registerA.data.user.id]
    );
    check(
      'recurring bulk update audits are recorded',
      recAuditRows.filter((row) => row.action === 'recurring_bulk_updated').length === 3,
      recAuditRows
    );
    check(
      'recurring bulk delete audit is recorded',
      recAuditRows.filter((row) => row.action === 'recurring_bulk_deleted').length === 1,
      recAuditRows
    );
    check(
      'recurring bulk audit details contain no amounts or emails',
      recAuditRows.every((row) => !/[₹@]/.test(row.detail || '')),
      recAuditRows
    );

    child.kill();
    await new Promise((resolve) => {
      if (!child || child.exitCode !== null) {
        resolve();
        return;
      }
      child.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
    child = null;
  } finally {
    if (child) {
      child.kill();
      await new Promise((resolve) => {
        if (!child || child.exitCode !== null) {
          resolve();
          return;
        }
        child.once('exit', resolve);
        setTimeout(resolve, 5000);
      });
    }
    for (const file of [DB_PATH, SESSION_DB]) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          if (fs.existsSync(`${file}${suffix}`)) fs.rmSync(`${file}${suffix}`);
        } catch (err) {
          console.error(`cleanup warning: could not remove ${file}${suffix}: ${err.message}`);
        }
      }
    }
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.error(`\nServer log:\n${serverLog}`);
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('\nVerification aborted:', err.message);
  console.error(err.stack);
  if (child) child.kill();
  process.exitCode = 1;
});
