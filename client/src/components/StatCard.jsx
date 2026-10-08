import React from 'react';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';

export default function StatCard({ label, value, type, icon, isCurrency = true }) {
  const { formatValue } = usePrivacyFormat();

  return (
    <div className={`stat-card ${type || ''}`}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{formatValue(value, isCurrency)}</div>
    </div>
  );
}
