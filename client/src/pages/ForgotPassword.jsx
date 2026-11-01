import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeMenu from '../components/ThemeMenu.jsx';
import { forgotPassword } from '../services/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not request a reset link. Please try again.');
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
          <p>Reset your password</p>
        </div>

        {sent ? (
          <>
            <div className="success-message">
              If an account exists for {email}, a reset link is on its way. The link expires in 30
              minutes and can be used once.
            </div>
            <p className="auth-note">
              No email after a few minutes? Check your spam folder, then request another link.
            </p>
            {import.meta.env.DEV && (
              <p className="auth-note">
                Running locally without SMTP? The reset link is printed in the server console.
              </p>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
            >
              Send another link
            </button>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            <p className="auth-note">
              Enter the email for your account and we will send you a link to choose a new
              password.
            </p>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
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
