# MINI PROJECT REPORT

## on

# SpendWise: Multi-Feature Finance Tracker

### Version 3.0 — Forecasting, Planning and Data Portability

**Submitted by,**

| Name | Roll No. |
|---|---|
| Kartik Maurya | 2 |
| Ved Mishra | 8 |
| Shriram Nalawade | 19 |
| Soham Niwate | 24 |

**Under the guidance of**

**Prof. Reshma Zore**

Department of Information Technology

Datta Meghe College of Engineering,

Sector-3, Airoli, Navi Mumbai – 400 708, (M.S.), INDIA

**2026-27**

---

## Datta Meghe College of Engineering

(AICTE & Govt. of Maharashtra Recognized, Affiliated to University of Mumbai)

### Department of Information Technology

## C E R T I F I C A T E

This is to certify that the students listed on the title page from the Department of Information Technology, Datta Meghe College of Engineering, have successfully executed the mini project work for the subject Research and Open Source Programming (ROSP) titled **"SpendWise: Multi-Feature Finance Tracker"** under my guidance and supervision within the institute.

The work presented in this report documents the analysis of an existing open-source project and the enhancements contributed to it by the team, prepared for academic submission.

Examined on: ____________________

---

## ACKNOWLEDGEMENT

We would like to express our sincere gratitude to our project guide, Prof. Reshma Zore, for her valuable guidance, suggestions and encouragement throughout this mini project. Her feedback helped us plan the enhancements and organise the work effectively.

We are grateful to the Head of the Department and the faculty members of the Department of Information Technology, Datta Meghe College of Engineering, for providing the academic support and resources required to carry out this project.

We also thank all the members of our team for their cooperation in analysis, development, testing, documentation and presentation.

Finally, we acknowledge the open-source community and the maintainers of the SpendWise repository, whose existing work provided the foundation for this project, and the developers of the open-source libraries and frameworks used in it.

---

## ABSTRACT

Personal finance applications help users record income and expenses and understand their spending. Earlier versions of SpendWise, an open-source finance tracker built with React, Node.js, Express and SQLite, established secure multi-user accounts, budgets, recurring transactions, analytics, exports and an audit log. Version 2.0.0, however, still reported the past: it described what had already been spent and offered little support for deciding what to do next, it could not move data in or out of the application beyond a one-way CSV export, and it verified behaviour with a single integration script that required a running server.

This report documents the third contribution to the same project. Version 3.0.0 adds a forecasting and planning layer built on robust statistics, a budget reallocation engine that explains every proposal, readiness gates that state which analyses the available history can support, and backtesting that measures forecast error against a naive baseline. It adds guided import and structured export (CSV, JSON and Excel), a printable monthly report with configurable paper and margin settings, deeper audit tooling with redaction and a recommendation trail, password reset and change-password flows, encryption-key rotation, demo data, URL-based routing, bulk operations, keyboard shortcuts and an accessibility pass. The database grows from five tables to eight, the API from 21 routes across seven groups to 54 route definitions across nine groups, and the client from 11 shared components to 42.

The enhanced system was verified with five isolated suites containing 229 automated checks, all of which passed on 2026-11-01, and with a browser walkthrough of every page at desktop and mobile widths. The report records the analysis of the v2.0.0 baseline, the design of the v3.0.0 additions, the implementation, the verification results and the limitations that remain. It shows how an existing open-source application can be extended through a structured contribution without discarding its original design or its existing data.

---

## INDEX

| Chapter | Title | Sections |
|---|---|---|
| 1 | Introduction | Background; open-source project; evolution across versions; motivation; contributions; organisation |
| 2 | Literature Survey | Finance trackers; security guidance; hashing and encryption; robust statistics; forecasting; explainability and evaluation; portability; contribution workflow |
| 3 | Analysis of the Existing System | Method; v1.0 to v2.0; features; architecture; database; API; security; limitations |
| 4 | Problem Definition and Objectives | Problem statement; objectives; functional and non-functional requirements |
| 5 | Scope of Project | In scope; out of scope; assumptions and constraints |
| 6 | Proposed Solution | Contribution approach; architecture; data model; forecasting; recommendations; explainability; portability; security; technology; work distribution |
| 7 | Implementation | Repository structure; database; accounts; analytics pipeline; forecasting; pacing; detection; recommendations; backtesting; insights; import/export; report; audit; interface; API |
| 8 | Testing (Validation and Verification) | Approach; suites; results; manual verification; defects; limitations |
| 9 | Results and Analysis | Working system; comparison; objectives against outcomes; discussion |
| 10 | Conclusion | Conclusion; limitations |
| 11 | Future Scope | Planned improvements |
| 12 | References | Numbered sources |

---

## LIST OF FIGURES

| Figure | Caption |
|---|---|
| Fig 1 | Registration and login page |
| Fig 2 | Dashboard with summary cards, alerts and charts |
| Fig 3 | Dashboard in dark theme |
| Fig 4 | Unified transactions workspace with filters and bulk actions |
| Fig 5 | Transaction dialog for adding or editing a record |
| Fig 6 | Analytics workspace with forecast, pacing and insights |
| Fig 7 | Budget recommendations with reasons, confidence and evidence |
| Fig 8 | Proof drawer for a headline number |
| Fig 9 | Applied recommendation and updated proposals |
| Fig 10 | Budgets with pacing, warnings and period control |
| Fig 11 | Recurring schedules |
| Fig 12 | Audit log with filters and category counts |
| Fig 13 | Recommendation trail reconstructed from applied batches |
| Fig 14 | Settings overview |
| Fig 15 | Export and backup controls |
| Fig 16 | Guided import preview with duplicate and conflict classification |
| Fig 17 | Printable monthly report |
| Fig 18 | Keyboard shortcut reference |
| Fig 19 | Dashboard at mobile width |
| Fig 20 | Mobile navigation drawer |
| Fig 21 | Privacy mode with masked amounts |

---

## LIST OF TABLES

| Table | Caption |
|---|---|
| Table 1 | Release history of SpendWise |
| Table 2 | Limitations identified in v2.0.0 |
| Table 3 | Objectives and success criteria |
| Table 4 | Database additions in v3.0.0 |
| Table 5 | Forecasting parameters |
| Table 6 | Rules used by the reallocation engine |
| Table 7 | Readiness gates and coverage tiers |
| Table 8 | Security controls added or strengthened in v3.0.0 |
| Table 9 | Indicative division of work |
| Table 10 | API route groups in v3.0.0 |
| Table 11 | Verification suites and check counts |
| Table 12 | v2.0.0 and v3.0.0 compared |
| Table 13 | Objectives against outcomes |
| Table 14 | Known limitations of v3.0.0 |

---

# Chapter 1: INTRODUCTION

## 1.1 Background

Personal finance management involves recording income, tracking expenses and understanding where money is being spent. Notebooks and spreadsheets work for a handful of entries, but they become inconvenient as transactions grow and users want budgets, summaries and charts. Web-based finance trackers solve this by keeping all records in one place and calculating balances and summaries automatically.

Because financial records are sensitive, such applications must also protect user data. Questions of who can see the data, how passwords are stored and how the data is protected at rest are as important as the features themselves [1], [4]. A tracker that reports the past accurately but cannot say what is likely to happen next, or cannot move a user's records in and out, is only partly useful; modern personal finance tools combine record keeping with planning and portability.

## 1.2 The Selected Open-Source Project

For the ROSP mini project, the team selected SpendWise, an open-source personal finance tracker. It is a full-stack web application with a React 18 frontend built using Vite, a Node.js and Express backend, and an SQLite database. The project was already developed through two earlier contributions by the same team, and all source code for the three versions is maintained in the project repository:

- **v1.0.0** — a single-user tracker with transactions, a dashboard, five API routes and one database table.
- **v2.0.0** — a secure multi-user platform with accounts, sessions, encryption, budgets, recurring transactions, basic analytics, exports and an audit log.
- **v3.0.0** — the contribution documented in this report, which adds forecasting, planning, explainable recommendations, data portability, reporting and deeper security and accessibility work.

The application is small enough to read in full, yet it exercises a realistic set of engineering concerns: schema migration, authentication, encryption, analytics, exports and testing. That combination makes it a suitable subject for an open-source contribution study.

## 1.3 Evolution Across the Three Versions

Table 1 summarises the three releases. The dates and themes are taken from the project changelog and release history.

**Table 1: Release history of SpendWise**

| Version | Date | Theme | Principal additions |
|---|---|---|---|
| 1.0.0 | 2026-08-20 | Initial MVP | Transactions, dashboard totals, categories, SQLite persistence, Express API, React/Vite interface |
| 2.0.0 | 2026-09-06 | Secure platform | Accounts, bcrypt passwords, sessions, per-user isolation, budgets, recurring transactions, basic analytics, AES-256-GCM encryption, audit log, CSV export |
| 3.0.0 | 2026-11-01 | Forecasting and planning | Forecasts, monthly plans, safe-to-spend, pacing, anomalies, subscription detection, recommendations with proof, backtesting, guided import, structured export, printable report, audit trail, password reset, key rotation, accessibility |

