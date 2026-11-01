const ExcelJS = require('exceljs');
const {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  validateFrequency,
} = require('./validation');
const {
  IMPORT_MAX_ROWS,
  IMPORT_ERROR_LIMIT,
  normalizeHeader,
  mapHeaders,
  parseImportDate,
  parseImportAmount,
  unguardFormula,
  isMaskedValue,
} = require('./importHelpers');

const IMPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;

const DATASET_ORDER = ['transactions', 'recurring', 'budgets', 'plans'];

const DATASET_DEFINITIONS = {
  transactions: {
    label: 'Transactions',
    sheetNames: ['transactions'],
    required: ['date', 'amount', 'category'],
    requiredLabel: 'Date, Amount and Category',
    aliases: {
      date: ['date', 'transaction date', 'txn date'],
      type: ['type', 'transaction type', 'txn type'],
      amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
      category: ['category', 'head'],
      description: ['description', 'note', 'notes', 'memo', 'details'],
    },
    jsonFields: {
      date: 'date',
      type: 'type',
      amount: 'amount',
      category: 'category',
      description: 'description',
    },
  },
  recurring: {
    label: 'Recurring schedules',
    sheetNames: ['recurring', 'recurring schedules'],
    required: ['type', 'amount', 'category', 'description', 'frequency', 'nextOccurrence'],
    requiredLabel: 'Type, Amount, Category, Description, Frequency and Next Occurrence',
    aliases: {
      type: ['type', 'transaction type'],
      amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
      category: ['category', 'head'],
      description: ['description', 'note', 'notes', 'memo', 'details', 'name'],
      frequency: ['frequency', 'recurrence', 'schedule'],
      nextOccurrence: ['next occurrence', 'next date', 'next occurrence date', 'next_occurrence'],
      status: ['status', 'state', 'active'],
    },
    jsonFields: {
      type: 'type',
      amount: 'amount',
      category: 'category',
      description: 'description',
      frequency: 'frequency',
      nextOccurrence: 'next_occurrence',
      status: 'is_active',
    },
  },
  budgets: {
    label: 'Budgets',
    sheetNames: ['budgets'],
    required: ['month', 'year', 'category', 'amount'],
    requiredLabel: 'Month, Year, Category and Amount',
    aliases: {
      month: ['month'],
      year: ['year'],
      category: ['category', 'head'],
      amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
    },
    jsonFields: {
      month: 'month',
      year: 'year',
      category: 'category',
      amount: 'amount',
    },
  },
  plans: {
    label: 'Monthly plans',
    sheetNames: ['plans', 'monthly plans'],
    required: ['month', 'year'],
    requiredLabel: 'Month and Year',
    aliases: {
      month: ['month'],
      year: ['year'],
      objective: ['objective', 'goal'],
      incomeAssumption: ['income assumption', 'income_assumption', 'expected income'],
      savingsTarget: ['savings target', 'savings_target', 'savings goal'],
    },
    jsonFields: {
      month: 'month',
      year: 'year',
      objective: 'objective',
      incomeAssumption: 'income_assumption',
      savingsTarget: 'savings_target',
    },
  },
};

const TYPE_ALIASES = { income: 'income', credit: 'income', expense: 'expense', debit: 'expense' };
const STATUS_ALIASES = {
  active: 1,
  yes: 1,
  true: 1,
  '1': 1,
  paused: 0,
  inactive: 0,
  no: 0,
  false: 0,
  '0': 0,
};
const PLAN_OBJECTIVES = ['savings', 'overrun'];

const MASKED_HINT = 'Masked exports cannot be imported. Download without privacy mode first';

function utcDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return utcDateString(value);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }
    if (value.result !== undefined && value.result !== null) return cellText(value.result);
    if (value.text !== undefined && value.text !== null) return String(value.text);
    if (value.hyperlink) return String(value.hyperlink);
    return '';
  }
  return String(value);
}

