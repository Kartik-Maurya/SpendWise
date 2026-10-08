require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');

const db = require('./database/init');
const { processAllDueRecurring } = require('./utils/recurringProcessor');

const app = express();
const PORT = process.env.PORT || 5000;

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
    secret: process.env.SESSION_SECRET || 'dev-insecure-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
app.use('/api/audit', require('./routes/audit'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SpendWise API v2.0.0' });
});

app.get('/', (req, res) => {
  res.send('SpendWise API v2.0.0 is running');
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