The v1.0.0 baseline had three pages, two shared components, one controller, five transaction routes, a single `transactions` table and no authentication. The v2.0.0 contribution replaced that baseline with ten pages, eleven shared components, seven controllers and route groups, five tables, session authentication, encryption and an audit log [19]. Version 3.0.0 keeps the v2.0.0 security model and extends it rather than replacing it: every v2.0.0 capability remains available, and the new work is layered on top of the existing schema, API conventions and interface.

## 1.4 Motivation and Significance

The motivation for the third contribution came from three gaps observed in v2.0.0.

First, the application was descriptive rather than predictive. It could show what had been spent, but it could not estimate next month's expenses, tell a user how much remained safe to spend today, warn that a category was pacing towards an overrun, or suggest a budget that balanced savings against realistic spending.

Second, the application was difficult to leave. CSV export existed, but there was no way to bring data back in, no complete backup, no workbook format that a non-technical user could inspect, and no printable summary for a month.

Third, the verification story was thin. A single integration script covered the main routes but required a running server and a live database, so it could not be run safely against working data.

Version 3.0.0 addresses these gaps while preserving the project's original purpose. The significance is twofold: the product becomes useful for planning and for moving data, and the codebase becomes verifiable in isolation, which matters for an open-source project that others may contribute to.

## 1.5 Contributions of This Report

This report makes the following contributions.

1. A documented analysis of the v2.0.0 baseline, including its architecture, schema, API surface, security posture and limitations.
2. A design for a forecasting, planning and recommendation layer built on transparent statistical methods rather than opaque scoring.
3. An implementation description covering the eight-table schema, the analytics pipeline, the import/export formats and the reporting path.
4. A verification record of five isolated suites and 229 automated checks, together with the defects found while building them.
5. A visual record of the working product through 21 screenshots taken from an isolated instance seeded with demonstration data.
6. A comparison of v1.0, v2.0 and v3.0 that can serve as the evolution narrative for the project.

## 1.6 Organisation of the Report

Chapter 2 surveys the standards and techniques that guided the work. Chapter 3 analyses the v2.0.0 system. Chapter 4 states the problem and objectives. Chapter 5 defines the scope. Chapter 6 presents the proposed solution and its design decisions. Chapter 7 describes the implementation. Chapter 8 records testing and verification. Chapter 9 presents the working system and compares v2.0.0 with v3.0.0. Chapters 10 and 11 conclude and set out future work. Chapter 12 lists the references.

---

# Chapter 2: LITERATURE SURVEY

Since this is an open-source contribution project, the survey focuses on the standards, techniques and tools that guided the enhancements, rather than on academic research papers alone.

## 2.1 Personal Finance and Web-Based Trackers

Personal finance tools range from spreadsheets to full applications. A typical tracker offers transaction entry, categorisation, balance calculation and history. More capable tools add budgets, recurring entries, search and visual reports. Charts such as pie, bar and area charts help users notice patterns that are hard to see in a list of numbers; the Recharts library, built on React, is a common way to provide them [11].

Planning features move beyond description. A monthly plan states an income assumption and a savings target; a forecast estimates future spending; a pacing check compares actual spending with the rate needed to stay inside a budget; and a safe-to-spend figure converts the remaining budget into a daily allowance. These are standard ideas in personal budgeting practice, and they can be implemented with modest statistical machinery if the method is chosen for robustness rather than precision.

## 2.2 Web Application Security Guidance

The OWASP Top 10 lists the most critical web application risks, including broken access control, cryptographic failures, injection and security misconfiguration [4]. The OWASP Application Security Verification Standard (ASVS) gives a detailed checklist for authentication, session management, access control, validation and logging [1]. The OWASP Cheat Sheet Series adds practical guidance on password storage [2], session management [3] and security logging [15]. These documents shaped the security objectives of the project and, in v3.0.0, the decision to persist sessions, to hash reset tokens, to redact audit details and to invalidate sessions after a password change.

The original v2.0.0 implementation already followed much of this guidance: bcrypt hashing, HttpOnly cookies, per-user query scoping, Helmet headers and rate limiting. The v3.0.0 work therefore focused on the parts that were still missing: session persistence, token handling, key rotation, export privacy and import safety.

## 2.3 Password Hashing and Encryption

Passwords should never be stored in plain text. The bcrypt scheme, introduced by Provos and Mazières, is an adaptive hash with a tunable cost factor, so that hashing can be made slower as hardware improves [5]. OWASP recommends adaptive, salted hashing for password storage [2]. SpendWise uses bcryptjs with 12 rounds.

For protecting data at rest, AES in Galois/Counter Mode (GCM), specified in NIST SP 800-38D, provides both confidentiality and integrity through authenticated encryption [6]. Node.js exposes such primitives through its built-in crypto module [14]. SpendWise encrypts transaction and recurring-template descriptions with AES-256-GCM and a random initialisation vector per value. Version 3.0.0 adds key rotation: an older key can be supplied through `ENCRYPTION_KEY_PREVIOUS` while records are re-encrypted under a new key, and the rotation script refuses to run while any record is unreadable.

## 2.4 Robust Statistics

Financial data is noisy and often contains a few very large transactions. The mean and standard deviation are sensitive to those values, so a single hospital bill can distort a category average. Robust statistics offer alternatives.

The median is resistant to outliers, and the median absolute deviation (MAD) provides a robust scale estimate. Leys et al. recommend median absolute deviation rather than standard deviation when detecting outliers [22], and the modified z-score described by Iglewicz and Hoaglin converts a deviation into a scale-free score [23]. SpendWise uses the modified z-score with a threshold of 3.5, the value commonly recommended for this statistic, and requires at least five observations in a category before flagging anything. A coefficient of variation, computed from the robust scale, is used to describe how stable a category is and therefore how much confidence to place in its forecast.

## 2.5 Forecasting

Two simple forecast components are used together. The median of the last three completed months provides a level estimate that ignores a single unusual month. A Theil–Sen estimator provides a trend [20], [21]. The Theil–Sen slope is the median of the slopes between all pairs of points, which makes it robust to outliers in the same way as the median. The trend is capped at 10 per cent of the base level per month so that a short run of unusual months cannot produce an implausible projection. The combination follows the general advice that simple, transparent baselines are hard to beat and should be established before more complex models are attempted [19].

The forecast band uses one robust standard deviation and a multiplier of 1.28, which corresponds to an 80 per cent interval under a normal approximation. The band is deliberately described as a range rather than a prediction interval, because the distribution of monthly category spending is not normal and the history is short.

## 2.6 Evaluation of Forecasts

A forecast that is never checked is only an opinion. Rolling-origin evaluation, also called walk-forward validation, trains a method on data up to a point and tests it on the next observation, then moves the origin forward [19]. SpendWise uses this scheme for one-step-ahead evaluation and compares the mean absolute error (MAE) of its forecast with the MAE of a naive forecast that repeats the previous month. The ratio is reported as a skill score, `1 − MAE / naiveMAE`, so that a positive value means the method beat the naive baseline and a negative value means it did not. Mean absolute percentage error (MAPE) is reported alongside, with the usual caveat that it is unstable when actual values are close to zero.

## 2.7 Explainability

A recommendation that cannot be inspected is difficult to trust, particularly when it changes a user's budget. The design therefore attaches a proof object to every headline number: the method, the inputs, the assumptions, a confidence level and a trace of the intermediate values. This is a lightweight form of explanation by provenance rather than a learned explanation model, and it suits a rule-based system whose inputs are already known.

## 2.8 Data Portability

CSV remains the most widely supported tabular interchange format, but it carries well-known risks: delimiter and quoting errors, encoding problems and formula injection when a spreadsheet opens a cell beginning with `=`, `+`, `-` or `@`. SpendWise neutralises formula prefixes on import and quotes output fields correctly [24]. JSON is used for complete backups because it preserves types and nesting. Excel workbooks are generated with ExcelJS, which supports styled headers, filters and real date cells [25]. The workbook also contains an About sheet that records the export date, the application version and the privacy state of the file, so that a recipient can tell what they are holding.

## 2.9 Open-Source Contribution

Open-source projects evolve through contributions that follow a standard flow: understand the project, propose or select an improvement, implement it on a separate branch or fork, test it, and submit it for review [17], [18]. This project follows the same approach, with each version treated as a contribution stage and each stage recorded in the changelog and documentation.

## 2.10 Project Gap

Compared with the guidance above, v2.0.0 lacked forecasting and planning, explainable recommendations, readiness reporting, backtesting, import, structured export, printable reporting, password reset, key rotation and isolated automated verification. It also retained in-memory sessions, state-based navigation and no bulk operations. Version 3.0.0 addresses these gaps.

---

# Chapter 3: ANALYSIS OF THE EXISTING SYSTEM

## 3.1 Method

