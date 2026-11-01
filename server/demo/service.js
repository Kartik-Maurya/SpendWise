const query = require('../database/query');
const { encrypt } = require('../utils/encryption');
const { buildDemoDataset } = require('./dataset');

const loadingUsers = new Set();

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

async function getDemoStatus(userId) {
  const [
    demoTransactions,
    userTransactions,
    demoBudgets,
    userBudgets,
    demoRecurring,
    userRecurring,
    demoPlans,
    userPlans,
  ] = await Promise.all([
    query.get(
      `SELECT COUNT(*) AS count,
              COUNT(DISTINCT strftime('%Y-%m', date)) AS months,
              MIN(date) AS firstDate,
              MAX(date) AS lastDate
       FROM transactions
       WHERE user_id = ? AND is_demo = 1`,
      [userId]
    ),
    query.get('SELECT COUNT(*) AS count FROM transactions WHERE user_id = ? AND is_demo = 0', [
      userId,
    ]),
    query.get('SELECT COUNT(*) AS count FROM budgets WHERE user_id = ? AND is_demo = 1', [userId]),
    query.get('SELECT COUNT(*) AS count FROM budgets WHERE user_id = ? AND is_demo = 0', [userId]),
    query.get(
      'SELECT COUNT(*) AS count FROM recurring_transactions WHERE user_id = ? AND is_demo = 1',
      [userId]
    ),
    query.get(
      'SELECT COUNT(*) AS count FROM recurring_transactions WHERE user_id = ? AND is_demo = 0',
      [userId]
    ),
    query.get('SELECT COUNT(*) AS count FROM plans WHERE user_id = ? AND is_demo = 1', [userId]),
    query.get('SELECT COUNT(*) AS count FROM plans WHERE user_id = ? AND is_demo = 0', [userId]),
  ]);

  const transactions = Number(demoTransactions.count || 0);
  const budgets = Number(demoBudgets.count || 0);
  const recurring = Number(demoRecurring.count || 0);
  const plans = Number(demoPlans.count || 0);

  return {
    active: transactions + budgets + recurring + plans > 0,
    transactions,
    budgets,
    recurring,
    plans,
    months: Number(demoTransactions.months || 0),
    firstDate: demoTransactions.firstDate || null,
    lastDate: demoTransactions.lastDate || null,
    userTransactions: Number(userTransactions.count || 0),
    userBudgets: Number(userBudgets.count || 0),
    userRecurring: Number(userRecurring.count || 0),
    userPlans: Number(userPlans.count || 0),
    hasUserData:
      Number(userTransactions.count || 0) +
        Number(userBudgets.count || 0) +
        Number(userRecurring.count || 0) +
        Number(userPlans.count || 0) >
      0,
  };
}

