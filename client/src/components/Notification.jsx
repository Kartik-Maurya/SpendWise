import React, { useState, useEffect } from 'react';

export default function Notification() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('notification:show', { detail: { type: 'init' } }));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { type, message, duration = 4000 } = e.detail;
      const id = Date.now();
      setNotifications((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    };
    window.addEventListener('notification:show', handler);
    return () => window.removeEventListener('notification:show', handler);
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map((n) => (
        <div key={n.id} className={`notification notification-${n.type}`}>
          {n.message}
        </div>
      ))}
    </div>
  );
}

export function showNotification(type, message, duration) {
  window.dispatchEvent(new CustomEvent('notification:show', { detail: { type, message, duration } }));
}