The v2.0.0 codebase was inspected before any change was made. The inspection covered the folder structure, the client pages and components, the server routes and controllers, the database schema and migration routine, the API surface and the security controls. The documentation prepared for v1.0.0 and v2.0.0, together with the source code itself, served as the baseline. This chapter summarises that baseline; the v1.0.0 material is used only to explain how v2.0.0 was reached.

## 3.2 From v1.0.0 to v2.0.0

Version 1.0.0 was a single-user tracker. It had three pages (Dashboard, Transactions and Add Transaction), two shared components (the navigation bar and a transaction form), one controller and one route file, a single `transactions` table and seven endpoints including the health check. Descriptions were stored as plain text, cross-origin access was open, and there was no authentication, rate limiting or automated test.

Version 2.0.0 replaced the single-user model with accounts and sessions, added per-user query scoping, encrypted descriptions, budgets, recurring transactions, basic analytics, CSV export, an audit log, privacy mode and a dark theme. It introduced a Promise-based database wrapper and an idempotent migration that assigned legacy rows to a default local user. It also added an integration script with 27 checks. The result was a substantially stronger application, but it still stopped at description.

## 3.3 Features of v2.0.0

The baseline offered the following capabilities.

- Registration, login and logout with bcrypt password hashing and server-side sessions.
- Per-user isolation of transactions, budgets, recurring templates and audit records.
- A dashboard with summary cards, charts, budget progress and recent transactions.
- Transaction entry, editing and deletion, with search, filtering and sorting.
- Monthly category budgets with warnings at 80 per cent, 100 per cent and above 100 per cent.
- Recurring templates for weekly, monthly and yearly transactions, generated when due.
- Basic analytics: spending by category, monthly spending, income against expenses and a summary.
- CSV export of transactions.
- An audit log page with pagination.
- Privacy mode, light/dark/system themes and toast notifications.

## 3.4 Architecture of v2.0.0

The frontend was a React 18 single-page application built with Vite. It had ten pages, eleven shared components and three context providers (authentication, theme and privacy). Navigation was handled by a state variable in the root component rather than by URL routes, so pages had no addresses and the browser's back button did not move between them. All styling lived in a single global stylesheet, and the Vite development server proxied API calls to the backend [7], [12].

The backend was a Node.js and Express server with seven route groups and seven controllers [8]. Database access used a Promise-based wrapper around the sqlite3 driver with parameterised statements [13]. A health-check route, an authentication middleware and a generic error handler were provided. Sessions were held in memory even though the session-store dependency was already installed.

## 3.5 Database of v2.0.0

The database contained five tables: `users`, `transactions`, `budgets`, `recurring_transactions` and `audit_logs`. Every financial table carried a `user_id`. Descriptions were stored twice during migration—an encrypted column and a plaintext column that was cleared after encryption—and the application read the encrypted value. There were no indexes beyond the implicit primary keys and unique constraints, no table for monthly plans, no record of applied recommendations and no storage for password-reset tokens.

## 3.6 API of v2.0.0

The API exposed 21 endpoints across seven route groups: authentication, transactions, analytics, budgets, recurring, export and audit. Every endpoint except registration, login and the health check required a valid session, and every data query was scoped to the authenticated user. Validation was performed on the server for the fields that existed at the time.

## 3.7 Security of v2.0.0

Security was already layered: bcrypt hashing, signed HttpOnly cookies with SameSite set, restricted CORS, Helmet headers, rate limits on login and registration, parameterised SQL, server-side validation, audit logging and production-safe error messages. Three weaknesses remained and are addressed in v3.0.0.

- Sessions were stored in memory, so every restart signed all users out and the design could not run behind more than one process.
- There was no password-reset or change-password flow, and no way to invalidate sessions that had been established before a password change.
- Export privacy was a client-side concern: an export request had no way to ask the server to mask values, and there was no import path at all.

## 3.8 Limitations of v2.0.0

The inspection produced the limitations in Table 2. Each became an input to the objectives in Chapter 4.

**Table 2: Limitations identified in v2.0.0**

| Area | Limitation | Consequence |
|---|---|---|
| Planning | No forecast, plan, pacing or safe-to-spend | The application described past spending but could not support a decision |
| Guidance | No budget recommendations or explanation of numbers | Users had to interpret raw totals themselves |
| Data in | No import of any kind | Data could leave the application but not return |
| Data out | CSV of transactions only | No complete backup, no workbook, no printable report |
| Audit | Basic paginated list | No filtering, export or trace of applied recommendations |
| Accounts | No password reset or change-password | A forgotten password locked the account permanently |
| Sessions | In memory | Sessions lost on restart; not cluster-safe |
| Encryption | Single key with no rotation path | A leaked key could not be replaced without losing data |
| Navigation | State-based routing | No deep links, no browser history, no shareable page addresses |
| Transactions | One-at-a-time editing | Repetitive work for bulk corrections |
| Verification | One integration script requiring a live server | Unsafe to run against working data; no isolated suites |
| Testing | No unit tests, no coverage, no CI | Regressions could pass unnoticed |
| Accessibility | Basic labels and focus styles | Keyboard traps, unlabeled controls and motion issues remained |
| Categories | Fixed in code | No custom category management |

---

# Chapter 4: PROBLEM DEFINITION AND OBJECTIVES

## 4.1 Problem Statement

The existing SpendWise application records transactions securely, but it offers no forecasting or planning, no explanation of the figures it presents, no way to bring data back into the application, no complete backup or printable report, no account-recovery path, and no verification that can run without touching live data. The problem is to extend this open-source application into a planning and portability platform while preserving the v2.0.0 security model, its data and its interface conventions.

## 4.2 Objectives

The project set the following objectives.

1. Add a monthly plan with an income assumption, a savings target and a planning objective.
2. Forecast monthly expenses and income using a method that is robust to outliers and that states its confidence.
3. Convert the plan and the budget envelope into a safe-to-spend allowance and a per-category spending pace.
4. Detect unusual transactions and likely subscriptions without manual rules.
5. Propose budget reallocations that respect essentials, historical floors and stability, and explain every proposal.
6. State which analyses the available history supports, and what is missing for the next level.
7. Backtest the forecast and the recommendation method against simple baselines.
8. Provide guided import and structured export in CSV, JSON and Excel formats.
9. Generate a printable monthly report with configurable paper, margins and pagination.
10. Strengthen account recovery, session invalidation, key rotation, export privacy and import safety.
11. Improve navigation, bulk editing, keyboard access and accessibility.
12. Verify the result with isolated automated suites and a documented browser walkthrough.

Table 3 pairs each objective with the evidence used to judge it.

**Table 3: Objectives and success criteria**

| Objective | Success criterion | Evidence |
|---|---|---|
| Planning and forecasting | Overview returns income, expense forecast, band and confidence for a month | Analytics suite; Fig 6 |
| Safe-to-spend and pacing | Figures are returned with method, inputs and confidence | Analytics suite; Fig 6 |
| Anomaly and subscription detection | Seeded outlier and subscription are detected | Analytics suite |
| Explainable recommendations | Every category carries a reason, evidence, floor and cap | Analytics suite; Figs 7–9 |
| Readiness | Each analysis reports available or locked with missing steps | Analytics suite; Fig 6 |
| Backtesting | Folds, MAE, naive MAE and skill are reported | Analytics suite |
| Import and export | Workbook, backup and CSV round-trip; duplicates and conflicts reported | Import and export suites; Figs 15–16 |
| Printable report | Report renders with print controls and selected paper | Screenshot Fig 17 |
| Security | Reset tokens hashed and single-use; keys rotatable; masked exports rejected | Privacy and export suites |
| Interface | URL routing, bulk actions, shortcuts, accessible controls | Browser walkthrough; Figs 4, 14, 18–20 |
| Verification | All isolated checks pass | 229 of 229, Table 11 |

## 4.3 Functional Requirements

- The system shall let a user set an income assumption, a savings target and an objective for a month.
- The system shall forecast category and total spending from completed months.
- The system shall show a safe-to-spend figure that subtracts committed recurring charges.
- The system shall show a pacing status for each active budget.
- The system shall flag unusual transactions relative to the category's own history.
- The system shall detect repeated charges on weekly, monthly and yearly cadences.
- The system shall propose budget changes with floors, caps and reasons, and allow a proposal to be applied.
- The system shall record applied proposal batches and expose them as a trail.
- The system shall export transactions, recurring schedules, budgets and plans as CSV, a JSON backup and an Excel workbook.
- The system shall import an exported workbook or backup after a preview that classifies every row.
- The system shall generate a printable monthly report.
- The system shall support password reset, password change and session invalidation.
- The system shall support encryption-key rotation without data loss.
- The system shall provide URL-based navigation, bulk actions and keyboard shortcuts.

## 4.4 Non-Functional Requirements

