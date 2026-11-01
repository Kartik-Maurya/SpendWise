import React, { useEffect, useRef, useState } from 'react';
import { AuditIcon } from './AuditBadge.jsx';
import { DATE_PRESETS, formatDateRange, matchPreset, presetRange } from '../../utils/audit.js';

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [invalid, setInvalid] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  const activePreset = matchPreset(from, to);

  const openPopover = () => {
    setCustomFrom(from);
    setCustomTo(to);
    setInvalid(false);
    setOpen(true);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const applyPreset = (key) => {
    onChange(presetRange(key));
    setOpen(false);
  };

  const applyCustom = (event) => {
    event.preventDefault();
    if (customFrom && customTo && customFrom > customTo) {
      setInvalid(true);
      return;
    }
    onChange({ from: customFrom, to: customTo });
    setOpen(false);
  };

  const clear = () => {
    setInvalid(false);
    onChange({ from: '', to: '' });
    setOpen(false);
  };

  return (
    <div className="audit-date-field" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`audit-control audit-date-trigger${from || to ? ' is-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPopover())}
      >
        <AuditIcon name="calendar" />
        <span>{formatDateRange(from, to)}</span>
        <span className="audit-date-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <>
          <div className="audit-popover-backdrop" aria-hidden="true" onClick={close} />
          <div className="audit-date-popover" role="dialog" aria-label="Filter by date range">
            <div className="audit-date-popover-head">
              <strong>Date range</strong>
              <button
                type="button"
                className="audit-icon-button"
                aria-label="Close date range"
                onClick={close}
              >
                ×
              </button>
            </div>

            <div className="audit-date-presets">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`audit-preset${activePreset === preset.key ? ' is-active' : ''}`}
                  onClick={() => applyPreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <form className="audit-date-custom" onSubmit={applyCustom}>
              <span className="audit-date-custom-title">Custom range</span>
              <div className="audit-date-inputs">
                <label>
                  <span>From</span>
                  <input
                    id="audit-date-from"
                    name="from"
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(event) => {
                      setInvalid(false);
                      setCustomFrom(event.target.value);
                    }}
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    id="audit-date-to"
                    name="to"
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(event) => {
                      setInvalid(false);
                      setCustomTo(event.target.value);
                    }}
                  />
                </label>
              </div>
              {invalid && (
                <p className="audit-date-error" role="alert">
                  From must be on or before To.
                </p>
              )}
              <div className="audit-date-actions">
                <button type="button" className="btn btn-ghost btn-small" onClick={clear}>
                  Clear
                </button>
                <button type="submit" className="btn btn-primary btn-small">
                  Apply range
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
