const pad2 = (value) => String(value).padStart(2, '0');

export const AUDIT_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'data', label: 'Data changes' },
  { key: 'auth', label: 'Sign-ins' },
  { key: 'recommendation', label: 'Recommendations' },
  { key: 'export', label: 'Imports & exports' },
  { key: 'demo', label: 'Demo data' },
];

export const CATEGORY_LABELS = {
  auth: 'Sign-ins',
  data: 'Data changes',
  recommendation: 'Recommendations',
  export: 'Imports & exports',
  demo: 'Demo data',
};

const ACTION_META = {
  login: { title: 'Signed in', category: 'auth', icon: 'shield' },
  login_failed: { title: 'Failed sign-in attempt', category: 'auth', icon: 'shield', warning: true },
  logout: { title: 'Signed out', category: 'auth', icon: 'shield' },
  register: { title: 'Account created', category: 'auth', icon: 'shield' },
  password_changed: { title: 'Password changed', category: 'auth', icon: 'lock' },
  password_change_failed: {
    title: 'Password change failed',
    category: 'auth',
    icon: 'lock',
    warning: true,
  },
  password_reset_requested: { title: 'Password reset requested', category: 'auth', icon: 'lock' },
  password_reset_completed: { title: 'Password reset completed', category: 'auth', icon: 'lock' },
  password_reset_failed: {
    title: 'Password reset failed',
    category: 'auth',
    icon: 'lock',
    warning: true,
  },
  transaction_created: { title: 'Transaction added', category: 'data', icon: 'receipt' },
  transaction_updated: { title: 'Transaction updated', category: 'data', icon: 'receipt' },
  transaction_deleted: {
    title: 'Transaction deleted',
    category: 'data',
    icon: 'receipt',
    warning: true,
  },
  transactions_bulk_updated: {
    title: 'Transactions updated in bulk',
    category: 'data',
    icon: 'receipt',
  },
  transactions_bulk_deleted: {
    title: 'Transactions deleted in bulk',
    category: 'data',
    icon: 'receipt',
    warning: true,
  },
  transaction_created_from_recurring: {
    title: 'Recurring transaction posted',
    category: 'data',
    icon: 'repeat',
  },
  budget_created: { title: 'Budget created', category: 'data', icon: 'wallet' },
  budget_updated: { title: 'Budget updated', category: 'data', icon: 'wallet' },
  budget_deleted: { title: 'Budget deleted', category: 'data', icon: 'wallet', warning: true },
  recurring_created: { title: 'Recurring schedule created', category: 'data', icon: 'repeat' },
  recurring_updated: { title: 'Recurring schedule updated', category: 'data', icon: 'repeat' },
  recurring_deleted: {
    title: 'Recurring schedule deleted',
    category: 'data',
    icon: 'repeat',
    warning: true,
  },
  recurring_bulk_updated: {
    title: 'Recurring schedules updated in bulk',
    category: 'data',
    icon: 'repeat',
  },
  recurring_bulk_deleted: {
    title: 'Recurring schedules deleted in bulk',
    category: 'data',
    icon: 'repeat',
    warning: true,
  },
  plan_updated: { title: 'Monthly plan updated', category: 'data', icon: 'calendar' },
  recommendation_applied: {
    title: 'Recommendation applied',
    category: 'recommendation',
    icon: 'sparkle',
  },
  transactions_imported: { title: 'Transactions imported', category: 'export', icon: 'upload' },
  recurring_imported: { title: 'Recurring schedules imported', category: 'export', icon: 'upload' },
  budgets_imported: { title: 'Budgets imported', category: 'export', icon: 'upload' },
  plans_imported: { title: 'Monthly plans imported', category: 'export', icon: 'upload' },
  data_exported: { title: 'Data exported', category: 'export', icon: 'download' },
  report_exported: { title: 'Monthly report generated', category: 'export', icon: 'download' },
  demo_data_loaded: { title: 'Demo data loaded', category: 'demo', icon: 'flask' },
  demo_data_purged: { title: 'Demo data removed', category: 'demo', icon: 'flask', warning: true },
};

const RESOURCE_BADGES = {
  transaction: 'TRANSACTION',
  budget: 'BUDGET',
  recurring: 'RECURRING',
  plan: 'PLAN',
  user: 'ACCOUNT',
  auth: 'AUTH',
  demo: 'DEMO',
};

