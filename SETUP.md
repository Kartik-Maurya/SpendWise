# SpendWise setup guide

This guide takes a fresh clone to a running application, then explains the optional pieces: password-reset email, demo data, verification suites and self-hosting. It assumes no prior knowledge of the project.

- [1. Requirements](#1-requirements)
- [2. Quick start](#2-quick-start)
- [3. Configure the server environment](#3-configure-the-server-environment)
- [4. Password-reset email](#4-password-reset-email-optional)
- [5. Database](#5-database)
- [6. Running the application](#6-running-the-application)
- [7. Verification suites](#7-verification-suites)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Self-hosting checklist](#9-self-hosting-checklist)
- [10. Never commit these](#10-never-commit-these)

---

## 1. Requirements

| Requirement | Notes |
|---|---|
| Node.js 18 or newer | `node --version` |
| npm | Ships with Node.js |
| Git | Optional; only needed to clone and update |
| An SMTP mailbox | Optional; only for emailed password-reset links |

No external database server is needed. SQLite is embedded and the file is created on first start.

---

## 2. Quick start

```bash
git clone https://github.com/Kartik-Maurya/SpendWise.git
cd SpendWise
npm run install-all
cp .env.example server/.env
```

Open `server/.env` and replace the two placeholder secrets. Generate them locally:

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ENCRYPTION_KEY (32 bytes as hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start both servers:

```bash
npm run dev
```

- Web UI: <http://localhost:3000>
- API: <http://localhost:5000/api/health>

Register an account on the login screen. There is no default user on a fresh database. To see the analytics, budgets and report features immediately, load **Settings → Demo data**, which generates six months of sample history for the signed-in account and can be purged again without touching your own rows.

> `npm run seed` is **not** the right command for a fresh install. It targets the legacy `local@spendwise.app` account that only exists after a v1.0.0 database migration. Use the demo-data button instead.

### Windows launchers

`start.bat` and `stop.bat` wrap `scripts/spendwise.ps1`, which starts both servers in separate windows and tracks their process IDs:

```bat
start.bat          :: start web UI and API
stop.bat           :: stop both
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\spendwise.ps1 status
```

---

## 3. Configure the server environment

The backend reads `server/.env` through `dotenv`, relative to the process working directory. The npm scripts (`npm run dev`, `npm start --prefix server`) run from `server/`, so `server/.env` is the correct location.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | In `production` the server refuses to start without a strong `SESSION_SECRET` and an `ENCRYPTION_KEY` |
| `CORS_ORIGIN` | `http://localhost:3000` | The only browser origin allowed to call the API |
| `SESSION_SECRET` | none | Signs the session cookie |
| `ENCRYPTION_KEY` | generated file | 32-byte AES-256-GCM key as 64 hex characters |
| `ENCRYPTION_KEY_PREVIOUS` | none | Older keys, only while rotating |
| `APP_URL` | `CORS_ORIGIN` | Base URL used in password-reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | none | Optional reset email |
| `SPENDWISE_DB_PATH` | `server/database/spendwise.db` | Alternate database file, useful for scratch runs |

### Secrets behave differently in development and production

- **Development, no `ENCRYPTION_KEY`:** the server generates a random key and writes it to `server/.enc_key` (gitignored), printing a warning. Keep that file. Delete it and previously encrypted descriptions can no longer be read.
- **Production:** missing `SESSION_SECRET` or `ENCRYPTION_KEY` stops the server at startup instead of silently generating values.
- **Changing `ENCRYPTION_KEY` on an existing database:** put the old key in `ENCRYPTION_KEY_PREVIOUS`, run `node server/scripts/reencrypt.js --apply`, then remove the old key. See [Rotating the encryption key](README.md#rotating-the-encryption-key).

If you run `node server.js` by hand from the repository root instead of from `server/`, `dotenv` looks for a `.env` in the root and none of the above is loaded.

---

## 4. Password-reset email (optional)

Without SMTP the application still works. The reset link is printed to the server console and can be copied from there, which is the normal path for local development and demonstrations.

To send real email, provide SMTP settings in `server/.env`.

### Gmail

Gmail requires **2-Step Verification** and an **App Password**; your normal account password will not work.

1. Enable 2-Step Verification: <https://myaccount.google.com/security>
2. Create an app password: <https://myaccount.google.com/apppasswords> (choose "Mail" and your device)
3. Copy the 16-character password, without spaces, into `server/.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.address@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM=SpendWise <your.address@gmail.com>
APP_URL=http://localhost:3000
```

`SMTP_PORT=587` uses STARTTLS. If your provider uses implicit TLS on port 465, set `SMTP_SECURE=true` instead.

### Any other provider

Use the host, port and TLS mode from the provider's SMTP documentation. Only `SMTP_HOST` controls whether mail is attempted; leaving it empty restores the console fallback.

### Rules for this credential

- Use a dedicated mailbox or an app password, never a personal account password.
- Never commit `server/.env`, paste the password into an issue, or include it in a zip you share.
- If the password was ever committed, pasted or shared, revoke it in the provider's console and issue a new one.
- `APP_URL` must match the address people actually use, or reset links will point at the wrong host.

---

## 5. Database

| Item | Location |
|---|---|
| Data | `server/database/spendwise.db` |
| Sessions | `server/database/spendwise-sessions.db` |
| Schema and migrations | `server/database/init.js`, applied automatically on start |

Migrations are additive and idempotent, so starting a newer version against an older file upgrades it in place. A v1.0.0 database is detected, its transactions are assigned to `local@spendwise.app` (password `changeme123`), and plaintext descriptions are encrypted. Change that password immediately after the first login.

### Back up and reset

```bash
# Back up while the server is stopped
cp server/database/spendwise.db backups/spendwise-$(date +%F).db
```

To start over in development, stop the server and delete both database files. This destroys all local data.

```bash
rm server/database/spendwise.db server/database/spendwise-sessions.db
```

The `.db`, `.db.bak*` and session files are gitignored, along with `server/.enc_key`.

---

## 6. Running the application

```bash
npm run dev                     # both servers, from the repository root
npm start --prefix server       # API only
npm run dev --prefix client     # Vite dev server only
npm run build --prefix client   # production bundle in client/dist
```

| Port | Service | Change it by |
|---|---|---|
| 3000 | Vite dev server | `client/vite.config.js` (`server.port`) |
| 5000 | Express API | `PORT` in `server/.env`, plus the proxy target in `client/vite.config.js` |

If you move the API port, update `CORS_ORIGIN` as well or the browser will reject the requests.

---

## 7. Verification suites

Each suite starts its own server on an isolated port with a temporary database, so it never touches your working data. Run them one at a time because several share port 5099.

```bash
node server/verify_analytics.js       # analytics, plan, recommendations, backtest (5099)
node server/verify_bulk.js            # bulk transaction and recurring actions (5099)
node server/verify_dataset_import.js  # CSV imports and duplicate handling (5097)
node server/verify_export_audit.js    # CSV/JSON/XLSX exports, audit log (5098)
node server/verify_privacy.js         # privacy masking, encryption, key rotation (5099)
```

`node server/test_api.js` is the legacy end-to-end suite. It targets `http://localhost:5000` and **writes data**, so run it only against a disposable database, never against one you care about.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE :3000` or `:5000` | Something else is running. Stop the old process (`stop.bat`, `scripts/spendwise.ps1 stop`) or change the port in both places. |
| API returns `401` right after login | The browser blocked the cookie. Check that the UI origin matches `CORS_ORIGIN` and that you opened the app through `http://localhost:3000`, not `127.0.0.1` mixed with `localhost`. |
| `Failed to connect to SQLite database` | The directory in `SPENDWISE_DB_PATH` does not exist or is not writable. |
| Tables look empty after an upgrade | The server is pointed at a different database file. Check `SPENDWISE_DB_PATH` and the working directory. |
| Descriptions show as unreadable text | `ENCRYPTION_KEY` changed and the old key is not in `ENCRYPTION_KEY_PREVIOUS`. Restore the previous key before running the re-encryption script. |
| Reset link goes to the wrong host | Set `APP_URL` to the public frontend URL. |
| No reset email arrives | `SMTP_HOST` is empty or credentials are wrong. Check the server console: an unconfigured mailer prints the link instead. |
| Gmail rejects the login | Use an App Password with 2-Step Verification enabled; the account password is rejected. |
| Login blocked after repeated attempts | Rate limiting: 5 attempts per 15 minutes. Restarting the server clears the in-process counters. |
| `npm run dev` fails with `concurrently: not found` | Root dependencies were not installed. Run `npm install` at the repository root (or `npm run install-all`). |

---

## 9. Self-hosting checklist

- Set `NODE_ENV=production`, a strong `SESSION_SECRET` (32+ characters) and a fixed `ENCRYPTION_KEY`.
- Serve the built client and the API over HTTPS. Session cookies are marked `Secure` in production.
- Set `CORS_ORIGIN` and `APP_URL` to the real public URLs.
- Back up `spendwise.db` regularly; SQLite is a single file and the design is single-node, with no cluster-safe sessions.
- Keep `server/.env` and `server/.enc_key` out of version control and out of any archive you share.
- Rotate the encryption key with `ENCRYPTION_KEY_PREVIOUS` and `node server/scripts/reencrypt.js` if the key may have been exposed.
- Review the [Known limitations](README.md#known-limitations) before treating this as production banking software.

---

## 10. Never commit these

`.gitignore` already excludes all of them; if you copy files into a checkout manually, confirm with `git status` before committing.

| File | Why |
|---|---|
| `server/.env` | Contains the session secret, encryption key and SMTP password |
| `server/.enc_key` | Generated key file; losing or leaking it breaks stored data |
| `*.db`, `*.db.bak*`, `*sessions.db` | Real account data, password hashes and session records |
| `node_modules/`, `client/dist/`, `.run/` | Reproducible build output and local process state |
| `docs/~$*.docx` | Office lock files created while a document is open |

`.env.example` is safe to commit: it contains placeholders only.
