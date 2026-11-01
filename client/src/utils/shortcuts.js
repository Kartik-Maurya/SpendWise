export const SHORTCUT_GROUPS = [
  { id: 'navigation', title: 'Navigation' },
  { id: 'actions', title: 'Actions' },
  { id: 'help', title: 'Help' },
];

export const SHORTCUT_ACTIONS = [
  {
    id: 'nav-dashboard',
    group: 'navigation',
    label: 'Go to Dashboard',
    description: 'Open the dashboard overview.',
    path: '/dashboard',
    defaultBinding: 'Alt+Shift+D',
  },
  {
    id: 'nav-transactions',
    group: 'navigation',
    label: 'Go to Transactions',
    description: 'Open the transaction list.',
    path: '/transactions',
    defaultBinding: 'Alt+Shift+T',
  },
  {
    id: 'nav-budgets',
    group: 'navigation',
    label: 'Go to Budgets',
    description: 'Open monthly budgets and plans.',
    path: '/budgets',
    defaultBinding: 'Alt+Shift+B',
  },
  {
    id: 'nav-analytics',
    group: 'navigation',
    label: 'Go to Analytics',
    description: 'Open the analytics workspace.',
    path: '/analytics',
    defaultBinding: 'Alt+Shift+A',
  },
  {
    id: 'nav-audit',
    group: 'navigation',
    label: 'Go to Audit Log',
    description: 'Open the security and activity trail.',
    path: '/audit',
    defaultBinding: 'Alt+Shift+L',
  },
  {
    id: 'nav-settings',
    group: 'navigation',
    label: 'Go to Settings',
    description: 'Open appearance, exports and account settings.',
    path: '/settings',
    defaultBinding: 'Alt+Shift+S',
  },
  {
    id: 'add-transaction',
    group: 'actions',
    label: 'Add transaction',
    description: 'Open the new transaction dialog.',
    defaultBinding: 'Alt+Shift+N',
  },
  {
    id: 'toggle-privacy',
    group: 'actions',
    label: 'Toggle privacy mode',
    description: 'Mask amounts and descriptions across the app.',
    defaultBinding: 'Alt+Shift+P',
  },
  {
    id: 'cycle-theme',
    group: 'actions',
    label: 'Cycle theme',
    description: 'Switch between light, dark and system.',
    defaultBinding: 'Alt+Shift+M',
  },
  {
    id: 'show-shortcuts',
    group: 'help',
    label: 'Show keyboard shortcuts',
    description: 'Open the shortcut panel from anywhere.',
    defaultBinding: 'Alt+Shift+K',
  },
];

export const DEFAULT_SHORTCUTS = SHORTCUT_ACTIONS.reduce((map, action) => {
  map[action.id] = action.defaultBinding;
  return map;
}, {});

const CODE_KEY = /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/;
const MAIN_KEY = /^([A-Z]|[0-9]|F(?:[1-9]|1[0-2]))$/;
const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);
// F4 with Alt closes the window on Windows and Linux; Tab, Space and the
// arrow keys are already excluded by the main-key pattern.
const RESERVED_BINDINGS = new Set(['Alt+F4']);

const serialize = ({ ctrl, alt, shift, meta, main }) =>
  [ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', meta && 'Meta', main]
    .filter(Boolean)
    .join('+');

const labelFromCode = (code) => {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
};

export function parseBinding(binding) {
  if (typeof binding !== 'string') return null;
  const parts = binding.split('+').map((part) => part.trim());
  if (parts.length < 2) return null;
  const main = parts.pop();
  if (!MAIN_KEY.test(main)) return null;
  const modifiers = new Set();
  for (const part of parts) {
    const token = part.toLowerCase();
    if (token === 'ctrl' || token === 'control') modifiers.add('Ctrl');
    else if (token === 'alt' || token === 'option') modifiers.add('Alt');
    else if (token === 'shift') modifiers.add('Shift');
    else if (token === 'meta' || token === 'cmd' || token === 'command' || token === 'win') {
      modifiers.add('Meta');
    } else {
      return null;
    }
  }
  return {
    ctrl: modifiers.has('Ctrl'),
    alt: modifiers.has('Alt'),
    shift: modifiers.has('Shift'),
    meta: modifiers.has('Meta'),
    main,
  };
}

export const normalizeBinding = (binding) => {
  const parsed = parseBinding(binding);
  return parsed ? serialize(parsed) : null;
};

export function bindingFromEvent(event) {
  if (!event || event.repeat) return null;
  if (typeof event.getModifierState === 'function' && event.getModifierState('AltGraph')) {
    return null;
  }
  if (!CODE_KEY.test(event.code || '')) return null;
  return serialize({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    main: labelFromCode(event.code),
  });
}

export const isModifierCode = (code) => MODIFIER_CODES.has(code);

export function validateShortcut(binding, { actionId, shortcuts }) {
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return {
      ok: false,
      message: 'Use Alt with a letter, a digit or F1–F12, for example Alt+Shift+K.',
    };
  }
  const parsed = parseBinding(normalized);
  if (!parsed.alt) {
    return {
      ok: false,
      message: 'Every shortcut needs Alt, so typing and browser shortcuts keep working.',
    };
  }
  if (RESERVED_BINDINGS.has(normalized)) {
    return { ok: false, message: `${normalized} is reserved by your operating system.` };
  }
  const conflictId = Object.keys(shortcuts || {}).find(
    (id) => id !== actionId && shortcuts[id] === normalized
  );
  if (conflictId) {
    const action = SHORTCUT_ACTIONS.find((item) => item.id === conflictId);
    return {
      ok: false,
      conflict: conflictId,
      message: `${normalized} is already used by ${action?.label || 'another action'}.`,
    };
  }
  return { ok: true, binding: normalized };
}

export function sanitizeShortcuts(raw) {
  const result = { ...DEFAULT_SHORTCUTS };
  if (!raw || typeof raw !== 'object') return result;
  const used = new Set(Object.values(result));
  for (const action of SHORTCUT_ACTIONS) {
    const candidate = normalizeBinding(raw[action.id]);
    if (!candidate || used.has(candidate)) continue;
    const check = validateShortcut(candidate, {
      actionId: action.id,
      shortcuts: Object.fromEntries(
        Object.entries(result).filter(([id]) => id !== action.id)
      ),
    });
    if (!check.ok) continue;
    used.delete(result[action.id]);
    result[action.id] = candidate;
    used.add(candidate);
  }
  return result;
}

export function formatShortcut(binding) {
  const parsed = parseBinding(binding);
  if (!parsed) return 'Unassigned';
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
  const parts = [];
  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.alt) parts.push(isMac ? 'Option' : 'Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push(isMac ? 'Cmd' : 'Win');
  parts.push(parsed.main);
  return parts.join('+');
}

export function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return Boolean(target.closest?.('[contenteditable="true"]'));
}
