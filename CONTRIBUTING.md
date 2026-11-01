# Contributing to SpendWise

Thank you for your interest in contributing to SpendWise! This document provides guidelines and instructions for contributing.

## How to Contribute

### 1. Fork the Repository

Click the "Fork" button at the top right of the [SpendWise repository](https://github.com/yourusername/spendwise) to create a copy of the repository in your GitHub account.

### 2. Clone Your Fork

```bash
git clone https://github.com/yourusername/spendwise.git
cd spendwise
```

### 3. Create a Branch

Create a new branch for your feature or bugfix:

```bash
git checkout -b feature/your-feature-name
```

Or for security-related work:

```bash
git checkout -b security/encrypt-sensitive-data
```

Branch naming conventions:

| Type | Example |
|---|---|
| Feature | `feature/analytics`, `feature/csv-export`, `feature/dark-mode` |
| Security | `security/hash-passwords`, `security/audit-logging`, `security/rate-limiting` |
| Bug fix | `fix/transaction-update`, `fix/auth-redirect` |
| Refactor | `refactor/api-validation`, `refactor/dashboard-ui` |
| Docs | `docs/readme-update`, `docs/contributing` |

### 4. Install Dependencies

```bash
npm run install-all
```

Or install manually:

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 5. Configure Environment Variables

A full walkthrough, including password-reset email, is in [SETUP.md](SETUP.md).

```bash
cd server
cp ../.env.example .env
```

Edit `.env` and set:
- `SESSION_SECRET` — a strong random string (e.g., `openssl rand -base64 48`); at least 32 characters is enforced in production
- `ENCRYPTION_KEY` — a 32-byte hex string (e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Optional variables:
- `APP_URL` — public frontend URL used in password-reset links (falls back to `CORS_ORIGIN`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — reset email; without SMTP the reset link is printed to the server console
- `CORS_ORIGIN` — allowed frontend origin (default `http://localhost:3000`)
- `SPENDWISE_DB_PATH` — alternate database path for isolated runs

> **Important:** Never commit the `.env` file. It is listed in `.gitignore`.

### 6. Database Setup

The database is automatically initialized and migrated on server startup. Migrations are additive and idempotent. A v1.0.0 or v2.0.0 database is upgraded in place:

1. Missing tables are created (`users`, `budgets`, `recurring_transactions`, `plans`, `budget_recommendations`, `password_resets`, `audit_logs`).
2. Missing columns are added (`user_id`, encrypted descriptions, `password_changed_at`, `is_demo`, and related fields).
3. Existing transactions are assigned to a default local user (`local@spendwise.app`).
4. Existing plaintext descriptions are encrypted with AES-256-GCM.

To start with a fresh database:

```bash
rm server/database/spendwise.db server/database/spendwise-sessions.db server/.enc_key
```

To seed sample data:

```bash
npm run seed
```

For interactive sample data inside an existing account, use **Settings → Demo data**; demo rows are flagged and can be purged without touching the account's own records.

### 7. Start Development Servers

Start both the backend and frontend:

```bash
npm run dev
```

Or start them separately:

```bash
# Terminal 1 — Backend
cd server
npm start

# Terminal 2 — Frontend
cd client
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

On Windows you can also use `start.bat` and `stop.bat`, which manage both processes and record their state in `.run/`.

### 8. Make Your Changes

Make your changes in the codebase. Please follow the existing code style and structure.

- **Backend:** Write controller logic in `server/controllers/`, routes in `server/routes/`, utilities in `server/utils/`, middleware in `server/middleware/`
- **Frontend:** Write components in `client/src/components/`, pages in `client/src/pages/`, services in `client/src/services/`, contexts in `client/src/contexts/`

### 9. Test Your Changes

Each verification suite spawns its own server on an isolated port with a temporary database, so it does not touch your working data:

```bash
node server/verify_analytics.js      # analytics, plan, recommendations, backtest
node server/verify_bulk.js           # bulk transaction and recurring actions
node server/verify_dataset_import.js # CSV imports and duplicate handling
node server/verify_export_audit.js   # CSV/JSON/XLSX exports and audit log
node server/verify_privacy.js        # privacy masking, encryption, key rotation
```

Run them one at a time because several use port 5099. `node server/test_api.js` targets the running server on port 5000 and writes data, so use it only with a disposable database.

Also:

- Build the frontend: `npm run build --prefix client`
- Test with an empty database and with an existing database (migration)
- Test a user with history but no budgets, and a brand-new user, to check the readiness tiers
- Verify isolation: two accounts must not see each other's transactions, budgets, schedules, plans, or audit events
- Verify auth and password-write rate limits and security headers
- Export with and without `privacy=1`, then re-import a non-masked copy and confirm duplicates are skipped
- Print the monthly report as paginated and single-page PDFs using the browser's "Save as PDF"

### 10. Commit Your Changes

```bash
git add .
git commit -m "feat: add financial analytics dashboard"
```

Commit message conventions:

| Prefix | Use for |
|---|---|
| `feat:` | New features |
| `security:` | Security improvements |
| `fix:` | Bug fixes |
| `refactor:` | Code refactoring |
| `docs:` | Documentation |
| `ui:` | UI/ux improvements |
| `test:` | Test additions |

### 11. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 12. Submit a Pull Request

Go to the original SpendWise repository on GitHub and click "New Pull Request". Select your branch and submit the PR with a clear description of your changes.

## Code Style

- Use consistent formatting (2-space indentation)
- Write clear, readable code
- Add comments where the logic is non-obvious
- Follow the existing project structure
- Keep changes focused and minimal
- Do NOT hardcode secrets or encryption keys
- Do NOT store plaintext passwords or plaintext transaction descriptions
- Do NOT return password hashes, encryption keys, or reset tokens in API responses
- Do NOT bypass authorization checks; scope every query to the authenticated user
- Do NOT log reset tokens, passwords, or unredacted financial details
- Keep imports validated: file size, row limits, and spreadsheet formula prefixes
- Preserve server-side privacy masking for exports and reports

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with:

- A clear description of the issue
- Steps to reproduce (for bugs)
- Expected behavior
- Screenshots if applicable

Thank you for contributing!
