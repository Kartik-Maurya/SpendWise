import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { usePrivacy } from '../contexts/PrivacyContext.jsx';

export default function Navbar({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { privacyMode, togglePrivacy } = usePrivacy();

  const navLinks = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'budgets', label: 'Budgets' },
    { key: 'recurring', label: 'Recurring' },
    { key: 'audit', label: 'Audit Log' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">💰</span>
        <span className="brand-text">SpendWise</span>
      </div>
      <div className="navbar-links">
        {navLinks.map((link) => (
          <button
            key={link.key}
            className={`nav-link ${currentPage === link.key ? 'active' : ''}`}
            onClick={() => onNavigate(link.key)}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div className="navbar-actions">
        <button
          className="icon-btn"
          onClick={togglePrivacy}
          title={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
        >
          {privacyMode ? '👁️' : '🔒'}
        </button>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user && (
          <button className="nav-link user-menu" onClick={logout} title="Logout">
            <span className="user-avatar">{user.name?.[0]?.toUpperCase() || '?'}</span>
            <span className="user-name">{user.name}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