- **Security.** Every data request is authenticated and scoped to the owner; secrets are supplied through the environment; masked exports are never importable.
- **Robustness.** Statistical methods must degrade gracefully when history is short or a category has few observations.
- **Transparency.** Every headline number must expose its method, inputs, assumptions, confidence and trace.
- **Portability.** Exports must open in common tools and imports must fail safely rather than partially.
- **Accessibility.** Controls must be labelled, focus must be visible and motion must be suppressible.
- **Testability.** Verification must run without a live server or working data.
- **Compatibility.** v2.0.0 behaviour and data must survive the upgrade.

---

# Chapter 5: SCOPE OF PROJECT

## 5.1 In Scope

- Monthly plans with income assumption, savings target and objective.
- Expense and income forecasts with a band and a confidence level.
- Safe-to-spend, pacing and committed recurring charges.
- Anomaly detection and subscription detection.
- Budget recommendations with apply, evidence and trail.
- Readiness tiers and missing-step reporting.
- Forecast and recommendation backtesting.
- CSV, JSON and Excel export; guided workbook and backup import; per-screen CSV import.
- A printable monthly report with a print kit.
- Password reset, change password and session invalidation.
- Encryption-key rotation.
- Audit filters, export, redaction and recommendation trail.
- Demo data with scoped load and purge.
- URL routing, account menu, mobile drawer, transaction dialog, bulk actions, chart data tables and keyboard shortcuts.
- Isolated verification suites and a browser walkthrough.

## 5.2 Out of Scope

- Custom category management; categories remain a fixed list.
- Multiple currencies; amounts are formatted as Indian Rupees.
- Bank or payment-gateway integration.
- Email verification and multi-factor authentication.
- A native mobile application.
- Server-side PDF generation; the report is HTML and the browser produces the PDF.
- Horizontal scaling or a multi-node deployment.
- A continuous-integration pipeline.

## 5.3 Assumptions and Constraints

- The application runs on a single Node.js process with a local SQLite file.
- The user has at least a few months of transaction history for the planning features to be meaningful; the interface states when that is not the case.
- SMTP is optional. Without it, password-reset links are printed to the server console in development.
- The report is designed for the browser's print dialog and the "Save as PDF" destination.
- The project remains a student project and is not presented as production-grade banking software.

---

# Chapter 6: PROPOSED SOLUTION

## 6.1 Contribution Approach

The enhancements were planned as incremental contributions to the existing codebase rather than a rewrite. The original three-tier structure (React frontend, Express backend, SQLite database) was retained. Work proceeded in stages, each ending with an isolated verification run and a browser check:

1. Analyse v2.0.0 and record its limitations (Chapter 3).
2. Extend the schema additively and add the analytics modules.
3. Build the analytics API and the explanation layer.
4. Build the Analytics interface, proof drawer and readiness panels.
5. Add import, export and the printable report.
6. Harden encryption, sessions, audit redaction and privacy-aware exports.
7. Add bulk operations and unify the transactions and recurring screens.
8. Rework navigation, mobile behaviour and accessibility.
9. Refine the visual system, charts and chart accessibility.
10. Add demo data, account recovery, shortcuts and the print kit.
11. Capture the product screenshots and complete documentation.

## 6.2 Proposed Architecture

The v3.0.0 architecture keeps the v2.0.0 layers and adds an analytics layer, a portability layer and a report layer. The diagram below shows the request path.

```
Browser (React 18 single-page application)
  |  HTTPS, session cookie (HttpOnly, SameSite=Lax)
  v
Express 4 application
  |-- Helmet (security headers)
  |-- CORS (restricted origin, credentials)
  |-- express-rate-limit (login, registration, reset, password writes)
  |-- express-session + connect-sqlite3 (sessions survive restarts)
  |-- requireAuth (session validation and password-change check)
  |
  +-- 9 route modules (54 route definitions)
  |     |
  |     +-- 9 controllers
  |           |-- analytics (11 modules: stats, context, coverage, forecast,
  |           |     pacing, anomaly, recurrence, reallocate, insights, explain,
  |           |     evaluate)
  |           |-- export/import (CSV, JSON backup, Excel workbook)
  |           |-- report (monthly HTML builder + print kit)
  |           |-- audit (filters, CSV export, recommendation trail, redaction)
  |           `-- demo (dataset and lifecycle)
  |
  +-- SQLite: 8 tables, 6 indexes, AES-256-GCM encrypted descriptions
