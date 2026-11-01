const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(__dirname, 'tmp_verify_privacy.db');
const PROD_DB_PATH = path.join(__dirname, 'tmp_verify_privacy_prod.db');
const SESSION_DB = path.join(__dirname, 'tmp_verify_privacy-sessions.db');
const PROD_SESSION_DB = path.join(__dirname, 'tmp_verify_privacy_prod-sessions.db');
const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const SECRET_TX = 'Dinner with Priya at the Taj';
const SECRET_RECURRING = 'Private gym membership';
const EMAIL = 'privacy.verify@spendwise.test';
const PASSWORD = 'verify-pass-123';

const checks = [];
let activeServer = null;

function check(name, condition, detail) {
  const ok = Boolean(condition);
  checks.push({ name, ok });
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function removeFile(file) {
  try {
    if (fs.existsSync(file)) fs.rmSync(file);
  } catch (err) {
    console.error(`cleanup warning: could not remove ${file}: ${err.message}`);
  }
}

function cleanup() {
  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`, SESSION_DB]) {
    removeFile(file);
  }
  for (const file of [PROD_DB_PATH, `${PROD_DB_PATH}-wal`, `${PROD_DB_PATH}-shm`, PROD_SESSION_DB]) {
    removeFile(file);
  }
  if (fs.existsSync(__dirname)) {
    for (const file of fs.readdirSync(__dirname)) {
      if (file.startsWith(`${path.basename(DB_PATH)}.bak-`)) {
        removeFile(path.join(__dirname, file));
      }
    }
  }
}

function makeClient() {
  let cookie = '';
  let lastSetCookies = [];

  async function request(method, route, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(`${BASE}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    lastSetCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const raw of lastSetCookies) {
      const pair = raw.split(';')[0];
      if (pair.startsWith('spendwise.sid=')) cookie = pair;
    }

    const text = await response.text();
    let data = null;
    if ((response.headers.get('content-type') || '').includes('json')) {
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
      setCookies: lastSetCookies,
      contentType: response.headers.get('content-type') || '',
    };
  }

  request.cookie = () => cookie;
  request.setCookies = () => lastSetCookies;
  request.reset = () => {
    cookie = '';
  };
  return request;
}

function readDb(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
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

function startServer({ port = PORT, key = KEY_A, nodeEnv = 'test', dbPath = DB_PATH } = {}) {
  const env = {
    ...process.env,
    SPENDWISE_DB_PATH: dbPath,
    PORT: String(port),
    SESSION_SECRET: 'verify-only-session-secret-0123456789',
    NODE_ENV: nodeEnv,
    ENCRYPTION_KEY: key,
    ENCRYPTION_KEY_PREVIOUS: '',
  };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => {
    log += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    log += chunk.toString();
  });

  const handle = { child, log: () => log, base: `http://127.0.0.1:${port}` };
  activeServer = handle;
  return handle;
}

async function waitForHealth(server, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (server.child.exitCode !== null) {
      throw new Error(`Server exited early with code ${server.child.exitCode}\n${server.log()}`);
    }
    try {
      const response = await fetch(`${server.base}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch (err) {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become healthy in time\n${server.log()}`);
}

async function stopServer(server) {
  if (!server || !server.child) return;
  server.child.kill();
  await new Promise((resolve) => {
    if (server.child.exitCode !== null) {
      resolve();
      return;
    }
    server.child.once('exit', resolve);
    setTimeout(resolve, 5000);
  });
  if (activeServer === server) activeServer = null;
}

function runNode(args, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: __dirname,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, out }));
  });
}

function spawnExpectExit(args, env, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: __dirname,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Process did not exit in time\n${out}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

function backupFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((file) => file.startsWith(`${path.basename(DB_PATH)}.bak-`));
}

async function login(client, password = PASSWORD) {
  return client('POST', '/api/auth/login', { email: EMAIL, password });
}

