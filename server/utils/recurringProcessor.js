const query = require('../database/query');
const { encrypt, decrypt } = require('./encryption');
const logAudit = require('./auditLogger');

function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addFrequency(date, frequency) {
  const d = new Date(date + 'T00:00:00');
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    const currentMonth = d.getMonth();
    d.setMonth(d.getMonth() + 1);
    if (d.getMonth() === currentMonth) {
      d.setDate(0);
    }
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }
  return formatLocalYMD(d);
}

async function processDueRecurring(userId) {
  const today = formatLocalYMD(new Date());

  const dueRows = await query.all(
    'SELECT * FROM recurring_transactions WHERE user_id = ? AND is_active = 1 AND next_occurrence <= ?',
    [userId, today]
  );

  if (dueRows.length === 0) {
    return { created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const row of dueRows) {
    const recurringDesc = row.description || '';
    const existingRows = await query.all(
      `SELECT description_encrypted FROM transactions
       WHERE user_id = ? AND type = ? AND category = ? AND date = ?`,
      [userId, row.type, row.category, today]
    );

    let duplicateFound = false;
    for (const txRow of existingRows) {
      let txDesc = '';
      try {
        if (txRow.description_encrypted) {
          txDesc = decrypt(txRow.description_encrypted) || '';
        }
      } catch (err) {
        txDesc = '';
      }
      if (txDesc === recurringDesc) {
        duplicateFound = true;
        break;
      }
    }

    if (duplicateFound) {
      skipped++;
      continue;
    }

    const encryptedDesc = encrypt(row.description || '');

    const result = await query.run(
      'INSERT INTO transactions (user_id, type, amount, category, description_encrypted, date, recurring_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, row.type, Number(row.amount), row.category, encryptedDesc, today, row.id]
    );

    created++;

    logAudit(userId, 'transaction_created_from_recurring', 'transaction', `Created transaction #${result.lastID} from recurring #${row.id}`, 'system');

    const nextDate = addFrequency(row.next_occurrence, row.frequency);

    await query.run(
      'UPDATE recurring_transactions SET next_occurrence = ? WHERE id = ?',
      [nextDate, row.id]
    );
  }

  return { created, skipped };
}

async function processAllDueRecurring() {
  const users = await query.all('SELECT id FROM users');
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const user of users) {
    const result = await processDueRecurring(user.id);
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  if (totalCreated > 0) {
    console.log('[recurring] Processed due recurring templates:', { created: totalCreated, skipped: totalSkipped });
  }

  return { created: totalCreated, skipped: totalSkipped };
}

module.exports = {
  processDueRecurring,
  processAllDueRecurring,
  addFrequency,
};
