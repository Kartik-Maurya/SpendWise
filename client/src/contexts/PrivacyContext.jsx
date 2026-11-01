import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatCurrency } from '../utils/format.js';

const PrivacyContext = createContext();

export const MASK = '••••••••';

const STORAGE_KEY = 'privacyMode';

const readStoredPrivacy = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

// Set before React paints so charts are never briefly visible unblurred when
// privacy mode was left on in a previous visit.
const initialPrivacy = readStoredPrivacy();
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-privacy', initialPrivacy ? 'true' : 'false');
}

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(initialPrivacy);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, privacyMode);
    } catch {
      // Storage can be unavailable (private browsing, quota); the session still works.
    }
    document.documentElement.setAttribute('data-privacy', privacyMode ? 'true' : 'false');
  }, [privacyMode]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        setPrivacyMode(event.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const togglePrivacy = () => {
    setPrivacyMode((p) => !p);
  };

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy, setPrivacyMode }}>
      <span className="sr-only" role="status" aria-live="polite">
        Privacy mode {privacyMode ? 'on' : 'off'}
      </span>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);

export const usePrivacyFormat = () => {
  const { privacyMode } = usePrivacy();

  const formatAmount = (amount) => (privacyMode ? MASK : formatCurrency(amount));
  const formatValue = (value, isCurrency = true) =>
    privacyMode ? MASK : isCurrency ? formatCurrency(value) : String(value);
  const protectText = (text) => {
    if (!privacyMode || text === null || text === undefined) return text;
    return String(text).replace(/₹\s?-?[\d,]+(?:\.\d+)?/g, MASK);
  };

  const formatText = (text) => {
    if (text === null || text === undefined) return text;
    if (privacyMode) return protectText(text);
    return String(text).replace(/₹\s?(-?[\d,]+(?:\.\d+)?)/g, (match, raw) => {
      const value = Number(raw.replace(/,/g, ''));
      return Number.isFinite(value) ? formatCurrency(value) : match;
    });
  };

  const formatDescription = (text) =>
    privacyMode && text !== null && text !== undefined && text !== '' ? MASK : text;

  return {
    privacyMode,
    formatAmount,
    formatValue,
    protectText,
    formatText,
    formatDescription,
  };
};
