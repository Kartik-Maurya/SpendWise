import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatCurrency } from '../utils/format.js';

const PrivacyContext = createContext();

const MASK = '••••••••';

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    return localStorage.getItem('privacyMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('privacyMode', privacyMode);
    document.documentElement.setAttribute('data-privacy', privacyMode ? 'true' : 'false');
  }, [privacyMode]);

  const togglePrivacy = () => {
    setPrivacyMode((p) => !p);
  };

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy, setPrivacyMode }}>
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

  return { privacyMode, formatAmount, formatValue };
};
