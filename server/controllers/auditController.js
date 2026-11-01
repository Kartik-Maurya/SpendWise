const query = require('../database/query');
const { validateDate } = require('../utils/validation');
const { csvEscape } = require('../utils/csv');
const logAudit = require('../utils/auditLogger');

const AUDIT_CATEGORIES = {
  auth: [
    'login',
    'login_failed',
    'logout',
    'register',
    'password_changed',
    'password_change_failed',
    'password_reset_requested',
    'password_reset_completed',
    'password_reset_failed',
  ],
  data: [
    'transaction_created',
    'transaction_updated',
    'transaction_deleted',
    'transactions_bulk_updated',
    'transactions_bulk_deleted',
    'transaction_created_from_recurring',
    'budget_created',
    'budget_updated',
    'budget_deleted',
    'recurring_created',
    'recurring_updated',
    'recurring_deleted',
    'recurring_bulk_updated',
    'recurring_bulk_deleted',
    'plan_updated',
  ],
  recommendation: ['recommendation_applied'],
  export: [
    'transactions_imported',
    'recurring_imported',
    'budgets_imported',
    'plans_imported',
    'data_exported',
    'report_exported',
  ],
  demo: ['demo_data_loaded', 'demo_data_purged'],
};

const CATEGORY_KEYS = Object.keys(AUDIT_CATEGORIES);
const SORTS = ['newest', 'oldest'];

const ACTION_CATEGORY = {};
for (const [category, actions] of Object.entries(AUDIT_CATEGORIES)) {
  for (const action of actions) ACTION_CATEGORY[action] = category;
}

const ACTION_TITLES = {
  login: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  register: 'Account created',
  password_changed: 'Password changed',
  password_change_failed: 'Password change failed',
  password_reset_requested: 'Password reset requested',
  password_reset_completed: 'Password reset completed',
  password_reset_failed: 'Password reset failed',
  transaction_created: 'Transaction added',
  transaction_updated: 'Transaction updated',
  transaction_deleted: 'Transaction deleted',
  transactions_bulk_updated: 'Transactions updated in bulk',
  transactions_bulk_deleted: 'Transactions deleted in bulk',
  transaction_created_from_recurring: 'Recurring transaction posted',
  budget_created: 'Budget created',
  budget_updated: 'Budget updated',
  budget_deleted: 'Budget deleted',
  recurring_created: 'Recurring schedule created',
  recurring_updated: 'Recurring schedule updated',
  recurring_deleted: 'Recurring schedule deleted',
  recurring_bulk_updated: 'Recurring schedules updated in bulk',
  recurring_bulk_deleted: 'Recurring schedules deleted in bulk',
  plan_updated: 'Monthly plan updated',
  recommendation_applied: 'Recommendation applied',
  transactions_imported: 'Transactions imported',
  recurring_imported: 'Recurring schedules imported',
  budgets_imported: 'Budgets imported',
  plans_imported: 'Monthly plans imported',
  data_exported: 'Data exported',
  report_exported: 'Monthly report generated',
  demo_data_loaded: 'Demo data loaded',
  demo_data_purged: 'Demo data removed',
};

const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function actionTitle(action) {
  if (ACTION_TITLES[action]) return ACTION_TITLES[action];
  const words = String(action || '').replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Event';
}

function likeTerm(search) {
  const escaped = String(search)
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, '\\$&');
  return `%${escaped}%`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

