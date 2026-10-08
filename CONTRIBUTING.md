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
cd server && npm install && cd ../..
cd client && npm install && cd ..
```

### 5. Configure Environment Variables

```bash
cd server
cp ../.env.example .env
```

Edit `.env` and set:
- `SESSION_SECRET` — a strong random string (e.g., `openssl rand -base64 48`)
- `ENCRYPTION_KEY` — a 32-byte hex string (e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

> **Important:** Never commit the `.env` file. It is listed in `.gitignore`.

### 6. Database Setup

The database is automatically initialized and migrated on server startup. If you have existing Stage 1 data in `server/database/spendwise.db`, it will be automatically migrated:

1. New tables are created (`users`, `budgets`, `recurring_transactions`, `audit_logs`)
2. Existing transactions are assigned to a default local user (`local@spendwise.app`)
3. Existing plaintext descriptions are encrypted with AES-256-GCM

To start with a fresh database:

```bash
rm server/database/spendwise.db server/.enc_key
```

To seed sample data:

```bash
npm run seed
```

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

### 8. Make Your Changes

Make your changes in the codebase. Please follow the existing code style and structure.

- **Backend:** Write controller logic in `server/controllers/`, routes in `server/routes/`, utilities in `server/utils/`, middleware in `server/middleware/`
- **Frontend:** Write components in `client/src/components/`, pages in `client/src/pages/`, services in `client/src/services/`, contexts in `client/src/contexts/`

### 9. Test Your Changes

- Run the backend API tests: `node server/test_api.js`
- Start the servers and test manually in the browser
- Test with an empty database
- Test with existing data (migration)
- Verify user isolation: two accounts should not see each other's data
- Verify rate limiting on auth endpoints
- Verify security headers are present

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
- Do NOT store plaintext passwords
- Do NOT return password hashes in API responses
- Do NOT bypass authorization checks

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with:

- A clear description of the issue
- Steps to reproduce (for bugs)
- Expected behavior
- Screenshots if applicable

Thank you for contributing!
