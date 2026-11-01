const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = path.join(__dirname, 'tmp_verify_analytics.db');
const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;
const MONTH = 10;
const YEAR = 2026;

const checks = [];
let child = null;

function check(name, condition, detail) {
  const ok = Boolean(condition);
  checks.push({ name, ok });
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function closeTo(actual, expected, tolerance = 0.02) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
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
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = text;
      }
    }
    return { status: response.status, data };
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

async function seedPriorMonth(client, month, shoppingAmount) {
  await addTransaction(client, 'income', 60000, 'Salary', seedDate(month, 1), 'Monthly salary');
  for (const day of [3, 10, 17, 24]) {
    await addTransaction(client, 'expense', 2250, 'Food', seedDate(month, day), 'Groceries');
  }
  await addTransaction(client, 'expense', 2000, 'Transport', seedDate(month, 8), 'Commute');
  await addTransaction(client, 'expense', 4000, 'Bills', seedDate(month, 12), 'Utilities');
  await addTransaction(client, 'expense', shoppingAmount, 'Shopping', seedDate(month, 20), 'Clothes');
  await addTransaction(client, 'expense', 500, 'Health', seedDate(month, 6), 'Pharmacy');
  await addTransaction(client, 'expense', 500, 'Health', seedDate(month, 21), 'Pharmacy');
  await addTransaction(client, 'expense', 199, 'Entertainment', seedDate(month, 5), 'Streaming');
}