// SQLite stores `created_at` as a UTC "YYYY-MM-DD HH:MM:SS" string.
function toSqliteUtc(date) {
  return (
    `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ` +
    `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
  );
}

function dayBoundaryMillis(value, isEnd) {
  const [year, month, day] = value.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  return isEnd ? start + 24 * 60 * 60 * 1000 - 1 : start;
}

function parseBoundary(value, isEnd, label) {
  if (!value) return null;
  if (validateDate(value)) {
    return { kind: 'day', value, millis: dayBoundaryMillis(value, isEnd) };
  }
  if (!ISO_DATETIME.test(value)) {
    const error = new Error(`${label} must be YYYY-MM-DD or an ISO 8601 timestamp`);
    error.status = 400;
    throw error;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return { kind: 'instant', value: toSqliteUtc(date), millis: date.getTime() };
}

function parseCategories(req) {
  const raw = req.query.categories !== undefined ? req.query.categories : req.query.category;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const categories = [];

  for (const value of values) {
    for (const part of String(value).split(',')) {
      const key = part.trim().toLowerCase();
      if (!key || key === 'all') continue;
      if (!AUDIT_CATEGORIES[key]) {
        const error = new Error(`Category must be one of: ${CATEGORY_KEYS.join(', ')}`);
        error.status = 400;
        throw error;
      }
      if (!categories.includes(key)) categories.push(key);
    }
  }

  return categories;
}

function buildFilters(userId, { search, categories, fromBound, toBound }) {
  const clauses = ['user_id = ?'];
  const params = [userId];

  if (search) {
    const term = likeTerm(search);
    clauses.push(
      "(LOWER(action) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(detail, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(resource, '')) LIKE ? ESCAPE '\\')"
    );
    params.push(term, term, term);
  }

  if (categories && categories.length > 0) {
    const actions = [...new Set(categories.flatMap((category) => AUDIT_CATEGORIES[category]))];
    clauses.push(`action IN (${actions.map(() => '?').join(', ')})`);
    params.push(...actions);
  }

  if (fromBound) {
    clauses.push('created_at >= ?');
    params.push(fromBound.value);
  }
  if (toBound) {
    if (toBound.kind === 'day') {
      clauses.push("created_at < datetime(?, '+1 day')");
    } else {
      clauses.push('created_at < ?');
    }
    params.push(toBound.value);
  }

  return { clause: clauses.join(' AND '), params };
}

function parseFilters(req) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const rawSort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : '';
  const sort = rawSort || 'newest';

  if (search.length > 120) {
    const error = new Error('Search must be 120 characters or fewer');
    error.status = 400;
    throw error;
  }
  if (!SORTS.includes(sort)) {
    const error = new Error('Sort must be newest or oldest');
    error.status = 400;
    throw error;
  }

  const categories = parseCategories(req);
  const fromBound = parseBoundary(from, false, 'From date');
  const toBound = parseBoundary(to, true, 'To date');

  if (fromBound && toBound && fromBound.millis > toBound.millis) {
    const error = new Error('From date must be on or before the to date');
    error.status = 400;
    throw error;
  }

  return {
    search,
    categories,
    from,
    to,
    sort,
    fromBound,
    toBound,
  };
}

function publicFilters({ search, categories, from, to, sort }) {
  return { search, categories, from, to, sort };
}

exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const offset = (page - 1) * limit;

    const filters = parseFilters(req);
    const order = filters.sort === 'oldest' ? 'ASC' : 'DESC';
    const base = buildFilters(req.user.id, {
      search: filters.search,
      fromBound: filters.fromBound,
      toBound: filters.toBound,
    });
    const filtered = buildFilters(req.user.id, filters);

    const [rows, countRow, countRows] = await Promise.all([
      query.all(
        `SELECT id, action, resource, detail, ip_address, created_at FROM audit_logs WHERE ${filtered.clause} ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`,
        [...filtered.params, limit, offset]
      ),
      query.get(`SELECT COUNT(*) as count FROM audit_logs WHERE ${filtered.clause}`, filtered.params),
      query.all(
        `SELECT action, COUNT(*) as count FROM audit_logs WHERE ${base.clause} GROUP BY action`,
        base.params
      ),
    ]);

    const counts = { all: 0, auth: 0, data: 0, recommendation: 0, export: 0, demo: 0 };
    for (const row of countRows) {
      const total = Number(row.count) || 0;
      counts.all += total;
      const group = ACTION_CATEGORY[row.action];
      if (group) counts[group] += total;
    }

    const total = countRow.count || 0;

    res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      counts,
      filters: publicFilters(filters),
    });
  } catch (err) {
    next(err);
  }
};

function exportTimestamp(date = new Date()) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}_` +
    `${pad2(date.getHours())}${pad2(date.getMinutes())}`
  );
}

