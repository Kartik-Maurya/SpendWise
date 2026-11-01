const query = require('../database/query');
const { encrypt, decrypt } = require('../utils/encryption');
const logAudit = require('../utils/auditLogger');
const {
  DATASET_ORDER,
  DATASET_DEFINITIONS,
  parseImportFile,
  validateDataset,
  transactionKey,
  recurringKey,
  budgetKey,
  budgetSignature,
  planKey,
  planSignature,
} = require('../utils/importWorkbook');

const DATASET_INDEX = {};
DATASET_ORDER.forEach((key, index) => {
  DATASET_INDEX[key] = index;
});

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readDescription(row) {
  try {
    if (row.description_encrypted) return decrypt(row.description_encrypted) || '';
    if (row.description) return row.description;
  } catch (err) {
    return '';
  }
  return '';
}

function transactionSummary(row) {
  return `${row.date} · ${row.type} · ${row.amount} · ${row.category}`;
}

function recurringSummary(row) {
  return `${row.description} · ${row.frequency} · ${row.nextOccurrence}`;
}

function budgetSummary(row) {
  return `${row.category} · ${row.month}/${row.year}`;
}

function planSummary(row) {
  return `${row.month}/${row.year}`;
}

async function classifyTransactions(userId, entry, rows) {
  const existingCounts = new Map();
  if (rows.length) {
    const dates = rows.map((row) => row.date).sort();
    const existing = await query.all(
      'SELECT date, type, amount, category, description, description_encrypted FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?',
      [userId, dates[0], dates[dates.length - 1]]
    );
    for (const row of existing) {
      const key = transactionKey({
        date: row.date,
        type: row.type,
        amount: row.amount,
        category: row.category,
        description: readDescription(row),
      });
      existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
    }
  }

  for (const row of rows) {
    const key = transactionKey(row);
    const remaining = existingCounts.get(key) || 0;
    if (remaining > 0) {
      existingCounts.set(key, remaining - 1);
      entry.duplicates += 1;
      if (entry.duplicateRows.length < 20) {
        entry.duplicateRows.push({ line: row.line, summary: transactionSummary(row) });
      }
      continue;
    }
    entry.inserts.push(row);
  }
}

async function classifyRecurring(userId, entry, rows) {
  const existingCounts = new Map();
  if (rows.length) {
    const existing = await query.all(
      'SELECT type, amount, category, description, description_encrypted, frequency, next_occurrence, is_active FROM recurring_transactions WHERE user_id = ?',
      [userId]
    );
    for (const row of existing) {
      const key = recurringKey({
        type: row.type,
        amount: row.amount,
        category: row.category,
        description: readDescription(row),
        frequency: row.frequency,
        nextOccurrence: row.next_occurrence,
        isActive: row.is_active,
      });
      existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
    }
  }

  for (const row of rows) {
    const key = recurringKey(row);
    const remaining = existingCounts.get(key) || 0;
    if (remaining > 0) {
      existingCounts.set(key, remaining - 1);
      entry.duplicates += 1;
      if (entry.duplicateRows.length < 20) {
        entry.duplicateRows.push({ line: row.line, summary: recurringSummary(row) });
      }
      continue;
    }
    entry.inserts.push(row);
  }
}

async function classifyBudgets(userId, entry, rows) {
  const existing = await query.all('SELECT * FROM budgets WHERE user_id = ?', [userId]);
  const existingByKey = new Map();
  for (const row of existing) {
    existingByKey.set(budgetKey(row), row);
  }

  for (const row of rows) {
    const key = budgetKey(row);
    const current = existingByKey.get(key);

    if (!current) {
      existingByKey.set(key, row);
      entry.inserts.push(row);
      continue;
    }

    if (budgetSignature(row) === budgetSignature(current)) {
      entry.duplicates += 1;
      if (entry.duplicateRows.length < 20) {
        entry.duplicateRows.push({ line: row.line, summary: budgetSummary(row) });
      }
      continue;
    }

    entry.conflicts += 1;
    if (entry.conflictRows.length < 20) {
      entry.conflictRows.push({ line: row.line, summary: budgetSummary(row) });
    }
  }
}

async function classifyPlans(userId, entry, rows) {
  const existing = await query.all('SELECT * FROM plans WHERE user_id = ?', [userId]);
  const existingByKey = new Map();
  for (const row of existing) {
    existingByKey.set(planKey(row), {
      objective: row.objective,
      incomeAssumption: row.income_assumption === null ? null : Number(row.income_assumption),
      savingsTarget: row.savings_target === null ? null : Number(row.savings_target),
    });
  }

  for (const row of rows) {
    const key = planKey(row);
    const current = existingByKey.get(key);

    if (!current) {
      existingByKey.set(key, row);
      entry.inserts.push(row);
      continue;
    }

    if (planSignature(row) === planSignature(current)) {
      entry.duplicates += 1;
      if (entry.duplicateRows.length < 20) {
        entry.duplicateRows.push({ line: row.line, summary: planSummary(row) });
      }
      continue;
    }

    entry.conflicts += 1;
    if (entry.conflictRows.length < 20) {
      entry.conflictRows.push({ line: row.line, summary: planSummary(row) });
    }
  }
}

const CLASSIFIERS = {
  transactions: classifyTransactions,
  recurring: classifyRecurring,
  budgets: classifyBudgets,
  plans: classifyPlans,
};

