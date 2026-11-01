const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { csvEscape } = require('./utils/csv');

const PORT = 5097;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(__dirname, 'tmp_verify_dataset_import.db');
const SESSION_DB = path.join(__dirname, 'tmp_verify_dataset_import-sessions.db');
const EMAIL = 'import.verify@spendwise.test';
const PASSWORD = 'verify-pass-123';
const MONTH = 10;
const YEAR = 2026;

const checks = [];
let server = null;

function check(name, condition, detail) {
  const ok = Boolean(condition);
  checks.push({ name, ok });
  if (ok) console.log(`PASS  ${name}`);
  else console.error(`FAIL  ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
}

function removeFile(file) {
  try {
    if (fs.existsSync(file)) fs.rmSync(file);
  } catch (err) {
    console.error(`cleanup warning: could not remove ${file}: ${err.message}`);
  }
}

function cleanup() {
  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`, SESSION_DB]) removeFile(file);
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: {
        ...process.env,
        PORT: String(PORT),
        SPENDWISE_DB_PATH: DB_PATH,
        SESSION_SECRET: 'verify-dataset-import-session-secret-key',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes(`port ${PORT}`)) resolve();
    });
    server.stderr.on('data', () => {});
    server.on('exit', (code) => reject(new Error(`Server exited with code ${code}`)));
  });
}

function makeClient() {
  let cookie = '';

  async function request(method, route, body) {
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
    if ((response.headers.get('content-type') || '').includes('json')) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } else {
      data = text;
    }

    return { status: response.status, data, text };
  }

  return request;
}

function appendRows(csv, rows) {
  return `${csv.replace(/\r?\n$/, '')}\n${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}`;
}

