const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const { validateEmail, validatePassword } = require('../utils/validation');
const { sendPasswordResetEmail } = require('../utils/mailer');
const { isSessionStale } = require('../utils/sessions');

const SESSION_COOKIE = 'spendwise.sid';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetUrlFor(token) {
  const baseUrl = (process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
  return `${baseUrl}/reset-password?token=${token}`;
}

function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.authenticatedAt = Date.now();
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await query.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), normalizedEmail, passwordHash]
    );

    await establishSession(req, result.lastID);

    logAudit(result.lastID, 'register', 'user', 'User registered', req.ip);

    res.status(201).json({
      user: { id: result.lastID, name: name.trim(), email: normalizedEmail },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await query.get(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!user) {
      logAudit(null, 'login_failed', 'auth', 'Login failed: unknown account', req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(user.id, 'login_failed', 'auth', 'Login failed: invalid password', req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await establishSession(req, user.id);
    logAudit(user.id, 'login', 'auth', 'Successful login', req.ip);

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res, next) => {
  const userId = req.session.userId;
  logAudit(userId, 'logout', 'auth', 'User logged out', req.ip);

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.json({ message: 'Logged out successfully' });
  });
};

exports.me = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ user: null });
    }

    if (await isSessionStale(req.session.userId, req.session.authenticatedAt)) {
      return req.session.destroy(() => res.status(401).json({ user: null }));
    }

    const user = await query.get(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (!user) {
      return res.status(401).json({ user: null });
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const user = await query.get('SELECT id, password_hash FROM users WHERE id = ?', [
      req.session.userId,
    ]);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      logAudit(
        user.id,
        'password_change_failed',
        'auth',
        'Password change failed: incorrect current password',
        req.ip
      );
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'New password must be different from the current one' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const changedAt = new Date().toISOString();

    await query.run('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?', [
      passwordHash,
      changedAt,
      user.id,
    ]);
    await query.run(
      'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
      [changedAt, user.id]
    );

    await establishSession(req, user.id);
    logAudit(user.id, 'password_changed', 'auth', 'Password changed', req.ip);

    res.json({ message: 'Password updated. Other sessions were signed out.' });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  const genericResponse = {
    message: 'If an account exists for that email, a password reset link has been sent.',
  };

  try {
    const { email } = req.body || {};

    if (!email || !validateEmail(email)) {
      return res.json(genericResponse);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await query.get('SELECT id, name, email FROM users WHERE email = ?', [
      normalizedEmail,
    ]);

    if (!user) {
      logAudit(
        null,
        'password_reset_requested',
        'auth',
        'Password reset requested for unknown account',
        req.ip
      );
      return res.json(genericResponse);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await query.run("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", [
      new Date().toISOString(),
      user.id,
    ]);
    await query.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(token), expiresAt]
    );

    const resetUrl = resetUrlFor(token);
    let delivered = false;

    try {
      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
      delivered = result.sent;
    } catch (err) {
      console.error('[mail] Failed to send password reset email:', err.message);
    }

    if (!delivered) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '[mail] SMTP is not configured; the password reset email could not be delivered.'
        );
      } else {
        console.log('--------------------------------------------------------------');
        console.log('Password reset link (SMTP not configured, development fallback):');
        console.log(`  ${resetUrl}`);
        console.log('  Expires in 30 minutes and can be used once.');
        console.log('--------------------------------------------------------------');
      }
    }

    logAudit(user.id, 'password_reset_requested', 'auth', 'Password reset link issued', req.ip);

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const reset = await query.get(
      'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
      [hashToken(token)]
    );

    const expired = reset ? Date.parse(reset.expires_at) <= Date.now() : true;

    if (!reset || reset.used_at || expired) {
      logAudit(
        reset ? reset.user_id : null,
        'password_reset_failed',
        'auth',
        'Password reset failed: invalid or expired link',
        req.ip
      );
      return res
        .status(400)
        .json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    }

    const user = await query.get('SELECT id, name, email FROM users WHERE id = ?', [reset.user_id]);

    if (!user) {
      return res
        .status(400)
        .json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const usedAt = new Date().toISOString();

    await query.run('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?', [
      passwordHash,
      usedAt,
      user.id,
    ]);
    await query.run("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", [
      usedAt,
      user.id,
    ]);

    await establishSession(req, user.id);
    logAudit(user.id, 'password_reset_completed', 'auth', 'Password reset completed', req.ip);

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};