async function buildPlan(userId, parsed) {
  const datasets = [];

  for (const key of DATASET_ORDER) {
    const source = parsed.datasets[key];
    const entry = {
      key,
      label: DATASET_DEFINITIONS[key].label,
      present: Boolean(source && source.present),
      headerError: (source && source.headerError) || null,
      totalRows: 0,
      rejected: 0,
      duplicates: 0,
      conflicts: 0,
      errors: [],
      duplicateRows: [],
      conflictRows: [],
      inserts: [],
    };

    if (entry.present && !entry.headerError && source.rows.length) {
      const result = validateDataset(key, source.rows);
      entry.totalRows = result.totalRows;
      entry.rejected = result.rejected;
      entry.errors = result.errors;
      if (!result.overflow) {
        await CLASSIFIERS[key](userId, entry, result.valid);
      }
    }

    datasets.push(entry);
  }

  return { format: parsed.format, datasets };
}

function serializePlan(plan) {
  return plan.datasets.map((entry) => ({
    key: entry.key,
    label: entry.label,
    present: entry.present,
    headerError: entry.headerError,
    totalRows: entry.totalRows,
    importable: entry.inserts.length,
    duplicates: entry.duplicates,
    conflicts: entry.conflicts,
    rejected: entry.rejected,
    errors: entry.errors,
    duplicateRows: entry.duplicateRows,
    conflictRows: entry.conflictRows,
  }));
}

function selectedKeys(body, plan) {
  const requested = body && body.datasets;
  const available = plan.datasets
    .filter((entry) => entry.present && !entry.headerError && entry.inserts.length > 0)
    .map((entry) => entry.key);

  if (requested === undefined) return available;
  if (!Array.isArray(requested)) {
    throw httpError(400, 'datasets must be an array of dataset keys');
  }

  const filtered = requested
    .map((key) => String(key))
    .filter((key, index, list) => DATASET_INDEX[key] !== undefined && list.indexOf(key) === index);

  return filtered.filter((key) => available.includes(key));
}

async function parseRequest(body) {
  const parsed = await parseImportFile(body || {});
  if (parsed.masked) {
    throw httpError(
      400,
      'That file was exported with privacy mode on, so amounts and descriptions are masked. Download it again with privacy mode off and import that copy.'
    );
  }
  return parsed;
}

exports.previewImport = async (req, res, next) => {
  try {
    const parsed = await parseRequest(req.body);
    const plan = await buildPlan(req.user.id, parsed);
    res.json({ format: plan.format, datasets: serializePlan(plan) });
  } catch (err) {
    next(err);
  }
};

exports.commitImport = async (req, res, next) => {
  let started = false;

  try {
    const parsed = await parseRequest(req.body);
    const plan = await buildPlan(req.user.id, parsed);
    const keys = selectedKeys(req.body, plan);

    if (!keys.length) {
      throw httpError(400, 'Nothing to import. Every selected dataset is empty, rejected or duplicated.');
    }

    const imported = {};
    keys.forEach((key) => {
      imported[key] = 0;
    });

    await query.run('BEGIN');
    started = true;

    for (const key of keys) {
      const entry = plan.datasets.find((item) => item.key === key);
      for (const row of entry.inserts) {
        if (key === 'transactions') {
          await query.run(
            'INSERT INTO transactions (user_id, type, amount, category, description_encrypted, date) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, row.type, row.amount, row.category, encrypt(row.description || ''), row.date]
          );
        } else if (key === 'recurring') {
          await query.run(
            `INSERT INTO recurring_transactions (user_id, description, description_encrypted, type, amount, category, frequency, next_occurrence, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.id,
              '',
              encrypt(row.description),
              row.type,
              row.amount,
              row.category,
              row.frequency,
              row.nextOccurrence,
              row.isActive,
            ]
          );
        } else if (key === 'budgets') {
          await query.run(
            'INSERT INTO budgets (user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, row.category, row.amount, row.month, row.year]
          );
        } else if (key === 'plans') {
          await query.run(
            `INSERT INTO plans (user_id, month, year, income_assumption, savings_target, objective, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              req.user.id,
              row.month,
              row.year,
              row.incomeAssumption,
              row.savingsTarget,
              row.objective,
            ]
          );
        }
        imported[key] += 1;
      }
    }

    await query.run('COMMIT');
    started = false;

    const resourceNames = {
      transactions: 'transaction',
      recurring: 'recurring',
      budgets: 'budget',
      plans: 'plan',
    };
    const formatLabel = plan.format === 'xlsx' ? 'Excel workbook' : 'JSON backup';

    for (const key of keys) {
      const entry = plan.datasets.find((item) => item.key === key);
      if (!imported[key]) continue;
      const noun = imported[key] === 1 ? resourceNames[key] : entry.label.toLowerCase();
      logAudit(
        req.user.id,
        `${key}_imported`,
        resourceNames[key],
        `Imported ${imported[key]} ${noun} from ${formatLabel} (${entry.duplicates} duplicate(s), ${entry.conflicts} conflict(s) skipped, ${entry.rejected} row(s) rejected)`,
        req.ip
      );
    }

    const totals = { imported: 0, duplicates: 0, conflicts: 0, rejected: 0 };
    for (const entry of plan.datasets) {
      if (!keys.includes(entry.key)) continue;
      totals.imported += imported[entry.key] || 0;
      totals.duplicates += entry.duplicates;
      totals.conflicts += entry.conflicts;
      totals.rejected += entry.rejected;
    }

    res.status(201).json({
      format: plan.format,
      imported,
      totals,
      datasets: serializePlan(plan).map((item) => ({
        ...item,
        imported: imported[item.key] || 0,
      })),
    });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[import] rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};
