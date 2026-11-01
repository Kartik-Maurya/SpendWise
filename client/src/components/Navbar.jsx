import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePrivacy } from '../contexts/PrivacyContext.jsx';
import { useShortcuts } from '../contexts/ShortcutsContext.jsx';
import { formatShortcut } from '../utils/shortcuts.js';
import ThemeMenu from './ThemeMenu.jsx';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/settings', label: 'Settings' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { privacyMode, togglePrivacy } = usePrivacy();
  const { getShortcut, openPanel } = useShortcuts();
  const privacyShortcut = getShortcut('toggle-privacy');
  const privacyLabel = formatShortcut(privacyShortcut);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const accountItemRefs = useRef([]);
  const drawerRef = useRef(null);
  const drawerTriggerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    accountItemRefs.current[0]?.focus();
  }, [menuOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const node = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(node.querySelectorAll('a[href], button:not([disabled])')).filter(
        (element) => element.offsetParent !== null
      );

    focusables()[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        drawerTriggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      if (!node.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? items[items.length - 1] : items[0]).focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 981px)');
    const handleChange = () => {
      if (mediaQuery.matches) setDrawerOpen(false);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  };

  const goToSettings = () => {
    setMenuOpen(false);
    navigate('/settings');
  };

  const openShortcutPanel = () => {
    setMenuOpen(false);
    openPanel();
  };

  const handleAccountMenuKeyDown = (event) => {
    const items = accountItemRefs.current.filter(Boolean);
    const currentIndex = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  return (
    <nav className={`navbar${drawerOpen ? ' drawer-open' : ''}`} aria-label="Primary">
      <div className="navbar-brand">
        <span className="brand-icon">💰</span>
        <span className="brand-text">SpendWise</span>
      </div>
      <div className="navbar-links">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="navbar-actions">
        <span
          className={`privacy-status${privacyMode ? '' : ' privacy-status-off'}`}
          role="img"
          aria-label={
            privacyMode
              ? `Privacy mode is on. Press ${privacyLabel} or open the account menu to turn it off.`
              : undefined
          }
          aria-hidden={privacyMode ? undefined : true}
          title={privacyMode ? `Privacy mode is on (${privacyLabel} to turn it off)` : undefined}
        >
          🔒
        </span>
        <ThemeMenu />
        {user && (
          <div className="account-menu" ref={menuRef}>
            <button
              type="button"
              ref={triggerRef}
              className={`user-menu ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="user-avatar">{user.name?.[0]?.toUpperCase() || '?'}</span>
              <span className="user-name">{user.name}</span>
              <span className="user-caret" aria-hidden="true">▾</span>
            </button>
            {menuOpen && (
              <div
                className="account-dropdown"
                role="menu"
                aria-label="Account menu"
                onKeyDown={handleAccountMenuKeyDown}
              >
                <div className="account-identity">
                  <span className="user-avatar account-avatar">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span className="account-details">
                    <span className="account-name">{user.name}</span>
                    {user.email && <span className="account-email">{user.email}</span>}
                  </span>
                </div>
                <div className="account-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="account-item"
                  ref={(node) => {
                    accountItemRefs.current[0] = node;
                  }}
                  onClick={goToSettings}
                >
                  <span className="account-item-icon" aria-hidden="true">⚙</span>
                  Account settings
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={privacyMode}
                  aria-keyshortcuts={privacyShortcut}
                  className="account-item"
                  ref={(node) => {
                    accountItemRefs.current[1] = node;
                  }}
                  onClick={togglePrivacy}
                  title={`Toggle privacy mode (${privacyLabel})`}
                >
                  <span className="account-item-icon" aria-hidden="true">
                    {privacyMode ? '👁️' : '🔒'}
                  </span>
                  Privacy mode
                  <span className="account-item-state">{privacyMode ? 'On' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="account-item"
                  ref={(node) => {
                    accountItemRefs.current[2] = node;
                  }}
                  onClick={openShortcutPanel}
                >
                  <span className="account-item-icon" aria-hidden="true">⌨</span>
                  Keyboard shortcuts
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="account-item account-item-danger"
                  ref={(node) => {
                    accountItemRefs.current[3] = node;
                  }}
                  onClick={logout}
                >
                  <span className="account-item-icon" aria-hidden="true">↪</span>
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          ref={drawerTriggerRef}
          className="icon-btn hamburger-btn"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="primary-navigation"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {drawerOpen && (
        <div
          className="nav-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <div
            id="primary-navigation"
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            ref={drawerRef}
            tabIndex={-1}
          >
            <div className="nav-drawer-head">
              <span className="nav-drawer-title">Menu</span>
              <button
                type="button"
                className="nav-drawer-close"
                aria-label="Close navigation menu"
                onClick={closeDrawer}
              >
                ×
              </button>
            </div>
            <div className="nav-drawer-links">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `nav-drawer-link ${isActive ? 'active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