async function seedCurrentMonth(client) {
  await addTransaction(client, 'income', 60000, 'Salary', seedDate(MONTH, 1), 'Monthly salary');
  for (const day of [2, 9, 16, 23]) {
    await addTransaction(client, 'expense', 2250, 'Food', seedDate(MONTH, day), 'Groceries');
  }
  await addTransaction(client, 'expense', 2000, 'Transport', seedDate(MONTH, 4), 'Commute');
  await addTransaction(client, 'expense', 4000, 'Bills', seedDate(MONTH, 6), 'Utilities');
  await addTransaction(client, 'expense', 5000, 'Shopping', seedDate(MONTH, 7), 'Clothes');
  await addTransaction(client, 'expense', 199, 'Entertainment', seedDate(MONTH, 5), 'Streaming');
  await addTransaction(client, 'expense', 45000, 'Health', seedDate(MONTH, 9), 'Hospital bill');
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child && child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${BASE}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
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

  let serverLog = '';
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
      name: 'Analytics Verify A',
      email: 'verify.a@spendwise.test',
      password: 'verify-pass-123',
      confirmPassword: 'verify-pass-123',
    });
    check('register user A', registerA.status === 201, registerA.data);
    const userAId = registerA.data && registerA.data.user ? registerA.data.user.id : null;
    check('register returns user id', Number.isInteger(userAId), registerA.data);

    const monthShopping = { 6: 1000, 7: 2000, 8: 3000, 9: 4000 };
    for (const month of [6, 7, 8, 9]) {
      await seedPriorMonth(userA, month, monthShopping[month]);
    }
    await seedCurrentMonth(userA);

    for (const [category, amount] of [
      ['Food', 9000],
      ['Transport', 2000],
      ['Bills', 4000],
      ['Shopping', 5000],
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
    check('plan saved', plan.status === 200 && plan.data.savings_target === 10000, plan.data);

    const savedPlan = await userA('GET', `/api/analytics/plan?month=${MONTH}&year=${YEAR}`);
    check(
      'plan round-trips',
      savedPlan.status === 200 && savedPlan.data.objective === 'savings',
      savedPlan.data
    );

    const overview = await userA(
      'GET',
      `/api/analytics/overview?month=${MONTH}&year=${YEAR}`
    );
    check('overview returns 200', overview.status === 200, overview.data);
    const o = overview.data || {};

    check('overview period key', o.period && o.period.key === `${YEAR}-10`, o.period);
    check(
      'coverage sees four completed months',
      o.coverage && o.coverage.expenseMonths >= 4,
      o.coverage && o.coverage.expenseMonths
    );
    check(
      'coverage tier is at least 2',
      o.coverage && o.coverage.tier && o.coverage.tier.level >= 2,
      o.coverage && o.coverage.tier
    );
    const envelopeGate =
      o.coverage &&
      Array.isArray(o.coverage.readiness) &&
      o.coverage.readiness.find((item) => item.key === 'envelope');
    check(
      'envelope readiness is available',
      envelopeGate && envelopeGate.status === 'available',
      envelopeGate
    );

    const tierReadiness =
      o.coverage && Array.isArray(o.coverage.readiness) ? o.coverage.readiness : [];
    check(
      'readiness entries explain unlocks',
      tierReadiness.length >= 8 && tierReadiness.every((item) => Array.isArray(item.missing)),
      tierReadiness
    );
    const forecastGate = tierReadiness.find((item) => item.key === 'forecast');
    const backtestGate = tierReadiness.find((item) => item.key === 'backtest');
    check('forecast gate available at four months', forecastGate && forecastGate.status === 'available', forecastGate);
    check('backtest gate available at four months', backtestGate && backtestGate.status === 'available', backtestGate);

    check(
      'income proof uses the plan assumption',
      o.income && o.income.value === 60000 && o.income.method.includes('assumption'),
      o.income
    );
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const periodIsCurrent = o.period && o.period.key === `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    check(
      'safe-to-spend uses budgets and respects the period state',
      o.safeToSpend &&
        o.safeToSpend.usingBudgets === true &&
        o.safeToSpend.method &&
        (periodIsCurrent
          ? o.safeToSpend.daysRemaining > 0
          : o.safeToSpend.daysRemaining === 0 &&
            o.safeToSpend.method === 'not applicable to a completed month'),
      o.safeToSpend && {
        method: o.safeToSpend.method,
        daysRemaining: o.safeToSpend.daysRemaining,
        periodIsCurrent,
      }
    );
    check(
      'safe-to-spend carries trace and confidence',
      o.safeToSpend &&
        o.safeToSpend.trace &&
        o.safeToSpend.confidence &&
        Array.isArray(o.safeToSpend.inputs),
      o.safeToSpend && { trace: o.safeToSpend.trace, confidence: o.safeToSpend.confidence }
    );

    if (!periodIsCurrent) {
      const currentBudget = await userA('POST', '/api/budgets', {
        category: 'Food',
        amount: 7000,
        month: currentMonth,
        year: currentYear,
      });
      check('current-month budget seeded', currentBudget.status === 201, currentBudget.data);

      const currentOverview = await userA(
        'GET',
        `/api/analytics/overview?month=${currentMonth}&year=${currentYear}`
      );
      check(
        'safe-to-spend reports days remaining in the current month',
        currentOverview.status === 200 &&
          currentOverview.data.safeToSpend &&
          currentOverview.data.safeToSpend.usingBudgets === true &&
          currentOverview.data.safeToSpend.daysRemaining > 0 &&
          currentOverview.data.safeToSpend.trace &&
          currentOverview.data.safeToSpend.confidence,
        currentOverview.data && currentOverview.data.safeToSpend
      );
    }

    check(
      'pacing has a row per active category',
      o.pacing && Array.isArray(o.pacing.rows) && o.pacing.rows.length >= 6,
      o.pacing && o.pacing.rows && o.pacing.rows.length
    );
    const healthPacing =
      o.pacing && Array.isArray(o.pacing.rows)
        ? o.pacing.rows.find((row) => row.category === 'Health')
        : null;
    check(
      'Health pacing detects an exceeded budget',
      healthPacing && healthPacing.status === 'exceeded',
      healthPacing
    );

    check(
      'anomaly detects the health outlier',
      o.anomalies &&
        o.anomalies.total >= 1 &&
        Array.isArray(o.anomalies.items) &&
        o.anomalies.items.some((item) => item.category === 'Health'),
      o.anomalies
    );
    check(
      'detected subscription finds the streaming charge',
      o.recurrence &&
        o.recurrence.detected &&
        o.recurrence.detected.status === 'available' &&
        o.recurrence.detected.items.some((item) => item.category === 'Entertainment'),
      o.recurrence && o.recurrence.detected
    );

    check(
      'overview recommendation summary is available',
      o.recommendation && o.recommendation.status === 'available',
      o.recommendation
    );
    check(
      'overview insights are ranked and typed',
      o.insights &&
        Array.isArray(o.insights.items) &&
        o.insights.items.length > 0 &&
        o.insights.rankedBy,
      o.insights && { total: o.insights.total, rankedBy: o.insights.rankedBy }
    );
    check(
      'insights include a budget overrun signal',
      o.insights &&
        Array.isArray(o.insights.items) &&
        o.insights.items.some((item) => item.type === 'budget_exceeded'),
      o.insights && o.insights.items && o.insights.items.map((item) => item.type)
    );

    const insights = await userA(
      'GET',
      `/api/analytics/insights?month=${MONTH}&year=${YEAR}`
    );
    check(
      'insights endpoint returns coverage context',
      insights.status === 200 &&
        Array.isArray(insights.data.items) &&
        insights.data.coverage &&
        insights.data.coverage.tier,
      insights.data
    );

    const recommendation = await userA(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}`
    );
    check('recommendations returns 200', recommendation.status === 200, recommendation.data);
    const r = recommendation.data || {};
    check('recommendation is available', r.status === 'available', r);
    check('recommendation echoes savings objective', r.objective === 'savings', r.objective);
    check('recommendation is feasible', r.feasible === true && r.deficit === 0, {
      feasible: r.feasible,
      deficit: r.deficit,
    });
    check(
      'recommendation respects the envelope',
      Number(r.totalProposed) <= Number(r.envelope) + 0.01,
      { envelope: r.envelope, totalProposed: r.totalProposed }
    );
    check(
      'recommendation exposes income and envelope',
      r.income && r.income.value === 60000 && r.envelope === 50000,
      { income: r.income && r.income.value, envelope: r.envelope }
    );
    check(
      'recommendation categories carry floors, caps and evidence',
      Array.isArray(r.categories) &&
        r.categories.length >= 6 &&
        r.categories.every(
          (item) =>
            item.reason &&
            item.evidence &&
            typeof item.floor === 'number' &&
            typeof item.cap === 'number' &&
            typeof item.target === 'number'
        ),
      r.categories && r.categories.length
    );
    const foodRec = Array.isArray(r.categories)
      ? r.categories.find((item) => item.category === 'Food')
      : null;
    check(
      'essential floor protects historical spend',
      foodRec && foodRec.essential === true && foodRec.floor >= 7500,
      foodRec && { essential: foodRec.essential, floor: foodRec.floor }
    );

    const overrun = await userA(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}&objective=overrun`
    );
    check(
      'objective override is honored',
      overrun.status === 200 && overrun.data.objective === 'overrun',
      overrun.data && overrun.data.objective
    );

    const badObjective = await userA(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}&objective=bogus`
    );
    check('invalid objective returns 400', badObjective.status === 400, badObjective.data);

    const chosen = r.categories.slice(0, 3);
    const apply = await userA('POST', '/api/analytics/recommendations/apply', {
      month: MONTH,
      year: YEAR,
      categories: chosen.map((item) => ({ category: item.category, amount: item.target })),
    });
    check('apply returns 200', apply.status === 200, apply.data);
    check(
      'apply reports one entry per category',
      apply.data && Array.isArray(apply.data.applied) && apply.data.applied.length === 3,
      apply.data && apply.data.applied
    );
    check(
      'apply returns a batch id',
      apply.data && typeof apply.data.batchId === 'string' && apply.data.batchId.length > 10,
      apply.data && apply.data.batchId
    );

    const budgetsAfter = await userA('GET', `/api/budgets?month=${MONTH}&year=${YEAR}`);
    check('budgets endpoint returns 200', budgetsAfter.status === 200, budgetsAfter.data);
    const budgetRows = Array.isArray(budgetsAfter.data) ? budgetsAfter.data : [];
    const allApplied = chosen.every((item) => {
      const row = budgetRows.find((budget) => budget.category === item.category);
      return row && closeTo(row.amount, item.target);
    });
    check('applied budgets are persisted', allApplied, { chosen, budgetRows });

    const emptyApply = await userA('POST', '/api/analytics/recommendations/apply', {
      month: MONTH,
      year: YEAR,
      categories: [],
    });
    check('empty apply returns 400', emptyApply.status === 400, emptyApply.data);

    const invalidCategory = await userA('POST', '/api/analytics/recommendations/apply', {
      month: MONTH,
      year: YEAR,
      categories: [{ category: 'NotACategory', amount: 100 }],
    });
    check('unknown category returns 400', invalidCategory.status === 400, invalidCategory.data);

    const infeasiblePlan = await userA('PUT', '/api/analytics/plan', {
      month: MONTH,
      year: YEAR,
      income_assumption: 60000,
      savings_target: 59000,
      objective: 'savings',
    });
    check('infeasible plan saved', infeasiblePlan.status === 200, infeasiblePlan.data);

    const infeasible = await userA(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}`
    );
    check(
      'infeasible plan is reported, not hidden',
      infeasible.status === 200 &&
        infeasible.data.feasible === false &&
        infeasible.data.deficit > 0 &&
        infeasible.data.notes.length > 0,
      infeasible.data && {
        feasible: infeasible.data.feasible,
        deficit: infeasible.data.deficit,
        notes: infeasible.data.notes,
      }
    );

    const backtest = await userA(
      'GET',
      `/api/analytics/backtest?month=${MONTH}&year=${YEAR}&months=6`
    );
    check('backtest returns 200', backtest.status === 200, backtest.data);
    check(
      'forecast backtest has at least one fold',
      backtest.data &&
        backtest.data.forecast &&
        backtest.data.forecast.status === 'available' &&
        backtest.data.forecast.folds >= 1,
      backtest.data && backtest.data.forecast
    );
    const forecastBacktest = backtest.data && backtest.data.forecast;
    check(
      'forecast backtest reports naive baseline and skill',
      forecastBacktest &&
        typeof forecastBacktest.naiveMae === 'number' &&
        'skill' in forecastBacktest &&
        (typeof forecastBacktest.skill === 'number' || forecastBacktest.naiveMae === 0),
      forecastBacktest
    );
    check(
      'recommendation counterfactual produces totals',
      backtest.data &&
        backtest.data.recommendations &&
        backtest.data.recommendations.status === 'available' &&
        backtest.data.recommendations.totals,
      backtest.data && backtest.data.recommendations
    );

    const anonymous = makeClient();
    const unauthorized = await anonymous('GET', '/api/analytics/overview');
    check('unauthenticated request returns 401', unauthorized.status === 401, unauthorized.data);

    const month13 = await userA('GET', `/api/analytics/overview?month=13&year=${YEAR}`);
    check('month 13 returns 400', month13.status === 400, month13.data);

    const userB = makeClient();
    const registerB = await userB('POST', '/api/auth/register', {
      name: 'Analytics Verify B',
      email: 'verify.b@spendwise.test',
      password: 'verify-pass-123',
      confirmPassword: 'verify-pass-123',
    });
    check('register user B', registerB.status === 201, registerB.data);

    await addTransaction(userB, 'income', 20000, 'Salary', seedDate(9, 1), 'Salary');
    await addTransaction(userB, 'expense', 1000, 'Food', seedDate(9, 10), 'Groceries');
    await addTransaction(userB, 'expense', 500, 'Transport', seedDate(9, 12), 'Bus');
    await addTransaction(userB, 'expense', 1000, 'Bills', seedDate(9, 15), 'Electricity');

    const thinOverview = await userB(
      'GET',
      `/api/analytics/overview?month=${MONTH}&year=${YEAR}`
    );
    check('thin-history overview returns 200', thinOverview.status === 200, thinOverview.data);
    check(
      'one-month user sits at tier 1',
      thinOverview.data &&
        thinOverview.data.coverage &&
        thinOverview.data.coverage.expenseMonths === 1 &&
        thinOverview.data.coverage.tier.level === 1,
      thinOverview.data && thinOverview.data.coverage
    );
    check(
      'one-month user has a locked recommendation with missing steps',
      thinOverview.data &&
        thinOverview.data.recommendation &&
        thinOverview.data.recommendation.status === 'locked' &&
        Array.isArray(thinOverview.data.recommendation.missing) &&
        thinOverview.data.recommendation.missing.length > 0,
      thinOverview.data && thinOverview.data.recommendation
    );

    const thinRecommendation = await userB(
      'GET',
      `/api/analytics/recommendations?month=${MONTH}&year=${YEAR}`
    );
    check(
      'locked recommendation explains the gate',
      thinRecommendation.status === 200 &&
        thinRecommendation.data.status === 'locked' &&
        thinRecommendation.data.reason,
      thinRecommendation.data
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

    const appliedRows = await readDb(
      "SELECT COUNT(*) AS c FROM budget_recommendations WHERE status = 'applied'"
    );
    check(
      'applied recommendation rows are stored',
      appliedRows[0] && appliedRows[0].c === 3,
      appliedRows
    );

    const planRows = await readDb('SELECT COUNT(*) AS c FROM plans');
    check('plan row is stored', planRows[0] && planRows[0].c === 1, planRows);

    const appliedShopping = chosen.find((item) => item.category === 'Shopping');
    if (appliedShopping) {
      const shoppingRows = await readDb(
        'SELECT amount FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?',
        [userAId, 'Shopping', MONTH, YEAR]
      );
      check(
        'database budget matches the applied proposal',
        shoppingRows[0] && closeTo(shoppingRows[0].amount, appliedShopping.target),
        { shoppingRows, applied: appliedShopping.target }
      );
    }

    const evidenceRows = await readDb(
      "SELECT evidence_json FROM budget_recommendations WHERE status = 'applied' LIMIT 1"
    );
    let evidenceOk = false;
    try {
      const parsed = JSON.parse(evidenceRows[0].evidence_json);
      evidenceOk = typeof parsed.recommended === 'number' && typeof parsed.applied === 'number';
    } catch (err) {
      evidenceOk = false;
    }
    check('applied rows keep their evidence snapshot', evidenceOk, evidenceRows);
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
