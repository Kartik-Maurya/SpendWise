# SpendWise v2.0.0 — Secure Personal Finance Management Platform

SpendWise is an open-source personal finance management application that helps you track income and expenses, set budgets, and understand your financial health. Version 2.0.0 builds on the v1.0.0 MVP by adding user accounts, secure authentication, financial analytics, budget management, and a privacy-focused interface.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Stage 1 — Initial MVP (v1.0.0)

SpendWise v1.0.0 provided:

- **Dashboard** with balance, total income, total expenses, and transaction count
- **Add Transaction** — record income and expenses with type, amount, category, description, and date
- **Edit / Delete Transaction** — modify or remove transactions with confirmation
- **Transaction History** — view all transactions with clear income/expense distinction
- **Predefined Categories** — Income and expense categories for quick selection
- **SQLite Persistence** — all data stored locally
- **React/Vite Frontend + Express Backend REST API**

All Stage 1 functionality continues to work in v2.0.0.

---

## Stage 2 — Secure Finance Management Platform (v2.0.0)

SpendWise v2.0.0 adds:

### Financial Analytics
- **Spending by Category** — pie chart of expense distribution from real transaction data
- **Monthly Spending** — area chart showing income vs expenses over time
- **Income vs Expenses** — bar chart comparison
- **Analytics Summary** — highest spending category, monthly totals, net savings

### Budget Management
- **Monthly Category Budgets** — create, edit, delete budgets by category/month/year
- **Budget Progress** — tracks spent, remaining, and percentage used from actual transactions
- **Budget Warnings** — real-time alerts when spending approaches or exceeds a budget

### Transaction Search & Filtering
- **Search** by description and category
- **Filters** by type (income/expense), category, and date range
- **Sorting** by date or amount (ascending/descending)

### Recurring Transactions
- **Templates** for weekly, monthly, or yearly repeating transactions
- **Active/inactive** toggle
- **Next occurrence** tracking

### CSV Export
- Export transaction data to CSV (date, type, amount, category, description)
- Only exports the authenticated user's data
- Accessible from the **Settings** → Exports section and the **Transactions** page header (Export to CSV button)

### Security & Privacy
- **User Authentication** — register, login, logout with secure session management
- **Password Hashing** — bcryptjs (12 rounds)
- **Secure Sessions** — HttpOnly, SameSite, server-side Express sessions
- **Data Encryption** — AES-256-GCM encryption for transaction descriptions
- **Account Isolation** — users can only access their own data
- **Security Headers** — Helmet
- **Rate Limiting** — Protection on authentication endpoints
- **Server-Side Validation** — All inputs validated on the backend
- **Audit Logging** — Security and activity events
- **Privacy Mode** — Hide all monetary values across the app (transactions, dashboard, budgets, analytics) and blur charts when active; toggle from the Navbar or Settings

### User Experience
- **Improved Dashboard** — combined stats, charts, budget overview, warnings, recent transactions
- **Dark Mode** — Light, dark, and system themes
- **Responsive Design** — Desktop, tablet, and mobile optimized
- **Loading States** — Spinner and loading indicators
- **Empty States** — Helpful messages when no data exists
- **Notifications** — Success/error toast messages
- **Form Validation** — Real-time validation with error messages
- **Confirmation Dialogs** — Delete confirmations and safety checks

---

## Security

Security is implemented as **defense in depth** — multiple overlapping controls rather than a single boundary. This is a student project and is **not** production-grade banking software.

### Implemented Controls

| Control | Purpose |
|---|---|
| **Password Hashing** | Passwords hashed with bcryptjs (12 salt rounds), never stored in plaintext |
| **Authentication** | Session-based auth with unique user accounts |
| **Authorization** | Backend enforces that every query is scoped to the authenticated user's ID |
| **Secure Sessions** | HttpOnly, SameSite=Lax cookies with 24-hour expiration; sessions stored server-side |
| **Encryption at Rest** | Transaction descriptions encrypted with AES-256-GCM |
| **Rate Limiting** | Login (5/15min), registration (3/hour) endpoints protected |
| **Security Headers** | Helmet sets CSP, X-Frame-Options, X-Content-Type-Options, HSTS, and more |
| **Server-Side Validation** | All API inputs validated on the server; frontend validation is advisory only |
| **Audit Logging** | Security and activity events (login, logout, CRUD operations) logged per user |
| **SQL Injection Prevention** | All queries use parameterized prepared statements |
| **Error Handling** | Generic error messages returned to clients; internal details logged server-side only |

### Security Architecture Diagram

```
Browser (no tokens in localStorage)
  │
  │  HTTPS (session cookie: HttpOnly, SameSite=Lax)
  ▼
Express.js API
  ├─ Helmet (security headers)
  ├─ express-rate-limit (auth endpoints)
  ├─ express-session (server-side sessions)
  ├─ requireAuth middleware (authorization)
  ├─ Server-side validation (all inputs)
  └─ SQLite (parameterized queries)
       ├─ users.password_hash → bcryptjs
       └─ transactions.description_encrypted → AES-256-GCM
            └─ Key from ENCRYPTION_KEY env var (never in source)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + Recharts |
| **Backend** | Node.js + Express |
| **Database** | SQLite3 |
| **Password Hashing** | bcryptjs (12 rounds) |
| **Session Management** | express-session |
| **Security Headers** | Helmet |
| **Rate Limiting** | express-rate-limit |
| **Encryption** | Node.js crypto (AES-256-GCM) |
| **State Management** | React Context API |
| **Charts** | Recharts |

---

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm

### Clone the repository

```bash
git clone https://github.com/yourusername/spendwise.git
cd spendwise
```

### Install dependencies

```bash
npm run install-all
```

Or install manually:

```bash
npm install
cd server && npm install
cd ../client && npm install
```

### Configure environment variables

```bash
cd server
cp ../.env.example .env
```

Edit `.env` and set the following:

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default 5000) | No |
| `NODE_ENV` | `development` or `production` | No |
| `SESSION_SECRET` | Secret used to sign session cookies (use a strong random string) | **Yes** |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM (see below) | **Yes** |
| `CORS_ORIGIN` | Frontend URL for CORS (default `http://localhost:3000`) | No |

