import React, { useId, useState } from 'react';
import InfoHint from './InfoHint.jsx';
import { showNotification } from './Notification.jsx';

export default function CsvImportPanel({ title, hint, footer, onImport, onClose, onImported }) {
  const inputId = useId();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (event) => {
    setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null);
    setResult(null);
    setError('');
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      const csv = await file.text();
      const summary = await onImport(csv);
      setResult(summary);
      const parts = [`${summary.imported} imported`];
      if (summary.updated) parts.push(`${summary.updated} updated`);
      if (summary.duplicates) parts.push(`${summary.duplicates} duplicate(s) skipped`);
      showNotification('success', parts.join(', '));
      if (onImported) onImported(summary);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="import-panel">
      <header className="panel-head">
        <h3>
          {title}
          {hint && <InfoHint label={`About ${title}`}>{hint}</InfoHint>}
        </h3>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="import-controls">
        <label className="import-file-label" htmlFor={inputId}>
          Choose CSV
        </label>
        <input
          id={inputId}
          className="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
        />
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={handleImport}
          disabled={!file || importing}
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
        {file && (
          <span className="import-file-name">
            {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
          </span>
        )}
      </div>

      {footer && <p className="import-hint">{footer}</p>}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="import-result">
          <div className="import-summary">
            <span className="import-stat positive">{result.imported} imported</span>
            {result.updated > 0 && (
              <span className="import-stat positive">{result.updated} updated</span>
            )}
            <span className="import-stat">{result.duplicates} duplicate(s) skipped</span>
            <span className="import-stat">{result.rejected} row(s) rejected</span>
            <span className="import-stat muted">{result.totalRows} row(s) read</span>
          </div>

          {result.rejected > 0 && (
            <details open={result.rejected <= 5}>
              <summary>Rejected rows ({result.rejected})</summary>
              <ul className="import-error-list">
                {result.errors.map((item) => (
                  <li key={`err-${item.line}`}>
                    <span className="import-line">Row {item.line}</span>
                    {item.message}
                  </li>
                ))}
              </ul>
              {result.rejected > result.errors.length && (
                <p className="import-hint">
                  Showing the first {result.errors.length} rejected rows.
                </p>
              )}
            </details>
          )}

          {result.duplicateRows && result.duplicateRows.length > 0 && (
            <details>
              <summary>Duplicate rows ({result.duplicates})</summary>
              <ul className="import-error-list">
                {result.duplicateRows.map((item) => (
                  <li key={`dup-${item.line}`}>
                    <span className="import-line">Row {item.line}</span>
                    {item.summary}
                  </li>
                ))}
              </ul>
              {result.duplicates > result.duplicateRows.length && (
                <p className="import-hint">
                  Showing the first {result.duplicateRows.length} duplicates.
                </p>
              )}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
