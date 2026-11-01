import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { PrivacyProvider } from './contexts/PrivacyContext.jsx';
import { ShortcutsProvider } from './contexts/ShortcutsContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PrivacyProvider>
          <ShortcutsProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ShortcutsProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