exports.exportAuditLogs = async (req, res, next) => {
  try {
    const filters = parseFilters(req);
    const order = filters.sort === 'oldest' ? 'ASC' : 'DESC';
    const where = buildFilters(req.user.id, filters);

    const rows = await query.all(
      `SELECT id, action, resource, detail, ip_address, created_at FROM audit_logs WHERE ${where.clause} ORDER BY created_at ${order}, id ${order}`,
      where.params
    );

    const header = [
      'Timestamp (UTC)',
      'Category',
      'Action',
      'Title',
      'Resource',
      'Detail',
      'IP address',
    ];
    const lines = [header.map(csvEscape).join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.created_at,
          ACTION_CATEGORY[row.action] || '',
          row.action,
          actionTitle(row.action),
          row.resource || '',
          row.detail || '',
          row.ip_address || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    const filename = `spendwise-audit-log_${exportTimestamp()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    res.send(csv);

    logAudit(
      req.user.id,
      'data_exported',
      'audit',
      `Exported ${rows.length} audit log row(s) to CSV`,
      req.ip
    );
  } catch (err) {
    next(err);
  }
};

function parseEvidence(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

exports.getRecommendationTrail = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 10), 40);
    const hasMonth = req.query.month !== undefined && req.query.month !== '';
    const hasYear = req.query.year !== undefined && req.query.year !== '';

    if (hasMonth !== hasYear) {
      const error = new Error('Provide both month and year, or neither');
      error.status = 400;
      throw error;
    }

    const clauses = ["user_id = ?", "status = 'applied'"];
    const params = [req.user.id];

    if (hasMonth) {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        const error = new Error('Month must be an integer between 1 and 12');
        error.status = 400;
        throw error;
      }
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        const error = new Error('Year must be between 2000 and 2100');
        error.status = 400;
        throw error;
      }
      clauses.push('month = ?', 'year = ?');
      params.push(month, year);
    }

    const rows = await query.all(
      `SELECT * FROM budget_recommendations WHERE ${clauses.join(' AND ')} ORDER BY applied_at DESC, id DESC`,
      params
    );

    const countRow = await query.get(
      `SELECT COUNT(DISTINCT batch_id) as count FROM budget_recommendations WHERE ${clauses.join(' AND ')}`,
      params
    );

    const batches = [];
    const byId = new Map();

    for (const row of rows) {
      let batch = byId.get(row.batch_id);
      if (!batch) {
        if (batches.length >= limit) continue;
        batch = {
          batchId: row.batch_id,
          month: row.month,
          year: row.year,
          objective: row.objective,
          appliedAt: row.applied_at,
          createdAt: row.created_at,
          itemCount: 0,
          totalProposed: 0,
          totalDelta: 0,
          categories: [],
        };
        byId.set(row.batch_id, batch);
        batches.push(batch);
      }

      const evidence = parseEvidence(row.evidence_json);
      batch.itemCount += 1;
      batch.totalProposed += Number(row.proposed_amount) || 0;
      batch.totalDelta += Number(row.delta) || 0;
      batch.categories.push({
        category: row.category,
        current: row.current_amount === null ? null : Number(row.current_amount),
        proposed: Number(row.proposed_amount),
        delta: Number(row.delta),
        reason: row.reason,
        confidence: row.confidence,
        recommended: evidence && typeof evidence.recommended === 'number' ? evidence.recommended : null,
        adjusted: Boolean(evidence && evidence.adjusted),
        evidence,
      });
    }

    for (const batch of batches) {
      batch.totalProposed = Math.round(batch.totalProposed * 100) / 100;
      batch.totalDelta = Math.round(batch.totalDelta * 100) / 100;
    }

    res.json({ batches, totalBatches: countRow.count || 0 });
  } catch (err) {
    next(err);
  }
};