```

Three ideas shape the design.

**Additive migration.** New tables and columns are created only when missing, so an existing database upgrades in place. Nothing is dropped and no plaintext is recreated.

**Computation on the server.** All analytics are computed in the backend from the user's own rows. The client receives finished figures with their proofs; it does not recompute financial logic. This keeps one implementation of each rule and makes the numbers testable over HTTP.

**Proof by default.** Functions that produce a headline number return a proof object alongside the value. The interface can therefore show the same explanation that a test can assert on.

## 6.3 Data Model

Version 3.0.0 takes the database from five tables to eight and adds six indexes. Table 4 lists the changes.

**Table 4: Database additions in v3.0.0**

| Object | Type | Purpose |
|---|---|---|
| `plans` | New table | Monthly income assumption, savings target and objective per user, with a uniqueness constraint on user, month and year |
| `budget_recommendations` | New table | Proposal batches with month, category, objective, current and proposed amounts, delta, reason, evidence JSON, confidence and status |
| `password_resets` | New table | SHA-256 token hash, expiry and single-use timestamp per user |
| `users.password_changed_at` | New column | Invalidates sessions established before a password change |
| `transactions.is_essential` | New column | Explicit essential flag used by the reallocation engine |
| `transactions.merchant` | New column | Merchant text for clearer descriptions and duplicate matching |
| `recurring_transactions.description_encrypted` | New column | Encrypted storage for recurring descriptions |
| `is_demo` | New column on four financial tables | Separates generated demonstration rows from the account's own records |
| Six indexes | New indexes | Transactions by user and date; transactions by user, type, category and date; recommendations by user and period; reset tokens by user; recurring schedules by user, active flag and due date; audit events by user and creation time |

All financial tables remain scoped by `user_id`. Deleting a user cascades to budgets and recurring schedules, while audit records keep the row with a null user reference so that history is not silently erased.

## 6.4 Forecasting Design

The forecast is deliberately simple and robust. Table 5 lists the parameters.

**Table 5: Forecasting parameters**

| Element | Choice | Reason |
|---|---|---|
| Level estimate | Median of the last three completed months | Ignores a single unusual month |
| Trend | Theil–Sen slope over the last six months | Robust to outliers, resistant to a short run of unusual values |
| Trend cap | 10 per cent of the base level per month | Prevents implausible projections from short history |
| Scale | Robust sigma: 1.4826 × MAD, falling back to standard deviation when MAD is zero | Scale estimate that is not dominated by outliers |
| Band | Point estimate ± 1.28 × scale | Approximates an 80 per cent interval |
| Confidence | High when at least five months and coefficient of variation at most 0.35; medium when at least three months and at most 0.7 | States how much the history supports the number |
| Income | Plan assumption when present, otherwise the forecast of prior income | Keeps the plan authoritative |

The forecast returns its method as a string, so the interface can print how the number was produced rather than presenting it as a bare figure.

## 6.5 Pacing and Safe-to-Spend Design

Pacing compares the amount spent so far in a budget category with the amount expected by this point in the month. The expected rate is the median daily rate across the three preceding months, with a fallback to a simple linear rate when fewer months are available. Remaining occurrences of active recurring templates are added to the projection, because a bill that is known to be coming should count before it is charged.

Safe-to-spend starts from an envelope. When budgets exist, the envelope is the sum of the month's budgets; otherwise it is the plan income minus the savings target. Spent amounts and committed recurring charges are subtracted, and the remainder is divided by the days left in the month. A completed month reports that the figure is not applicable instead of returning a misleading zero.

## 6.6 Detection Design

**Anomalies.** For each category, the system computes the median and MAD over a 365-day window. A transaction receives a modified z-score of `0.6745 × |amount − median| / MAD`; a score of 3.5 or more is flagged, provided the category has at least five observations. When MAD is zero, a fixed ratio rule of three times the median is used so that the check does not fail on very stable categories. Severity is high at a score of 5 or more.

**Subscriptions.** Charges are grouped by normalised description and category, and the intervals between them are examined for weekly, monthly and yearly cadences with near-identical amounts. Detected subscriptions are reported separately from recurring templates, because a user may be paying for something they never configured.

## 6.7 Recommendation Design

The reallocation engine proposes next month's budget for each category. It is objective-aware: the `savings` objective tries to reach the savings target, while the `overrun` objective tries to keep spending inside the income envelope. Table 6 lists the rules.

**Table 6: Rules used by the reallocation engine**

| Rule | Behaviour |
|---|---|
| Essential categories | `Bills`, `Food`, `Health`, `Transport` and `Education` by default; a category flips to its explicit flag when at least three recent transactions agree |
| Floor | The larger of committed recurring charges, the 25th percentile and 85 per cent of the median for essentials |
| Cap | Current budget plus 20 per cent, or 1.25 times the largest month, whichever is more permissive, bounded by the envelope |
| Stability band | Proposals within 20 per cent of the current budget are left unchanged |
| Reduction order | Discretionary categories are reduced before essentials |
| Residual | With the overrun objective, any remaining money is distributed to essentials that are still below their floor |
| Locked result | When the envelope cannot be met, the result is reported as infeasible with a deficit and notes rather than silently trimming essentials |
| Evidence | Each proposal carries a reason string and an evidence object containing the recommended value, the applied value and the basis for the floor and cap |

Applying a proposal writes the new budget amounts and records a batch with one row per category. The audit trail can later reconstruct which values were applied and why.

## 6.8 Readiness Design

Not every analysis is meaningful with one month of data. The system computes coverage from the user's history and evaluates eight requirements. Each requirement returns `available` or `locked` with a list of what is missing. Table 7 lists the gates and the coverage tiers.

**Table 7: Readiness gates and coverage tiers**

| Requirement | Minimum history | Unlocks |
|---|---|---|
| Budget pacing | None | Projected month-end spend and overrun risk |
| Safe to spend | None | A daily allowance that respects commitments |
| Unusual transactions | 1 month, 5 transactions in a category | Outliers relative to that category |
| Recurring charges | 1 month | Commitments and subscription leakage |
| Spending forecast | 2 months, 2 transactions in each of 2 categories | A range for next month |
| Budget recommendation | 3 months, 3 transactions in each of 3 categories, income available | Objective-aware budgets with floors and reasons |
| Category trends | 4 months, 4 transactions in a category | Direction and slope over time |
| Accuracy backtest | 3 months, 2 transactions in a category | Measured error and a counterfactual |

| Tier | Months of expenses | Label |
|---|---|---|
| 0 | 0 | Getting started |
| 1 | 1–2 | Pacing |
| 2 | 3–5 | Forecast and plan |
| 3 | 6 or more | Seasonal view |

## 6.9 Backtesting Design

The backtest walks forward through the available history. At each origin it computes a forecast for the next month using only earlier data, compares it with the actual value, and records the absolute and percentage error. The same is done for a naive forecast that repeats the previous month. The engine then reports the mean errors, the skill score and a per-category breakdown, and it compares the recommendation method with proportional and repeat baselines. The result is a statement about method quality that can be checked rather than assumed.

## 6.10 Data Portability Design

Three export formats serve three audiences: CSV for spreadsheets and scripts, JSON for a complete backup that the application can restore, and Excel for a workbook that a person can open, read and filter. Every export is scoped to the signed-in account and recorded in the audit log.

Import is a two-step operation. The preview parses the file, validates each row, and classifies it as importable, duplicate, conflicting or rejected. Duplicates are counted as a multiset, so three identical rows in the file against one saved row produce one duplicate and two importable rows rather than treating all three as duplicates. Conflicts are reported for budgets and plans whose key already exists with a different value; the imported row is not allowed to overwrite it silently. The commit step then writes the selected datasets inside a transaction. Masked exports are rejected because their amounts and descriptions cannot be restored.

## 6.11 Security Design

Version 3.0.0 keeps the v2.0.0 controls and closes the remaining gaps. Table 8 summarises the additions.

**Table 8: Security controls added or strengthened in v3.0.0**

| Control | Implementation |
|---|---|
| Persistent sessions | `connect-sqlite3` stores sessions in a database file beside the main database |
| Session invalidation | `users.password_changed_at` invalidates sessions created before a password change |
| Password reset | 30-minute, single-use tokens stored as SHA-256 hashes; generic responses avoid account enumeration |
| Password change | Verifies the current password, rejects reuse, invalidates outstanding reset tokens and signs out other sessions |
| Key rotation | `ENCRYPTION_KEY_PREVIOUS` accepts older keys while records are re-encrypted; the script is dry-run by default and backs up before applying |
| Recurring description encryption | Templates use the same AES-256-GCM scheme as transactions |
| Export privacy | `privacy=1` masks amounts and hides descriptions on the server |
| Import safety | File size, row count, file type, masked-file detection and formula-injection neutralisation |
| Audit redaction | Email addresses and rupee amounts are redacted before details are stored |
| Bulk ownership | Every ID in a bulk request is verified before any write |
| Rate limits | Separate limits for login, registration, forgot-password and password writes |
| Demo isolation | Generated rows carry `is_demo`; purge is scoped and requires confirmation |

## 6.12 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 4, React Router 6, Recharts 3 |
| Backend | Node.js, Express 4 |
| Database | SQLite3 |
| Sessions | express-session + connect-sqlite3 |
| Password hashing | bcryptjs, 12 rounds |
| Encryption | Node.js crypto, AES-256-GCM |
| Security headers | Helmet |
| Rate limiting | express-rate-limit |
| Spreadsheet | ExcelJS 4.4 |
| Email | Nodemailer, optional SMTP |
| State | React Context API |
| Styling | Hand-written CSS with light, dark and system themes |

## 6.13 Work Distribution

Table 9 records the areas each member led. The work overlapped deliberately: every stage ended with a review by a second member and a shared verification run.

**Table 9: Indicative division of work**

| Member | Primary areas |
|---|---|
| Kartik Maurya | v2.0.0 analysis, analytics and forecasting modules, recommendation engine, verification suites |
| Ved Mishra | Interface implementation, charts and chart accessibility, responsive behaviour, screenshot capture |
| Shriram Nalawade | Import and export, workbook generation, printable report and print kit |
| Soham Niwate | Security hardening, audit tooling, account recovery, documentation and report compilation |

---

# Chapter 7: IMPLEMENTATION

## 7.1 Repository Structure

The repository keeps its original `client` and `server` folders. The client contains 10 pages, 42 shared components organised into generic, analytics, audit, chart and shortcut groups, four context providers and 58 JSX files in total, together with an API service, formatting utilities and a single stylesheet. The server contains nine route modules, nine controllers, eleven analytics modules, ten utilities, two middleware modules, two database modules, two report modules, two demo modules and one maintenance script. Across both sides the JavaScript and JSX sources amount to approximately 24,400 lines, including the verification suites.

## 7.2 Database Layer and Migration

Migration remains idempotent and additive. On start-up the server checks for each table, column and index and creates only what is missing. Version 3.0.0 adds the `plans`, `budget_recommendations` and `password_resets` tables, the `password_changed_at` column, the `is_essential` and `merchant` columns on transactions, the encrypted description column on recurring templates, and the `is_demo` flag on the four financial tables. Legacy plaintext descriptions are encrypted and cleared, and existing rows are never deleted.

The database layer uses parameterised statements throughout. Analytics modules receive plain arrays of rows from a context builder and return plain objects, which makes them testable without a database and keeps the SQL in one place.

## 7.3 Accounts, Sessions and Recovery

Registration validates the email address and password, hashes the password with bcryptjs at 12 rounds and stores only the hash. Login compares the password and creates a session; the cookie is signed, HttpOnly, SameSite=Lax and expires after 24 hours, with the `Secure` attribute set in production. The authentication middleware validates the session on every request and compares the session's creation time with `password_changed_at`, so a password change signs out other sessions.

Password reset creates a random token, stores only its SHA-256 hash with a 30-minute expiry and marks it used when consumed. If SMTP is configured the link is emailed; otherwise it is printed to the server console in development. The response to a reset request is the same whether or not the address exists, which prevents account enumeration. A change-password request verifies the current password, rejects reuse, invalidates outstanding tokens and updates `password_changed_at`.

## 7.4 Analytics Pipeline

An overview request is handled in a fixed order. The context builder loads the user's transaction history, the month's budgets, active recurring templates and the plan. Coverage is computed first, because it decides which analyses are meaningful. The forecast, pacing, anomaly, recurrence and recommendation modules then run against the same context, and the insight builder ranks the resulting signals. Each module returns a proof object, and the controller assembles the response.

Because every module works from the same context, the numbers on one screen agree with each other. The response combines period metadata, totals, coverage, income forecast, pacing rows, safe-to-spend, anomalies, committed recurring charges, detected subscriptions, a recommendation summary and a ranked insight list.

## 7.5 Forecasting

The forecast module is a pure function over a monthly series. It returns no data for an empty series, a wide low-confidence band for a single month, and the median-plus-capped-trend estimate for longer series. The method string names the level, the trend and the band, so the interface can show exactly what was done. When the plan contains an income assumption, that value is used for the income side and labelled as an assumption rather than a forecast.

## 7.6 Pacing and Safe-to-Spend

Pacing produces one row per active budget. Each row carries the budget, the amount spent, the projected month-end spend, the remaining amount, the variance and a status: unbudgeted, exceeded, within budget, at risk, underspending or on track. Remaining occurrences of active recurring templates are added to the projection, and the daily rate is taken from the preceding three months where possible.

Safe-to-spend reports the available amount, the committed remaining amount, the days left and an allowance per day, together with its inputs and confidence. For a completed month it returns an explicit "not applicable to a completed month" method and a zero allowance, which is the correct answer for a period that can no longer be spent.

## 7.7 Anomaly and Subscription Detection

Anomaly detection uses the robust modified z-score described in Chapter 6. It returns the item's amount, the category median, the MAD, the score, a severity and the evidence used. Because the threshold and window are constants in one module, they can be changed in one place and verified by the analytics suite.

Subscription detection groups charges by a normalised description and category, computes the intervals, and accepts a group when the intervals cluster around a weekly, monthly or yearly cadence and the amounts are close. The result distinguishes detected subscriptions from configured recurring templates, because the two have different user actions: one may need to be cancelled, the other may simply need to be reviewed.

## 7.8 Recommendation Engine

The engine first computes the envelope: the plan income minus the savings target for the `savings` objective, or the income envelope itself for the `overrun` objective. It then computes a floor and a cap for each category, applies the stability band, and allocates from the most discretionary category to the least. If the target cannot be met without breaking a floor, the result is marked infeasible with a deficit and explanatory notes; the engine does not quietly produce an allocation that violates its own rules.

Each category result contains the current amount, the proposed amount, the delta, the target, the floor, the cap, an essential flag, a reason string and an evidence object. Applying a proposal writes the amounts and stores a batch identifier, so the audit page can later reconstruct the change. The interface presents the proposal as a comparison and requires an explicit apply action; nothing is written during preview.

## 7.9 Backtesting

The evaluation module requires at least three completed months. For each origin it builds a forecast from the data available at that point, compares it with the next month's actual value, and repeats. It reports the number of folds, the mean absolute error, the mean absolute percentage error, the naive baseline error and the skill score. The recommendation counterfactual compares the engine's proposal with proportional and repeat baselines over the same months. The assumptions used by the evaluation are returned with the result, so a reader can see that the comparison is one-step-ahead and that the naive baseline repeats the previous month.

## 7.10 Insights and Readiness

The insight module converts the other results into typed, severity-ranked observations such as budget pressure, unusual spend, savings pace and subscription leakage. It is capped at twelve items so that the feed stays readable, and it reports the field by which items were ranked. Readiness is computed from coverage and returned as eight entries, each with a label, a status, the missing steps and what the analysis would unlock. The interface uses the same payload to hide or explain panels, so a locked analysis is never shown as an empty chart.

## 7.11 Import and Export

Export has four paths: a single-dataset CSV, a complete JSON backup, an Excel workbook and the monthly report. CSV output quotes fields correctly and neutralises formula prefixes. The backup contains the four financial datasets plus metadata and excludes audit records, credentials, encryption material and derived recommendations. The workbook contains four data sheets and an About sheet, with styled headers, filters and real date cells.

Import accepts an `.xlsx` workbook or a SpendWise `.json` backup. The preview stores nothing; it returns per-dataset counts and lists of rejected rows, duplicates and conflicts. The commit step accepts the dataset keys the user selected and writes them in one transaction. Per-screen CSV import remains available for transactions, recurring schedules and budgets, with header-driven parsing and duplicate skipping.

Limits are enforced before parsing: 5 MB and 5,000 rows per dataset for guided import, 2 MB for transaction CSV. A file exported with privacy mode on is rejected because its values are masked.

## 7.12 Monthly Report and Print Kit

The report builder produces a self-contained HTML document for a month. It contains at-a-glance totals, insights, spending pace, anomalies, a rebalance proposal, recurring commitments and the plan assumptions used. The print kit is a shared module that injects paper size, margin and pagination settings into the document, so the same report can be printed on A4, US Letter or US Legal with compact, normal or wide margins. Single-page mode keeps the content column and removes the surrounding page frame, letting the page height grow with the content up to a safety limit. The server does not generate a PDF; the browser's print dialog does.

## 7.13 Audit Tooling

The audit page supports search, category filters, a date range, sorting, pagination and per-category counts, and it can export the filtered log as CSV. Details are redacted before storage: email addresses and rupee amounts are replaced, so a leaked log does not expose contact details or balances. A recommendation trail reconstructs applied batches with their evidence and confidence, which links a budget value back to the proposal that produced it.

## 7.14 Interface and Accessibility

Navigation now uses React Router with lazy-loaded pages, so every page has a URL and the browser's back and forward buttons work. The navigation bar carries an account menu and collapses into a drawer on small screens; the drawer traps focus and closes on Escape. Transactions and recurring schedules share one workspace with tabs, and both support multi-select, bulk edit and bulk delete. Adding or editing a transaction opens a dialog instead of navigating away.

Charts have data tables for screen readers and an expandable modal for small screens. A shortcut registry provides ten Alt-based shortcuts, a searchable reference and per-browser rebinding with conflict detection. The accessibility pass adds a skip link, landmarks, visible focus states, labelled controls, live regions and reduced-motion handling. Privacy mode is synchronised across tabs and masks monetary values in the interface, charts and exports.

## 7.15 API Summary

Version 3.0.0 exposes 54 route definitions across nine modules, listed in Table 10. Every endpoint except registration, login, forgot-password, reset-password and the health check requires a valid session.

**Table 10: API route groups in v3.0.0**

| Group | Routes | Responsibility |
|---|---|---|
| `/api/auth` | 7 | Register, login, logout, current user, change password, forgot password, reset password |
| `/api/transactions` | 9 | List with filters, summary, single record, create, update, delete, CSV import, bulk update, bulk delete |
| `/api/budgets` | 7 | Period list, warnings, single record, create, update, delete, CSV import |
| `/api/recurring` | 8 | List, single record, create, update, delete, bulk update, bulk delete, CSV import |
| `/api/analytics` | 11 | Overview, insights, recommendations, apply, backtest, plan read and write, spending by category, monthly series, income comparison, summary |
| `/api/import` | 2 | Preview and commit |
| `/api/export` | 4 | CSV, JSON backup, Excel workbook, monthly report |
| `/api/audit` | 3 | Filtered list, CSV export, recommendation trail |
| `/api/demo` | 3 | Status, load, purge |

---

# Chapter 8: TESTING (VALIDATION AND VERIFICATION)

## 8.1 Testing Approach

The v2.0.0 integration script sent requests to a running server and a live database. That approach proved the main routes but could not be run safely against working data. For v3.0.0 the verification was reorganised into five suites. Each suite starts its own server process on an isolated port with a temporary database, seeds only the data it needs, asserts over HTTP and, where relevant, reads the temporary database directly, then shuts the server down and removes the files. The working database and the running development servers are never touched.

The legacy script was retained. It contains 27 checks and still targets `http://localhost:5000`; it is documented as suitable only for a disposable database and was not part of the isolated run recorded here.

