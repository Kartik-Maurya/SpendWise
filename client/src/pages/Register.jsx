import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import AuthForm from '../components/AuthForm.jsx';

export default function Register({ onNavigate, onSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError('');
    try {
      await register(formData.name, formData.email, formData.password, formData.confirmPassword);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <p>Create your account</p>
        </div>
        <AuthForm mode="register" onSubmit={handleSubmit} error={error} loading={loading} />
        <div className="auth-footer">
          <button
            className="btn btn-ghost btn-small"
            onClick={() => onNavigate('login')}
            disabled={loading}
          >
            Already have an account? Log in
          </button>
        </div>
      </div>
      <button
        className="theme-toggle-circle"
        onClick={toggleTheme}
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  );
}
