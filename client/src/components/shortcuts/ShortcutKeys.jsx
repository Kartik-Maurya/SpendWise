import React from 'react';
import { formatShortcut, parseBinding } from '../../utils/shortcuts.js';

export default function ShortcutKeys({ binding }) {
  if (!parseBinding(binding)) {
    return <span className="shortcut-unassigned">Unassigned</span>;
  }
  const parts = formatShortcut(binding).split('+');
  return (
    <span className="shortcut-keys">
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {index > 0 && (
            <span className="shortcut-sep" aria-hidden="true">
              +
            </span>
          )}
          <kbd>{part}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
