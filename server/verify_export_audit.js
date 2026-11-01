const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const ExcelJS = require('exceljs');

const DB_PATH = path.join(__dirname, 'tmp_verify_export_audit.db');
const PORT = 5098;
const BASE = `http://127.0.0.1:${PORT}`;
const MONTH = 10;
const YEAR = 2026;

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

    const buffer = Buffer.from(await response.arrayBuffer());
    const text = buffer.toString('utf8');
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (text && contentType.includes('json')) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = text;
      }
    }

    return {
      status: response.status,
      data,
      text,
      buffer,
      contentType,
      disposition: response.headers.get('content-disposition') || '',
      csp: response.headers.get('content-security-policy') || '',
    };
  };
}

function seedDate(month, day) {
  return `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function addTransaction(client, type, amount, category, date, description) {
  const response = await client('POST', '/api/transactions', {
    type,
    amount,
    category,
    date,
    description,
  });
  if (response.status !== 201) {
    throw new Error(`Seed failed (${type} ${category} ${date}): ${JSON.stringify(response.data)}`);
  }
  return response.data;
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
      // server not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server did not become healthy in time');
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

const JULY_CSV = [
  'Description,Date,Category,Amount',
  'Monthly salary,01/07/2026,Salary,60000',
  'Groceries,03/07/2026,Food,2250',
  '"Coffee, beans",04/07/2026,Food,450',
  'Electricity,05/07/2026,Bills,"1,200"',
  '"Dinner ""out""",06/07/2026,Food,800',
].join('\r\n');

const AUGUST_CSV = [
  'Date,Type,Amount,Category,Description',
  '2026-08-01,expense,500,Food,Valid row',
  '2026-08-02,bogus,100,Food,Bad type',
  '2026-02-31,expense,100,Food,Bad date',
  '2026-08-03,expense,-5,Food,Bad amount',
  '2026-08-04,expense,100,Salary,Expense category mismatch',
  '2026-08-05,credit,700,Other Income,Credit maps to income',
].join('\n');

const SEPTEMBER_CSV = [
  'Date,Type,Amount,Category,Description',
  '2026-09-10,expense,300,Transport,Bus pass',
  '2026-09-10,expense,300,Transport,Bus pass',
].join('\n');

async function run() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${DB_PATH}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
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
    console.log('Server healthy on isolated database\n');

    const userA = makeClient();
    const registerA = await userA('POST', '/api/auth/register', {
      name: 'Export Verify A',
      email: 'export.a@spendwise.test',
      password: 'verify-pass-123',
      confirmPassword: 'verify-pass-123',
    });
    check('register user A', registerA.status === 201, registerA.data);
    const userAId = registerA.data && registerA.data.user ? registerA.data.user.id : null;

    // --- CSV import ---
    const july = await userA('POST', '/api/transactions/import', { csv: JULY_CSV });
    check('import accepts reordered headers and inferred type', july.status === 201 && july.data.imported === 5, july.data);
    const julyRows = await userA('GET', '/api/transactions');
    const coffee = Array.isArray(julyRows.data)
      ? julyRows.data.find((row) => row.description === 'Coffee, beans')
      : null;
    const dinner = Array.isArray(julyRows.data)
      ? julyRows.data.find((row) => row.description === 'Dinner "out"')
      : null;
    check('quoted comma in description survives import', coffee && Number(coffee.amount) === 450, coffee);
    check('escaped quotes in description survive import', dinner && Number(dinner.amount) === 800, dinner);
    const salary = Array.isArray(julyRows.data)
      ? julyRows.data.find((row) => row.category === 'Salary')
      : null;
    check('type is inferred from category when omitted', salary && salary.type === 'income', salary);
    const electricity = Array.isArray(julyRows.data)
      ? julyRows.data.find((row) => row.category === 'Bills')
      : null;
    check('quoted amount with a comma is parsed', electricity && Number(electricity.amount) === 1200, electricity);

    const julyAgain = await userA('POST', '/api/transactions/import', { csv: JULY_CSV });
    check(
      're-import skips every existing row as a duplicate',
      julyAgain.status === 201 &&
        julyAgain.data.imported === 0 &&
        julyAgain.data.duplicates === 5 &&
        julyAgain.data.totalRows === 5,
      julyAgain.data
    );

    const august = await userA('POST', '/api/transactions/import', { csv: AUGUST_CSV });
    check(
      'partial import keeps valid rows and reports rejected rows',
      august.status === 201 &&
        august.data.imported === 2 &&
        august.data.rejected === 4 &&
        august.data.totalRows === 6,
      august.data
    );
    check(
      'rejected rows explain the problem',
      august.data &&
        Array.isArray(august.data.errors) &&
        august.data.errors.length === 4 &&
        august.data.errors.every((item) => item.line >= 2 && item.message.length > 5),
      august.data && august.data.errors
    );

    const september = await userA('POST', '/api/transactions/import', { csv: SEPTEMBER_CSV });
    check(
      'identical rows inside one file are deduplicated',
      september.status === 201 && september.data.imported === 1 && september.data.duplicates === 1,
      september.data
    );

    const missingHeaders = await userA('POST', '/api/transactions/import', {
      csv: 'Foo,Bar\n1,2',
    });
    check('missing required columns return 400', missingHeaders.status === 400, missingHeaders.data);

    const emptyCsv = await userA('POST', '/api/transactions/import', { csv: '' });
    check('empty csv returns 400', emptyCsv.status === 400, emptyCsv.data);

    const oversized = await userA('POST', '/api/transactions/import', {
      csv: `Date,Amount,Category\n${'2026-01-01,10,Food\n'.repeat(1)}\n${'x'.repeat(2 * 1024 * 1024)}`,
    });
    check('csv over 2 MB returns 413', oversized.status === 413, oversized.status);

    const manyRows = ['Date,Type,Amount,Category,Description'];
    for (let index = 0; index < 5001; index += 1) {
      manyRows.push(`2026-01-01,expense,10,Food,Row ${index}`);
    }
    const tooMany = await userA('POST', '/api/transactions/import', { csv: manyRows.join('\n') });
    check('more than 5,000 rows returns 413', tooMany.status === 413, tooMany.status);

    // --- CSV export ---
    await addTransaction(
      userA,
      'expense',
      42,
      'Food',
      seedDate(10, 31),
      '=SUM(A1:A2)'
    );
    const beforeExport = await userA('GET', '/api/transactions');
    const exported = await userA('GET', '/api/export/csv');
    check(
      'csv export returns a text attachment',
      exported.status === 200 &&
        exported.contentType.includes('text/csv') &&
        exported.disposition.includes('attachment'),
      { status: exported.status, type: exported.contentType, disposition: exported.disposition }
    );
    check(
      'csv export starts with a UTF-8 BOM for Excel',
      exported.buffer[0] === 0xef && exported.buffer[1] === 0xbb && exported.buffer[2] === 0xbf,
      exported.buffer.slice(0, 3)
    );
    check(
      'csv export filename uses the dataset and timestamp',
      /spendwise-transactions_\d{4}-\d{2}-\d{2}_\d{4}\.csv/.test(exported.disposition),
      exported.disposition
    );
    const exportLines = exported.text.replace(/^\uFEFF/, '').split('\n');
    check(
      'export keeps the documented header and one line per transaction',
      exportLines[0] === 'Date,Type,Amount,Category,Description' &&
        exportLines.length === beforeExport.data.length + 1,
      { header: exportLines[0], lines: exportLines.length, rows: beforeExport.data.length }
    );
    check(
      'export escapes commas and quotes',
      exported.text.includes('"Coffee, beans"') && exported.text.includes('"Dinner ""out"""'),
      exported.text.split('\n').find((line) => line.includes('Dinner'))
    );
    check(
      'export neutralises spreadsheet formulas in descriptions',
      exported.text.includes("'=SUM(A1:A2)"),
      exported.text.split('\n').find((line) => line.includes('SUM'))
    );
    const unknownDataset = await userA('GET', '/api/export/csv?dataset=audit');
    check(
      'unknown export dataset is rejected',
      unknownDataset.status === 400 && /Unknown export dataset/.test(unknownDataset.data.error),
      unknownDataset.data
    );
    const anonymousClient = makeClient();
    const anonymousBackup = await anonymousClient('GET', '/api/export/backup');
    check('export endpoints require authentication', anonymousBackup.status === 401, anonymousBackup.status);

    const userB = makeClient();
    const registerB = await userB('POST', '/api/auth/register', {
      name: 'Export Verify B',
      email: 'export.b@spendwise.test',
      password: 'verify-pass-123',
      confirmPassword: 'verify-pass-123',
    });
    check('register user B', registerB.status === 201, registerB.data);

    const roundTrip = await userB('POST', '/api/transactions/import', { csv: exported.text });
    check(
      'exported csv imports cleanly into another account',
      roundTrip.status === 201 && roundTrip.data.imported === beforeExport.data.length,
      roundTrip.data
    );
    const bRows = await userB('GET', '/api/transactions');
    check(
      'round-tripped descriptions decrypt correctly',
      Array.isArray(bRows.data) &&
        bRows.data.some((row) => row.description === 'Coffee, beans') &&
        bRows.data.some((row) => row.description === 'Dinner "out"'),
      Array.isArray(bRows.data) ? bRows.data.map((row) => row.description) : bRows.data
    );

    // --- Seed history for analytics and recommendation trail ---
    await addTransaction(userA, 'income', 60000, 'Salary', seedDate(6, 1), 'Monthly salary');
    await addTransaction(userA, 'expense', 2000, 'Food', seedDate(6, 5), 'Groceries');
    await addTransaction(userA, 'expense', 1000, 'Transport', seedDate(6, 8), 'Commute');
    await addTransaction(userA, 'expense', 1500, 'Bills', seedDate(6, 12), 'Utilities');
    await addTransaction(userA, 'income', 60000, 'Salary', seedDate(8, 1), 'Monthly salary');
    await addTransaction(userA, 'income', 60000, 'Salary', seedDate(9, 1), 'Monthly salary');
    await addTransaction(userA, 'expense', 1000, 'Bills', seedDate(9, 5), 'Internet');
    await addTransaction(userA, 'expense', 1200, 'Transport', seedDate(9, 15), 'Train pass');

    await addTransaction(userA, 'income', 60000, 'Salary', seedDate(MONTH, 1), 'Monthly salary');
    await addTransaction(userA, 'expense', 2000, 'Food', seedDate(MONTH, 5), 'Groceries');
    await addTransaction(userA, 'expense', 2000, 'Food', seedDate(MONTH, 12), 'Groceries');
    await addTransaction(userA, 'expense', 2000, 'Food', seedDate(MONTH, 19), 'Groceries');
    await addTransaction(userA, 'expense', 3000, 'Shopping', seedDate(MONTH, 8), 'Shoes');
    await addTransaction(userA, 'expense', 1800, 'Bills', seedDate(MONTH, 3), 'Electricity');
    await addTransaction(userA, 'expense', 199, 'Entertainment', seedDate(MONTH, 6), 'Streaming');

    for (const [category, amount] of [
      ['Food', 9000],
      ['Shopping', 2000],
      ['Bills', 2000],
      ['Transport', 1000],
      ['Entertainment', 500],
      ['Health', 1000],
    ]) {
      const response = await userA('POST', '/api/budgets', {
        category,
        amount,
        month: MONTH,
        year: YEAR,
      });
      if (response.status !== 201) {
        throw new Error(`Budget seed failed for ${category}: ${JSON.stringify(response.data)}`);
      }
    }

    const plan = await userA('PUT', '/api/analytics/plan', {
      month: MONTH,
      year: YEAR,
      income_assumption: 60000,
      savings_target: 10000,
      objective: 'savings',
    });
    check('plan saved for the trail', plan.status === 200, plan.data);

    // --- Expanded export datasets ---
    const recurringSeed = await userA('POST', '/api/recurring', {
      description: 'Monthly internet',
      type: 'expense',
      amount: 999,
      category: 'Bills',
      frequency: 'monthly',
      nextOccurrence: '2099-01-15',
      isActive: true,
    });
    check(
      'recurring schedule seeded for export',
      recurringSeed.status === 201,
      recurringSeed.data
    );

    const recurringExport = await userA('GET', '/api/export/csv?dataset=recurring');
    const recurringLines = recurringExport.text.replace(/^\uFEFF/, '').split('\n');
    check(
      'recurring CSV uses its own header and rows',
      recurringExport.status === 200 &&
        recurringLines[0] ===
          'Type,Amount,Category,Description,Frequency,Next Occurrence,Status,Created At' &&
        recurringLines.length === 2 &&
        recurringLines[1].includes('monthly') &&
        recurringLines[1].includes('Active'),
      recurringLines
    );

    const budgetsExport = await userA('GET', '/api/export/csv?dataset=budgets');
    const budgetLines = budgetsExport.text.replace(/^\uFEFF/, '').split('\n');
    check(
      'budgets CSV includes every budget',
      budgetsExport.status === 200 &&
        budgetLines[0] === 'Month,Year,Category,Amount,Created At' &&
        budgetLines.length === 7,
      { header: budgetLines[0], lines: budgetLines.length }
    );

    const plansExport = await userA('GET', '/api/export/csv?dataset=plans');
    const planLines = plansExport.text.replace(/^\uFEFF/, '').split('\n');
    check(
      'plans CSV includes the monthly plan',
      plansExport.status === 200 &&
        planLines[0] ===
          'Month,Year,Objective,Income Assumption,Savings Target,Updated At' &&
        planLines.length === 2 &&
        planLines[1].includes('savings') &&
        planLines[1].includes('60000.00') &&
        planLines[1].includes('10000.00'),
      planLines
    );

    const currentTransactions = await userA('GET', '/api/transactions');
    const currentBudgets = await userA('GET', `/api/budgets?month=${MONTH}&year=${YEAR}`);
    const backup = await userA('GET', '/api/export/backup');
    check(
      'full backup returns a timestamped JSON attachment',
      backup.status === 200 &&
        backup.contentType.includes('application/json') &&
        /spendwise-backup_\d{4}-\d{2}-\d{2}_\d{4}\.json/.test(backup.disposition),
      { status: backup.status, type: backup.contentType, disposition: backup.disposition }
    );
    check(
      'full backup matches current rows and excludes sensitive material',
      backup.data &&
        backup.data.datasets &&
        backup.data.datasets.transactions.length === currentTransactions.data.length &&
        backup.data.datasets.budgets.length === currentBudgets.data.length &&
        backup.data.datasets.recurring.length === 1 &&
        backup.data.datasets.plans.length === 1 &&
        backup.data.excluded.includes('audit_logs') &&
        !JSON.stringify(backup.data).includes('description_encrypted') &&
        !JSON.stringify(backup.data).includes('"user_id"') &&
        !JSON.stringify(backup.data).includes('password_hash'),
      backup.data && backup.data.counts
    );

    const privateBackup = await userA('GET', '/api/export/backup?privacy=1');
    const privateSalary = privateBackup.data.datasets.transactions.find(
      (row) => row.category === 'Salary'
    );
    check(
      'privacy backup masks amounts, descriptions and plan figures',
      privateBackup.data.privacy_mode === true &&
        privateSalary &&
        privateSalary.amount === '••••••••' &&
        privateSalary.description === '[hidden]' &&
        privateBackup.data.datasets.budgets.every((row) => row.amount === '••••••••') &&
        privateBackup.data.datasets.plans.every(
          (row) => row.income_assumption === '••••••••'
        ),
      privateBackup.data.counts
    );

    const workbookExport = await userA('GET', '/api/export/workbook');
    check(
      'XLSX workbook returns a timestamped attachment',
      workbookExport.status === 200 &&
        workbookExport.contentType.includes('spreadsheetml') &&
        /spendwise-data_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx/.test(workbookExport.disposition),
      {
        status: workbookExport.status,
        type: workbookExport.contentType,
        disposition: workbookExport.disposition,
      }
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookExport.buffer);
    const txSheet = workbook.getWorksheet('Transactions');
    const aboutSheet = workbook.getWorksheet('About');
    check(
      'XLSX workbook contains every dataset sheet',
      ['Transactions', 'Recurring', 'Budgets', 'Plans', 'About'].every((name) =>
        workbook.getWorksheet(name)
      ),
      workbook.worksheets.map((sheet) => sheet.name)
    );
    check(
      'XLSX dates are real date cells and amounts are numeric',
      txSheet &&
        txSheet.getCell('A2').type === ExcelJS.ValueType.Date &&
        txSheet.getCell('C2').type === ExcelJS.ValueType.Number,
      txSheet && { date: txSheet.getCell('A2').type, amount: txSheet.getCell('C2').type }
    );
    check(
      'XLSX sets column widths and a bold header',
      txSheet &&
        txSheet.getColumn(1).width >= 14 &&
        txSheet.getCell('A1').font &&
        txSheet.getCell('A1').font.bold === true,
      txSheet && { width: txSheet.getColumn(1).width, bold: txSheet.getCell('A1').font }
    );
    check(
      'XLSX About sheet documents excluded audit logs',
      aboutSheet && JSON.stringify(aboutSheet.getSheetValues()).includes('Audit logs'),
      aboutSheet && aboutSheet.getSheetValues().slice(0, 12)
    );

    const privateWorkbookExport = await userA('GET', '/api/export/workbook?privacy=1');
    const privateWorkbook = new ExcelJS.Workbook();
    await privateWorkbook.xlsx.load(privateWorkbookExport.buffer);
    const privateSheet = privateWorkbook.getWorksheet('Transactions');
    const privateRow = privateSheet && privateSheet.getRow(2);
    check(
      'privacy workbook masks amounts and descriptions',
      privateRow &&
        privateRow.getCell(3).value === '••••••••' &&
        privateRow.getCell(5).value === '[hidden]',
      privateRow && [privateRow.getCell(3).value, privateRow.getCell(5).value]
    );

    const recommendation = await userA(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}`
    );
    check(
      'recommendation is available for the trail',
      recommendation.status === 200 &&
        recommendation.data.status === 'available' &&
        Array.isArray(recommendation.data.categories) &&
        recommendation.data.categories.length >= 4,
      recommendation.data && recommendation.data.status
    );

    const proposal =
      recommendation.data && Array.isArray(recommendation.data.categories)
        ? recommendation.data.categories
        : [];
    if (proposal.length < 3) {
      throw new Error(`Trail seed needs at least three recommendation categories: ${JSON.stringify(recommendation.data)}`);
    }
    const stabilityLimited = proposal.find(
      (item) => item.evidence && item.evidence.stabilityLimited
    );
    check(
      'stability-limited targets explain the current-budget band',
      stabilityLimited &&
        ['floor', 'cap'].includes(stabilityLimited.evidence.stabilityBound) &&
        /Held at ₹|Capped at ₹/.test(stabilityLimited.reason) &&
        /current budget|protected floor/.test(stabilityLimited.reason),
      stabilityLimited && {
        category: stabilityLimited.category,
        reason: stabilityLimited.reason,
        bound: stabilityLimited.evidence.stabilityBound,
      }
    );
    const firstBasket = proposal.slice(0, 2);
    const applyOne = await userA('POST', '/api/analytics/recommendations/apply', {
      month: MONTH,
      year: YEAR,
      categories: firstBasket.map((item) => ({ category: item.category, amount: item.target })),
    });
    check(
      'first recommendation batch applies',
      applyOne.status === 200 && applyOne.data.applied.length === 2,
      applyOne.data
    );

    const applyTwo = await userA('POST', '/api/analytics/recommendations/apply', {
      month: MONTH,
      year: YEAR,
      categories: [
        { category: firstBasket[0].category, amount: 0 },
        { category: proposal[2].category, amount: proposal[2].target },
      ],
    });
    check(
      'second batch supports removal and a new target',
      applyTwo.status === 200 &&
        applyTwo.data.applied.length === 1 &&
        applyTwo.data.deleted.length === 1,
      applyTwo.data
    );

    const trail = await userA('GET', '/api/audit/recommendations');
    check('trail returns applied batches', trail.status === 200 && trail.data.batches.length === 2, trail.data);
    check(
      'trail reports the total number of batches',
      trail.data.totalBatches === 2,
      trail.data.totalBatches
    );
    const newest = trail.data.batches[0];
    check(
      'newest batch is first and keeps its period and objective',
      newest.batchId === applyTwo.data.batchId &&
        newest.month === MONTH &&
        newest.year === YEAR &&
        newest.objective === 'savings',
      newest && { batchId: newest.batchId, month: newest.month, year: newest.year }
    );
    check(
      'trail records a zero proposal for a removed budget',
      newest.categories.some((item) => item.proposed === 0) &&
        newest.categories.every((item) => item.reason && item.confidence && item.evidence),
      newest.categories
    );
    check(
      'trail totals sum the proposals',
      Math.abs(
        newest.totalProposed -
          newest.categories.reduce((sum, item) => sum + Number(item.proposed), 0)
      ) < 0.01,
      newest && { totalProposed: newest.totalProposed, categories: newest.categories }
    );

    const trailPeriod = await userA(
      'GET',
      `/api/audit/recommendations?month=${MONTH}&year=${YEAR}`
    );
    check('trail filters by period', trailPeriod.status === 200 && trailPeriod.data.batches.length === 2, trailPeriod.data);
    const trailEmptyPeriod = await userA('GET', '/api/audit/recommendations?month=3&year=2025');
    check(
      'trail returns no batches for an empty period',
      trailEmptyPeriod.status === 200 && trailEmptyPeriod.data.batches.length === 0,
      trailEmptyPeriod.data
    );
    const trailBadPeriod = await userA('GET', '/api/audit/recommendations?month=13&year=2026');
    check('trail rejects an invalid month', trailBadPeriod.status === 400, trailBadPeriod.data);
    const trailHalfPeriod = await userA('GET', '/api/audit/recommendations?month=10');
    check('trail requires month and year together', trailHalfPeriod.status === 400, trailHalfPeriod.data);
    const trailB = await userB('GET', '/api/audit/recommendations');
    check(
      'trail is isolated per account',
      trailB.status === 200 && Array.isArray(trailB.data.batches) && trailB.data.batches.length === 0,
      trailB.data
    );

    const budgetsAfter = await userA('GET', `/api/budgets?month=${MONTH}&year=${YEAR}`);
    const removedBudget = Array.isArray(budgetsAfter.data)
      ? budgetsAfter.data.find((row) => row.category === firstBasket[0].category)
      : null;
    check('removing a recommendation deletes its budget', !removedBudget, budgetsAfter.data);

    // --- Printable report ---
    const report = await userA('GET', '/api/export/report?month=7&year=2026');
    check(
      'monthly report returns printable html',
      report.status === 200 &&
        report.contentType.includes('text/html') &&
        report.text.startsWith('<!doctype html>') &&
        report.text.includes('July 2026') &&
        report.text.includes('At a glance') &&
        report.text.includes('Spending pace'),
      { status: report.status, type: report.contentType }
    );
    check(
      'monthly report names the account and includes amounts',
      report.text.includes('Export Verify A') && report.text.includes('₹'),
      null
    );
    check(
      'monthly report is inline and locked down by CSP',
      report.disposition.includes('inline') &&
        report.disposition.includes('2026-07') &&
        report.csp.includes("default-src 'none'"),
      { disposition: report.disposition, csp: report.csp }
    );

    const emptyReport = await userA('GET', '/api/export/report?month=1&year=2025');
    check(
      'monthly report renders an empty month without failing',
      emptyReport.status === 200 && emptyReport.text.includes('January 2025'),
      emptyReport.status
    );

    const badReport = await userA('GET', '/api/export/report?month=13&year=2026');
    check('monthly report rejects an invalid month', badReport.status === 400, badReport.data);

    const reportB = await userB('GET', '/api/export/report?month=7&year=2026');
    check(
      'monthly report is scoped to its account',
      reportB.status === 200 &&
        reportB.text.includes('Export Verify B') &&
        !reportB.text.includes('Export Verify A'),
      reportB.status
    );

    // --- Audit filters ---
    const audit = await userA('GET', '/api/audit?limit=100');
    check('audit returns logs and counts', audit.status === 200 && Array.isArray(audit.data.logs), audit.data);
    check(
      'audit counts cover every category',
      audit.data.counts.all > 0 &&
        audit.data.counts.auth >= 1 &&
        audit.data.counts.data >= 1 &&
        audit.data.counts.recommendation >= 2 &&
        audit.data.counts.export >= 6,
      audit.data.counts
    );
    check(
      'imports, exports and reports are logged',
      audit.data.logs.some((log) => log.action === 'transactions_imported') &&
        audit.data.logs.some((log) => log.action === 'data_exported') &&
        audit.data.logs.some((log) => log.action === 'report_exported') &&
        audit.data.logs.some((log) => log.action === 'recommendation_applied'),
      audit.data.logs.map((log) => log.action)
    );
    check(
      'import audit detail counts imported, duplicate and rejected rows',
      audit.data.logs.some(
        (log) =>
          log.action === 'transactions_imported' &&
          log.detail.includes('Imported 0 transaction') &&
          log.detail.includes('5 duplicate')
      ),
      audit.data.logs.find((log) => log.action === 'transactions_imported')
    );

    const exportOnly = await userA('GET', '/api/audit?category=export&limit=100');
    check(
      'category filter returns only that group and its matching count',
      exportOnly.status === 200 &&
        exportOnly.data.logs.length === audit.data.counts.export &&
        exportOnly.data.logs.every((log) =>
          ['transactions_imported', 'data_exported', 'report_exported'].includes(log.action)
        ),
      { total: exportOnly.data.pagination.total, count: audit.data.counts.export }
    );

    const recOnly = await userA('GET', '/api/audit?category=recommendation&limit=100');
    check(
      'recommendation filter isolates applied recommendations',
      recOnly.status === 200 &&
        recOnly.data.logs.length === audit.data.counts.recommendation &&
        recOnly.data.logs.every((log) => log.action === 'recommendation_applied'),
      recOnly.data.logs
    );

    const searchImport = await userA('GET', '/api/audit?search=Imported&limit=100');
    check(
      'search matches audit details case-insensitively',
      searchImport.status === 200 &&
        searchImport.data.pagination.total >= 4 &&
        searchImport.data.logs.every((log) => String(log.detail).toLowerCase().includes('imported')),
      searchImport.data && searchImport.data.pagination
    );

    const future = await userA('GET', '/api/audit?from=2099-01-01');
    check(
      'future date range returns no rows',
      future.status === 200 && future.data.pagination.total === 0 && future.data.counts.all === 0,
      future.data && future.data.pagination
    );

    const badCategory = await userA('GET', '/api/audit?category=bogus');
    check('invalid audit category returns 400', badCategory.status === 400, badCategory.data);
    const badDate = await userA('GET', '/api/audit?from=2026-13-01');
    check('invalid audit date returns 400', badDate.status === 400, badDate.data);
    const reversedDates = await userA('GET', '/api/audit?from=2026-10-02&to=2026-10-01');
    check('reversed audit date range returns 400', reversedDates.status === 400, reversedDates.data);

    const pageTwo = await userA('GET', '/api/audit?limit=2&page=2');
    check(
      'audit pagination reports pages and slices the list',
      pageTwo.status === 200 &&
        pageTwo.data.logs.length === 2 &&
        pageTwo.data.pagination.page === 2 &&
        pageTwo.data.pagination.totalPages >= 2,
      pageTwo.data && pageTwo.data.pagination
    );

    const searchB = await userB('GET', '/api/audit?search=Imported&limit=100');
    check(
      'audit logs are isolated per account',
      searchB.status === 200 && searchB.data.pagination.total === 1,
      searchB.data && searchB.data.pagination
    );

    const anonymous = makeClient();
    const unauthorizedAudit = await anonymous('GET', '/api/audit');
    const unauthorizedTrail = await anonymous('GET', '/api/audit/recommendations');
    const unauthorizedReport = await anonymous('GET', '/api/export/report?month=7&year=2026');
    check(
      'export and audit endpoints require authentication',
      unauthorizedAudit.status === 401 &&
        unauthorizedTrail.status === 401 &&
        unauthorizedReport.status === 401,
      [unauthorizedAudit.status, unauthorizedTrail.status, unauthorizedReport.status]
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

    const importRows = await readDb(
      "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'transactions_imported' AND user_id = ?",
      [userAId]
    );
    check('import audit rows are persisted', importRows[0] && importRows[0].c === 4, importRows);

    const recRows = await readDb(
      "SELECT COUNT(*) AS c FROM budget_recommendations WHERE status = 'applied'"
    );
    check('applied recommendation rows persist across batches', recRows[0] && recRows[0].c === 4, recRows);

    const txRows = await readDb('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?', [userAId]);
    check('database holds every imported and seeded transaction', txRows[0] && txRows[0].c === 24, txRows);
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
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${DB_PATH}${suffix}`;
      try {
        if (fs.existsSync(file)) fs.rmSync(file);
      } catch (err) {
        console.error(`cleanup warning: could not remove ${file}: ${err.message}`);
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

run().catch(async (err) => {
  console.error('\nVerification aborted:', err.message);
  console.error(err.stack);
  if (child) child.kill();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${DB_PATH}${suffix}`;
    try {
      if (fs.existsSync(file)) fs.rmSync(file);
    } catch (cleanupErr) {
      // ignore cleanup failure on abort
    }
  }
  process.exitCode = 1;
});
