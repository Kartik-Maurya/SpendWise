import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TransactionForm from './TransactionForm.jsx';
import { createTransaction, createRecurring, updateTransaction } from '../services/api.js';
import { showNotification } from './Notification.jsx';

const CLOSE_MS = 170;

export default function TransactionDialog({
  open,
  mode = 'create',
  initialData,
  onSubmit,
  onSaved,
  onClose,
  loading = false,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();

  const busy = saving || loading;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement;
    setMounted(true);
    setClosing(false);
    setError('');
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return undefined;
    setClosing(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [mounted]);

  const requestClose = () => {
    if (!busy) onClose?.();
  };

  useEffect(() => {
    if (!mounted) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mounted, busy, onClose]);

  const handleDialogKeyDown = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const nodes = Array.from(
      dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((node) => node.offsetParent !== null);
    if (nodes.length === 0) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitCreate = async (data) => {
    try {
      const created = await createTransaction({
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
      });

      if (data.makeRecurring) {
        try {
          const recurring = await createRecurring({
            description: data.description,
            type: data.type,
            amount: data.amount,
            category: data.category,
            frequency: data.frequency,
            nextOccurrence: data.nextOccurrence,
            isActive: true,
          });
          await updateTransaction(created.id, {
            type: data.type,
            amount: data.amount,
            category: data.category,
            description: data.description,
            date: data.date,
            recurring_id: recurring.id,
          });
        } catch (recurringError) {
          showNotification(
            'error',
            'Transaction saved, but the recurring schedule could not be created. Add it from Transactions → Recurring.'
          );
          onSaved?.();
          return;
        }
        showNotification('success', 'Transaction and recurring schedule added!');
      } else {
        showNotification('success', 'Transaction added successfully!');
      }

      onSaved?.();
    } catch (err) {
      const message = err.message || 'Failed to add transaction';
      setError(message);
      showNotification('error', message);
    }
  };

  const handleSubmit = async (data) => {
    if (mode === 'edit') {
      try {
        await onSubmit?.(data);
      } catch (err) {
        const message = err.message || 'Failed to save changes';
        setError(message);
        showNotification('error', message);
      }
      return;
    }

    setSaving(true);
    setError('');
    try {
      await submitCreate(data);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`txn-dialog-backdrop ${closing ? 'closing' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`txn-dialog ${closing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="txn-dialog-head">
          <div>
            <h2 id={titleId}>{mode === 'edit' ? 'Edit transaction' : 'Add transaction'}</h2>
            <p className="txn-dialog-subtitle">
              {mode === 'edit'
                ? 'Update the details, or turn it into a recurring schedule.'
                : 'Record an income or expense entry.'}
            </p>
          </div>
          <button
            type="button"
            className="txn-dialog-close"
            onClick={requestClose}
            aria-label="Close dialog"
            disabled={busy}
          >
            ×
          </button>
        </header>
        <div className="txn-dialog-body">
          <TransactionForm
            onSubmit={handleSubmit}
            initialData={initialData}
            onCancel={requestClose}
            loading={busy}
            error={error}
            submitLabel={mode === 'edit' ? 'Save changes' : 'Add transaction'}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
