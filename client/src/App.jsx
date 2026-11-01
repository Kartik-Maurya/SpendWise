import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { usePrivacy } from './contexts/PrivacyContext.jsx';
import { useTheme } from './contexts/ThemeContext.jsx';
import { useShortcuts } from './contexts/ShortcutsContext.jsx';
import { setAuthErrorHandler } from './services/api.js';
import Navbar from './components/Navbar.jsx';
import Notification from './components/Notification.jsx';
import TransactionDialog from './components/TransactionDialog.jsx';
import ShortcutPanel from './components/shortcuts/ShortcutPanel.jsx';
import { bindingFromEvent, isEditableTarget, SHORTCUT_ACTIONS } from './utils/shortcuts.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));

function RouteFallback() {
  return (
    <div className="route-loading" role="status">
      <div className="loading-spinner" aria-hidden="true"></div>
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

function App() {
  const { user, loading, checkAuth, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const { togglePrivacy } = usePrivacy();
  const { toggleTheme } = useTheme();
  const { shortcuts, capturing, panelOpen, openPanel, closePanel } = useShortcuts();

  const shortcutIndex = useMemo(() => {
    const index = new Map();
    Object.entries(shortcuts).forEach(([actionId, binding]) => index.set(binding, actionId));
    return index;
  }, [shortcuts]);

  useEffect(() => {
    setAuthErrorHandler(() => {
      logout().catch(() => {});
    });
  }, [logout]);

  useEffect(() => {
    setAddOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!user) closePanel();
  }, [user, closePanel]);

  useEffect(() => {
    if (!user) return undefined;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat || capturing) return;
      if (isEditableTarget(event.target)) return;
      const binding = bindingFromEvent(event);
      if (!binding) return;
      const actionId = shortcutIndex.get(binding);
      if (!actionId) return;

      if (actionId === 'show-shortcuts') {
        if (panelOpen) {
          event.preventDefault();
          closePanel();
          return;
        }
        if (document.querySelector('[aria-modal="true"]')) return;
        event.preventDefault();
        openPanel();
        return;
      }

      // A dialog, chart expansion or nav drawer owns the keyboard while open.
      if (document.querySelector('[aria-modal="true"]')) return;

      const action = SHORTCUT_ACTIONS.find((item) => item.id === actionId);
      if (!action) return;
      event.preventDefault();
      if (action.path) navigate(action.path);
      else if (actionId === 'add-transaction') setAddOpen(true);
      else if (actionId === 'toggle-privacy') togglePrivacy();
      else if (actionId === 'cycle-theme') toggleTheme();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    user,
    capturing,
    shortcutIndex,
    panelOpen,
    closePanel,
    openPanel,
    navigate,
    togglePrivacy,
    toggleTheme,
  ]);

  const handleAuthSuccess = () => {
    setRefreshKey((k) => k + 1);
    navigate('/dashboard', { replace: true });
  };

  const handleTransactionSaved = () => {
    setAddOpen(false);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="loading-screen" role="status">
        <div className="loading-spinner" aria-hidden="true"></div>
        <span className="sr-only">Loading SpendWise…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/reset-password"
              element={<ResetPassword onSuccess={handleAuthSuccess} />}
            />
            <Route path="/register" element={<Register onSuccess={handleAuthSuccess} />} />
            <Route path="*" element={<Login onSuccess={handleAuthSuccess} />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  onAddTransaction={() => setAddOpen(true)}
                  refreshToken={refreshKey}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <Transactions
                  onAddTransaction={() => setAddOpen(true)}
                  refreshToken={refreshKey}
                />
              }
            />
            <Route path="/budgets" element={<Budgets />} />
            <Route
              path="/analytics"
              element={
                <Analytics
                  onAddTransaction={() => setAddOpen(true)}
                  refreshToken={refreshKey}
                />
              }
            />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
      {pathname === '/dashboard' && (
        <button
          className="fab"
          onClick={() => setAddOpen(true)}
          title="Add Transaction"
          aria-label="Add Transaction"
        >
          +
        </button>
      )}
      <TransactionDialog
        open={addOpen}
        mode="create"
        onClose={() => setAddOpen(false)}
        onSaved={handleTransactionSaved}
      />
      <ShortcutPanel />
      <Notification />
    </div>
  );
}

export default App;
