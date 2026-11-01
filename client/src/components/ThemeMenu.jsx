import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '🖥️' },
];

export default function ThemeMenu({ className = '' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  const current = THEME_OPTIONS.find((option) => option.value === theme) || THEME_OPTIONS[2];
  const description = theme === 'system' ? `System (${resolvedTheme})` : current.label;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = THEME_OPTIONS.findIndex((option) => option.value === theme);
    itemRefs.current[index >= 0 ? index : 0]?.focus();
  }, [open]);

  const selectTheme = (value) => {
    setTheme(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event) => {
    const currentIndex = itemRefs.current.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        (currentIndex + step + THEME_OPTIONS.length) % THEME_OPTIONS.length;
      itemRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      itemRefs.current[THEME_OPTIONS.length - 1]?.focus();
    }
  };

  return (
    <div className={`theme-menu-wrap ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="icon-btn theme-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${description}. Choose light, dark or system theme.`}
        title={`Theme: ${description}`}
      >
        <span aria-hidden="true">{current.icon}</span>
      </button>
      {open && (
        <div
          className="theme-menu-popover"
          role="menu"
          aria-label="Theme"
          onKeyDown={handleMenuKeyDown}
        >
          {THEME_OPTIONS.map((option, index) => {
            const checked = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                className={`theme-menu-item ${checked ? 'is-checked' : ''}`}
                onClick={() => selectTheme(option.value)}
                tabIndex={-1}
              >
                <span className="theme-menu-icon" aria-hidden="true">{option.icon}</span>
                <span className="theme-menu-label">
                  {option.label}
                  {option.value === 'system' && (
                    <span className="theme-menu-meta">Now using {resolvedTheme}</span>
                  )}
                </span>
                <span className="theme-menu-check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