function detectFormat(filename, buffer) {
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return 'xlsx';
  if (buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx';
  if (buffer.length && buffer.toString('utf8', 0, 1).trim() === '{') return 'json';
  return null;
}

function emptyDatasets() {
  const datasets = {};
  for (const key of DATASET_ORDER) {
    datasets[key] = { present: false, rows: [], headerError: null };
  }
  return datasets;
}

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const datasets = emptyDatasets();
  let masked = false;

  const about = workbook.worksheets.find(
    (sheet) => normalizeHeader(sheet.name) === 'about'
  );
  if (about) {
    about.eachRow((row) => {
      const label = normalizeHeader(cellText(row.getCell(1).value));
      const value = cellText(row.getCell(2).value);
      if (label === 'privacy mode' && /^on\b/i.test(value)) masked = true;
    });
  }

  const bySheet = new Map();
  for (const sheet of workbook.worksheets) {
    bySheet.set(normalizeHeader(sheet.name), sheet);
  }

  for (const key of DATASET_ORDER) {
    const definition = DATASET_DEFINITIONS[key];
    const sheet = definition.sheetNames
      .map((name) => bySheet.get(normalizeHeader(name)))
      .find(Boolean);
    if (!sheet) continue;

    const entry = datasets[key];
    entry.present = true;

    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      headers[columnNumber - 1] = cellText(cell.value);
    });

    const mapping = mapHeaders(headers, definition.aliases);
    const missing = definition.required.filter((field) => mapping[field] === undefined);
    if (missing.length) {
      entry.headerError = `Missing required column(s): ${missing.join(', ')}. Expected ${definition.requiredLabel}.`;
      continue;
    }

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const raw = { line: rowNumber };
      let hasValue = false;
      for (const [field, index] of Object.entries(mapping)) {
        const text = cellText(row.getCell(index + 1).value);
        raw[field] = text;
        if (text.trim() !== '') hasValue = true;
      }
      if (!hasValue) continue;
      if (isMaskedValue(raw.amount) || isMaskedValue(raw.description)) masked = true;
      entry.rows.push(raw);
    }
  }

  return { format: 'xlsx', masked, datasets };
}

function parseJson(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    const error = new Error('That file is not valid JSON');
    error.status = 400;
    throw error;
  }

  const datasets = emptyDatasets();
  const source = payload && payload.datasets;

  if (payload && payload.app && payload.app !== 'SpendWise') {
    const error = new Error(`That backup was created by ${payload.app}, not SpendWise`);
    error.status = 400;
    throw error;
  }

  if (!source || typeof source !== 'object') {
    const error = new Error(
      'That JSON file has no datasets. Use the backup downloaded from Settings → Export & backup.'
    );
    error.status = 400;
    throw error;
  }

  for (const key of DATASET_ORDER) {
    const list = source[key];
    if (!Array.isArray(list) || list.length === 0) continue;

    const definition = DATASET_DEFINITIONS[key];
    const entry = datasets[key];
    entry.present = true;

    list.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        entry.rows.push({ line: index + 1, invalidObject: true });
        return;
      }
      const raw = { line: index + 1 };
      for (const [field, jsonField] of Object.entries(definition.jsonFields)) {
        const value = item[jsonField];
        if (field === 'status' && typeof value === 'boolean') {
          raw[field] = value ? 'Active' : 'Paused';
        } else {
          raw[field] = value === null || value === undefined ? '' : String(value);
        }
      }
      entry.rows.push(raw);
    });
  }

  return {
    format: 'json',
    masked: Boolean(payload && payload.privacy_mode),
    datasets,
  };
}

