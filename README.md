# SpendWise v3.0.0 — Personal Finance Management & Forecasting Platform

SpendWise is an open-source personal finance application that tracks income and expenses, sets monthly budgets, schedules recurring transactions, and explains where the money is going. Version 3.0.0 builds on the secure multi-user foundation of v2.0.0 with a forecasting and planning layer, data portability (CSV, Excel, JSON), deeper audit tooling, and an accessibility-focused interface.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> SpendWise is a student project (BE Semester 7, Data Science). Security is implemented defense-in-depth, but this is **not** production-grade banking software. See [Known limitations](#known-limitations).

---

## Contents

- [Release history](#release-history)
- [What's new in v3.0.0](#whats-new-in-v300)
- [Product showcase](#product-showcase)
- [Feature guide](#feature-guide)
- [Security](#security)
- [Technology stack](#technology-stack)
- [Installation](#installation)
- [Setup guide](SETUP.md)
- [Using SpendWise](#using-spendwise)
- [API overview](#api-overview)
- [Testing and verification](#testing-and-verification)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Release history

| Version | Date | Theme | Highlights |
|---|---|---|---|
| **1.0.0** | 2026-08-20 | Initial MVP | Transactions, dashboard totals, categories, SQLite persistence, Express API, React/Vite UI |
| **2.0.0** | 2026-09-06 | Secure platform | Accounts, bcrypt passwords, sessions, budgets, basic analytics, AES-256-GCM encryption, audit log |
| **3.0.0** | 2026-11-01 | Forecasting and planning | Forecasts, monthly plans, safe-to-spend, pacing, anomalies, recommendations, backtesting, import/export, printable reports, audit trail, accessibility |

All v1.0.0 and v2.0.0 functionality remains available in v3.0.0.

---

## What's new in v3.0.0

### Analytics and planning

- **Expense and income forecasts** — a robust point estimate built from the median of the last three completed months plus a Theil–Sen trend capped at 10%, with an 80% band and confidence based on sample size and coefficient of variation. The plan's income assumption takes precedence when present.
- **Monthly plan** — sets an income assumption, savings target, and objective (`savings` or `overrun`) for a month. Stored per user and editable from the Analytics page.
- **Safe to spend** — a per-day and available-now figure derived from the budget envelope (or forecast income minus savings target), reduced by committed recurring charges and divided by days remaining.
- **Spending pace** — compares actual spend against each budget and projects month-end usage, including remaining recurring charges.
- **Budget recommendations** — an objective-aware reallocation proposal with essential-category defaults, floors, and a stability band. Recommendations can be previewed, applied to budgets, and inspected later in an audit trail.
- **Backtesting** — walks forward over 3–12 months of history and reports forecast MAE/MAPE against a naive baseline, plus a recommendation-engine comparison against proportional and repeat baselines.
- **Proof drawers** — every headline number exposes its method, inputs, assumptions, confidence, and trace, so a figure can be checked rather than trusted.
- **Insight feed** — typed, severity-ranked observations (budget pressure, unusual spend, savings pace, and more), capped at 12 items.
- **Anomaly detection** — robust modified z-score (MAD) with a 3.5 threshold over a 365-day history window.
- **Subscription detection** — finds near-identical recurring charges on weekly, monthly, and yearly cadences.
- **Readiness tiers** — four coverage levels (Getting started, Pacing, Forecast and plan, Seasonal view) explain what the available history can and cannot support.

### Data portability and reporting

- **CSV export** for transactions, recurring schedules, budgets, and monthly plans.
- **JSON backup** of all financial data for the account.
- **Excel workbook export** with four data sheets plus an About sheet, styled headers, filters, and real Excel date types.
- **Guided import** (`.xlsx`, `.json`) with a preview step, per-dataset selection, duplicate detection, conflict reporting, and a commit step.
- **Per-screen CSV import** for transactions, recurring schedules, and budgets.
- **Privacy-aware exports** — `privacy=1` masks amounts and hides descriptions; masked files are rejected on import.
- **Printable monthly report** — a self-contained HTML report with at-a-glance totals, insights, pacing, anomalies, a rebalance proposal, recurring commitments, and plan assumptions. The print toolbar offers A4, US Letter, or US Legal, three margin presets, and either a paginated PDF or one continuous page sized to the report content. The PDF is produced by the browser's "Save as PDF" destination; the server does not generate PDF files.

### Audit, privacy, and accounts

- **Richer audit log** — search, category filters, date range, sort, pagination, category counts, and CSV export.
- **Recommendation trail** — reconstructs applied recommendation batches with evidence and confidence.
- **Audit redaction** — email addresses and rupee amounts are redacted before audit details are stored.
- **Password reset** — 30-minute, single-use reset tokens stored as SHA-256 hashes; generic responses avoid account enumeration. If SMTP is not configured, the link is printed to the server console in development.
- **Change password** — verifies the current password, rejects reuse, invalidates outstanding reset tokens, and signs out other sessions.
- **Encryption-key rotation** — `ENCRYPTION_KEY_PREVIOUS` accepts older keys while existing records are re-encrypted; the CLI is dry-run by default and backs up the database before applying.
- **Privacy mode everywhere** — monetary values are masked in the interface, charts, exports, and the printable report; state is synchronized across tabs.
- **Demo data** — six months of sample history, recurring templates, budgets, and a plan can be loaded and later removed without touching the account's own records.

### Interface and accessibility

- **URL-based routing** with lazy-loaded pages, deep links, and browser back/forward support.
- **Account menu and mobile drawer** with keyboard support, focus trapping, and Escape to close.
- **Theme menu** — light, dark, or system, cycled with a shortcut.
- **Transaction dialog** — add or edit in a focused modal instead of navigating away.
- **Bulk actions** — multi-select transactions and recurring schedules, then bulk edit (type, category, date) or bulk delete.
- **Unified transaction and recurring workspace** with tabs.
- **Chart data tables and an expandable chart modal** so charts are readable by screen readers and on small screens.
- **Keyboard shortcut registry** — discoverable list, conflict-aware editing, and per-user persistence.
- **Accessibility sweep** — skip link, landmarks, focus-visible states, labeled controls, live regions, and reduced-motion handling.

---

## Product showcase

These screenshots were captured from SpendWise v3.0.0 running against an isolated database seeded with six months of demonstration data. Full-resolution images are in [`docs/screenshots/`](docs/screenshots/).

### Core workflow

| Login | Dashboard |
|---|---|
| ![Login page](docs/screenshots/01-login.png) | ![Dashboard with summary cards, alerts and charts](docs/screenshots/02-dashboard.png) |

| Dashboard in dark theme | Transactions workspace |
|---|---|
| ![Dashboard in dark theme](docs/screenshots/03-dashboard-dark.png) | ![Transactions with filters, selection and bulk actions](docs/screenshots/04-transactions.png) |

| Transaction dialog |
|---|
| ![Add or edit a transaction in a dialog](docs/screenshots/05-transaction-dialog.png) |

### Analytics and planning

| Analytics workspace | Budget recommendations |
|---|---|
| ![Forecast, pacing, safe-to-spend, insights and readiness](docs/screenshots/06-analytics.png) | ![Recommendations with reasons, confidence and evidence](docs/screenshots/07-analytics-recommendations.png) |

| Proof drawer | Applied recommendation |
|---|---|
| ![Method, inputs, assumptions and trace for a headline number](docs/screenshots/07b-analytics-proof.png) | ![Proposal applied and budgets updated](docs/screenshots/07c-analytics-applied.png) |

### Budgets, schedules and audit

| Budgets | Recurring schedules |
|---|---|
| ![Monthly budgets with pacing and warnings](docs/screenshots/08-budgets.png) | ![Recurring templates with bulk actions](docs/screenshots/09-recurring.png) |

| Audit log | Recommendation trail |
|---|---|
| ![Filtered audit log with category counts](docs/screenshots/10-audit-log.png) | ![Applied recommendation batches with evidence](docs/screenshots/10b-audit-trail.png) |

### Settings, import and export

| Settings | Export and backup |
|---|---|
| ![Settings overview](docs/screenshots/11-settings.png) | ![CSV, JSON and Excel exports with the privacy warning](docs/screenshots/12-settings-export.png) |

| Guided import preview |
|---|
| ![Workbook preview with duplicates and conflicts classified](docs/screenshots/12b-settings-import.png) |

### Reports and keyboard access

| Printable monthly report | Keyboard shortcuts |
|---|---|
| ![Monthly report with at-a-glance totals and insights](docs/screenshots/13-monthly-report.png) | ![Searchable shortcut reference](docs/screenshots/14-shortcuts.png) |

### Mobile and privacy

| Dashboard at mobile width | Navigation drawer |
|---|---|
| ![Dashboard at 390 px](docs/screenshots/15-mobile-dashboard.png) | ![Mobile drawer with focus trapping](docs/screenshots/16-mobile-drawer.png) |

| Privacy mode |
|---|
| ![Amounts masked across cards, charts and lists](docs/screenshots/17-privacy-mode.png) |

---

## Feature guide

### Transactions

- Record income and expenses with amount, category, description, and date.
- Edit or delete single transactions, or select many and use bulk edit/delete.
- Search descriptions and categories; filter by type, category, and date range; sort by date, amount, created time, or ID.
- Editing a transaction that was generated by a recurring schedule updates the linked schedule as well.
- Import CSV files with the expected header row; duplicate rows are skipped.

### Budgets

- Set a monthly amount for each expense category and month/year.
- See spent, remaining, and percentage used computed from actual transactions.
- Warnings at 80%, 100%, and over 100% of a budget.
- Import budget rows from CSV; an existing month/category row is updated when its amount differs.

### Recurring transactions

- Templates for weekly, monthly, or yearly income and expenses.
- Active/inactive toggle and next-occurrence tracking.
- Due templates create transactions when the server processes them.
- Bulk edit, bulk delete, and CSV import.
- Descriptions are encrypted at rest, like transaction descriptions.

### Analytics workspace

| Panel | What it answers |
|---|---|
| Overview | Income, expenses, net, coverage tier, pacing, safe-to-spend, anomalies, recommendation summary |
| Plan | What income and savings are assumed for this month, and which objective drives advice |
| Readiness | Which analyses the current history supports and what is missing |
| Pacing | Budget usage so far versus the expected pace, including committed recurring charges |
| Insights | Ranked signals that need attention |
| Anomalies | Unusually large expenses compared with the category's own history |
| Recurring | Detected subscriptions and committed upcoming charges |
| Recommendations | What-if budget reallocation, with apply action and proof |
| Backtest | How the forecast and recommendation methods performed on past months |
| Proof drawer | Method, inputs, assumptions, confidence, and trace for a number |

Charts on the Dashboard and Analytics pages are expandable and include data tables.

### Monthly report

The report is generated per month from **Settings → Export & backup** (or the export API). It contains:

1. At a glance — income used, expenses, net, savings target or safe-to-spend, plus available/committed figures while the month is open.
2. Insights — the same ranked signals as the Analytics page.
3. Spending pace — budget, spent, projected, and status per category.
4. Anomalies — unusual expenses with their baseline and threshold.
5. Rebalance proposal — next month's suggested allocation and rationale.
6. Recurring — committed charges and detected subscriptions.
7. Plan assumptions — the income, savings, and objective used for the month.

The print toolbar lets you choose paper and margins, then print a **paginated PDF** or a **single continuous page**. The single-page mode keeps the report's content column and removes the surrounding page frame, so the page width hugs the content; height grows with the report up to a safety limit. Use the browser's "Save as PDF" destination. System PDF printers such as "Microsoft Print to PDF" may rescale the long page onto A4 paper.

### Import

Two import paths exist:

| Path | Where | Formats | Behaviour |
|---|---|---|---|
| **Guided import** | Settings → Data import | `.xlsx` workbook, SpendWise `.json` backup | Preview every dataset, choose datasets, duplicates and conflicts reported, commit in one transaction |
| **Per-dataset CSV** | Transactions, Budgets, Recurring screens | `.csv` | Header-driven import; existing rows are skipped |

Guided import limits: 5 MB per file, 5,000 rows per dataset. CSV import limits: 2 MB and 5,000 rows for transactions; budget and recurring CSV imports also cap at 5,000 rows. Files exported with privacy mode on cannot be imported because their amounts and descriptions are masked. Spreadsheet formula prefixes are neutralized on import.

### Export

| Export | Contents | Filename |
|---|---|---|
| CSV | One dataset: transactions, recurring, budgets, or plans | `spendwise-<dataset>_YYYY-MM-DD_HHmm.csv` |
| JSON backup | All four datasets plus metadata | `spendwise-backup_YYYY-MM-DD_HHmm.json` |
| Excel workbook | Transactions, Recurring, Budgets, Plans, plus an About sheet | `spendwise-data_YYYY-MM-DD_HHmm.xlsx` |
| Monthly report | Self-contained HTML with print controls | `spendwise-report-YYYY-MM.html` |

Every export is scoped to the signed-in account and recorded in the audit log. Audit logs, credentials, encryption material, and derived budget recommendations are never included in a backup.

### Demo data

- Generates six months of history, three recurring templates, seven current budgets, and a plan (₹90,000 income assumption, ₹20,000 savings target), including a large shopping spike for anomaly testing.
- Demo rows carry an `is_demo` flag. Loading preserves the account's own recurring schedules, budgets, and plan when those already exist.
- Purge removes only flagged demo rows across transactions, budgets, recurring schedules, and plans; it requires an explicit confirmation.
- The Dashboard shows a dismissible banner while demo data is active.

### Accounts

- Register, log in, and log out with server-side sessions.
- Change password from Settings; other sessions are signed out.
- Forgot/reset password with a one-time link.
- Privacy mode and theme preferences are stored in the browser.
- Keyboard shortcuts can be viewed and rebound from Settings.

---

## Security

Security is implemented as **defense in depth** — multiple overlapping controls rather than a single boundary.

| Control | Implementation |
|---|---|
| **Password hashing** | bcryptjs with 12 salt rounds; plaintext passwords are never stored |
| **Authentication** | Server-side sessions with the `spendwise.sid` cookie |
| **Session storage** | `connect-sqlite3` store next to the main database (`*-sessions.db`) |
| **Session cookie** | HttpOnly, SameSite=Lax, 24-hour expiry, `Secure` in production |
| **Session invalidation** | `users.password_changed_at` invalidates sessions established before a password change |
| **Password reset** | 30-minute TTL, SHA-256 token hash, single use, generic responses, audit events |
| **Authorization** | Every data query is scoped to `req.user.id`; bulk operations verify ownership before writing |
| **Encryption at rest** | Transaction and recurring descriptions use AES-256-GCM with a random IV per value |
| **Key management** | Key from `ENCRYPTION_KEY`; older keys accepted through `ENCRYPTION_KEY_PREVIOUS`; rotation CLI with backup |
| **Rate limiting** | Login 5/15 min, registration 3/hour, forgot-password 3/hour, password writes 10/15 min |
| **Security headers** | Helmet sets CSP, X-Frame-Options, X-Content-Type-Options, HSTS, and related headers |
| **Server-side validation** | All API inputs are validated on the server; browser validation is advisory |
| **Import safety** | File type and size checked, row caps enforced, formula injection neutralized, masked exports rejected |
| **Export privacy** | Amounts masked and descriptions hidden server-side when `privacy=1` |
| **Audit logging** | Security and data events recorded per user; emails and rupee amounts redacted |
| **SQL injection prevention** | Parameterized prepared statements throughout |
| **Error handling** | Generic messages to clients; internal details logged server-side |
| **Demo isolation** | `is_demo` flag separates generated rows from the account's own data |

### Security architecture

```
Browser (no tokens in localStorage)
  │
  │  HTTPS (session cookie: HttpOnly, SameSite=Lax)
  ▼
Express.js API
  ├─ Helmet (security headers)
  ├─ express-rate-limit (auth and password endpoints)
  ├─ express-session + connect-sqlite3 (server-side sessions)
  ├─ requireAuth middleware (authentication + authorization)
  ├─ Server-side validation (all inputs)
  ├─ Import/export guards (size, rows, privacy, formula injection)
  └─ SQLite (parameterized queries)
       ├─ users.password_hash          → bcryptjs
       ├─ password_resets.token_hash   → SHA-256, 30-minute TTL
       ├─ transactions.description_encrypted      → AES-256-GCM
       └─ recurring_transactions.description_encrypted → AES-256-GCM
            └─ Keys from ENCRYPTION_KEY / ENCRYPTION_KEY_PREVIOUS
```

### Known limitations

- Single-node SQLite design; no horizontal scaling or cluster-safe sessions.
- No CSRF token — protection relies on SameSite=Lax cookies and JSON requests.
- Categories are fixed in code; there is no custom-category management.
- Amounts are formatted as INR (`en-IN`); no multi-currency support.
- The server generates printable HTML; PDF output depends on the browser's print dialog.
- Password-reset email requires SMTP configuration; without it the link is logged to the server console.
- No email-verification flow.
- No automated test runner or CI pipeline; verification scripts run manually.
- Rate limiting is in-process and resets when the server restarts.
- Data migrated from v1.0.0 is assigned to `local@spendwise.app` with the development password `changeme123`; change it after first login.

---

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 4, React Router 6, Recharts 3 |
| Backend | Node.js, Express 4 |
| Database | SQLite3 |
| Sessions | express-session + connect-sqlite3 |
| Password hashing | bcryptjs (12 rounds) |
| Encryption | Node.js crypto (AES-256-GCM) |
| Security headers | Helmet |
| Rate limiting | express-rate-limit |
| Spreadsheet export/import | ExcelJS 4.4 |
| Email | Nodemailer (optional SMTP) |
| State | React Context API |
| Styling | Hand-written CSS with light, dark, and system themes |

Node.js **18 or newer** is required.

---

## Installation

For a step-by-step walkthrough that also covers password-reset email (including Gmail app passwords), demo data, the verification suites and self-hosting, see **[SETUP.md](SETUP.md)**.

### Prerequisites

- Node.js 18+
- npm

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

| Variable | Description | Required |
|---|---|---|
| `PORT` | API port (default 5000) | No |
| `NODE_ENV` | `development` or `production` | No |
| `SESSION_SECRET` | Session-cookie signing secret; at least 32 characters in production | **Yes** in production |
| `ENCRYPTION_KEY` | 32-byte key encoded as 64 hex characters (or base64) for AES-256-GCM | **Yes** in production |
| `ENCRYPTION_KEY_PREVIOUS` | Comma-separated older keys, only while rotating | No |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:3000`) | No |
| `APP_URL` | Public frontend URL used in password-reset links (falls back to `CORS_ORIGIN`) | No |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP transport for reset email | No |
| `MAIL_FROM` | From address for reset email | No |
| `SPENDWISE_DB_PATH` | Alternate SQLite file path for scripts and isolated runs | No |

The frontend always calls `/api`, which Vite proxies to `http://localhost:5000` in development. To point the API elsewhere, change the proxy target in `client/vite.config.js`.

Generate secure values:

```bash
# Session secret
openssl rand -base64 48

# Encryption key (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If `ENCRYPTION_KEY` is unset, the server generates a key and stores it in `server/.enc_key` (gitignored). Set the variable explicitly to keep encrypted data readable across environments and restarts. In production the server refuses to start without a strong session secret.

### Database and migrations

The database lives at `server/database/spendwise.db` and is created or migrated automatically on startup. Migrations are additive and idempotent.

Version 3 adds:

- `plans` — monthly income assumption, savings target, objective.
- `budget_recommendations` — proposal batches, evidence, confidence, and status.
- `password_resets` — hashed, expiring reset tokens.
- `users.password_changed_at` — session invalidation marker.
- `transactions.recurring_id`, `is_essential`, `merchant`.
- `recurring_transactions.description_encrypted`.
- `is_demo` on transactions, budgets, recurring schedules, and plans.
- Indexes for user/date lookups, recurring due dates, recommendation periods, reset tokens, and audit history.

If v1.0.0 data is found, a default local user (`local@spendwise.app` / `changeme123`) is created, existing transactions are assigned to it, and plaintext descriptions are encrypted.

### Start the application

```bash
# Both servers
npm run dev
```

Or:

```bash
# Windows launcher
start.bat        # start
stop.bat         # stop

# Manual
cd server && npm start
cd client && npm run dev
```

- Web UI: `http://localhost:3000`
- API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

### Sample data

On a fresh install, register an account and load **Settings → Demo data**. This generates six months of history, recurring templates, budgets and a plan for that account, and can be purged later without affecting rows you created yourself.

`npm run seed` is a different tool: it attaches demo data to the legacy `local@spendwise.app` account that only exists after migrating a v1.0.0 database, and it fails on a fresh database.

### Rotating the encryption key

1. Generate a new key and set it as `ENCRYPTION_KEY`.
2. Put the old key(s) in `ENCRYPTION_KEY_PREVIOUS` (comma-separated).
3. Run a dry run, then apply:

```bash
node server/scripts/reencrypt.js
node server/scripts/reencrypt.js --apply
```

The script re-encrypts transaction and recurring descriptions, migrates legacy plaintext descriptions, writes a `VACUUM INTO` backup before applying, and refuses to run while any row is unreadable. Remove `ENCRYPTION_KEY_PREVIOUS` after verifying the app can read all descriptions.

---

## Using SpendWise

1. Register an account or log in.
2. Add transactions, or load demo data from Settings to explore first.
3. Create monthly budgets and a monthly plan (income assumption, savings target, objective).
4. Open Analytics to review forecasts, safe-to-spend, pacing, anomalies, and recommendations. Use the proof drawer to inspect any number.
5. Add recurring templates for bills and subscriptions.
6. Generate the monthly report, or export CSV/JSON/Excel from Settings.
7. Review the Audit Log for account and data activity.

---

## API overview

All endpoints are under `/api/`. Except for registration, login, forgot/reset password, and the health check, every endpoint requires a valid session cookie.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in (rate-limited) |
| POST | `/api/auth/logout` | Destroy the session |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change password and sign out other sessions |
| POST | `/api/auth/forgot-password` | Request a reset link |
| POST | `/api/auth/reset-password` | Consume a reset token and set a new password |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/transactions` | List with search, filters, and sorting |
| GET | `/api/transactions/summary` | Income, expenses, balance, count |
| GET | `/api/transactions/:id` | Single transaction |
| POST | `/api/transactions` | Create |
| PUT | `/api/transactions/:id` | Update |
| DELETE | `/api/transactions/:id` | Delete |
| POST | `/api/transactions/import` | Import a CSV file |
| PATCH | `/api/transactions/bulk` | Bulk update type, category, or date (max 500 IDs) |
| POST | `/api/transactions/bulk-delete` | Bulk delete (max 500 IDs) |

Listing parameters: `type`, `category`, `search`, `startDate`, `endDate`, `sortBy` (`date`, `amount`, `created_at`, `id`), `sortOrder` (`asc`, `desc`).

### Budgets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/budgets?month=M&year=YYYY` | List budgets for a period |
| GET | `/api/budgets/warnings` | Budgets near or over their limit |
| GET | `/api/budgets/:id` | Single budget |
| POST | `/api/budgets` | Create |
| PUT | `/api/budgets/:id` | Update |
| DELETE | `/api/budgets/:id` | Delete |
| POST | `/api/budgets/import` | Import budget CSV |

### Recurring transactions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recurring` | List schedules |
| GET | `/api/recurring/:id` | Single schedule |
| POST | `/api/recurring` | Create |
| PUT | `/api/recurring/:id` | Update |
| DELETE | `/api/recurring/:id` | Delete |
| PATCH | `/api/recurring/bulk` | Bulk update |
| POST | `/api/recurring/bulk-delete` | Bulk delete |
| POST | `/api/recurring/import` | Import recurring CSV |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/overview?month=M&year=YYYY` | Full monthly analysis payload |
| GET | `/api/analytics/insights` | Ranked insight feed |
| GET | `/api/analytics/recommendations` | Reallocation proposal |
| POST | `/api/analytics/recommendations/apply` | Apply a proposal to budgets |
| GET | `/api/analytics/backtest?months=3..12` | Forecast and recommendation backtest |
| GET | `/api/analytics/plan?month=M&year=YYYY` | Monthly plan |
| PUT | `/api/analytics/plan` | Upsert monthly plan |
| GET | `/api/analytics/spending-by-category` | Expense totals by category |
| GET | `/api/analytics/monthly-spending` | Monthly income and expense series |
| GET | `/api/analytics/income-vs-expenses` | Total comparison |
| GET | `/api/analytics/summary` | Highest category, monthly totals, net savings |

The overview response combines period metadata, totals, coverage, income forecast, pacing, safe-to-spend, anomalies, committed recurring charges, detected subscriptions, recommendation summary, and insights.

### Import, export, and reports

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/import/preview` | Parse a workbook or JSON backup and classify rows |
| POST | `/api/import/commit` | Import the selected datasets |
| GET | `/api/export/csv?dataset=transactions` | CSV for `transactions`, `recurring`, `budgets`, or `plans` |
| GET | `/api/export/backup` | JSON backup |
| GET | `/api/export/workbook` | Excel workbook |
| GET | `/api/export/report?month=M&year=YYYY` | Printable monthly HTML report |

Import payload: `filename`, `contentBase64`, and an optional `datasets` array. Export endpoints accept `privacy=1` to mask amounts and descriptions. CSV, backup, and workbook exports are timestamped and audited; the monthly report is recorded as a report export.

### Audit and demo data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/audit` | Audit events; supports `search`, `category`/`categories`, `from`, `to`, `sort`, `page`, `limit` |
| GET | `/api/audit/export` | Audit log CSV |
| GET | `/api/audit/recommendations` | Applied recommendation trail |
| GET | `/api/demo` | Demo status |
| POST | `/api/demo` | Load demo data |
| DELETE | `/api/demo` | Purge demo data; requires `{ "confirm": true }` |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service status and version |

---

## Testing and verification

### Verification scripts

Each suite starts its own server on an isolated port with a temporary database, so it does not touch the live database:

```bash
node server/verify_analytics.js      # analytics, plan, recommendations, backtest (port 5099)
node server/verify_bulk.js           # bulk transaction and recurring actions (port 5099)
node server/verify_dataset_import.js # CSV imports and duplicate handling (port 5097)
node server/verify_export_audit.js   # CSV/JSON/XLSX exports, audit log (port 5098)
node server/verify_privacy.js        # privacy masking, encryption, key rotation (port 5099)
```

Run them one at a time because several use port 5099.

`node server/test_api.js` targets `http://localhost:5000` and writes data. Run it only against a disposable database, never against your working data.

### Build

```bash
npm run build --prefix client
```

### Manual checks

1. Register two accounts and confirm neither can see the other's transactions, budgets, schedules, plans, or audit events.
2. Load demo data, inspect Analytics, generate the report, then purge demo data and confirm the account's own rows remain.
3. Export CSV/JSON/XLSX with and without `privacy=1`, then re-import a non-masked copy and confirm duplicates are skipped.
4. Request a password reset with and without SMTP configured.
5. Open the report and print a paginated and a single-page PDF using "Save as PDF".
6. Resize to 390, 768, and 1280 px; open the mobile drawer and account menu with the keyboard.

### Security checklist

- [ ] Unauthenticated requests return 401.
- [ ] User A cannot read or mutate User B's data by ID.
- [ ] Passwords are stored as bcrypt hashes only.
- [ ] Login, registration, forgot-password, and password-write rate limits trigger.
- [ ] Security headers are present.
- [ ] Descriptions are encrypted in the database, with no plaintext copies.
- [ ] Masked exports cannot be imported.
- [ ] Audit details contain no unredacted emails or rupee amounts.
- [ ] No secrets are committed to version control.

---

## Data model

| Table | Purpose |
|---|---|
| `users` | Account name, unique email, bcrypt hash, password-change timestamp |
| `transactions` | Income/expense rows, encrypted description, category, date, optional recurring link, demo and essential flags |
| `budgets` | Monthly amount per user, category, month, and year |
| `recurring_transactions` | Weekly/monthly/yearly templates, next occurrence, active flag, encrypted description |
| `plans` | Monthly income assumption, savings target, and objective |
| `budget_recommendations` | Proposal batches with evidence, confidence, status, and apply timestamps |
| `password_resets` | Hashed reset token, expiry, and single-use timestamp |
| `audit_logs` | User, action, resource, redacted detail, IP address, timestamp |

All financial tables are scoped by `user_id`. Sessions live in a separate SQLite file created by the session store.

---

## Project structure

```
spendwise/
├── client/                              # React + Vite frontend
│   ├── src/
│   │   ├── components/                  # Shared UI, analytics, audit, charts, shortcuts
│   │   ├── contexts/                    # Auth, theme, privacy, shortcuts
│   │   ├── pages/                       # Routed pages (Dashboard, Transactions, Analytics, ...)
│   │   ├── services/                    # API client
│   │   ├── utils/                       # Formatting, shortcuts, audit helpers
│   │   ├── App.jsx                      # Router, auth guard, layout
│   │   ├── main.jsx
│   │   └── index.css                    # Themes and component styles
│   ├── package.json
│   └── vite.config.js
├── server/                              # Express + SQLite backend
│   ├── analytics/                       # Forecasting, pacing, anomalies, recommendations, evaluation
│   ├── controllers/                     # Auth, transactions, budgets, recurring, analytics, import/export, audit, demo
│   ├── database/                        # Connection, schema, migrations, live SQLite files
│   ├── demo/                            # Demo dataset and lifecycle
│   ├── middleware/                      # Auth and error handling
│   ├── report/                          # Monthly report builder and print kit
│   ├── routes/                          # API route definitions
│   ├── scripts/                         # Encryption re-encryption CLI
│   ├── utils/                           # Encryption, sessions, mail, CSV, import, audit, recurring
│   ├── server.js                        # Express app and startup
│   ├── seed.js                          # Database seed script
│   ├── verify_*.js                      # Isolated verification suites
│   └── package.json
├── scripts/spendwise.ps1                # Windows start/stop/status helper
├── start.bat / stop.bat                 # Windows launchers
├── .env.example
├── .gitattributes
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SETUP.md                             # Step-by-step setup and operations guide
└── package.json                         # Shared scripts
```

---

## Keyboard shortcuts

Shortcuts are Alt-based so they do not fire while typing. Defaults can be changed in Settings; bindings are stored per browser.

| Action | Default |
|---|---|
| Go to Dashboard | `Alt+Shift+D` |
| Go to Transactions | `Alt+Shift+T` |
| Go to Budgets | `Alt+Shift+B` |
| Go to Analytics | `Alt+Shift+A` |
| Go to Audit Log | `Alt+Shift+L` |
| Go to Settings | `Alt+Shift+S` |
| Add transaction | `Alt+Shift+N` |
| Toggle privacy mode | `Alt+Shift+P` |
| Cycle theme | `Alt+Shift+M` |
| Show shortcut help | `Alt+Shift+K` |

---

## Roadmap

### Completed

- v1.0.0 — Transactions, dashboard, SQLite persistence.
- v2.0.0 — Accounts, sessions, budgets, basic analytics, encryption, audit log.
- v3.0.0 — Forecasting and planning, recommendation engine with proof and backtesting, import/export, printable reports, audit trail, accessibility.

### Future ideas

- Custom category management.
- Bank/UPI statement import beyond file upload.
- Encrypted backups.
- Multi-currency support.
- Mobile app (React Native).
- Automated test runner and CI pipeline.
- Email verification and additional account controls.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branching, testing, and commit conventions.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