## 8.2 Test Suites

Table 11 lists the suites, their ports and their check counts.

**Table 11: Verification suites and check counts**

| Suite | Port | Checks | Coverage |
|---|---|---|---|
| `verify_analytics.js` | 5099 | 59 | Coverage and readiness, forecasts, pacing, safe-to-spend in open and closed months, anomalies, subscriptions, plans, recommendations, apply, infeasibility, backtest, ownership, invalid inputs, persistence |
| `verify_bulk.js` | 5099 | 44 | Bulk update and delete for transactions and recurring schedules, ownership checks, limits, audit redaction |
| `verify_dataset_import.js` | 5097 | 16 | Transaction, recurring and budget CSV imports, header handling, duplicates, validation and audit records |
| `verify_export_audit.js` | 5098 | 77 | CSV, JSON and Excel exports, dataset contents, privacy masking, audit filters, counts, export and recommendation trail |
| `verify_privacy.js` | 5099 | 33 | Masked values, server-side privacy, encrypted storage, key rotation, production start-up guards, rate limits and session invalidation |
| **Total** | | **229** | |

The suites run one at a time because three share port 5099. Each prints a pass or fail line per check and a final count, and exits with a non-zero status if any check fails, which makes them usable as a manual gate before a release.

## 8.3 Test Results

All five suites passed on 2026-11-01: 59 of 59, 44 of 44, 16 of 16, 77 of 77 and 33 of 33, for 229 of 229 checks. The client production build also completed successfully.

The analytics suite is the most detailed. It seeds four prior months and a current period, creates six budgets and a plan, and then verifies the overview payload, the readiness gates, the forecast, pacing statuses, the detected health outlier, the detected streaming subscription, the ranked insights, the recommendation floors and caps, the apply action, the infeasible-plan path, the backtest skill against the naive baseline, unauthenticated access, invalid month and objective values, and a second user with a thin history who must sit at tier 1 and receive a locked recommendation with reasons.

## 8.4 Manual and Browser Verification

Every page was exercised in a browser at desktop, tablet and mobile widths, in light and dark themes, with privacy mode on and off. The walkthrough covered registration and login, adding and editing transactions in the dialog, filtering and bulk selection, creating budgets and recurring templates, loading and purging demo data, reviewing every Analytics panel, opening a proof drawer, applying a recommendation, generating and printing the monthly report, exporting each format, importing a workbook, resetting a password and reviewing the audit log.

