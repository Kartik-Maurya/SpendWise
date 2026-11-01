import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import ThemeMenu from '../components/ThemeMenu.jsx';
import { resetPassword } from '../services/api.js';

export default function ResetPassword({ onSuccess }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { checkAuth } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await resetPassword(token, formData.password, formData.confirmPassword);
      await checkAuth();
      onSuccess();
    } catch (err) {
      setError(err.message || 'Could not reset your password. Request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-icon">💰</div>
          <h1 className="brand-text">SpendWise</h1>
          <p>Choose a new password</p>
        </div>

        {!token ? (
          <>
            <div className="error-message">
              This reset link is missing its token. Request a new link to continue.
            </div>
            <Link className="btn btn-primary" to="/forgot-password">
              Request a new link
            </Link>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
                autoFocus
              />
              <small className="form-hint">Minimum 8 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link className="btn btn-ghost btn-small" to="/login">
            Back to log in
          </Link>
        </div>
      </div>

      <ThemeMenu className="theme-menu-auth" />
    </div>
  );
}
