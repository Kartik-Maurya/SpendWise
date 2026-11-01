import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import InfoHint from '../components/InfoHint.jsx';
import DataImportPanel from '../components/DataImportPanel.jsx';
import ShortcutList from '../components/shortcuts/ShortcutList.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { usePrivacy } from '../contexts/PrivacyContext.jsx';
import { useShortcuts } from '../contexts/ShortcutsContext.jsx';
import { formatShortcut } from '../utils/shortcuts.js';
import {
  changePassword,
  downloadDatasetCsv,
  downloadBackup,
  downloadWorkbook,
  getDemoStatus,
  loadDemoData,
  purgeDemoData,
} from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

const DATASETS = [
  {
    key: 'transactions',
    title: 'Transactions',
    description:
      'Every income and expense entry, including entries generated from recurring schedules.',
  },
  {
    key: 'recurring',
    title: 'Recurring schedules',
    description:
      'The templates behind recurring entries, including frequency, next date and active status.',
  },
  {
    key: 'budgets',
    title: 'Budgets',
    description: 'Monthly category limits for every month you have budgeted.',
  },
  {
    key: 'plans',
    title: 'Monthly plans',
    description: 'Income assumption, savings target and objective for each month.',
  },
];

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { privacyMode, setPrivacyMode } = usePrivacy();
  const { getShortcut } = useShortcuts();
  const { hash } = useLocation();
  const privacyShortcut = formatShortcut(getShortcut('toggle-privacy'));
  const [downloading, setDownloading] = useState('');
  const [demo, setDemo] = useState(null);
  const [demoBusy, setDemoBusy] = useState('');
  const [demoError, setDemoError] = useState('');
  const [confirmDemoPurge, setConfirmDemoPurge] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    getDemoStatus()
      .then(setDemo)
      .catch((err) => setDemoError(err.message || 'Could not check demo data'));
  }, []);

  useEffect(() => {
    if (hash !== '#keyboard-shortcuts') return;
    const node = document.getElementById('keyboard-shortcuts');
    if (!node) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    node.focus({ preventScroll: true });
  }, [hash]);

  const handleLoadDemo = async () => {
    if (demoBusy) return;
    setDemoBusy('load');
    setDemoError('');
    try {
      const result = await loadDemoData();
      setDemo(result.status);
      showNotification(
        'success',
        result.alreadyLoaded
          ? 'Demo data is already loaded.'
          : `Demo data loaded: ${result.loaded.transactions} transactions across ${result.status.months} months.`
      );
    } catch (err) {
      const message = err.message || 'Failed to load demo data';
      setDemoError(message);
      showNotification('error', message);
    } finally {
      setDemoBusy('');
    }
  };

  const handlePurgeDemo = async () => {
    if (demoBusy) return;
    setDemoBusy('purge');
    setDemoError('');
    try {
      const result = await purgeDemoData();
      setDemo(result.status);
      setConfirmDemoPurge(false);
      showNotification(
        'success',
        `Removed ${result.removed.transactions} demo transactions, ${result.removed.budgets} budgets, ${result.removed.recurring} recurring templates and ${result.removed.plans} plans.`
      );
    } catch (err) {
      const message = err.message || 'Failed to remove demo data';
      setDemoError(message);
      showNotification('error', message);
    } finally {
      setDemoBusy('');
    }
  };

  const saveDownload = async (key, loader, successMessage) => {
    if (downloading) return;
    setDownloading(key);
    try {
      const { blob, filename } = await loader();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showNotification(
        'success',
        `${successMessage} (${filename})${privacyMode ? ' with sensitive fields masked' : ''}`
      );
    } catch (err) {
      showNotification('error', err.message || 'Export failed');
    } finally {
      setDownloading('');
    }
  };

  const handlePasswordField = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    setPasswordError('');
    setPasswordDone(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordBusy) return;

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordBusy(true);
    setPasswordError('');
    setPasswordDone(false);
    try {
      const result = await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordDone(true);
      showNotification('success', result.message || 'Password updated.');
    } catch (err) {
      setPasswordError(err.message || 'Could not update your password');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleDataset = (dataset) =>
    saveDownload(
      dataset,
      () => downloadDatasetCsv(dataset, privacyMode),
      `${DATASETS.find((item) => item.key === dataset)?.title || 'Dataset'} CSV downloaded`
    );

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p className="page-subtitle">
            Appearance, keyboard shortcuts, account details, demo data and exports.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-group">
          <div className="setting-item">
            <span className="setting-name">Theme</span>
            <div className="theme-options">
              <button
                className={`btn btn-small ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button
                className={`btn btn-small ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
              <button
                className={`btn btn-small ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('system')}
              >
                System
              </button>
            </div>
          </div>

          <div className="setting-item">
            <span className="setting-name">
              Privacy mode
              <InfoHint label="About privacy mode">
                Replaces amounts and transaction descriptions across the app until privacy mode
                is turned off, and blurs chart geometry. It is a display mask, not a security
                control: category names, counts, percentages and values in forms stay visible.
                Every export and the monthly report are masked on the server. Press{' '}
                {privacyShortcut} anywhere to toggle it.
              </InfoHint>
            </span>
            <button
              className={`btn btn-small ${privacyMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPrivacyMode(!privacyMode)}
              aria-pressed={privacyMode}
            >
              {privacyMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section shortcut-section" id="keyboard-shortcuts" tabIndex={-1}>
        <h3>Keyboard shortcuts</h3>
        <p className="export-note">
          Shortcuts work anywhere except while you are typing in a field. Every shortcut needs Alt,
          so ordinary typing and browser commands stay unaffected. Change one by pressing the new
          combination; if it is already taken you can swap the two instead of losing one.
        </p>
        <ShortcutList />
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <div className="setting-group">
          <div className="setting-item">
            <span className="setting-name">Name</span>
            <span className="setting-value">{user?.name}</span>
          </div>
          <div className="setting-item">
            <span className="setting-name">Email</span>
            <span className="setting-value">{user?.email}</span>
          </div>
        </div>

        <form className="password-form" onSubmit={handlePasswordSubmit}>
          <h4>Change password</h4>
          <p className="export-note">
            Changing your password signs out every other session. You stay signed in here.
          </p>

          {passwordError && <div className="error-message">{passwordError}</div>}
          {passwordDone && <div className="success-message">Your password has been updated.</div>}

          <div className="password-fields">
            <div className="form-group">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordField}
                required
                disabled={passwordBusy}
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordField}
                required
                minLength={8}
                disabled={passwordBusy}
                autoComplete="new-password"
              />
              <small className="form-hint">Minimum 8 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirmNewPassword">Confirm new password</label>
              <input
                id="confirmNewPassword"
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordField}
                required
                minLength={8}
                disabled={passwordBusy}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-small" disabled={passwordBusy}>
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="settings-section demo-section">
        <h3>
          Demo data
          <InfoHint label="About demo data">
            Demo data adds six completed months plus the current month so every chart, insight and
            recommendation has something to work with. Every demo row is tagged separately, so
            removing it never deletes transactions, budgets, recurring schedules or plans that you
            created yourself.
          </InfoHint>
        </h3>

        {!demo && !demoError && <p className="demo-copy">Checking demo data…</p>}

        {demo && demo.active && (
          <>
            <p className="demo-copy">
              Demo data is loaded. It is kept separate from your own entries and can be removed at
              any time.
            </p>
            <div className="demo-counts">
              <span className="demo-chip">
                <strong>{demo.transactions}</strong> transactions
              </span>
              <span className="demo-chip">
                <strong>{demo.months}</strong> months
              </span>
              <span className="demo-chip">
                <strong>{demo.budgets}</strong> budgets
              </span>
              <span className="demo-chip">
                <strong>{demo.recurring}</strong> recurring
              </span>
              <span className="demo-chip">
                <strong>{demo.plans}</strong> {demo.plans === 1 ? 'plan' : 'plans'}
              </span>
            </div>

            {!confirmDemoPurge ? (
              <div className="demo-actions">
                <button
                  type="button"
                  className="btn btn-delete btn-small"
                  onClick={() => setConfirmDemoPurge(true)}
                  disabled={Boolean(demoBusy)}
                >
                  Remove demo data
                </button>
              </div>
            ) : (
              <div className="demo-confirm">
                <p>
                  Remove {demo.transactions} demo transactions, {demo.budgets} budgets,{' '}
                  {demo.recurring} recurring templates and {demo.plans} monthly{' '}
                  {demo.plans === 1 ? 'plan' : 'plans'}? Your own entries are kept.
                </p>
                <div className="demo-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setConfirmDemoPurge(false)}
                    disabled={demoBusy === 'purge'}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-delete btn-small"
                    onClick={handlePurgeDemo}
                    disabled={demoBusy === 'purge'}
                  >
                    {demoBusy === 'purge' ? 'Removing…' : 'Remove demo data'}
                  </button>
                </div>
              </div>
            )}

            <p className="demo-note">
              Loaded {demo.firstDate} to {demo.lastDate}. Audit entries for loading and removing demo
              data remain in the Audit Log.
            </p>
          </>
        )}

        {demo && !demo.active && (
          <>
            <p className="demo-copy">
              No demo data is loaded. Load six months of history plus the current month to explore
              the dashboard, analytics, budgets and recommendations before entering your own data.
            </p>
            {demo.hasUserData && (
              <p className="demo-note">
                This account already has {demo.userTransactions} of your own transactions. Demo
                entries are added alongside them, and removing demo data keeps your entries.
              </p>
            )}
            <div className="demo-actions">
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={handleLoadDemo}
                disabled={Boolean(demoBusy)}
              >
                {demoBusy === 'load' ? 'Loading…' : 'Load demo data'}
              </button>
            </div>
          </>
        )}

        {demoError && <div className="error-message demo-error">{demoError}</div>}
      </div>

      <div className="settings-section export-section">
        <h3>
          Export &amp; backup
          <InfoHint label="About exports">
            Downloads contain only your own data. Audit logs, account credentials, owner IDs and
            derived budget recommendations are excluded. Every file is named with its dataset and
            a timestamp. Privacy mode masks amounts and descriptions in every format, including
            the Excel workbook.
          </InfoHint>
        </h3>

        <p className="export-note">
          CSV files are best for spreadsheets. The Excel workbook combines every dataset into one
          file with real date cells and fixed column widths, so dates display normally instead of
          showing ########, and it can be imported back below. The JSON backup is the complete copy
          used for restoring an account.
        </p>

        <div className="export-list">
          {DATASETS.map((dataset) => (
            <div className="export-row" key={dataset.key}>
              <div className="export-row-main">
                <div className="export-row-title">
                  {dataset.title}
                  <span className="export-format">CSV</span>
                </div>
                <p>{dataset.description}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => handleDataset(dataset.key)}
                disabled={Boolean(downloading)}
              >
                {downloading === dataset.key ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          ))}
        </div>

        <div className="export-backup">
          <div className="export-backup-main">
            <h4>Complete backup</h4>
            <p>
              Transactions, recurring schedules, budgets and monthly plans in one file. The JSON
              backup is machine-readable; the Excel workbook is for reading and analysis.
            </p>
          </div>
          <div className="export-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                saveDownload(
                  'backup',
                  () => downloadBackup(privacyMode),
                  'Full backup downloaded'
                )
              }
              disabled={Boolean(downloading)}
            >
              {downloading === 'backup' ? 'Preparing…' : 'JSON backup'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                saveDownload(
                  'workbook',
                  () => downloadWorkbook(privacyMode),
                  'Excel workbook downloaded'
                )
              }
              disabled={Boolean(downloading)}
            >
              {downloading === 'workbook' ? 'Building workbook…' : 'Excel workbook (.xlsx)'}
            </button>
          </div>
        </div>

        <p className={`export-privacy-note ${privacyMode ? 'active' : ''}`}>
          <strong>Privacy mode is {privacyMode ? 'ON' : 'OFF'}.</strong>{' '}
          {privacyMode
            ? 'Amounts and descriptions will be masked in every download. A masked backup is not suitable for re-import.'
            : 'Exports contain amounts and descriptions. Turn privacy mode on before downloading if you are sharing your screen.'}
        </p>

        <p className="export-excluded">
          Audit logs are not exported because they contain security events and IP addresses. They
          remain available in the Audit Log page.
        </p>
      </div>

      <div className="settings-section import-section">
        <h3>Import &amp; restore</h3>

        <p className="export-note">
          Restore the Excel workbook or JSON backup downloaded above. Everything is checked before
          anything is written: pick which datasets to import, review the counts, then confirm.
        </p>

        <DataImportPanel />
      </div>
    </div>
  );
}