async function main() {
  cleanup();
  await startServer();

  const client = makeClient();
  const anonymous = makeClient();

  const health = await fetch(`${BASE}/api/health`);
  check('isolated server is healthy', health.status === 200);

  const register = await client('POST', '/api/auth/register', {
    name: 'Import Verify',
    email: EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
  check('register succeeds', register.status === 201, register.data);

  // --- Seed recurring schedules ---
  const recurringSeed = [
    {
      description: 'Rent payment',
      type: 'expense',
      amount: 18000,
      category: 'Bills',
      frequency: 'monthly',
      nextOccurrence: '2026-11-01',
      isActive: true,
    },
    {
      description: 'Freelance retainer',
      type: 'income',
      amount: 12000,
      category: 'Freelance',
      frequency: 'monthly',
      nextOccurrence: '2026-11-05',
      isActive: false,
    },
  ];
  for (const item of recurringSeed) {
    const response = await client('POST', '/api/recurring', item);
    if (response.status !== 201) {
      throw new Error(`Recurring seed failed: ${JSON.stringify(response.data)}`);
    }
  }

  const recurringExport = await client('GET', '/api/export/csv?dataset=recurring');
  check(
    'recurring export has the importable header',
    recurringExport.status === 200 &&
      recurringExport.text.includes('Type,Amount,Category,Description,Frequency,Next Occurrence,Status,Created At'),
    recurringExport.text.slice(0, 160)
  );

  const recurringRoundTrip = await client('POST', '/api/recurring/import', {
    csv: recurringExport.text,
  });
  check(
    'recurring round-trip skips existing schedules',
    recurringRoundTrip.status === 201 &&
      recurringRoundTrip.data.imported === 0 &&
      recurringRoundTrip.data.duplicates === 2 &&
      recurringRoundTrip.data.rejected === 0,
    recurringRoundTrip.data
  );

  const recurringExtraCsv = appendRows(recurringExport.text, [
    ['expense', '250', 'Food', "'=SUM(A1:A2)", 'monthly', '2026-11-15', 'Active', '2026-10-31 10:00:00'],
    ['expense', '99', 'Food', 'Gym', 'daily', '2026-11-20', 'Active', '2026-10-31 10:00:00'],
    ['expense', '••••••••', 'Food', 'Masked run', 'monthly', '2026-11-21', 'Active', '2026-10-31 10:00:00'],
  ]);
  const recurringExtra = await client('POST', '/api/recurring/import', { csv: recurringExtraCsv });
  check(
    'recurring import adds valid rows and rejects invalid ones',
    recurringExtra.status === 201 &&
      recurringExtra.data.imported === 1 &&
      recurringExtra.data.duplicates === 2 &&
      recurringExtra.data.rejected === 2,
    recurringExtra.data
  );

  const recurringList = await client('GET', '/api/recurring');
  const formulaRow = Array.isArray(recurringList.data)
    ? recurringList.data.find((row) => row.description === '=SUM(A1:A2)')
    : null;
  check(
    'formula-guarded descriptions are restored without the apostrophe',
    Boolean(formulaRow) && formulaRow.amount === 250,
    recurringList.data
  );

  const maskedRecurringCsv = await client('GET', '/api/export/csv?dataset=recurring&privacy=1');
  const maskedRecurringImport = await client('POST', '/api/recurring/import', {
    csv: maskedRecurringCsv.text,
  });
  check(
    'masked recurring exports are rejected on import',
    maskedRecurringImport.status === 201 &&
      maskedRecurringImport.data.imported === 0 &&
      maskedRecurringImport.data.rejected === 3,
    maskedRecurringImport.data
  );

  // --- Seed budgets ---
  for (const [category, amount] of [
    ['Food', 5000],
    ['Bills', 2000],
  ]) {
    const response = await client('POST', '/api/budgets', {
      category,
      amount,
      month: MONTH,
      year: YEAR,
    });
    if (response.status !== 201) {
      throw new Error(`Budget seed failed: ${JSON.stringify(response.data)}`);
    }
  }

  const budgetExport = await client('GET', '/api/export/csv?dataset=budgets');
  check(
    'budget export has the importable header',
    budgetExport.status === 200 &&
      budgetExport.text.includes('Month,Year,Category,Amount,Created At'),
    budgetExport.text.slice(0, 160)
  );

  const budgetCsv = appendRows(budgetExport.text, [
    [MONTH, YEAR, 'Food', '6500', '2026-10-31 10:00:00'],
    [MONTH, YEAR, 'Bills', '2000', '2026-10-31 10:00:00'],
    [MONTH + 1, YEAR, 'Transport', '1500', '2026-10-31 10:00:00'],
    ['13', YEAR, 'Health', '900', '2026-10-31 10:00:00'],
  ]);
  const budgetImport = await client('POST', '/api/budgets/import', { csv: budgetCsv });
  check(
    'budget import updates, inserts, skips and rejects correctly',
    budgetImport.status === 201 &&
      budgetImport.data.imported === 1 &&
      budgetImport.data.updated === 1 &&
      budgetImport.data.duplicates === 3 &&
      budgetImport.data.rejected === 1,
    budgetImport.data
  );

  const currentBudgets = await client('GET', `/api/budgets?month=${MONTH}&year=${YEAR}`);
  const foodBudget = currentBudgets.data.find((row) => row.category === 'Food');
  const billsBudget = currentBudgets.data.find((row) => row.category === 'Bills');
  check(
    'budget import updates the existing amount',
    foodBudget && foodBudget.amount === 6500,
    foodBudget
  );
  check(
    'budget import keeps unchanged rows untouched',
    billsBudget && billsBudget.amount === 2000,
    billsBudget
  );

  const nextBudgets = await client('GET', `/api/budgets?month=${MONTH + 1}&year=${YEAR}`);
  const transportBudget = nextBudgets.data.find((row) => row.category === 'Transport');
  check(
    'budget import inserts rows for another month',
    transportBudget && transportBudget.amount === 1500,
    nextBudgets.data
  );

  const maskedBudgetCsv = await client('GET', '/api/export/csv?dataset=budgets&privacy=1');
  const maskedBudgetImport = await client('POST', '/api/budgets/import', {
    csv: maskedBudgetCsv.text,
  });
  check(
    'masked budget exports are rejected on import',
    maskedBudgetImport.status === 201 &&
      maskedBudgetImport.data.imported === 0 &&
      maskedBudgetImport.data.updated === 0 &&
      maskedBudgetImport.data.rejected === 3,
    maskedBudgetImport.data
  );

  const missingHeaders = await client('POST', '/api/recurring/import', {
    csv: 'Name,Value\nGym,200',
  });
  check('recurring import requires its header columns', missingHeaders.status === 400, missingHeaders.data);

  const anonRecurring = await anonymous('POST', '/api/recurring/import', { csv: 'x' });
  const anonBudgets = await anonymous('POST', '/api/budgets/import', { csv: 'x' });
  check(
    'both import endpoints require authentication',
    anonRecurring.status === 401 && anonBudgets.status === 401,
    { anonRecurring: anonRecurring.status, anonBudgets: anonBudgets.status }
  );

  const audit = await client('GET', '/api/audit?limit=100');
  const actions = Array.isArray(audit.data)
    ? audit.data.map((row) => row.action)
    : Array.isArray(audit.data && audit.data.logs)
      ? audit.data.logs.map((row) => row.action)
      : [];
  check(
    'imports are recorded in the audit log',
    actions.includes('recurring_imported') && actions.includes('budgets_imported'),
    actions.filter((action) => action.includes('import'))
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
}

main()
  .catch((err) => {
    console.error('Verification error:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server) server.kill();
    setTimeout(() => {
      cleanup();
      process.exit(process.exitCode || 0);
    }, 500);
  });
