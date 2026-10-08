require('dotenv').config();

const db = require('./database/init');
const { encrypt } = require('./utils/encryption');

db.ready.then(async () => {
  const sampleTransactions = [
    { type: 'income', amount: 50000, category: 'Salary', description: 'Monthly salary', date: '2026-09-01' },
    { type: 'income', amount: 5000, category: 'Freelance', description: 'Freelance project', date: '2026-09-03' },
    { type: 'expense', amount: 1200, category: 'Food', description: 'Groceries', date: '2026-09-02' },
    { type: 'expense', amount: 300, category: 'Transport', description: 'Metro pass', date: '2026-09-02' },
    { type: 'expense', amount: 2000, category: 'Shopping', description: 'New shoes', date: '2026-09-04' },
    { type: 'expense', amount: 1500, category: 'Bills', description: 'Electricity bill', date: '2026-09-05' },
    { type: 'expense', amount: 500, category: 'Entertainment', description: 'Movie night', date: '2026-09-05' },
    { type: 'expense', amount: 400, category: 'Food', description: 'Lunch with friends', date: '2026-09-06' },
    { type: 'expense', amount: 800, category: 'Transport', description: 'Cab ride', date: '2026-09-06' },
    { type: 'income', amount: 2000, category: 'Investment', description: 'Dividend', date: '2026-09-07' },
    { type: 'expense', amount: 1500, category: 'Health', description: 'Medicine', date: '2026-09-07' },
    { type: 'expense', amount: 2500, category: 'Education', description: 'Online course', date: '2026-09-08' },
  ];

  const user = await db.get('SELECT id FROM users WHERE email = ?', ['local@spendwise.app']);
  const userId = user ? user.id : 1;

  const insert = db.prepare(
    'INSERT INTO transactions (user_id, type, amount, category, description_encrypted, date) VALUES (?, ?, ?, ?, ?, ?)'
  );

  let completed = 0;

  sampleTransactions.forEach((tx) => {
    const encryptedDesc = encrypt(tx.description);
    insert.run(
      [userId, tx.type, tx.amount, tx.category, encryptedDesc, tx.date],
      function (err) {
        if (err) {
          console.error('Failed to insert transaction:', err.message);
        }
        completed++;
        if (completed === sampleTransactions.length) {
          console.log(`Seeded ${completed} transactions successfully`);
          db.close();
          process.exit(0);
        }
      }
    );
  });
}).catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
