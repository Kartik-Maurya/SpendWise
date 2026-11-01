import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import AuthForm from '../components/AuthForm.jsx';
import ThemeMenu from '../components/ThemeMenu.jsx';

export default function Register({ onSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

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
          <Link
            className="btn btn-ghost btn-small"
            to="/login"
            aria-disabled={loading}
            onClick={(e) => {
              if (loading) e.preventDefault();
            }}
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
      <ThemeMenu className="theme-menu-auth" />
    </div>
  );
}
