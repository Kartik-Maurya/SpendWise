import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_SHORTCUTS,
  sanitizeShortcuts,
  SHORTCUT_ACTIONS,
  validateShortcut,
} from '../utils/shortcuts.js';

const ShortcutsContext = createContext();

const STORAGE_KEY = 'spendwise.shortcuts';

const readStoredShortcuts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeShortcuts(JSON.parse(raw)) : { ...DEFAULT_SHORTCUTS };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
};

export function ShortcutsProvider({ children }) {
  const [shortcuts, setShortcuts] = useState(readStoredShortcuts);
  const [capturing, setCapturing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch {
      // Storage can be unavailable (private browsing, quota); shortcuts still work.
    }
  }, [shortcuts]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        setShortcuts(sanitizeShortcuts(event.newValue ? JSON.parse(event.newValue) : null));
      } catch {
        setShortcuts({ ...DEFAULT_SHORTCUTS });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const assignShortcut = useCallback(
    (actionId, binding) => {
      const check = validateShortcut(binding, { actionId, shortcuts });
      if (!check.ok) return check;
      setShortcuts((prev) => ({ ...prev, [actionId]: check.binding }));
      return check;
    },
    [shortcuts]
  );

  const swapShortcuts = useCallback((actionId, otherId) => {
    setShortcuts((prev) => {
      if (!prev[actionId] || !prev[otherId]) return prev;
      return { ...prev, [actionId]: prev[otherId], [otherId]: prev[actionId] };
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const value = useMemo(
    () => ({
      shortcuts,
      actions: SHORTCUT_ACTIONS,
      capturing,
      setCapturing,
      assignShortcut,
      swapShortcuts,
      resetShortcuts,
      panelOpen,
      openPanel,
      closePanel,
      getShortcut: (actionId) => shortcuts[actionId],
    }),
    [
      shortcuts,
      capturing,
      assignShortcut,
      swapShortcuts,
      resetShortcuts,
      panelOpen,
      openPanel,
      closePanel,
    ]
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export const useShortcuts = () => useContext(ShortcutsContext);