Screenshots were captured from an isolated instance seeded with demonstration data, so the figures in this report come from a realistic six-month history rather than from assertions in a test. The 21 figures in Chapter 9 are those captures.

## 8.5 Defects Found and Resolved

Verification found several defects that manual inspection had missed.

- **Duplicate classification.** The first import preview treated repeated rows as a set, so three identical rows in a file against one saved row produced three duplicates. The parser was changed to count occurrences as a multiset.
- **Date-coupled safe-to-spend check.** The analytics suite used a fixed month. Once that month closed, safe-to-spend correctly returned "not applicable to a completed month" and the suite failed even though the product was right. The check was made period-aware, and a separate check now creates a budget in the current month and verifies that a positive allowance and a days-remaining figure are returned.
- **Identical documentation images.** Two Settings screenshots initially had the same content hash because the import section sat at the bottom of a long page and was never brought into view. A dedicated capture step now uploads a prepared import file and scrolls to the preview, producing a genuine import screen.
- **Chart label collisions.** Donut labels overlapped on small categories and axis labels were clipped; both were corrected in the chart components.
- **Privacy flash.** Masked values briefly rendered as real values before the first paint; the privacy state is now applied before the interface renders.
- **Horizontal overflow.** Wide tables and charts pushed the layout beyond the viewport; container and table styles were corrected.

## 8.6 Limitations of the Verification

The suites are integration-level. They exercise HTTP routes, database writes and file generation, but there is no unit-test framework and no coverage measurement. Rate limiting is in-process, so the limit checks depend on the server instance under test. Export tests parse the produced files rather than opening them in a spreadsheet application. Browser checks were performed manually and through screenshot capture, not through an automated end-to-end runner, and there is no continuous-integration pipeline.

---

# Chapter 9: RESULTS AND ANALYSIS

## 9.1 Working System

This section presents the enhanced application. Figure 1 shows the login page. Access to every other page requires a session.

![Fig 1: Registration and login page](screenshots/01-login.png)

*Fig 1: Registration and login page*

The dashboard in Figure 2 combines summary cards, a prioritised alert rail, expandable charts and recent activity. The same page in dark theme is shown in Figure 3.

![Fig 2: Dashboard with summary cards, alerts and charts](screenshots/02-dashboard.png)

*Fig 2: Dashboard with summary cards, alerts and charts*

![Fig 3: Dashboard in dark theme](screenshots/03-dashboard-dark.png)

*Fig 3: Dashboard in dark theme*

The transactions workspace in Figure 4 provides search, type and category filters, a date range, sorting and multi-select bulk actions. Figure 5 shows the dialog used to add or edit a record without leaving the page.

![Fig 4: Unified transactions workspace with filters and bulk actions](screenshots/04-transactions.png)

*Fig 4: Unified transactions workspace with filters and bulk actions*

![Fig 5: Transaction dialog for adding or editing a record](screenshots/05-transaction-dialog.png)

*Fig 5: Transaction dialog for adding or editing a record*

The Analytics workspace in Figure 6 presents the plan, coverage tier, forecast, safe-to-spend, pacing, insights, anomalies, subscriptions and recommendations. Figure 7 shows the recommendation panel with reasons, confidence and per-category evidence. The proof drawer in Figure 8 exposes the method, inputs, assumptions, confidence and trace behind a headline number. Figure 9 shows the result after a proposal is applied.

![Fig 6: Analytics workspace with forecast, pacing and insights](screenshots/06-analytics.png)

*Fig 6: Analytics workspace with forecast, pacing and insights*

![Fig 7: Budget recommendations with reasons, confidence and evidence](screenshots/07-analytics-recommendations.png)

*Fig 7: Budget recommendations with reasons, confidence and evidence*

![Fig 8: Proof drawer for a headline number](screenshots/07b-analytics-proof.png)

*Fig 8: Proof drawer for a headline number*

![Fig 9: Applied recommendation and updated proposals](screenshots/07c-analytics-applied.png)

*Fig 9: Applied recommendation and updated proposals*

Budgets in Figure 10 show spent, remaining and pacing against each limit, with warnings as a category approaches or passes its budget. Recurring schedules in Figure 11 share the transactions workspace styling and support the same bulk operations.

![Fig 10: Budgets with pacing, warnings and period control](screenshots/08-budgets.png)

*Fig 10: Budgets with pacing, warnings and period control*

![Fig 11: Recurring schedules](screenshots/09-recurring.png)

*Fig 11: Recurring schedules*

The audit log in Figure 12 supports search, category filters, a date range, sorting and per-category counts. Figure 13 shows the recommendation trail, which reconstructs applied proposal batches with their evidence.

![Fig 12: Audit log with filters and category counts](screenshots/10-audit-log.png)

*Fig 12: Audit log with filters and category counts*

![Fig 13: Recommendation trail reconstructed from applied batches](screenshots/10b-audit-trail.png)

*Fig 13: Recommendation trail reconstructed from applied batches*

Settings in Figure 14 consolidates appearance, privacy, account, demo data, export, import and shortcuts. Figure 15 shows the export and backup controls with the privacy-mode warning, and Figure 16 shows a guided import preview in which one transaction is new, one is a duplicate, one budget is new and one conflicts with an existing value.

![Fig 14: Settings overview](screenshots/11-settings.png)

*Fig 14: Settings overview*

![Fig 15: Export and backup controls](screenshots/12-settings-export.png)

*Fig 15: Export and backup controls*

![Fig 16: Guided import preview with duplicate and conflict classification](screenshots/12b-settings-import.png)

*Fig 16: Guided import preview with duplicate and conflict classification*

The printable monthly report in Figure 17 is generated from the same month's data and can be printed on three paper sizes, with three margin presets, either paginated or as one continuous page. Figure 18 shows the shortcut reference.

![Fig 17: Printable monthly report](screenshots/13-monthly-report.png)

*Fig 17: Printable monthly report*

![Fig 18: Keyboard shortcut reference](screenshots/14-shortcuts.png)

*Fig 18: Keyboard shortcut reference*

Figures 19 and 20 show the interface at mobile width, with the drawer open. Figure 21 shows privacy mode with amounts masked, including the chart surface.

![Fig 19: Dashboard at mobile width](screenshots/15-mobile-dashboard.png)

*Fig 19: Dashboard at mobile width*

![Fig 20: Mobile navigation drawer](screenshots/16-mobile-drawer.png)

*Fig 20: Mobile navigation drawer*

![Fig 21: Privacy mode with masked amounts](screenshots/17-privacy-mode.png)

*Fig 21: Privacy mode with masked amounts*

## 9.2 Comparison of v2.0.0 and v3.0.0

Table 12 compares the two versions across the dimensions used in the analysis.

**Table 12: v2.0.0 and v3.0.0 compared**

| Aspect | v2.0.0 | v3.0.0 |
|---|---|---|
| Theme | Secure multi-user platform | Forecasting and planning platform |
| Database tables | 5 | 8 |
| Indexes | None beyond constraints | 6 |
| API routes | 21 across 7 groups | 54 across 9 groups |
| Client pages | 10 | 10, with a different composition: add-transaction and recurring pages replaced by a dialog and tabs; forgot-password and reset-password added |
| Shared components | 11 | 42 |
| Context providers | 3 | 4 (shortcuts added) |
| Navigation | State-based | URL-based with lazy loading |
| Sessions | In memory | SQLite-backed, invalidated on password change |
| Password recovery | None | Forgot and reset with hashed single-use tokens |
| Encryption | Single key | Rotatable keys with a re-encryption CLI |
| Export | Transaction CSV | CSV for four datasets, JSON backup, Excel workbook, printable report |
| Import | None | Guided workbook and backup import; per-screen CSV import |
| Analytics | Descriptive charts | Forecasts, plans, pacing, safe-to-spend, anomalies, subscriptions, readiness, insights |
| Recommendations | None | Objective-aware proposals with proof, apply and trail |
| Evaluation | None | Rolling-origin backtest with naive baseline |
| Audit | Paginated list | Filters, counts, CSV export, redaction, recommendation trail |
| Bulk operations | None | Transactions and recurring schedules |
| Accessibility | Basic | Skip link, landmarks, focus states, live regions, data tables, reduced motion |
| Automated verification | 27 checks on a live server | 229 checks in five isolated suites |
| Build | Vite production build | Vite production build |

## 9.3 Objectives Against Outcomes

Table 13 states the outcome of each objective.

**Table 13: Objectives against outcomes**

