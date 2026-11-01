import React, { useEffect, useRef, useState } from 'react';
import { useShortcuts } from '../../contexts/ShortcutsContext.jsx';
import { showNotification } from '../Notification.jsx';
import {
  bindingFromEvent,
  formatShortcut,
  isModifierCode,
  SHORTCUT_GROUPS,
  validateShortcut,
} from '../../utils/shortcuts.js';
import ShortcutKeys from './ShortcutKeys.jsx';

export default function ShortcutList({ readOnly = false }) {
  const {
    actions,
    shortcuts,
    assignShortcut,
    swapShortcuts,
    resetShortcuts,
    setCapturing,
  } = useShortcuts();
  const [capturingId, setCapturingId] = useState(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const captureRef = useRef(null);

  useEffect(() => {
    if (capturingId) captureRef.current?.focus();
  }, [capturingId]);

  useEffect(() => () => setCapturing(false), [setCapturing]);

  const stopCapture = () => {
    setCapturingId(null);
    setCapturing(false);
    setError('');
    setConflict(null);
  };

  const startCapture = (actionId) => {
    setCapturingId(actionId);
    setCapturing(true);
    setError('');
    setConflict(null);
  };

  const handleCaptureKeyDown = (event, action) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stopCapture();
      return;
    }
    if (event.key === 'Tab') {
      stopCapture();
      return;
    }
    if (isModifierCode(event.code)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const binding = bindingFromEvent(event);
    if (!binding) {
      event.preventDefault();
      event.stopPropagation();
      setError('Use Alt with a letter, a digit or F1–F12, for example Alt+Shift+K.');
      setConflict(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const result = validateShortcut(binding, { actionId: action.id, shortcuts });
    if (!result.ok) {
      setError(result.message);
      setConflict(result.conflict ? { actionId: action.id, otherId: result.conflict } : null);
      return;
    }
    assignShortcut(action.id, result.binding);
    stopCapture();
    showNotification('success', `${action.label} is now ${formatShortcut(result.binding)}.`);
  };

  const handleSwap = () => {
    if (!conflict) return;
    const action = actions.find((item) => item.id === conflict.actionId);
    const other = actions.find((item) => item.id === conflict.otherId);
    swapShortcuts(conflict.actionId, conflict.otherId);
    stopCapture();
    showNotification(
      'success',
      `${action?.label || 'Shortcut'} and ${other?.label || 'the other action'} swapped shortcuts.`
    );
  };

  const handleReset = () => {
    resetShortcuts();
    stopCapture();
    showNotification('success', 'Keyboard shortcuts reset to defaults.');
  };

  return (
    <div className="shortcut-groups">
      {SHORTCUT_GROUPS.map((group) => {
        const groupActions = actions.filter((action) => action.group === group.id);
        if (groupActions.length === 0) return null;
        return (
          <div className="shortcut-group" key={group.id}>
            <h4>{group.title}</h4>
            <ul className="shortcut-list">
              {groupActions.map((action) => {
                const isCapturing = capturingId === action.id;
                const rowConflict = conflict?.actionId === action.id ? conflict : null;
                const conflictAction = rowConflict
                  ? actions.find((item) => item.id === rowConflict.otherId)
                  : null;
                return (
                  <li className="shortcut-row" key={action.id}>
                    <div className="shortcut-info">
                      <span className="shortcut-label">{action.label}</span>
                      <span className="shortcut-desc">{action.description}</span>
                    </div>
                    <div className="shortcut-control">
                      {isCapturing ? (
                        <div
                          className="shortcut-capture-area"
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              stopCapture();
                            }
                          }}
                        >
                          <button
                            type="button"
                            ref={captureRef}
                            className="shortcut-capture"
                            aria-label={`Press a new shortcut for ${action.label}`}
                            onKeyDown={(event) => handleCaptureKeyDown(event, action)}
                          >
                            Press shortcut…
                          </button>
                          <span className="shortcut-hint">
                            {rowConflict ? '' : 'Esc to cancel'}
                          </span>
                          {error && (
                            <span className="shortcut-error-text" role="alert">
                              {error}
                            </span>
                          )}
                          {rowConflict && (
                            <span className="shortcut-conflict-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={handleSwap}
                              >
                                Swap with {conflictAction?.label}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-small"
                                onClick={stopCapture}
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </div>
                      ) : (
                        <ShortcutKeys binding={shortcuts[action.id]} />
                      )}
                      {!readOnly && !isCapturing && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => startCapture(action.id)}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {!readOnly && (
        <div className="shortcut-reset">
          <p>
            Custom shortcuts are saved in this browser. Every shortcut needs Alt and must be unique.
          </p>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleReset}>
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
