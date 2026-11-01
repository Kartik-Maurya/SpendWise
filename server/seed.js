require('dotenv').config();

const db = require('./database/init');
const query = require('./database/query');
const { loadDemoData } = require('./demo/service');

db.ready
  .then(async () => {
    const user = await query.get('SELECT id, email FROM users WHERE email = ?', [
      'local@spendwise.app',
    ]);
    if (!user) {
      throw new Error('The local@spendwise.app user does not exist');
    }

    const result = await loadDemoData(user.id);

    if (result.alreadyLoaded) {
      console.log('Demo data is already loaded for %s (id=%d).', user.email, user.id);
      console.log('  Transactions: %d', result.status.transactions);
      console.log('  Budgets: %d', result.status.budgets);
      console.log('  Recurring templates: %d', result.status.recurring);
      console.log('  Monthly plans: %d', result.status.plans);
    } else {
      console.log('Seeded demo data for %s (id=%d):', user.email, user.id);
      console.log('  Transactions: %d', result.loaded.transactions);
      console.log('  Budgets: %d', result.loaded.budgets);
      console.log('  Recurring templates: %d', result.loaded.recurring);
      console.log('  Monthly plans: %d', result.loaded.plans);

      if (result.skipped.budgets.length > 0) {
        console.log('  Skipped existing budgets: %s', result.skipped.budgets.join(', '));
      }
      if (result.skipped.recurring) {
        console.log('  Skipped recurring templates because this account already has its own.');
      }
      if (result.skipped.plan) {
        console.log('  Skipped the monthly plan because this month already has one.');
      }
    }

    await new Promise((resolve, reject) => {
      db.close((err) => (err ? reject(err) : resolve()));
    });
  })
  .catch(async (err) => {
    console.error('Seeding failed:', err.message);
    try {
      await new Promise((resolve) => db.close(() => resolve()));
    } catch (closeErr) {
      // ignore close errors after a failed seed
    }
    process.exit(1);
  });
