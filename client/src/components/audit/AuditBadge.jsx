import React from 'react';

const PATHS = {
  shield: <path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M4 7V6a2 2 0 012-2h11" />
      <path d="M16 13h.01" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 014-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 01-4 4H4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v5l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
};

export function AuditIcon({ name = 'activity', size = 14 }) {
  return (
    <svg
      className="audit-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] || PATHS.activity}
    </svg>
  );
}

export default function AuditBadge({ tone, icon, label, warning }) {
  return (
    <span className={`audit-badge tone-${tone}${warning ? ' is-warning' : ''}`}>
      <AuditIcon name={icon} />
      <span className="audit-badge-label">{label}</span>
    </span>
  );
}