async function loadDemoData(userId) {
  if (loadingUsers.has(userId)) {
    throw conflict('Demo data is already being changed. Try again in a moment.');
  }
  loadingUsers.add(userId);

  try {
    const before = await getDemoStatus(userId);
    if (before.active) {
      return {
        alreadyLoaded: true,
        loaded: { transactions: 0, budgets: 0, recurring: 0, plans: 0 },
        skipped: { budgets: [], recurring: false, plan: false },
        status: before,
      };
    }

    const dataset = buildDemoDataset(new Date());
    const loaded = { transactions: 0, budgets: 0, recurring: 0, plans: 0 };
    const skipped = { budgets: [], recurring: false, plan: false };
    let started = false;

    try {
      await query.run('BEGIN IMMEDIATE');
      started = true;

      const userRecurring = await query.get(
        'SELECT COUNT(*) AS count FROM recurring_transactions WHERE user_id = ? AND is_demo = 0',
        [userId]
      );
      const recurringIds = new Map();

      if (Number(userRecurring.count || 0) === 0) {
        for (const template of dataset.recurring) {
          const result = await query.run(
            `INSERT INTO recurring_transactions
              (user_id, description, description_encrypted, type, amount, category, frequency, next_occurrence, is_active, is_demo)
             VALUES (?, '', ?, ?, ?, ?, ?, ?, 1, 1)`,
            [
              userId,
              encrypt(template.description),
              template.type,
              template.amount,
              template.category,
              template.frequency,
              template.next_occurrence,
            ]
          );
          recurringIds.set(template.key, result.lastID);
          loaded.recurring += 1;
        }
      } else {
        skipped.recurring = true;
      }

      for (const transaction of dataset.transactions) {
        const recurringId = transaction.recurringKey
          ? recurringIds.get(transaction.recurringKey) || null
          : null;

        await query.run(
          `INSERT INTO transactions
            (user_id, type, amount, category, description, description_encrypted, date, is_essential, recurring_id, is_demo)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)`,
          [
            userId,
            transaction.type,
            transaction.amount,
            transaction.category,
            encrypt(transaction.description),
            transaction.date,
            transaction.isEssential === undefined ? null : transaction.isEssential,
            recurringId,
          ]
        );
        loaded.transactions += 1;
      }

      for (const budget of dataset.budgets) {
        const existing = await query.get(
          'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?',
          [userId, budget.category, budget.month, budget.year]
        );
        if (existing) {
          skipped.budgets.push(budget.category);
          continue;
        }

        await query.run(
          'INSERT INTO budgets (user_id, category, amount, month, year, is_demo) VALUES (?, ?, ?, ?, ?, 1)',
          [userId, budget.category, budget.amount, budget.month, budget.year]
        );
        loaded.budgets += 1;
      }

      const existingPlan = await query.get(
        'SELECT id FROM plans WHERE user_id = ? AND month = ? AND year = ?',
        [userId, dataset.plan.month, dataset.plan.year]
      );
      if (existingPlan) {
        skipped.plan = true;
      } else {
        await query.run(
          `INSERT INTO plans
            (user_id, month, year, income_assumption, savings_target, objective, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            userId,
            dataset.plan.month,
            dataset.plan.year,
            dataset.plan.income_assumption,
            dataset.plan.savings_target,
            dataset.plan.objective,
          ]
        );
        loaded.plans = 1;
      }

      await query.run('COMMIT');
      started = false;
    } catch (err) {
      if (started) {
        try {
          await query.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('[demo] rollback failed:', rollbackError.message);
        }
      }
      throw err;
    }

    const status = await getDemoStatus(userId);
    return { alreadyLoaded: false, loaded, skipped, status };
  } finally {
    loadingUsers.delete(userId);
  }
}

async function purgeDemoData(userId) {
  if (loadingUsers.has(userId)) {
    throw conflict('Demo data is already being changed. Try again in a moment.');
  }
  loadingUsers.add(userId);

  try {
    const before = await getDemoStatus(userId);
    if (!before.active) {
      return {
        removed: { transactions: 0, budgets: 0, recurring: 0, plans: 0 },
        status: before,
      };
    }

    let started = false;
    try {
      await query.run('BEGIN IMMEDIATE');
      started = true;

      const tables = ['transactions', 'budgets', 'recurring_transactions', 'plans'];
      for (const table of tables) {
        await query.run(`DELETE FROM ${table} WHERE user_id = ? AND is_demo = 1`, [userId]);
      }

      await query.run('COMMIT');
      started = false;
    } catch (err) {
      if (started) {
        try {
          await query.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('[demo] rollback failed:', rollbackError.message);
        }
      }
      throw err;
    }

    const status = await getDemoStatus(userId);
    return {
      removed: {
        transactions: before.transactions,
        budgets: before.budgets,
        recurring: before.recurring,
        plans: before.plans,
      },
      status,
    };
  } finally {
    loadingUsers.delete(userId);
  }
}

module.exports = {
  getDemoStatus,
  loadDemoData,
  purgeDemoData,
};
