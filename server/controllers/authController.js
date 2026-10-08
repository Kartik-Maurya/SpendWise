const bcrypt = require('bcryptjs');
const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const { validateEmail, validatePassword } = require('../utils/validation');
const { getEncryptionKey } = require('../utils/encryption');

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

    req.session.userId = result.lastID;

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
      logAudit(null, 'login_failed', 'auth', `Login failed: unknown email ${normalizedEmail}`, req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(user.id, 'login_failed', 'auth', 'Login failed: invalid password', req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
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
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
};

exports.me = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ user: null });
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
