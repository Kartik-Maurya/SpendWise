import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import { setAuthErrorHandler } from './services/api.js';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import AddTransaction from './pages/AddTransaction.jsx';
import Analytics from './pages/Analytics.jsx';
import Budgets from './pages/Budgets.jsx';
import Recurring from './pages/Recurring.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Notification from './components/Notification.jsx';

function App() {
  const { user, loading, checkAuth, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    setAuthErrorHandler(() => {
      logout().catch(() => {});
    });
  }, [logout]);

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleAuthSuccess = () => {
    setRefreshKey((k) => k + 1);
    setCurrentPage('dashboard');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        {authMode === 'login' ? (
          <Login onNavigate={setAuthMode} onSuccess={handleAuthSuccess} />
        ) : (
          <Register onNavigate={setAuthMode} onSuccess={handleAuthSuccess} />
        )}
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard key={refreshKey} onNavigate={setCurrentPage} />;
      case 'transactions':
        return <Transactions key={refreshKey} onNavigate={setCurrentPage} />;
      case 'add':
        return <AddTransaction onSuccess={handleAuthSuccess} onCancel={() => setCurrentPage('transactions')} />;
      case 'analytics':
        return <Analytics />;
      case 'budgets':
        return <Budgets />;
      case 'recurring':
        return <Recurring />;
      case 'audit':
        return <AuditLog />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard key={refreshKey} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main-content">{renderPage()}      </main>
      {(currentPage === 'dashboard' || currentPage === 'transactions') && (
        <button
          className="fab"
          onClick={() => setCurrentPage('add')}
          title="Add Transaction"
          aria-label="Add Transaction"
        >
          +
        </button>
      )}
      <Notification />
    </div>
  );
}

export default App;
