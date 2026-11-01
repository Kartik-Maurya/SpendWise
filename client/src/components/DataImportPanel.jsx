import React, { useId, useState } from 'react';
import InfoHint from './InfoHint.jsx';
import { showNotification } from './Notification.jsx';
import { previewFileImport, commitFileImport } from '../services/api.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma === -1 ? '' : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function datasetStatus(item) {
  if (item.headerError) return 'Needs fixing';
  if (!item.present) return 'Not in file';
  if (item.totalRows === 0) return 'Empty';
  return `${item.importable} to import`;
}

function DatasetPreview({ item, checked, onToggle }) {
  const disabled = item.importable === 0;

  return (
    <li className={`data-import-dataset${disabled ? ' is-empty' : ''}`}>
      <label className="data-import-dataset-main">
        <input
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled || Boolean(item.headerError)}
          onChange={() => onToggle(item.key)}
        />
        <span className="data-import-dataset-label">
          <strong>{item.label}</strong>
          <span className="data-import-dataset-status">{datasetStatus(item)}</span>
        </span>
      </label>

      <div className="data-import-counts">
        {item.totalRows > 0 && <span>{item.totalRows} row(s) read</span>}
        {item.duplicates > 0 && <span>{item.duplicates} duplicate(s)</span>}
        {item.conflicts > 0 && <span>{item.conflicts} conflict(s)</span>}
        {item.rejected > 0 && (
          <span className="data-import-count-warn">{item.rejected} rejected</span>
        )}
      </div>

      {item.headerError && (
        <p className="data-import-note data-import-note-warn">{item.headerError}</p>
      )}

      {item.errors.length > 0 && (
        <details className="data-import-details">
          <summary>Rejected rows ({item.rejected})</summary>
          <ul className="import-error-list">
            {item.errors.map((error) => (
              <li key={`${item.key}-err-${error.line}`}>
                <span className="import-line">{error.line ? `Row ${error.line}` : 'File'}</span>
                {error.message}
              </li>
            ))}
          </ul>
          {item.rejected > item.errors.length && (
            <p className="import-hint">
              Showing the first {item.errors.length} rejected rows.
            </p>
          )}
        </details>
      )}

      {item.duplicateRows.length > 0 && (
        <details className="data-import-details">
          <summary>Already in SpendWise ({item.duplicates})</summary>
          <ul className="import-error-list">
            {item.duplicateRows.map((row) => (
              <li key={`${item.key}-dup-${row.line}`}>
                <span className="import-line">Row {row.line}</span>
                {row.summary}
              </li>
            ))}
          </ul>
          {item.duplicates > item.duplicateRows.length && (
            <p className="import-hint">
              Showing the first {item.duplicateRows.length}. All duplicates are skipped.
            </p>
          )}
        </details>
      )}

      {item.conflictRows.length > 0 && (
        <details className="data-import-details">
          <summary>Conflicts skipped ({item.conflicts})</summary>
          <ul className="import-error-list">
            {item.conflictRows.map((row) => (
              <li key={`${item.key}-conflict-${row.line}`}>
                <span className="import-line">Row {row.line}</span>
                {row.summary} — already exists with a different value
              </li>
            ))}
          </ul>
          {item.conflicts > item.conflictRows.length && (
            <p className="import-hint">
              Showing the first {item.conflictRows.length}. Edit these in the app to change them.
            </p>
          )}
        </details>
      )}
    </li>
  );
}

