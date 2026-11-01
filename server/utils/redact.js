const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const AMOUNT_PATTERN = /₹\s?-?[\d,]+(?:\.\d+)?/g;

function redactDetail(detail) {
  if (detail === null || detail === undefined) return detail;
  return String(detail)
    .replace(EMAIL_PATTERN, '[redacted email]')
    .replace(AMOUNT_PATTERN, '₹[redacted]');
}

module.exports = { redactDetail };