async function parseImportFile({ filename, contentBase64 }) {
  if (typeof contentBase64 !== 'string' || contentBase64.trim() === '') {
    const error = new Error('Choose a .xlsx workbook or a JSON backup to import');
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (!buffer.length) {
    const error = new Error('That file appears to be empty');
    error.status = 400;
    throw error;
  }
  if (buffer.length > IMPORT_FILE_MAX_BYTES) {
    const error = new Error('Files must be 5 MB or smaller');
    error.status = 413;
    throw error;
  }

  const format = detectFormat(filename, buffer);
  if (!format) {
    const error = new Error('Only .xlsx workbooks and SpendWise JSON backups can be imported');
    error.status = 400;
    throw error;
  }

  let parsed;
  try {
    parsed = format === 'json' ? parseJson(buffer.toString('utf8')) : await parseWorkbook(buffer);
  } catch (err) {
    if (err.status) throw err;
    const error = new Error(
      format === 'xlsx'
        ? 'That workbook could not be read. Save it as .xlsx and try again'
        : 'That JSON file could not be read'
    );
    error.status = 400;
    throw error;
  }

  const present = DATASET_ORDER.some((key) => parsed.datasets[key].present);
  if (!present) {
    const error = new Error(
      'No Transactions, Recurring, Budgets or Plans data found. Expected the workbook downloaded from Settings → Export & backup.'
    );
    error.status = 400;
    throw error;
  }

  return parsed;
}

function resolveCategory(rawCategory, rawType, errors) {
  const raw = unguardFormula(rawCategory).trim();
  const key = raw.toLowerCase();
  const typeKey = String(rawType || '').trim().toLowerCase();

  if (!raw) {
    errors.push('Category is required');
    return { type: null, category: null };
  }

  if (typeKey) {
    const type = TYPE_ALIASES[typeKey];
    if (!type) {
      errors.push('Type must be income, expense, credit or debit');
      return { type: null, category: null };
    }
    const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = pool.find((item) => item.toLowerCase() === key);
    if (!category) {
      errors.push(`"${raw}" is not a ${type} category (${pool.join(', ')})`);
      return { type, category: null };
    }
    return { type, category };
  }

  const incomeCategory = INCOME_CATEGORIES.find((item) => item.toLowerCase() === key);
  if (incomeCategory) return { type: 'income', category: incomeCategory };

  const expenseCategory = EXPENSE_CATEGORIES.find((item) => item.toLowerCase() === key);
  if (expenseCategory) return { type: 'expense', category: expenseCategory };

  errors.push(
    `"${raw}" is not a known category (${[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].join(', ')})`
  );
  return { type: null, category: null };
}

function validateTransactions(rows) {
  const valid = [];
  const errors = [];

  rows.forEach((row) => {
    const rowErrors = [];
    if (row.invalidObject) {
      errors.push({ line: row.line, message: 'Entry is not an object' });
      return;
    }

    const date = parseImportDate(cellText(row.date));
    if (!date) rowErrors.push('Date must be YYYY-MM-DD or DD/MM/YYYY');

    const amount = parseImportAmount(cellText(row.amount));
    if (amount === null) {
      rowErrors.push(
        isMaskedValue(row.amount) ? MASKED_HINT : 'Amount must be a positive number'
      );
    }

    const { type, category } = resolveCategory(row.category, row.type, rowErrors);

    const description = unguardFormula(cellText(row.description));
    if (isMaskedValue(row.description)) {
      rowErrors.push(MASKED_HINT);
    } else if (description.length > 500) {
      rowErrors.push('Description must be 500 characters or fewer');
    }

    if (rowErrors.length) {
      errors.push({ line: row.line, message: rowErrors.join('; ') });
      return;
    }

    valid.push({ line: row.line, date, amount, type, category, description });
  });

  return { valid, errors };
}

function validateRecurring(rows) {
  const valid = [];
  const errors = [];

  rows.forEach((row) => {
    const rowErrors = [];
    if (row.invalidObject) {
      errors.push({ line: row.line, message: 'Entry is not an object' });
      return;
    }

    const type = cellText(row.type).trim().toLowerCase();
    if (type !== 'income' && type !== 'expense') {
      rowErrors.push('Type must be income or expense');
    }

    const amount = parseImportAmount(cellText(row.amount));
    if (amount === null) {
      rowErrors.push(
        isMaskedValue(row.amount) ? MASKED_HINT : 'Amount must be a positive number'
      );
    }

    const rawCategory = unguardFormula(cellText(row.category));
    let category = null;
    if (!rawCategory) {
      rowErrors.push('Category is required');
    } else if (type === 'income' || type === 'expense') {
      const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      category = pool.find((item) => item.toLowerCase() === rawCategory.toLowerCase());
      if (!category) rowErrors.push(`"${rawCategory}" is not a ${type} category`);
    }

    const rawDescription = cellText(row.description);
    const description = unguardFormula(rawDescription);
    if (!description) {
      rowErrors.push('Description is required');
    } else if (isMaskedValue(rawDescription)) {
      rowErrors.push(MASKED_HINT);
    } else if (description.length > 500) {
      rowErrors.push('Description must be 500 characters or fewer');
    }

    const frequency = cellText(row.frequency).trim().toLowerCase();
    if (!validateFrequency(frequency)) {
      rowErrors.push('Frequency must be weekly, monthly or yearly');
    }

    const nextOccurrence = parseImportDate(cellText(row.nextOccurrence));
    if (!nextOccurrence) rowErrors.push('Next Occurrence must be YYYY-MM-DD or DD/MM/YYYY');

    let isActive = 1;
    const rawStatus = cellText(row.status).trim();
    if (rawStatus) {
      const status = STATUS_ALIASES[rawStatus.toLowerCase()];
      if (status === undefined) {
        rowErrors.push('Status must be Active or Paused');
      } else {
        isActive = status;
      }
    }

    if (rowErrors.length) {
      errors.push({ line: row.line, message: rowErrors.join('; ') });
      return;
    }

    valid.push({
      line: row.line,
      type,
      amount,
      category,
      description,
      frequency,
      nextOccurrence,
      isActive,
    });
  });

  return { valid, errors };
}

function validateBudgets(rows) {
  const valid = [];
  const errors = [];

  rows.forEach((row) => {
    const rowErrors = [];
    if (row.invalidObject) {
      errors.push({ line: row.line, message: 'Entry is not an object' });
      return;
    }

    const month = Number(cellText(row.month));
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      rowErrors.push('Month must be between 1 and 12');
    }

    const year = Number(cellText(row.year));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      rowErrors.push('Year must be between 2000 and 2100');
    }

    const category = unguardFormula(cellText(row.category));
    if (!category) {
      rowErrors.push('Category is required');
    } else if (category.length > 100) {
      rowErrors.push('Category must be 100 characters or fewer');
    }

    const amount = parseImportAmount(cellText(row.amount));
    if (amount === null) {
      rowErrors.push(
        isMaskedValue(row.amount) ? MASKED_HINT : 'Amount must be a positive number'
      );
    }

    if (rowErrors.length) {
      errors.push({ line: row.line, message: rowErrors.join('; ') });
      return;
    }

    valid.push({ line: row.line, month, year, category, amount });
  });

  return { valid, errors };
}