export default function DataImportPanel() {
  const inputId = useId();
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = () => {
    setPreview(null);
    setSelected({});
    setResult(null);
    setError('');
  };

  const runPreview = async (nextFile) => {
    reset();
    if (!nextFile) return;

    if (nextFile.size > MAX_FILE_BYTES) {
      setError('Files must be 5 MB or smaller.');
      setFile(null);
      setFileContent('');
      return;
    }

    setBusy('preview');
    try {
      const content = await fileToBase64(nextFile);
      const response = await previewFileImport({
        filename: nextFile.name,
        contentBase64: content,
      });
      setFileContent(content);
      setPreview(response);
      const nextSelected = {};
      response.datasets.forEach((item) => {
        nextSelected[item.key] = item.importable > 0;
      });
      setSelected(nextSelected);
    } catch (err) {
      setError(err.message || 'That file could not be read');
      setFileContent('');
    } finally {
      setBusy('');
    }
  };

  const handleFile = (event) => {
    const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setFile(nextFile);
    runPreview(nextFile);
  };

  const toggleDataset = (key) => {
    setSelected((current) => ({ ...current, [key]: !current[key] }));
  };

  const chosenKeys = preview
    ? preview.datasets.filter((item) => selected[item.key] && item.importable > 0).map((item) => item.key)
    : [];
  const importableTotal = preview
    ? preview.datasets
        .filter((item) => selected[item.key] && item.importable > 0)
        .reduce((sum, item) => sum + item.importable, 0)
    : 0;

  const handleImport = async () => {
    if (!preview || !chosenKeys.length || !file) return;
    setBusy('commit');
    setError('');

    try {
      const summary = await commitFileImport({
        filename: file.name,
        contentBase64: fileContent,
        datasets: chosenKeys,
      });
      setResult(summary);
      showNotification(
        'success',
        `${summary.totals.imported} row${summary.totals.imported === 1 ? '' : 's'} imported`
      );
      setPreview(null);
      setSelected({});
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="data-import" aria-labelledby={`${inputId}-title`}>
      <div className="data-import-head">
        <h4 id={`${inputId}-title`}>
          Import data
          <InfoHint label="About importing data">
            Accepts the Excel workbook or JSON backup downloaded from this page. SpendWise previews
            every row first: invalid rows are listed and skipped, rows already saved are skipped, and
            budgets or monthly plans that exist with different values are reported as conflicts
            instead of overwritten. Files exported with privacy mode on cannot be imported.
          </InfoHint>
        </h4>
      </div>

      <div className="data-import-controls">
        <label className="import-file-label" htmlFor={inputId}>
          Choose workbook or backup
        </label>
        <input
          id={inputId}
          className="import-file"
          type="file"
          accept=".xlsx,.xlsm,.json"
          onChange={handleFile}
          disabled={busy === 'commit'}
        />
        {busy === 'preview' && (
          <span className="import-file-name" role="status">
            Reading file…
          </span>
        )}
        {file && busy !== 'preview' && (
          <span className="import-file-name">
            {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
          </span>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {preview && (
        <div className="data-import-preview">
          <p className="data-import-summary" role="status">
            {preview.format === 'xlsx' ? 'Excel workbook' : 'JSON backup'} ·{' '}
            {preview.datasets.filter((item) => item.present).length} dataset(s) found
          </p>

          <ul className="data-import-list">
            {preview.datasets.map((item) => (
              <DatasetPreview
                key={item.key}
                item={item}
                checked={Boolean(selected[item.key])}
                onToggle={toggleDataset}
              />
            ))}
          </ul>

          <div className="data-import-actions">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={handleImport}
              disabled={busy === 'commit' || importableTotal === 0}
            >
              {busy === 'commit' ? 'Importing…' : `Import ${importableTotal} row(s)`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                setFile(null);
                setFileContent('');
                reset();
              }}
              disabled={busy === 'commit'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="import-result" role="status">
          <div className="import-summary">
            <span className="import-stat positive">{result.totals.imported} imported</span>
            {result.totals.duplicates > 0 && (
              <span className="import-stat">{result.totals.duplicates} duplicate(s) skipped</span>
            )}
            {result.totals.conflicts > 0 && (
              <span className="import-stat">{result.totals.conflicts} conflict(s) skipped</span>
            )}
            {result.totals.rejected > 0 && (
              <span className="import-stat">{result.totals.rejected} row(s) rejected</span>
            )}
          </div>
          <ul className="data-import-result-list">
            {result.datasets
              .filter((item) => item.imported > 0)
              .map((item) => (
                <li key={`imported-${item.key}`}>
                  {item.imported}{' '}
                  {item.imported === 1
                    ? item.label.replace(/s$/, '').toLowerCase()
                    : item.label.toLowerCase()}{' '}
                  imported
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
