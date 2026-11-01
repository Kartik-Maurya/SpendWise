import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import AuthForm from '../components/AuthForm.jsx';
import ThemeMenu from '../components/ThemeMenu.jsx';

export default function Login({ onSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError('');
    try {
      await login(formData.email, formData.password);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
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
          <p>Sign in to your account</p>
        </div>
        <AuthForm mode="login" onSubmit={handleSubmit} error={error} loading={loading} />
        <div className="auth-footer">
          <Link className="link-button" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <div className="auth-footer">
          <Link
            className="btn btn-ghost btn-small"
            to="/register"
            aria-disabled={loading}
            onClick={(e) => {
              if (loading) e.preventDefault();
            }}
          >
            Need an account? Register
          </Link>
        </div>
      </div>
      <ThemeMenu className="theme-menu-auth" />
    </div>
  );
}
