import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShortcuts } from '../../contexts/ShortcutsContext.jsx';
import ShortcutList from './ShortcutList.jsx';

export default function ShortcutPanel() {
  const { panelOpen, closePanel } = useShortcuts();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (!panelOpen) return undefined;

    const node = dialogRef.current;
    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        node.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((element) => element.offsetParent !== null);

    focusables()[0]?.focus();

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
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

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      const previous = restoreFocusRef.current;
      if (previous && previous !== document.body && previous.isConnected) previous.focus();
      else document.querySelector('.navbar .user-menu')?.focus();
    };
  }, [panelOpen, closePanel]);

  if (!panelOpen) return null;

  const openSettings = () => {
    closePanel();
    navigate('/settings#keyboard-shortcuts');
  };

  return (
    <div
      className="shortcut-panel-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePanel();
      }}
    >
      <div
        className="shortcut-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-panel-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="shortcut-panel-head">
          <div>
            <h3 id="shortcut-panel-title">Keyboard shortcuts</h3>
            <p className="shortcut-panel-subtitle">
              Shortcuts work anywhere except while you are typing in a field. They can be changed
              in Settings.
            </p>
          </div>
          <button
            type="button"
            className="chart-modal-close"
            onClick={closePanel}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </header>
        <div className="shortcut-panel-body">
          <ShortcutList readOnly />
        </div>
        <footer className="shortcut-panel-foot">
          <span>Shortcuts are saved in this browser.</span>
          <button type="button" className="btn btn-primary btn-small" onClick={openSettings}>
            Edit in Settings
          </button>
        </footer>
      </div>
    </div>
  );
}