async function run() {
  cleanup();

  const server = startServer();
  let userId = null;
  let registerCookie = '';

  try {
    await waitForHealth(server);
    console.log('Server healthy on isolated database\n');

    const client = makeClient();
    const register = await client('POST', '/api/auth/register', {
      name: 'Privacy Verify',
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    check('register succeeds', register.status === 201, register.data);
    userId = register.data && register.data.user && register.data.user.id;

    registerCookie = client.cookie();
    const registerSetCookies = client.setCookies();
    check(
      'session cookie is HttpOnly and SameSite=Lax',
      registerSetCookies.some(
        (raw) =>
          raw.startsWith('spendwise.sid=') &&
          /HttpOnly/i.test(raw) &&
          /SameSite=Lax/i.test(raw)
      ),
      registerSetCookies
    );

    const transaction = await client('POST', '/api/transactions', {
      type: 'expense',
      amount: 1234.5,
      category: 'Food',
      date: '2026-10-10',
      description: SECRET_TX,
    });
    check(
      'transaction is created and returns its description',
      transaction.status === 201 &&
        transaction.data &&
        transaction.data.description === SECRET_TX,
      transaction.data
    );

    const recurring = await client('POST', '/api/recurring', {
      description: SECRET_RECURRING,
      type: 'expense',
      amount: 800,
      category: 'Health',
      frequency: 'monthly',
      nextOccurrence: '2027-12-01',
      isActive: true,
    });
    check(
      'recurring template is created and returns its description',
      recurring.status === 201 &&
        recurring.data &&
        recurring.data.description === SECRET_RECURRING &&
        recurring.data.description_encrypted === undefined,
      recurring.data
    );

    const recurringList = await client('GET', '/api/recurring');
    check(
      'recurring list decrypts descriptions without exposing ciphertext',
      Array.isArray(recurringList.data) &&
        recurringList.data.some(
          (item) =>
            item.description === SECRET_RECURRING && item.description_encrypted === undefined
        ),
      recurringList.data
    );

    const txRows = await readDb(
      DB_PATH,
      'SELECT description, description_encrypted FROM transactions WHERE user_id = ?',
      [userId]
    );
    check(
      'transaction descriptions are encrypted at rest',
      txRows.length === 1 &&
        txRows[0].description === null &&
        Boolean(txRows[0].description_encrypted) &&
        !txRows[0].description_encrypted.includes(SECRET_TX),
      txRows
    );

    const recurringRows = await readDb(
      DB_PATH,
      'SELECT description, description_encrypted FROM recurring_transactions WHERE user_id = ?',
      [userId]
    );
    check(
      'recurring descriptions are encrypted at rest',
      recurringRows.length === 1 &&
        recurringRows[0].description === '' &&
        Boolean(recurringRows[0].description_encrypted) &&
        !recurringRows[0].description_encrypted.includes(SECRET_RECURRING),
      recurringRows
    );

    const dbBuffer = fs.readFileSync(DB_PATH);
    check(
      'the database file contains no plaintext descriptions',
      !dbBuffer.includes(Buffer.from(SECRET_TX)) &&
        !dbBuffer.includes(Buffer.from(SECRET_RECURRING))
    );

    const wrongPassword = await client('POST', '/api/auth/login', {
      email: EMAIL,
      password: 'definitely-wrong',
    });
    check('wrong password is rejected', wrongPassword.status === 401, wrongPassword.data);

    const ghost = makeClient();
    const unknownAccount = await ghost('POST', '/api/auth/login', {
      email: 'ghost.account@spendwise.test',
      password: 'whatever-123',
    });
    check('unknown account is rejected', unknownAccount.status === 401, unknownAccount.data);

    const authLogs = await client('GET', '/api/audit?category=auth&limit=100');
    check(
      'audit auth details never contain email addresses',
      authLogs.status === 200 && !JSON.stringify(authLogs.data).includes('@'),
      authLogs.data
    );

    const ghostRows = await readDb(
      DB_PATH,
      "SELECT detail FROM audit_logs WHERE action = 'login_failed' AND user_id IS NULL"
    );
    check(
      'unknown-account audit detail uses a redacted label',
      ghostRows.length === 1 && ghostRows[0].detail === 'Login failed: unknown account',
      ghostRows
    );

    const rawCsv = await client('GET', '/api/export/csv');
    check(
      'normal CSV export contains amounts and descriptions',
      rawCsv.status === 200 && rawCsv.text.includes('1234.50') && rawCsv.text.includes(SECRET_TX),
      rawCsv.text.slice(0, 300)
    );

    const privateCsv = await client('GET', '/api/export/csv?privacy=1');
    check(
      'privacy CSV export hides amounts and descriptions',
      privateCsv.status === 200 &&
        privateCsv.text.includes('••••••••') &&
        privateCsv.text.includes('[hidden]') &&
        !privateCsv.text.includes('1234.50') &&
        !privateCsv.text.includes(SECRET_TX),
      privateCsv.text.slice(0, 300)
    );

    const rawRecurringCsv = await client('GET', '/api/export/csv?dataset=recurring');
    check(
      'normal recurring CSV contains amounts and descriptions',
      rawRecurringCsv.status === 200 &&
        rawRecurringCsv.text.includes('800.00') &&
        rawRecurringCsv.text.includes(SECRET_RECURRING),
      rawRecurringCsv.text.slice(0, 300)
    );

    const privateRecurringCsv = await client(
      'GET',
      '/api/export/csv?dataset=recurring&privacy=1'
    );
    check(
      'privacy recurring CSV hides amounts and descriptions',
      privateRecurringCsv.status === 200 &&
        privateRecurringCsv.text.includes('••••••••') &&
        privateRecurringCsv.text.includes('[hidden]') &&
        !privateRecurringCsv.text.includes('800.00') &&
        !privateRecurringCsv.text.includes(SECRET_RECURRING),
      privateRecurringCsv.text.slice(0, 300)
    );

    const rawBackup = await client('GET', '/api/export/backup');
    check(
      'normal backup contains financial data without audit logs',
      rawBackup.status === 200 &&
        rawBackup.text.includes(SECRET_TX) &&
        rawBackup.text.includes(SECRET_RECURRING) &&
        rawBackup.text.includes('"datasets"') &&
        rawBackup.text.includes('"audit_logs"') &&
        !rawBackup.text.includes('"ip_address"') &&
        !rawBackup.text.includes('"action"'),
      rawBackup.text.slice(0, 400)
    );

    const privateBackup = await client('GET', '/api/export/backup?privacy=1');
    check(
      'privacy backup masks every dataset',
      privateBackup.status === 200 &&
        privateBackup.text.includes('"privacy_mode": true') &&
        privateBackup.text.includes('••••••••') &&
        privateBackup.text.includes('[hidden]') &&
        !/"amount":\s*1234\.5\b/.test(privateBackup.text) &&
        !/"amount":\s*800\b/.test(privateBackup.text) &&
        !privateBackup.text.includes(SECRET_TX) &&
        !privateBackup.text.includes(SECRET_RECURRING),
      privateBackup.text.slice(0, 400)
    );

    const rawReport = await client('GET', '/api/export/report?month=10&year=2026');
    const rawReportHasMoney = /₹\s?-?\d/.test(rawReport.text);
    check(
      'normal report renders currency amounts',
      rawReport.status === 200 && rawReportHasMoney,
      { status: rawReport.status, hasMoney: rawReportHasMoney }
    );

    const privateReport = await client('GET', '/api/export/report?month=10&year=2026&privacy=1');
    check(
      'privacy report masks amounts and flags the mode',
      privateReport.status === 200 &&
        privateReport.text.includes('Privacy mode') &&
        privateReport.text.includes('••••••••') &&
        !/₹\s?-?\d/.test(privateReport.text) &&
        !privateReport.text.includes(SECRET_TX),
      {
        status: privateReport.status,
        hasMoney: /₹\s?-?\d/.test(privateReport.text),
        hasMask: privateReport.text.includes('••••••••'),
      }
    );
    check(
      'privacy report still renders its sections',
      privateReport.text.includes('At a glance') &&
        privateReport.text.includes('Spending pace') &&
        privateReport.text.includes('Plan and assumptions'),
      {}
    );

    const exportLogs = await client('GET', '/api/audit?category=export&limit=100');
    check(
      'privacy exports are recorded distinctly in the audit log',
      exportLogs.status === 200 &&
        exportLogs.data.logs.some(
          (log) => log.action === 'data_exported' && /hidden|masked/.test(log.detail || '')
        ) &&
        exportLogs.data.logs.some(
          (log) => log.action === 'report_exported' && /hidden|masked/.test(log.detail || '')
        ),
      exportLogs.data && exportLogs.data.logs
    );

    const loginAgain = await login(client);
    const loginCookie = client.cookie();
    check(
      'login regenerates the session identifier',
      loginAgain.status === 200 && Boolean(loginCookie) && loginCookie !== registerCookie
    );

    const logout = await client('POST', '/api/auth/logout');
    check(
      'logout clears the spendwise.sid cookie',
      logout.status === 200 &&
        logout.setCookies.some(
          (raw) =>
            raw.startsWith('spendwise.sid=') &&
            (/Expires=Thu, 01 Jan 1970/i.test(raw) || /Max-Age=0/i.test(raw))
        ),
      logout.setCookies
    );
    const afterLogout = await client('GET', '/api/auth/me');
    check('logged-out session is unauthenticated', afterLogout.status === 401, afterLogout.data);

    check(
      'sessions are stored in a persistent SQLite store',
      fs.existsSync(SESSION_DB) &&
        (await readDb(SESSION_DB, 'SELECT COUNT(*) AS c FROM sessions')).length === 1,
      SESSION_DB
    );
  } finally {
    await stopServer(server);
  }

  const dryRun = await runNode(['scripts/reencrypt.js'], {
    ENCRYPTION_KEY: KEY_B,
    ENCRYPTION_KEY_PREVIOUS: KEY_A,
    SPENDWISE_DB_PATH: DB_PATH,
  });
  check(
    're-encryption dry run finds rows under the old key',
    dryRun.code === 0 &&
      /Transaction rows to re-encrypt: 1/.test(dryRun.out) &&
      /Recurring rows to re-encrypt: 1/.test(dryRun.out) &&
      /dry run/i.test(dryRun.out),
    dryRun.out
  );

  const apply = await runNode(['scripts/reencrypt.js', '--apply'], {
    ENCRYPTION_KEY: KEY_B,
    ENCRYPTION_KEY_PREVIOUS: KEY_A,
    SPENDWISE_DB_PATH: DB_PATH,
  });
  const backups = backupFiles();
  check(
    'key rotation applies with a database backup',
    apply.code === 0 &&
      /Rotation applied successfully/.test(apply.out) &&
      backups.length === 1,
    { code: apply.code, backups, out: apply.out.slice(-600) }
  );

  const rotatedServer = startServer({ key: KEY_B });
  try {
    await waitForHealth(rotatedServer);
    const rotatedClient = makeClient();
    const rotatedLogin = await login(rotatedClient);
    check('account still logs in after key rotation', rotatedLogin.status === 200, rotatedLogin.data);

    const rotatedTransactions = await rotatedClient('GET', '/api/transactions');
    check(
      'transactions decrypt with the new key only',
      rotatedTransactions.status === 200 &&
        Array.isArray(rotatedTransactions.data) &&
        rotatedTransactions.data.some((item) => item.description === SECRET_TX),
      rotatedTransactions.data
    );

    const rotatedRecurring = await rotatedClient('GET', '/api/recurring');
    check(
      'recurring templates decrypt with the new key only',
      rotatedRecurring.status === 200 &&
        Array.isArray(rotatedRecurring.data) &&
        rotatedRecurring.data.some((item) => item.description === SECRET_RECURRING),
      rotatedRecurring.data
    );

    const rotatedCsv = await rotatedClient('GET', '/api/export/csv');
    check(
      'CSV export decrypts descriptions after rotation',
      rotatedCsv.status === 200 && rotatedCsv.text.includes(SECRET_TX),
      rotatedCsv.text.slice(0, 300)
    );
  } finally {
    await stopServer(rotatedServer);
  }

  const prodEnv = { ...process.env };
  delete prodEnv.ENCRYPTION_KEY;
  delete prodEnv.ENCRYPTION_KEY_PREVIOUS;
  Object.assign(prodEnv, {
    NODE_ENV: 'production',
    SESSION_SECRET: 'production-session-secret-0123456789abcdef',
    SPENDWISE_DB_PATH: PROD_DB_PATH,
    PORT: String(PORT + 1),
  });
  const missingKey = await spawnExpectExit(['server.js'], prodEnv);
  check(
    'production refuses to start without ENCRYPTION_KEY',
    missingKey.code === 1 && /ENCRYPTION_KEY is required in production/.test(missingKey.out),
    { code: missingKey.code, out: missingKey.out.slice(-500) }
  );

  cleanup();

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

run().catch(async (err) => {
  console.error('\nVerification aborted:', err.message);
  console.error(err.stack);
  if (activeServer) {
    try {
      await stopServer(activeServer);
    } catch (stopErr) {
      // ignore
    }
  }
  cleanup();
  process.exitCode = 1;
});