Generate secure values:

```bash
# Session secret
openssl rand -base64 48

# Encryption key (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Note:** If `ENCRYPTION_KEY` is not set, the server generates a random key and saves it to `server/.enc_key`. This file is gitignored. For consistent encryption across restarts, always set `ENCRYPTION_KEY` explicitly.

### Database setup and migration

The database is automatically migrated on server startup. If existing Stage 1 data is found:

1. New tables (`users`, `budgets`, `recurring_transactions`, `audit_logs`) are created.
2. A `user_id` column is added to `transactions`.
3. A `description_encrypted` column is added to `transactions`.
4. A default local user (`local@spendwise.app`) is created.
5. All existing transactions are assigned to this user.
6. Existing plaintext descriptions are encrypted with AES-256-GCM.

**Migration credentials for v1 data:**

| Email | Password |
|---|---|
| `local@spendwise.app` | `changeme123` |

> **Security:** These credentials are auto-generated for development. Change the password after first login, and never use them in production.

To seed sample data:

```bash
npm run seed
```

### Start development servers

```bash
# Start both frontend and backend
npm run dev
```

Or start separately:

```bash
# Backend
cd server
npm start

# Frontend (in another terminal)
cd client
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

---

## API Overview

All endpoints are under `/api/`. Authenticated endpoints require a valid session cookie.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in (rate-limited) |
| POST | `/api/auth/logout` | Log out and invalidate session |
| GET | `/api/auth/me` | Get current user |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (supports search, filter, sort) |
| GET | `/api/transactions/summary` | Get financial summary |
| GET | `/api/transactions/:id` | Get a single transaction |
| POST | `/api/transactions` | Create a transaction |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |

**Query parameters for listing transactions:**

| Parameter | Description |
|-----------|-------------|
| `type` | `income` or `expense` |
| `category` | Exact category match |
| `search` | Search in description and category |
| `startDate` | Filter by date >= (YYYY-MM-DD) |
| `endDate` | Filter by date <= (YYYY-MM-DD) |
| `sortBy` | `date`, `amount`, `created_at`, `id` |
| `sortOrder` | `asc` or `desc` |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/spending-by-category` | Expense totals grouped by category |
| GET | `/api/analytics/monthly-spending` | Monthly income and expenses |
| GET | `/api/analytics/income-vs-expenses` | Total income vs total expenses |
| GET | `/api/analytics/summary` | Highest category, monthly totals, net savings |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets (supports `month`, `year` params) |
| GET | `/api/budgets/warnings` | Get budget warnings |
| GET | `/api/budgets/:id` | Get a single budget |
| POST | `/api/budgets` | Create a budget |
| PUT | `/api/budgets/:id` | Update a budget |
| DELETE | `/api/budgets/:id` | Delete a budget |

### Recurring Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recurring` | List recurring transaction templates |
| GET | `/api/recurring/:id` | Get a single template |
| POST | `/api/recurring` | Create a template |
| PUT | `/api/recurring/:id` | Update a template |
| DELETE | `/api/recurring/:id` | Delete a template |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/csv` | Export transactions as CSV |

### Audit Log

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | Get user's audit log (supports `page`, `limit` params) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

---

## Testing

### Backend API tests

A test script is available to verify API functionality:

```bash
node server/test_api.js
```

### Manual testing

1. Start the servers (`npm run dev`)
2. Open `http://localhost:3000`
3. Register a new account or log in with the default user
4. Test all features: add/edit/delete transactions, budgets, analytics, etc.

### Security testing checklist

- [ ] Unauthenticated requests return 401
- [ ] User A cannot access User B's data
- [ ] Passwords are hashed (check database — `password_hash` column, never plaintext)
- [ ] Rate limiting triggers after repeated login attempts
- [ ] Security headers are present (check network tab)
- [ ] Transaction descriptions are encrypted in the database
- [ ] No secrets are committed to Git

---

## Project Structure

```
spendwise/
├── client/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── contexts/                # React Context providers
│   │   ├── pages/                   # Page components
│   │   ├── services/                # API client
│   │   ├── utils/                   # Helper utilities
│   │   ├── App.jsx                  # Main app with routing
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # All styles (light/dark themes)
│   ├── package.json
│   └── vite.config.js
├── server/                          # Backend (Express + SQLite)
│   ├── controllers/                 # Route controllers
│   ├── database/                    # Database init + migration
│   ├── middleware/                  # Auth, error handler
│   ├── routes/                      # API route definitions
│   ├── utils/                       # Encryption, validation, audit
│   ├── server.js                    # Express app
│   ├── seed.js                      # Sample data seeder
│   └── package.json
├── .env.example                     # Environment template
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json                     # Root package.json (shared scripts)
└── README.md
```

---

## Roadmap

### Completed

- v1.0.0 — Initial MVP (transactions, dashboard, SQLite)
- v2.0.0 — Secure finance management platform (auth, budgets, analytics, encryption)

### Future Ideas

- Transaction categories management (custom categories)
- Data import from banking APIs
- Export to additional formats (PDF, Excel)
- Mobile app (React Native)
- Multi-currency support
- Data backup/export with encryption

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
