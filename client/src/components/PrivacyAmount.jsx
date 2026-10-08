import React from 'react';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';

export default function PrivacyAmount({ amount, prefix = '', suffix = '' }) {
  const { formatAmount } = usePrivacyFormat();
  return (
    <>
      {prefix}
      {formatAmount(amount)}
      {suffix}
    </>
  );
}
