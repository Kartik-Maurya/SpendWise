import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { usePrivacy } from '../contexts/PrivacyContext.jsx';
import { exportCsv } from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { privacyMode, setPrivacyMode } = usePrivacy();

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-group">
          <label className="setting-label">
            <span>Theme</span>
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
          </label>

          <label className="setting-label">
            <span>Privacy Mode</span>
            <button
              className={`btn btn-small ${privacyMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPrivacyMode(!privacyMode)}
            >
              {privacyMode ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <div className="setting-group">
          <div className="setting-item">
            <span className="setting-label">Name</span>
            <span className="setting-value">{user?.name}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Email</span>
            <span className="setting-value">{user?.email}</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Exports</h3>
        <div className="setting-group">
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const blob = await exportCsv();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'spendwise-transactions.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showNotification('success', 'CSV exported successfully');
              } catch (err) {
                showNotification('error', err.message || 'Export failed');
              }
            }}
          >
            Export Transactions to CSV
          </button>
        </div>
      </div>
    </div>
  );
}