| Objective | Outcome | Evidence |
|---|---|---|
| Monthly plan | Implemented with income, savings target and objective per month | Analytics suite; Fig 6 |
| Robust forecast | Implemented with median, capped Theil–Sen trend, band and confidence | Analytics suite; Figs 6 and 8 |
| Safe-to-spend and pacing | Implemented, including the completed-month case | Analytics suite |
| Anomaly and subscription detection | Implemented and detected on seeded data | Analytics suite |
| Explainable recommendations | Implemented with floors, caps, reasons and evidence | Analytics suite; Figs 7–9 |
| Readiness | Implemented for eight analyses and four tiers | Analytics suite; Fig 6 |
| Backtesting | Implemented with folds, MAE, naive baseline and skill | Analytics suite |
| Import and export | Implemented for CSV, JSON and Excel, with preview and classification | Import and export suites; Figs 15–16 |
| Printable report | Implemented with configurable paper, margins and pagination | Fig 17 |
| Account and key security | Implemented with reset tokens, session invalidation and rotation | Privacy suite |
| Interface and accessibility | Implemented with routing, bulk actions, shortcuts and focus handling | Figs 4, 14, 18–20 |
| Isolated verification | 229 of 229 checks passed | Table 11 |

## 9.4 Discussion

The results show that the objectives were met, with qualifications that follow from the design choices.

**Robustness over precision.** The forecast deliberately prefers a stable estimate to a fitted one. A median with a capped trend will not capture a sudden change, and it will lag a genuine upward or downward shift. The band and the confidence level communicate that limitation instead of hiding it, and the backtest reports the method's error against a naive baseline so that the claim can be checked on the user's own history.

**Explanation as a feature.** The proof object costs extra fields in every response, but it changes how the interface can behave. A user can open a drawer and see why a number is what it is, and a test can assert on the same object. This is more valuable for a financial tool than a marginally better score that cannot be explained.

**Honest failure.** The readiness gates and the infeasible-plan path both choose to say "not enough data" or "cannot be met" rather than return a plausible-looking number. This decision adds states to the interface, but it prevents the most damaging failure mode of a planning tool: confident advice built on two weeks of transactions.

**Portability with guardrails.** Import is the riskiest feature in the release, because it writes many rows at once. The two-step preview, the multiset duplicate count, the conflict classification, the masked-file rejection and the single transactional commit all exist to make an import explainable before it happens rather than after.

**Verification as infrastructure.** The move from one live-server script to five isolated suites is not only a testing improvement. It allows a contributor to run the project's checks on a laptop without touching real data, which is a precondition for accepting outside contributions.

## 9.5 Observations on Quality

The interface now presents one consistent visual system across light and dark themes, with a cool-neutral surface palette, semantic alert colours, consistent chart legends, themed tooltips and compact axis labels. Charts can be expanded and read as tables, which serves both small screens and assistive technology. Empty and locked states explain what is missing instead of showing a blank panel. The production build completes, and the size of the client is managed by route-level lazy loading.

---

# Chapter 10: CONCLUSION

## 10.1 Conclusion

This mini project extended an existing open-source personal finance tracker from a secure record-keeping application into a planning and portability platform. The third contribution adds monthly plans, robust forecasts, safe-to-spend, pacing, anomaly and subscription detection, explainable budget recommendations, readiness tiers, backtesting, guided import, structured export, a printable monthly report, password recovery, key rotation, richer audit tooling, URL navigation, bulk operations, keyboard shortcuts and an accessibility pass. The database grows from five tables to eight, the API from 21 routes to 54 route definitions, and the client from 11 shared components to 42, while every v2.0.0 capability remains available and existing data upgrades in place.

The work was verified with five isolated suites containing 229 checks, all of which passed, and with a browser walkthrough of every page at desktop and mobile widths. The visual record in Chapter 9 was captured from an isolated instance seeded with six months of demonstration data.

Beyond the software, the project gave the team practical experience of the open-source contribution process: reading an unfamiliar codebase, planning additive changes around an existing design, applying recognised security guidance, choosing statistical methods for the properties that matter, and building verification that can run safely.

## 10.2 Limitations

Table 14 lists the limitations that remain.

**Table 14: Known limitations of v3.0.0**

| Area | Limitation |
|---|---|
| Deployment | Single-node SQLite design; no horizontal scaling or cluster-safe sessions |
| Security | No CSRF token; protection relies on SameSite cookies and JSON requests |
| Categories | Fixed in code; no custom category management |
| Currency | Amounts are formatted as INR; no multi-currency support |
| PDF | The server produces printable HTML; the PDF depends on the browser's print dialog |
| Email | Password-reset email requires SMTP; without it the link is logged to the console |
| Verification | Integration-level suites only; no unit-test framework, coverage measurement or CI |
| Rate limiting | In-process; resets when the server restarts |
| Migration | v1.0.0 data is assigned to `local@spendwise.app` with a development password that must be changed |
| Seasonality | The Seasonal view describes the available context; it does not implement a seasonal model |

---

# Chapter 11: FUTURE SCOPE

1. Add a unit-test framework and a continuous-integration pipeline, and extend the isolated suites to cover the interface.
2. Introduce CSRF tokens and a stricter content-security policy as the interface evolves.
3. Allow users to create and manage custom categories, and migrate the fixed list into a table.
4. Support multiple currencies with a base currency and per-record currency.
5. Add bank and UPI statement import beyond file upload, with a mapping step for unknown columns.
6. Implement encrypted backups and a restore path that verifies the backup before writing.
7. Replace or complement the additive trend with a seasonal model once users have enough history, and compare it with the current method in the backtest.
8. Store rate-limit counters in a shared store so that limits survive restarts and work across processes.
9. Add email verification and, if the deployment warrants it, multi-factor authentication.
10. Package the application with containers and offer a progressive web app for offline access.
11. Add automated accessibility checks to the verification pipeline alongside the manual pass.
12. Extend the audit trail to cover every export and report generation with a downloadable receipt.

---

# Chapter 12: REFERENCES

[1] OWASP Foundation, *OWASP Application Security Verification Standard 4.0.3*. https://owasp.org/www-project-application-security-verification-standard/

[2] OWASP Foundation, *Password Storage Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

[3] OWASP Foundation, *Session Management Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

[4] OWASP Foundation, *OWASP Top 10:2021*. https://owasp.org/Top10/

[5] N. Provos and D. Mazières, "A Future-Adaptable Password Scheme," in *Proceedings of the 1999 USENIX Annual Technical Conference*, 1999.

[6] M. Dworkin, *Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC*, NIST Special Publication 800-38D, 2007. https://csrc.nist.gov/pubs/sp/800/38/d/final

[7] Meta Open Source, *React Documentation*. https://react.dev/

[8] OpenJS Foundation, *Express Documentation*. https://expressjs.com/

[9] E. Hahn and contributors, *Helmet: Help Secure Express Apps with HTTP Headers*. https://helmetjs.github.io/

[10] Express.js contributors, *express-session*. https://github.com/expressjs/session

[11] Recharts contributors, *Recharts: A Composable Charting Library Built on React Components*. https://recharts.org/

[12] Vite contributors, *Vite Documentation*. https://vitejs.dev/

[13] SQLite Consortium, *SQLite Documentation*. https://www.sqlite.org/docs.html

[14] OpenJS Foundation, *Node.js Crypto Module Documentation*. https://nodejs.org/api/crypto.html

[15] OWASP Foundation, *Logging Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

[16] Express Rate Limit contributors, *express-rate-limit*. https://github.com/express-rate-limit/express-rate-limit

[17] GitHub, *Contributing to a Project*. https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project

[18] GitHub, *Open Source Guides: How to Contribute to Open Source*. https://opensource.guide/how-to-contribute/

[19] R. J. Hyndman and G. Athanasopoulos, *Forecasting: Principles and Practice*, 3rd ed. Melbourne: OTexts, 2021. https://otexts.com/fpp3/

[20] H. Theil, "A Rank-Invariant Method of Linear and Polynomial Regression Analysis," *Proceedings of the Koninklijke Nederlandse Akademie van Wetenschappen*, vol. 53, pp. 386–392, 1950.

[21] P. K. Sen, "Estimates of the Regression Coefficient Based on Kendall's Tau," *Journal of the American Statistical Association*, vol. 63, no. 324, pp. 1379–1389, 1968. https://doi.org/10.1080/01621459.1968.10480934

[22] C. Leys, C. Ley, O. Klein, P. Bernard, and L. Licata, "Detecting Outliers: Do Not Use Standard Deviation Around the Mean, Use Absolute Deviation Around the Median," *Journal of Experimental Social Psychology*, vol. 49, no. 4, pp. 764–766, 2013. https://doi.org/10.1016/j.jesp.2013.03.013

[23] B. Iglewicz and D. C. Hoaglin, *How to Detect and Handle Outliers*. Milwaukee: ASQC Quality Press, 1993.

[24] ExcelJS contributors, *ExcelJS*. https://github.com/exceljs/exceljs

[25] Remix Software, *React Router Documentation*. https://reactrouter.com/

[26] W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

[27] W3C, *WAI-ARIA Authoring Practices Guide*. https://www.w3.org/WAI/ARIA/apg/

[28] MDN Web Docs, *Content Security Policy (CSP)*. https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
