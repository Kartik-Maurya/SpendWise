require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const SQLiteStore = require('connect-sqlite3')(session);

const db = require('./database/init');
const { processAllDueRecurring } = require('./utils/recurringProcessor');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    console.error('SESSION_SECRET is required in production. Set it in server/.env.');
    process.exit(1);
  }
  sessionSecret = 'dev-insecure-change-in-production';
  console.warn('WARNING: SESSION_SECRET is not set; using an insecure development default.');
}
if (isProduction && sessionSecret.length < 32) {
  console.error('SESSION_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

const sessionStore = new SQLiteStore({
  db: `${path.basename(db.dbPath, path.extname(db.dbPath))}-sessions.db`,
  dir: path.dirname(db.dbPath),
  concurrentDB: true,
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(
  session({
    name: 'spendwise.sid',
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/import'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/demo', require('./routes/demo'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SpendWise API v3.0.0' });
});

app.get('/', (req, res) => {
  res.send('SpendWise API v3.0.0 is running');
});

app.use(require('./middleware/errorHandler'));

db.ready
  .then(async () => {
    await processAllDueRecurring();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  });
