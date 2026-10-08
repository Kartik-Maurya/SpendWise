# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2026-09-06

### Added

- **User authentication** — register, login, logout with secure server-side sessions
- **Secure password hashing** — bcryptjs with 12 salt rounds
- **Secure session management** — HttpOnly, SameSite=Lax cookies with 24-hour expiration
- **Account isolation** — users can only access their own transactions, budgets, recurring transactions, and audit logs
- **Sensitive data encryption** — AES-256-GCM encryption for transaction descriptions
- **Spending analytics** — pie chart of expenses by category using real transaction data
- **Monthly spending chart** — area chart showing income vs expenses over time
- **Income vs expenses comparison** — bar chart and summary
- **Analytics summary** — highest spending category, monthly totals, net savings
- **Monthly category budgets** — create, edit, delete budgets with progress tracking
- **Budget warnings** — real-time alerts when spending approaches or exceeds a budget (80%, 100%, 100%+)
- **Transaction search** — search by description and category
- **Transaction filtering** — filter by type, category, and date range
- **Transaction sorting** — sort by date or amount (ascending/descending)
- **Recurring transactions** — templates for weekly, monthly, or yearly repeating transactions
- **CSV export** — export transaction data to CSV (user-scoped)
- **Security audit logging** — records of login, logout, registration, and all CRUD operations
- **Privacy mode** — hide monetary values in the UI with a toggle
- **Dark mode** — light, dark, and system theme options
- **Improved dashboard** — combined stat cards, charts, budget overview, warnings, and recent transactions
- **Loading states** — spinner indicators during data loading
- **Empty states** — helpful messages when no data exists
- **Success/error notifications** — toast messages for user actions
- **Form validation** — real-time client-side validation with server-side enforcement
- **Confirmation dialogs** — delete confirmations for transactions and budgets
- **Disabled form states** — buttons disabled during API requests
- **Access log page** — view security/activity audit events
- **Settings page** — theme and privacy preferences
- **Helmet security headers** — CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.
- **Rate limiting** — login (5 attempts/15min) and registration (3 attempts/hour)
- **Database migration** — automatic, idempotent migration from v1.0.0 schema
- **Default local user** — auto-created to inherit v1.0.0 data
- **`.env.example`** — template for environment configuration

### Improved

- **Dashboard** — redesigned with charts, budget overview, and warnings
- **Responsive layout** — optimized for desktop, tablet, and mobile
- **Transaction list** — added search filters and sorting controls
- **Navigation** — expanded with Analytics, Budgets, Recurring, Audit Log, and Settings pages
- **Form handling** — added loading states, validation, and error messages
- **Error handling** — generic error messages prevent information leakage
- **API** — all endpoints now require authentication and enforce user-scoped authorization
- **Database queries** — all use parameterized prepared statements (SQL injection prevention)
- **Privacy mode** — expanded to mask all monetary values (transactions, dashboard, budgets, analytics, chart tooltips) and blur charts when active; implemented via a centralized `usePrivacyFormat` hook and reusable `PrivacyAmount` component
- **Settings page** — now linked from the Navbar (previously implemented but unreachable by navigation)
- **CSV export** — export button also available on the Transactions page header for discoverability

### Security

- Password hashing with bcryptjs (12 rounds) — plaintext passwords never stored
- Server-side session management with signed, HttpOnly cookies
- AES-256-GCM encryption for transaction descriptions at rest
- Encryption key loaded from environment variable, never hardcoded
- Authorization enforced on every backend query (user_id scoping)
- Registration and login endpoints rate-limited
- Helmet security headers on all responses
- Server-side validation on all API inputs
- Audit logging of security and data access events
- No sensitive data returned to the frontend (password hashes, encryption keys)
- Generic error messages prevent information leakage

---

## [1.0.0] — 2026-08-20

### Added

- **Dashboard** — balance, income, expense, and transaction count
- **Add Transaction** — record income/expenses with type, amount, category, description, date
- **Edit Transaction** — modify existing transactions
- **Delete Transaction** — remove transactions with confirmation
- **Transaction History** — list all transactions
- **Predefined Categories** — income and expense categories
- **SQLite Persistence** — local database storage
- **Express Backend REST API**
- **React/Vite Frontend**
