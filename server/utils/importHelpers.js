const { validateAmount } = require('./validation');

const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_ROWS = 5000;
const IMPORT_ERROR_LIMIT = 50;

const MASKED_AMOUNT = '••••••••';
const MASKED_TEXT = '[hidden]';
const FORMULA_GUARD = /^'([=+\-@\t\r])/;

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapHeaders(headerRow, aliases) {
  const mapping = {};
  for (const [field, names] of Object.entries(aliases)) {
    const index = headerRow.findIndex((cell) => names.includes(normalizeHeader(cell)));
    if (index !== -1) mapping[field] = index;
  }
  return mapping;
}

function parseImportDate(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  let year;
  let month;
  let day;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseImportAmount(raw) {
  let value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return null;
  value = value
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/(₹|rs\.?|inr)$/i, '')
    .replace(/[\s,]/g, '');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  if (!validateAmount(amount)) return null;
  return Math.round(amount * 100) / 100;
}

function unguardFormula(value) {
  return String(value || '').replace(FORMULA_GUARD, '$1');
}

function isMaskedValue(value) {
  const text = String(value || '').trim();
  return text === MASKED_AMOUNT || text === MASKED_TEXT;
}

module.exports = {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_ERROR_LIMIT,
  normalizeHeader,
  mapHeaders,
  parseImportDate,
  parseImportAmount,
  unguardFormula,
  isMaskedValue,
};
