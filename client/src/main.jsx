import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { PrivacyProvider } from './contexts/PrivacyContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <PrivacyProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PrivacyProvider>
    </ThemeProvider>
  </React.StrictMode>
);
