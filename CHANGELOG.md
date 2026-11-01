# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [3.0.0] — 2026-11-01

### Added

**Forecasting and planning**

- **Monthly plan** — income assumption, savings target, and objective (`savings` or `overrun`) per month, stored in a new `plans` table
- **Expense and income forecasts** — median of the last three completed months with a capped Theil–Sen trend, 80% band, and confidence level
- **Safe to spend** — available budget after spend and committed recurring charges, expressed as a total and a daily allowance
- **Spending pace** — per-budget projected usage that includes remaining recurring occurrences
- **Budget recommendations** — objective-aware reallocation with essential-category defaults, floors, stability limits, and an apply action
- **Forecast and recommendation backtesting** over 3–12 months, including MAE/MAPE and naive/proportional baselines
- **Proof drawers** — method, inputs, assumptions, confidence, and trace for every headline number
- **Insight feed** — typed, severity-ranked observations, capped at 12 items
- **Anomaly detection** — robust modified z-score (MAD) over a 365-day window
- **Subscription detection** — near-identical charges on weekly, monthly, and yearly cadences
- **Readiness tiers** — Getting started, Pacing, Forecast and plan, and Seasonal view

**Data portability and reporting**

- **CSV export** for transactions, recurring schedules, budgets, and plans, with a privacy-mask option
- **JSON backup** of all financial datasets
- **Excel workbook export** with four data sheets, an About sheet, styling, filters, and real date cells
- **Guided import** for `.xlsx` workbooks and SpendWise `.json` backups, with preview, dataset selection, duplicate detection, conflict reporting, and transactional commit
- **Per-dataset CSV import** for transactions, recurring schedules, and budgets
- **Masked-export detection** — privacy-masked files are rejected on import
- **Printable monthly report** — self-contained HTML with at-a-glance totals, insights, pacing, anomalies, rebalance proposal, recurring commitments, and plan assumptions
- **Print kit** — A4, US Letter, and US Legal paper; compact, normal, and wide margins; paginated or single continuous page sized to the content

**Audit and accounts**

- **Audit filters** — search, category, date range, sort, pagination, and per-category counts
- **Audit CSV export** and a **recommendation trail** of applied batches
- **Change password** from Settings with reuse checks and session invalidation
- **Forgot/reset password** with 30-minute, single-use, hashed tokens and optional SMTP delivery
- **Encryption-key rotation** through `ENCRYPTION_KEY_PREVIOUS` and a re-encryption CLI
- **Demo data** — six months of sample history, three recurring templates, seven budgets, and a plan, with load, status, and confirmed purge
- **New tables** — `plans`, `budget_recommendations`, and `password_resets`
- **New columns** — `users.password_changed_at`; `transactions.recurring_id`, `is_essential`, `merchant`; `recurring_transactions.description_encrypted`; `is_demo` on the four financial tables
- **New indexes** for user/date, recurring due dates, recommendation periods, reset tokens, and audit history

**Interface and accessibility**

- **URL-based routing** with lazy-loaded pages and browser navigation
- **Account menu** and **mobile navigation drawer** with focus trapping
- **Theme menu** for light, dark, and system themes
- **Transaction dialog** for adding and editing without leaving the page
- **Bulk actions** for transactions and recurring schedules (edit type/category/date, delete)
- **Unified Transactions screen** with transaction and recurring tabs
- **Chart data tables** and an expandable chart modal
- **Keyboard shortcut registry** with view, rebind, conflict handling, and persistence
- **Accessibility sweep** — skip link, landmarks, focus states, labeled controls, live regions, and reduced motion
- **Privacy mode** synchronized across tabs, with a shortcut and chart-surface masking
- **Demo onboarding** banner on the Dashboard

### Improved

- **Dashboard** — unified alert rail with budget-first ordering, compact expandable charts, and clearer empty states
- **Charts** — themed tooltips, compact axis labels, consistent legends, and donut labels that avoid overlap
- **Visual design** — cool-neutral light palette and neutral charcoal dark mode with semantic alert colors
- **Settings** — consolidated export/backup, data import, demo controls, password, appearance, privacy, and shortcuts
- **Budgets** — shared period control and consistent warning spacing
- **Recurring** — parity with transactions for bulk actions, imports, and card layout
- **Navigation** — reordered links, account menu, and responsive drawer
- **Reports** — deterministic page width, tighter content height, and print guidance for system PDF printers
- **Validation and errors** — consistent server messages and client-side field feedback
- **Seed script** — aligned with the current schema

### Security

- Password-reset tokens are stored as SHA-256 hashes, expire after 30 minutes, work once, and are invalidated by a password change
- Password changes invalidate sessions established before `password_changed_at`
- Transaction **and** recurring-template descriptions are encrypted with AES-256-GCM
- Encryption keys can be rotated without data loss; unreadable rows block the rotation
- Exports and the monthly report mask amounts and hide descriptions server-side when privacy is requested
- Audit details redact email addresses and rupee amounts before storage
- Login, registration, forgot-password, and password-write endpoints are rate-limited separately
- Import rejects masked files, oversize files, too many rows, and formula-injection prefixes
- Bulk operations verify ownership of every ID before writing
- Demo rows are isolated with an `is_demo` flag and a confirmed, scoped purge

### Fixed

- Horizontal page overflow on wide tables and charts
- Donut chart label collisions and clipped axis labels
- Dashboard pie chart alignment and Income vs Expenses labeling
- Budget warning card spacing
- Privacy values flashing before the first paint
- Chart tooltips remaining readable while the chart surface is obscured in privacy mode
- Seed script failures against the current schema

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
