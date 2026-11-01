const ExcelJS = require('exceljs');
const query = require('../database/query');
const { decrypt } = require('../utils/encryption');
const { csvEscape, csvText } = require('../utils/csv');
const logAudit = require('../utils/auditLogger');
const analyticsController = require('./analyticsController');
const { buildMonthlyReport } = require('../report/monthly');
const { version: APP_VERSION } = require('../package.json');

const MASK = '••••••••';
const HIDDEN = '[hidden]';
const DATASETS = ['transactions', 'recurring', 'budgets', 'plans'];
const RESOURCE = {
  transactions: 'transaction',
  recurring: 'recurring',
  budgets: 'budget',
  plans: 'plan',
};

function parsePrivacy(value) {
  return /^(1|true|on)$/i.test(String(value || ''));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function timestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-') + `_${pad2(date.getHours())}${pad2(date.getMinutes())}`;
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

function hasDescription(row) {
  return Boolean(row.description_encrypted || row.description);
}

function descriptionFor(row, privacy) {
  if (privacy) return hasDescription(row) ? HIDDEN : '';
  return readDescription(row);
}

function amountFor(amount, privacy) {
  return privacy ? MASK : Number(amount).toFixed(2);
}

function nullableAmountFor(amount, privacy) {
  if (amount === null || amount === undefined || amount === '') return '';
  return amountFor(amount, privacy);
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function parseDateTime(value) {
  if (!value) return null;
  const text = String(value).trim().replace(' ', 'T');
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function loadDataset(dataset, userId) {
  switch (dataset) {
    case 'transactions':
      return query.all(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC',
        [userId]
      );
    case 'recurring':
      return query.all(
        'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
    case 'budgets':
      return query.all(
        'SELECT * FROM budgets WHERE user_id = ? ORDER BY year DESC, month DESC, category ASC',
        [userId]
      );
    case 'plans':
      return query.all(
        'SELECT * FROM plans WHERE user_id = ? ORDER BY year DESC, month DESC',
        [userId]
      );
    default:
      throw new Error(`Unsupported export dataset: ${dataset}`);
  }
}

function buildCsvDataset(dataset, rows, privacy) {
  if (dataset === 'transactions') {
    return {
      headers: ['Date', 'Type', 'Amount', 'Category', 'Description'],
      rows: rows.map((row) => [
        row.date,
        csvText(row.type),
        amountFor(row.amount, privacy),
        csvText(row.category),
        csvText(descriptionFor(row, privacy)),
      ]),
    };
  }

  if (dataset === 'recurring') {
    return {
      headers: [
        'Type',
        'Amount',
        'Category',
        'Description',
        'Frequency',
        'Next Occurrence',
        'Status',
        'Created At',
      ],
      rows: rows.map((row) => [
        csvText(row.type),
        amountFor(row.amount, privacy),
        csvText(row.category),
        csvText(descriptionFor(row, privacy)),
        csvText(row.frequency),
        row.next_occurrence,
        row.is_active ? 'Active' : 'Paused',
        row.created_at,
      ]),
    };
  }

  if (dataset === 'budgets') {
    return {
      headers: ['Month', 'Year', 'Category', 'Amount', 'Created At'],
      rows: rows.map((row) => [
        row.month,
        row.year,
        csvText(row.category),
        amountFor(row.amount, privacy),
        row.created_at,
      ]),
    };
  }

  return {
    headers: [
      'Month',
      'Year',
      'Objective',
      'Income Assumption',
      'Savings Target',
      'Updated At',
    ],
    rows: rows.map((row) => [
      row.month,
      row.year,
      csvText(row.objective),
      nullableAmountFor(row.income_assumption, privacy),
      nullableAmountFor(row.savings_target, privacy),
      row.updated_at,
    ]),
  };
}

function sendCsv(res, filename, table) {
  const lines = [table.headers.map(csvEscape).join(',')];
  for (const row of table.rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  const csv = `\uFEFF${lines.join('\n')}`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
  res.send(csv);
}

function sendJson(res, filename, payload) {
  const json = JSON.stringify(payload, null, 2);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8'));
  res.send(json);
}

function buildBackup(rowsByDataset, privacy) {
  const { transactions, recurring, budgets, plans } = rowsByDataset;

  return {
    app: 'SpendWise',
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    privacy_mode: privacy,
    counts: {
      transactions: transactions.length,
      recurring: recurring.length,
      budgets: budgets.length,
      plans: plans.length,
    },
    excluded: ['audit_logs', 'account_credentials', 'budget_recommendations'],
    datasets: {
      transactions: transactions.map((row) => ({
        id: row.id,
        type: row.type,
        amount: privacy ? MASK : row.amount,
        category: row.category,
        description: descriptionFor(row, privacy),
        date: row.date,
        created_at: row.created_at,
        recurring_id: row.recurring_id ?? null,
        is_essential: row.is_essential ?? null,
        merchant: privacy && row.merchant ? HIDDEN : row.merchant ?? null,
      })),
      recurring: recurring.map((row) => ({
        id: row.id,
        type: row.type,
        amount: privacy ? MASK : row.amount,
        category: row.category,
        description: descriptionFor(row, privacy),
        frequency: row.frequency,
        next_occurrence: row.next_occurrence,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
      })),
      budgets: budgets.map((row) => ({
        id: row.id,
        category: row.category,
        amount: privacy ? MASK : row.amount,
        month: row.month,
        year: row.year,
        created_at: row.created_at,
      })),
      plans: plans.map((row) => ({
        id: row.id,
        month: row.month,
        year: row.year,
        objective: row.objective,
        income_assumption:
          row.income_assumption === null
            ? null
            : privacy
              ? MASK
              : row.income_assumption,
        savings_target:
          row.savings_target === null ? null : privacy ? MASK : row.savings_target,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    },
  };
}

function addDataSheet(workbook, definition) {
  const sheet = workbook.addWorksheet(definition.name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = definition.headers.map((header, index) => {
    const column = definition.columns[index] || {};
    return {
      header,
      key: `column${index}`,
      width: column.width || 16,
      style: column.numFmt ? { numFmt: column.numFmt } : {},
    };
  });

  for (const row of definition.rows) {
    sheet.addRow(row);
  }

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0B5F59' } } };
  });

  definition.columns.forEach((column, index) => {
    if (!column || !column.wrap) return;
    sheet.getColumn(index + 1).alignment = { vertical: 'top', wrapText: true };
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: definition.headers.length },
  };

  return sheet;
}

function buildWorkbook(rowsByDataset, privacy) {
  const { transactions, recurring, budgets, plans } = rowsByDataset;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SpendWise';
  workbook.lastModifiedBy = 'SpendWise';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = 'SpendWise data export';
  workbook.subject = 'Personal finance data exported from SpendWise';
  workbook.description = privacy
    ? 'Export generated with privacy mode on; amounts and descriptions are masked.'
    : 'Export generated with privacy mode off.';

  addDataSheet(workbook, {
    name: 'Transactions',
    headers: ['Date', 'Type', 'Amount', 'Category', 'Description', 'Created At', 'Recurring'],
    rows: transactions.map((row) => [
      parseDateOnly(row.date),
      row.type,
      privacy ? MASK : Number(row.amount),
      row.category,
      descriptionFor(row, privacy),
      parseDateTime(row.created_at),
      row.recurring_id ? 'Yes' : 'No',
    ]),
    columns: [
      { width: 14, numFmt: 'yyyy-mm-dd' },
      { width: 12 },
      { width: 14, numFmt: '#,##0.00' },
      { width: 20 },
      { width: 44, wrap: true },
      { width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
      { width: 12 },
    ],
  });

  addDataSheet(workbook, {
    name: 'Recurring',
    headers: [
      'Type',
      'Amount',
      'Category',
      'Description',
      'Frequency',
      'Next Occurrence',
      'Status',
      'Created At',
    ],
    rows: recurring.map((row) => [
      row.type,
      privacy ? MASK : Number(row.amount),
      row.category,
      descriptionFor(row, privacy),
      row.frequency,
      parseDateOnly(row.next_occurrence),
      row.is_active ? 'Active' : 'Paused',
      parseDateTime(row.created_at),
    ]),
    columns: [
      { width: 12 },
      { width: 14, numFmt: '#,##0.00' },
      { width: 20 },
      { width: 44, wrap: true },
      { width: 12 },
      { width: 16, numFmt: 'yyyy-mm-dd' },
      { width: 10 },
      { width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
    ],
  });

  addDataSheet(workbook, {
    name: 'Budgets',
    headers: ['Month', 'Year', 'Category', 'Amount', 'Created At'],
    rows: budgets.map((row) => [
      row.month,
      row.year,
      row.category,
      privacy ? MASK : Number(row.amount),
      parseDateTime(row.created_at),
    ]),
    columns: [
      { width: 10 },
      { width: 8 },
      { width: 20 },
      { width: 14, numFmt: '#,##0.00' },
      { width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
    ],
  });

  addDataSheet(workbook, {
    name: 'Plans',
    headers: [
      'Month',
      'Year',
      'Objective',
      'Income Assumption',
      'Savings Target',
      'Updated At',
    ],
    rows: plans.map((row) => [
      row.month,
      row.year,
      row.objective,
      row.income_assumption === null
        ? null
        : privacy
          ? MASK
          : Number(row.income_assumption),
      row.savings_target === null ? null : privacy ? MASK : Number(row.savings_target),
      parseDateTime(row.updated_at),
    ]),
    columns: [
      { width: 10 },
      { width: 8 },
      { width: 12 },
      { width: 18, numFmt: '#,##0.00' },
      { width: 18, numFmt: '#,##0.00' },
      { width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
    ],
  });

  const about = workbook.addWorksheet('About', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  about.columns = [
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Value', key: 'value', width: 92 },
  ];
  const counts = {
    transactions: transactions.length,
    recurring: recurring.length,
    budgets: budgets.length,
    plans: plans.length,
  };
  const aboutRows = [
    ['Export generated', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
    ['Application', `SpendWise ${APP_VERSION}`],
    ['Privacy mode', privacy ? 'On — amounts and descriptions masked' : 'Off'],
    ['Transactions', counts.transactions],
    ['Recurring schedules', counts.recurring],
    ['Budgets', counts.budgets],
    ['Plans', counts.plans],
    [
      'Included',
      'Transactions (including entries generated from recurring schedules), recurring schedules, budgets and monthly plans.',
    ],
    [
      'Excluded',
      'Audit logs, account credentials, owner IDs, encrypted blobs and derived budget recommendations.',
    ],
    [
      'Dates',
      'Stored as real Excel dates formatted YYYY-MM-DD (timestamps use YYYY-MM-DD HH:MM).',
    ],
    [
      'Re-import',
      'The first five columns of the Transactions sheet match the CSV import format used by Transactions → Import CSV.',
    ],
  ];
  for (const row of aboutRows) {
    about.addRow(row);
  }
  const aboutHeader = about.getRow(1);
  aboutHeader.height = 22;
  aboutHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  aboutHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  about.getColumn(2).alignment = { vertical: 'top', wrapText: true };
  about.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 2 } };

  return workbook;
}

exports.exportCSV = async (req, res, next) => {
  try {
    const rawDataset = Array.isArray(req.query.dataset)
      ? req.query.dataset[0]
      : req.query.dataset;
    const dataset = String(rawDataset || 'transactions').toLowerCase();
    if (!DATASETS.includes(dataset)) {
      return res.status(400).json({
        error: `Unknown export dataset. Choose one of: ${DATASETS.join(', ')}`,
      });
    }

    const privacy = parsePrivacy(req.query.privacy);
    const rows = await loadDataset(dataset, req.user.id);
    const table = buildCsvDataset(dataset, rows, privacy);
    const filename = `spendwise-${dataset}_${timestamp()}.csv`;

    logAudit(
      req.user.id,
      'data_exported',
      RESOURCE[dataset],
      `Exported ${rows.length} ${dataset} row(s) to CSV${privacy ? ' with sensitive fields masked' : ''}`,
      req.ip
    );

    sendCsv(res, filename, table);
  } catch (err) {
    next(err);
  }
};

exports.exportBackup = async (req, res, next) => {
  try {
    const privacy = parsePrivacy(req.query.privacy);
    const [transactions, recurring, budgets, plans] = await Promise.all([
      loadDataset('transactions', req.user.id),
      loadDataset('recurring', req.user.id),
      loadDataset('budgets', req.user.id),
      loadDataset('plans', req.user.id),
    ]);

    const backup = buildBackup({ transactions, recurring, budgets, plans }, privacy);
    const filename = `spendwise-backup_${timestamp()}.json`;

    logAudit(
      req.user.id,
      'data_exported',
      'backup',
      `Exported a full backup (${backup.counts.transactions} transaction(s), ${backup.counts.recurring} recurring schedule(s), ${backup.counts.budgets} budget(s), ${backup.counts.plans} plan(s))${privacy ? ' with sensitive fields masked' : ''}`,
      req.ip
    );

    sendJson(res, filename, backup);
  } catch (err) {
    next(err);
  }
};

exports.exportWorkbook = async (req, res, next) => {
  try {
    const privacy = parsePrivacy(req.query.privacy);
    const [transactions, recurring, budgets, plans] = await Promise.all([
      loadDataset('transactions', req.user.id),
      loadDataset('recurring', req.user.id),
      loadDataset('budgets', req.user.id),
      loadDataset('plans', req.user.id),
    ]);

    const workbook = buildWorkbook({ transactions, recurring, budgets, plans }, privacy);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `spendwise-data_${timestamp()}.xlsx`;

    logAudit(
      req.user.id,
      'data_exported',
      'workbook',
      `Exported an Excel workbook (${transactions.length} transaction(s), ${recurring.length} recurring schedule(s), ${budgets.length} budget(s), ${plans.length} plan(s))${privacy ? ' with sensitive fields masked' : ''}`,
      req.ip
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

exports.exportMonthlyReport = async (req, res, next) => {
  try {
    const { month, year } = analyticsController.parsePeriod(req.query);
    const privacy = /^(1|true|on)$/i.test(String(req.query.privacy || ''));
    const [data, user] = await Promise.all([
      analyticsController.assemble(req.user.id, month, year),
      query.get('SELECT name FROM users WHERE id = ?', [req.user.id]),
    ]);

    const html = buildMonthlyReport({ user, data, privacy });
    const filename = `spendwise-report-${year}-${String(month).padStart(2, '0')}.html`;

    logAudit(
      req.user.id,
      'report_exported',
      'report',
      `Generated the monthly report for ${month}/${year}${privacy ? ' with amounts hidden' : ''}`,
      req.ip
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"
    );
    res.setHeader('Content-Length', Buffer.byteLength(html, 'utf8'));
    res.send(html);
  } catch (err) {
    next(err);
  }
};
