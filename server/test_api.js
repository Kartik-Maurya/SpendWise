require('dotenv').config();
const http = require('http');
const db = require('./database/init');

const BASE_URL = 'http://localhost:5000/api';
let cookie = '';
let pass = 0;
let fail = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  \u2713 ${name}`);
      pass++;
    } catch (err) {
      console.log(`  \u2717 ${name}: ${err.message}`);
      fail++;
    }
  };
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const req = http.request(`${BASE_URL}${path}`, { method, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        if (res.headers['set-cookie'] && !cookie) {
          cookie = res.headers['set-cookie'][0].split(';')[0];
        }
        try {
          resolve({ status: res.statusCode, data: chunks ? JSON.parse(chunks) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

function assertTruthy(val, msg) {
  if (!val) throw new Error(msg || 'Expected truthy value');
}

function getLocalToday() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
}

async function runTests() {
  const { addFrequency } = require('./utils/recurringProcessor');

  console.log('\nSpendWise API Tests\n====================\n');

  const tests = [];

  tests.push(test('Health check returns OK', async () => {
    const res = await request('GET', '/health');
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.data.status, 'ok', 'Status field');
  }));

  tests.push(test('Login with default credentials', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'local@spendwise.app',
      password: 'changeme123',
    });
    assertEqual(res.status, 200, 'Login status');
    assertTruthy(res.data.user, 'User object');
    assertEqual(res.data.user.email, 'local@spendwise.app', 'Email');
  }));

  tests.push(test('Auth/me returns authenticated user', async () => {
    const res = await request('GET', '/auth/me');
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.data.user.email, 'local@spendwise.app', 'Email');
  }));

  tests.push(test('Transaction summary works', async () => {
    const res = await request('GET', '/transactions/summary');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(res.data.balance !== undefined, 'Balance field');
    assertTruthy(res.data.income !== undefined, 'Income field');
    assertTruthy(res.data.expense !== undefined, 'Expense field');
  }));

  tests.push(test('GET /transactions returns array', async () => {
    const res = await request('GET', '/transactions');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(Array.isArray(res.data), 'Returns array');
  }));

  tests.push(test('GET /transactions/:id returns single transaction', async () => {
    const txs = await request('GET', '/transactions');
    if (txs.data.length > 0) {
      const id = txs.data[0].id;
      const res = await request('GET', `/transactions/${id}`);
      assertEqual(res.status, 200, 'Status');
      assertEqual(res.data.id, id, 'ID match');
    }
  }));

  tests.push(test('GET /analytics/summary works', async () => {
    const res = await request('GET', '/analytics/summary');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(res.data.highestSpendingCategory, 'highestSpendingCategory');
  }));

  tests.push(test('GET /analytics/spending-by-category works', async () => {
    const res = await request('GET', '/analytics/spending-by-category');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(Array.isArray(res.data), 'Returns array');
  }));

  tests.push(test('GET /analytics/monthly-spending works', async () => {
    const res = await request('GET', '/analytics/monthly-spending');
    assertEqual(res.status, 200, 'Status');
  }));

  tests.push(test('GET /analytics/income-vs-expenses works', async () => {
    const res = await request('GET', '/analytics/income-vs-expenses');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(res.data.income !== undefined, 'Income');
    assertTruthy(res.data.expense !== undefined, 'Expense');
  }));

  tests.push(test('Create due recurring transaction', async () => {
    const res = await request('POST', '/recurring', {
      description: 'TEST_RECURRING_DUE',
      type: 'expense',
      amount: 100,
      category: 'Food',
      frequency: 'weekly',
      nextOccurrence: getLocalToday(),
      isActive: true,
    });
    assertEqual(res.status, 201, 'Status');
    assertEqual(res.data.description, 'TEST_RECURRING_DUE', 'Description');
  }));

  tests.push(test('Due recurring generates transaction', async () => {
    await request('GET', '/auth/me');
    const txs = await request('GET', '/transactions');
    let generated = txs.data.find((t) => {
      try { return t.description === 'TEST_RECURRING_DUE'; } catch (e) { return false; }
    });
    assertTruthy(generated, 'Transaction should be generated from due recurring');
    assertTruthy(generated.recurring_id != null, 'Generated transaction should have recurring_id');
  }));

  tests.push(test('next_occurrence advances after generation', async () => {
    const recurring = await request('GET', '/recurring');
    const tmpl = recurring.data.find((r) => r.description === 'TEST_RECURRING_DUE');
    assertTruthy(tmpl, 'Template exists');
    assertTruthy(tmpl.next_occurrence !== getLocalToday(), 'next_occurrence should be advanced past today');
  }));

  tests.push(test('No duplicate on re-processing', async () => {
    const before = await request('GET', '/transactions/summary');
    const beforeCount = before.data.transactionCount;
    await request('GET', '/auth/me');
    await request('GET', '/auth/me');
    await request('GET', '/auth/me');
    const after = await request('GET', '/transactions/summary');
    assertEqual(after.data.transactionCount, beforeCount, 'Transaction count should not change');
  }));

  tests.push(test('Monthly advance adds 1 month', async () => {
    assertEqual(addFrequency('2024-01-15', 'monthly'), '2024-02-15', 'Monthly advance');
  }));

  tests.push(test('Weekly advance adds 7 days', async () => {
    assertEqual(addFrequency('2024-01-15', 'weekly'), '2024-01-22', 'Weekly advance');
  }));

  tests.push(test('Yearly advance adds 1 year', async () => {
    assertEqual(addFrequency('2024-01-15', 'yearly'), '2025-01-15', 'Yearly advance');
  }));

  tests.push(test('Future recurring does not generate', async () => {
    const res = await request('POST', '/recurring', {
      description: 'TEST_RECURRING_FUTURE',
      type: 'income',
      amount: 999,
      category: 'Salary',
      frequency: 'monthly',
      nextOccurrence: '2027-12-31',
      isActive: true,
    });
    assertEqual(res.status, 201, 'Create status');
    await request('GET', '/auth/me');
    const txs = await request('GET', '/transactions');
    const generated = txs.data.find((t) => {
      try { return t.description === 'TEST_RECURRING_FUTURE'; } catch (e) { return false; }
    });
    assertTruthy(!generated, 'Future recurring should NOT generate transaction');
  }));

  tests.push(test('Inactive recurring does not generate', async () => {
    const res = await request('POST', '/recurring', {
      description: 'TEST_RECURRING_INACTIVE',
      type: 'income',
      amount: 888,
      category: 'Salary',
      frequency: 'weekly',
      nextOccurrence: getLocalToday(),
      isActive: false,
    });
    assertEqual(res.status, 201, 'Create status');
    await request('GET', '/auth/me');
    const txs = await request('GET', '/transactions');
    const generated = txs.data.find((t) => {
      try { return t.description === 'TEST_RECURRING_INACTIVE'; } catch (e) { return false; }
    });
    assertTruthy(!generated, 'Inactive recurring should NOT generate transaction');
  }));

  tests.push(test('Edit normal transaction to recurring creates schedule', async () => {
    const txRes = await request('POST', '/transactions', {
      type: 'expense',
      amount: 50,
      category: 'Food',
      description: 'TEST_EDIT_TO_RECURRING',
      date: getLocalToday(),
    });
    assertEqual(txRes.status, 201, 'Create transaction status');
    const txId = txRes.data.id;

    const recRes = await request('POST', '/recurring', {
      description: 'TEST_EDIT_TO_RECURRING',
      type: 'expense',
      amount: 50,
      category: 'Food',
      frequency: 'weekly',
      nextOccurrence: getLocalToday(),
      isActive: true,
    });
    assertEqual(recRes.status, 201, 'Create recurring status');
    const recId = recRes.data.id;

    const updRes = await request('PUT', `/transactions/${txId}`, {
      type: 'expense',
      amount: 50,
      category: 'Food',
      description: 'TEST_EDIT_TO_RECURRING',
      date: getLocalToday(),
      recurring_id: recId,
    });
    assertEqual(updRes.status, 200, 'Update status');
    assertEqual(updRes.data.recurring_id, recId, 'Should have recurring_id');

    const recurring = await request('GET', '/recurring');
    const found = recurring.data.find((r) => r.description === 'TEST_EDIT_TO_RECURRING');
    assertTruthy(found, 'Recurring schedule should exist');
    assertEqual(found.frequency, 'weekly', 'Frequency should match');
  }));

  tests.push(test('Edit transaction already linked to recurring updates schedule (no duplicate)', async () => {
    const txRes = await request('POST', '/transactions', {
      type: 'expense',
      amount: 75,
      category: 'Food',
      description: 'TEST_EDIT_EXISTING_RECURRING',
      date: getLocalToday(),
    });
    assertEqual(txRes.status, 201, 'Create transaction status');
    const txId = txRes.data.id;

    const recRes = await request('POST', '/recurring', {
      description: 'TEST_EDIT_EXISTING_RECURRING',
      type: 'expense',
      amount: 75,
      category: 'Food',
      frequency: 'monthly',
      nextOccurrence: getLocalToday(),
      isActive: true,
    });
    assertEqual(recRes.status, 201, 'Create recurring status');
    const recId = recRes.data.id;

    const linkRes = await request('PUT', `/transactions/${txId}`, {
      type: 'expense',
      amount: 75,
      category: 'Food',
      description: 'TEST_EDIT_EXISTING_RECURRING',
      date: getLocalToday(),
      recurring_id: recId,
    });
    assertEqual(linkRes.status, 200, 'Link recurring status');
    assertEqual(linkRes.data.recurring_id, recId, 'recurring_id should match');

    const updRes = await request('PUT', `/recurring/${recId}`, {
      description: 'TEST_EDIT_EXISTING_RECURRING',
      type: 'expense',
      amount: 75,
      category: 'Food',
      frequency: 'yearly',
      nextOccurrence: getLocalToday(),
      isActive: true,
    });
    assertEqual(updRes.status, 200, 'Update recurring status');
    assertEqual(updRes.data.frequency, 'yearly', 'Frequency should be updated');

    const recurring = await request('GET', '/recurring');
    const matches = recurring.data.filter((r) => r.description === 'TEST_EDIT_EXISTING_RECURRING');
    assertEqual(matches.length, 1, 'Should not create duplicate recurring');
  }));

  tests.push(test('GET /transactions/:id includes recurring_id after linking', async () => {
    const txRes = await request('POST', '/transactions', {
      type: 'expense',
      amount: 25,
      category: 'Food',
      description: 'TEST_RECURRING_ID_FIELD',
      date: getLocalToday(),
    });
    assertEqual(txRes.status, 201, 'Create transaction status');
    const txId = txRes.data.id;

    const recRes = await request('POST', '/recurring', {
      description: 'TEST_RECURRING_ID_FIELD',
      type: 'expense',
      amount: 25,
      category: 'Food',
      frequency: 'weekly',
      nextOccurrence: getLocalToday(),
      isActive: true,
    });
    assertEqual(recRes.status, 201, 'Create recurring status');

    const linkRes = await request('PUT', `/transactions/${txId}`, {
      type: 'expense',
      amount: 25,
      category: 'Food',
      description: 'TEST_RECURRING_ID_FIELD',
      date: getLocalToday(),
      recurring_id: recRes.data.id,
    });
    assertEqual(linkRes.status, 200, 'Link status');

    const getRes = await request('GET', `/transactions/${txId}`);
    assertEqual(getRes.status, 200, 'Get status');
    assertEqual(getRes.data.recurring_id, recRes.data.id, 'recurring_id should be returned');
  }));

  tests.push(test('GET /budgets works', async () => {
    const res = await request('GET', '/budgets');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(Array.isArray(res.data), 'Returns array');
  }));

  tests.push(test('GET /export/csv works', async () => {
    const res = await request('GET', '/export/csv');
    assertEqual(res.status, 200, 'Status');
  }));

  tests.push(test('GET /audit works', async () => {
    const res = await request('GET', '/audit?page=1&limit=20');
    assertEqual(res.status, 200, 'Status');
    assertTruthy(res.data.logs !== undefined, 'Logs field');
    assertTruthy(res.data.pagination !== undefined, 'Pagination field');
  }));

  tests.push(test('Logout works', async () => {
    const res = await request('POST', '/auth/logout');
    assertEqual(res.status, 200, 'Status');
  }));

  tests.push(test('401 after logout', async () => {
    cookie = '';
    const res = await request('GET', '/transactions/summary');
    assertEqual(res.status, 401, 'Should return 401');
  }));

  console.log('');
  for (const t of tests) await t();

  console.log(`\n====================`);
  console.log(`Results: ${pass} passed, ${fail} failed of ${tests.length} total`);
  console.log(`====================\n`);

  // Cleanup test data
  await request('POST', '/auth/login', {
    email: 'local@spendwise.app',
    password: 'changeme123',
  });
  const _recurring = await request('GET', '/recurring');
  if (Array.isArray(_recurring.data)) {
    for (const _r of _recurring.data) {
      if (_r.description.startsWith('TEST_')) {
        await request('DELETE', `/recurring/${_r.id}`);
      }
    }
  }
  const _txs = await request('GET', '/transactions');
  if (Array.isArray(_txs.data)) {
    for (const _tx of _txs.data) {
      if (_tx.description.startsWith('TEST_')) {
        await request('DELETE', `/transactions/${_tx.id}`);
      }
    }
  }

  await new Promise((r) => setTimeout(r, 500));
  process.exit(fail > 0 ? 1 : 0);
}

db.ready.then(runTests).catch((err) => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});
