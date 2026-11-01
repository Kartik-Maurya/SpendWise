const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvText(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return FORMULA_PREFIX.test(str) ? `'${str}` : str;
}

function parseCsv(input) {
  let text = String(input || '');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    const error = new Error('The file has an unterminated quoted field');
    error.status = 400;
    throw error;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ''));
}

module.exports = {
  csvEscape,
  csvText,
  parseCsv,
};
