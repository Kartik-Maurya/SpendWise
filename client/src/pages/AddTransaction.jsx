import React, { useState } from 'react';
import TransactionForm from '../components/TransactionForm.jsx';
import { createTransaction, createRecurring } from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

export default function AddTransaction({ onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      const txData = { type: data.type, amount: data.amount, category: data.category, description: data.description, date: data.date };
      const createdTx = await createTransaction(txData);

      if (data.makeRecurring) {
        await createRecurring({
          description: data.description,
          type: data.type,
          amount: data.amount,
          category: data.category,
          frequency: data.frequency,
          nextOccurrence: data.nextOccurrence,
          isActive: true,
        });
        showNotification('success', 'Transaction and recurring schedule added!');
      } else {
        showNotification('success', 'Transaction added successfully!');
      }

      onSuccess?.();
    } catch (err) {
      showNotification('error', err.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-transaction-page">
      <h2>Add Transaction</h2>
      <TransactionForm onSubmit={handleSubmit} loading={loading} onCancel={onCancel} />
    </div>
  );
}
