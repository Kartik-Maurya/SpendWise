module.exports = function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message || err);

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction
    ? 'An internal server error occurred'
    : err.message || 'Internal server error';

  res.status(err.status || 500).json({ error: message });
};
