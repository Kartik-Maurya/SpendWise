import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 320;

export default function InfoHint({ label = 'More information', children, className = '' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger || !pop) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(WIDTH, window.innerWidth - 16);
      const height = pop.offsetHeight;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = rect.bottom + 8;
      const top = below + height > window.innerHeight - 8 ? rect.top - height - 8 : below;
      setCoords({ top: Math.max(8, top), left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (
        popRef.current && !popRef.current.contains(event.target) &&
        triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
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

  return (
    <span className={`info-hint ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="info-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open &&
        createPortal(
          <span
            ref={popRef}
            id={id}
            role="tooltip"
            className="info-popover"
            style={coords}
          >
            {children}
          </span>,
          document.body
        )}
    </span>
  );
}