const RESOURCE_LINKS = {
  transaction: { to: '/transactions', label: 'View transactions' },
  recurring: { to: '/transactions?tab=recurring', label: 'View recurring schedules' },
  budget: { to: '/budgets', label: 'View budgets' },
  plan: { to: '/analytics', label: 'Open analytics' },
  demo: { to: '/settings', label: 'Open Settings' },
  audit: { to: '/settings', label: 'Open Settings' },
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

function prettifyAction(action) {
  const words = String(action || '').replace(/_/g, ' ').trim();
  return capitalize(words) || 'Event';
}

function badgeFor(action, category, resource) {
  if (category === 'auth') return 'AUTH';
  if (category === 'demo') return 'DEMO';
  if (category === 'recommendation') return 'RECOMMENDATION';
  if (category === 'export') return action.endsWith('_imported') ? 'IMPORT' : 'EXPORT';
  return RESOURCE_BADGES[resource] || 'DATA';
}

function cleanDetail(detail) {
  const text = String(detail || '').trim();
  if (!text) return '';
  const stripped = text.replace(/^(Created|Updated|Deleted|Applied|Removed|Bulk updated|Bulk deleted)\s+/i, '');
  return stripped === text ? text : capitalize(stripped);
}

function authDescription(detail, ipAddress) {
  const text = String(detail || '');
  const failed = /failed:\s*(.+)$/i.exec(text);
  let primary = '';
  if (failed) primary = capitalize(failed[1].trim());
  else if (/unknown account/i.test(text)) primary = 'Unknown account';

  return [primary, ipAddress ? `IP ${ipAddress}` : ''].filter(Boolean).join(' · ');
}

function entityLink(action, resource) {
  if (action === 'recommendation_applied') {
    return { to: '/analytics', label: 'Open analytics' };
  }
  if (action === 'data_exported' || action === 'report_exported') {
    return { to: '/settings', label: 'Open exports' };
  }
  return RESOURCE_LINKS[resource] || null;
}

export function parseAuditDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
  const date = new Date(zoned);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function auditDayKey(date) {
  if (!date) return 'unknown';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatAuditDay(key) {
  if (!key || key === 'unknown') return 'Unknown date';
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAuditTime(date) {
  if (!date) return '';
  return date
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase();
}

export function formatAuditFull(date) {
  if (!date) return '';
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatAuditUtc(date) {
  if (!date) return '';
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

export function recurringPostInfo(detail) {
  const match = /Created transaction #(\d+) from recurring #(\d+)/.exec(String(detail || ''));
  if (!match) return null;
  return { transactionId: Number(match[1]), recurringId: Number(match[2]) };
}

export function describeLog(log) {
  const meta = ACTION_META[log.action] || {};
  const category = meta.category || 'data';
  const title = meta.title || prettifyAction(log.action);
  const date = parseAuditDate(log.created_at);
  const description =
    category === 'auth' ? authDescription(log.detail, log.ip_address) : cleanDetail(log.detail);
  const redundant =
    !description || description.trim().toLowerCase() === title.trim().toLowerCase();

  return {
    category,
    tone: category,
    badge: badgeFor(log.action, category, log.resource),
    icon: meta.icon || 'activity',
    title,
    description: redundant ? '' : description,
    warning: Boolean(meta.warning),
    link: entityLink(log.action, log.resource),
    date,
  };
}

function describeGroup(group) {
  const ids = group.items
    .map((item) => recurringPostInfo(item.detail))
    .filter(Boolean)
    .map((item) => item.transactionId);
  const count = group.items.length;
  const shown = ids.slice(0, 6).map((id) => `#${id}`).join(', ');
  const remainder = ids.length > 6 ? ` and ${ids.length - 6} more` : '';

  return {
    category: 'data',
    tone: 'data',
    badge: 'RECURRING',
    icon: 'repeat',
    title: `Posted ${count} transaction${count === 1 ? '' : 's'} from recurring #${group.recurringId}`,
    description: shown ? `Transaction ${shown}${remainder}` : '',
    warning: false,
    link: { to: '/transactions', label: 'View transactions' },
    date: parseAuditDate(group.items[0] && group.items[0].created_at),
  };
}

export function buildEntries(logs) {
  const entries = [];

  for (const log of logs) {
    const post =
      log.action === 'transaction_created_from_recurring' ? recurringPostInfo(log.detail) : null;

    if (post) {
      const last = entries[entries.length - 1];
      if (last && last.type === 'group' && last.recurringId === post.recurringId) {
        last.items.push(log);
        continue;
      }
      entries.push({ type: 'group', recurringId: post.recurringId, items: [log] });
      continue;
    }

    entries.push({ type: 'single', log });
  }

  return entries.map((entry) => {
    if (entry.type === 'group') {
      const view = describeGroup(entry);
      return { ...entry, view, date: view.date, count: entry.items.length };
    }
    const view = describeLog(entry.log);
    return { ...entry, view, date: view.date, count: 1 };
  });
}

export function groupEntriesByDay(entries) {
  const groups = [];

  for (const entry of entries) {
    const key = auditDayKey(entry.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      last.count += entry.count;
    } else {
      groups.push({ key, label: formatAuditDay(key), entries: [entry], count: entry.count });
    }
  }

  return groups;
}

export function todayKey() {
  return auditDayKey(new Date());
}

function keyToDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysKey(key, delta) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + delta);
  return auditDayKey(date);
}

export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
];

export function presetRange(key) {
  const today = todayKey();
  if (key === 'today') return { from: today, to: today };
  if (key === '7d') return { from: addDaysKey(today, -6), to: today };
  if (key === '30d') return { from: addDaysKey(today, -29), to: today };
  if (key === 'month') {
    const date = keyToDate(today);
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    return { from: auditDayKey(first), to: today };
  }
  return { from: '', to: '' };
}

export function matchPreset(from, to) {
  if (!from || !to) return null;
  const preset = DATE_PRESETS.find((item) => {
    const range = presetRange(item.key);
    return range.from === from && range.to === to;
  });
  return preset ? preset.key : null;
}

export function formatRangeDay(key) {
  if (!key) return '';
  const date = keyToDate(key);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatDateRange(from, to) {
  if (!from && !to) return 'Any date';
  const preset = matchPreset(from, to);
  if (preset) return DATE_PRESETS.find((item) => item.key === preset).label;
  if (from && to) {
    return from === to ? formatRangeDay(from) : `${formatRangeDay(from)} – ${formatRangeDay(to)}`;
  }
  if (from) return `From ${formatRangeDay(from)}`;
  return `Until ${formatRangeDay(to)}`;
}

export function isoStartOfDay(key) {
  if (!key) return '';
  const date = keyToDate(key);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
}

export function isoStartOfNextDay(key) {
  if (!key) return '';
  const date = keyToDate(key);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0).toISOString();
}