function parseOptionalAmount(raw, label, errors) {
  const text = cellText(raw).trim();
  if (!text) return null;
  if (isMaskedValue(text)) {
    errors.push(MASKED_HINT);
    return null;
  }
  const number = Number(text.replace(/^(₹|rs\.?|inr)\s*/i, '').replace(/[\s,]/g, ''));
  if (!Number.isFinite(number) || number < 0 || number > 1e12) {
    errors.push(`${label} must be a non-negative number`);
    return null;
  }
  return Math.round(number * 100) / 100;
}

function validatePlans(rows) {
  const valid = [];
  const errors = [];

  rows.forEach((row) => {
    const rowErrors = [];
    if (row.invalidObject) {
      errors.push({ line: row.line, message: 'Entry is not an object' });
      return;
    }

    const month = Number(cellText(row.month));
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      rowErrors.push('Month must be between 1 and 12');
    }

    const year = Number(cellText(row.year));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      rowErrors.push('Year must be between 2000 and 2100');
    }

    const rawObjective = cellText(row.objective).trim().toLowerCase();
    const objective = rawObjective || 'savings';
    if (!PLAN_OBJECTIVES.includes(objective)) {
      rowErrors.push('Objective must be savings or overrun');
    }

    const incomeAssumption = parseOptionalAmount(
      row.incomeAssumption,
      'Income assumption',
      rowErrors
    );
    const savingsTarget = parseOptionalAmount(row.savingsTarget, 'Savings target', rowErrors);

    if (rowErrors.length) {
      errors.push({ line: row.line, message: rowErrors.join('; ') });
      return;
    }

    valid.push({ line: row.line, month, year, objective, incomeAssumption, savingsTarget });
  });

  return { valid, errors };
}

const VALIDATORS = {
  transactions: validateTransactions,
  recurring: validateRecurring,
  budgets: validateBudgets,
  plans: validatePlans,
};

function validateDataset(key, rows) {
  const definition = DATASET_DEFINITIONS[key];

  if (rows.length > IMPORT_MAX_ROWS) {
    return {
      totalRows: rows.length,
      valid: [],
      rejected: rows.length,
      errors: [
        {
          line: 0,
          message: `A single import can contain at most ${IMPORT_MAX_ROWS} ${definition.label.toLowerCase()}. Split the file and import it in parts.`,
        },
      ],
      overflow: true,
    };
  }

  const { valid, errors } = VALIDATORS[key](rows);
  return {
    totalRows: rows.length,
    valid,
    errors: errors.slice(0, IMPORT_ERROR_LIMIT),
    rejected: errors.length,
    overflow: false,
  };
}

function normText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function transactionKey(row) {
  return [
    row.date,
    row.type,
    Number(row.amount).toFixed(2),
    row.category,
    normText(row.description),
  ].join('|');
}

function recurringKey(row) {
  return [
    row.type,
    Number(row.amount).toFixed(2),
    row.category,
    normText(row.description),
    row.frequency,
    row.nextOccurrence,
    row.isActive ? 1 : 0,
  ].join('|');
}

function budgetKey(row) {
  return `${row.category}|${row.month}|${row.year}`;
}

function planKey(row) {
  return `${row.month}|${row.year}`;
}

function budgetSignature(row) {
  return Number(row.amount).toFixed(2);
}

function planSignature(row) {
  return [
    row.objective,
    row.incomeAssumption === null ? '' : Number(row.incomeAssumption).toFixed(2),
    row.savingsTarget === null ? '' : Number(row.savingsTarget).toFixed(2),
  ].join('|');
}

module.exports = {
  IMPORT_FILE_MAX_BYTES,
  DATASET_ORDER,
  DATASET_DEFINITIONS,
  MASKED_HINT,
  parseImportFile,
  validateDataset,
  transactionKey,
  recurringKey,
  budgetKey,
  budgetSignature,
  planKey,
  planSignature,
  normalizeHeader,
};
