const PAPER = {
  a4: { label: 'A4 (210 × 297 mm)', width: 210, height: 297 },
  letter: { label: 'US Letter (216 × 279 mm)', width: 215.9, height: 279.4 },
  legal: { label: 'US Legal (216 × 356 mm)', width: 215.9, height: 355.6 },
};

const MARGINS = {
  compact: { label: 'Compact (8 mm)', width: 8 },
  normal: { label: 'Normal (14 mm)', width: 14 },
  wide: { label: 'Wide (20 mm)', width: 20 },
};

const MAX_PAGE_MM = 5000;
const STORAGE_KEY = 'spendwise.print';

function printCss() {
  return `
  /* Print toolbar (screen only) */
  .print-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 14px;
    margin: 18px 0 0;
    padding: 12px 14px;
    border: 1px solid #e6eaf0;
    border-radius: 10px;
    background: #f8fafc;
  }
  .print-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #65708a; }
  .print-field select {
    min-width: 11.5rem;
    padding: 6px 10px;
    border: 1px solid #d7dee8;
    border-radius: 8px;
    background: #fff;
    color: #172033;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  .print-actions { display: flex; gap: 8px; margin-left: auto; }
  .print-btn {
    border: 1px solid #0f766e;
    border-radius: 8px;
    background: #0f766e;
    color: #fff;
    padding: 8px 14px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .print-btn:hover { background: #0b5f59; border-color: #0b5f59; }
  .print-btn-secondary { background: #fff; color: #0f766e; }
  .print-btn-secondary:hover { background: #ecfdf5; }
  .print-hint { flex-basis: 100%; margin: 0; color: #7a8499; font-size: 11.5px; }
  @media screen and (max-width: 620px) {
    .print-field { flex: 1 1 100%; }
    .print-field select { min-width: 0; width: 100%; }
    .print-actions { width: 100%; margin-left: 0; }
    .print-btn { flex: 1; }
  }

  /* Page setup: the script rewrites this rule with the selected paper size. */
  @page { size: 210mm 297mm; margin: 0; }
  :root { --print-mx: 14mm; --print-my: 14mm; }

  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print, .print-toolbar { display: none !important; }
    .sheet {
      width: 100%;
      max-width: none;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
      padding: var(--print-my) var(--print-mx);
    }
    .table-wrap { overflow: visible !important; }
    .table-wrap table { min-width: 0 !important; }
    table { width: 100%; font-size: 12px; break-inside: auto; page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
    tr, .stat, .insight, .notes li { break-inside: avoid; page-break-inside: avoid; }
    h1 { font-size: 25px; }
    h1, h2, h3, .section-head, .subhead, .insight-head {
      break-after: avoid;
      page-break-after: avoid;
    }
    .section-head { break-inside: avoid; page-break-inside: avoid; }
    .section { margin-top: 20px; break-inside: auto; }
    p, li { orphans: 3; widows: 3; }
    pre { overflow: visible !important; white-space: pre-wrap; }
    details { break-inside: avoid; page-break-inside: avoid; }
  }

  /* Mirrors the print layout off-screen so single-page height can be measured. */
  html.sw-measuring .no-print { display: none !important; }
  html.sw-measuring body { background: #fff; }
  html.sw-measuring .sheet {
    width: var(--measure-width, 182mm);
    max-width: none;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    padding: var(--print-my) var(--print-mx);
  }
  html.sw-measuring .section { margin-top: 20px; }
  html.sw-measuring table { font-size: 12px; }
  html.sw-measuring h1 { font-size: 25px; }
  /* Print never uses the narrow-screen layout, so measurement must not either. */
  html.sw-measuring body { padding: 0; }
  html.sw-measuring .report-head { flex-direction: row; gap: 24px; }
  html.sw-measuring .head-side { text-align: right; white-space: nowrap; }
  html.sw-measuring .stat-row { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  html.sw-measuring th, html.sw-measuring td { padding: 8px 10px; }
  html.sw-measuring .table-wrap { overflow: visible; }
  html.sw-measuring .table-wrap table { min-width: 0; }`;
}

function printToolbar({ paper = 'a4', margin = 'normal' } = {}) {
  const paperOptions = Object.entries(PAPER)
    .map(
      ([id, item]) =>
        `<option value="${id}"${id === paper ? ' selected' : ''}>${item.label}</option>`
    )
    .join('');
  const marginOptions = Object.entries(MARGINS)
    .map(
      ([id, item]) =>
        `<option value="${id}"${id === margin ? ' selected' : ''}>${item.label}</option>`
    )
    .join('');

  return `
  <div class="print-toolbar no-print" role="group" aria-label="Print and PDF options">
    <label class="print-field" for="sw-paper">
      Paper size
      <select id="sw-paper">${paperOptions}</select>
    </label>
    <label class="print-field" for="sw-margin">
      Margins
      <select id="sw-margin">${marginOptions}</select>
    </label>
    <div class="print-actions">
      <button type="button" class="print-btn" data-print-mode="paginated">Save paginated PDF</button>
      <button type="button" class="print-btn print-btn-secondary" data-print-mode="single">Save single-page PDF</button>
    </div>
    <p class="print-hint" id="sw-print-hint" role="status">Use the “Save as PDF” destination — system PDF printers (e.g. “Microsoft Print to PDF”) shrink the long page onto A4 paper.</p>
  </div>`;
}

function printScript({ paper = 'a4', margin = 'normal' } = {}) {
  const config = {
    paper,
    margin,
    storageKey: STORAGE_KEY,
    maxPageMm: MAX_PAGE_MM,
    papers: PAPER,
    margins: MARGINS,
  };

  return `
<script>
(function () {
  var CONFIG = ${JSON.stringify(config)};
  var root = document.documentElement;
  var paperSelect = document.getElementById('sw-paper');
  var marginSelect = document.getElementById('sw-margin');
  var hint = document.getElementById('sw-print-hint');
  if (!paperSelect || !marginSelect) return;

  var pageStyle = document.getElementById('sw-page');
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = 'sw-page';
    document.head.appendChild(pageStyle);
  }

  var defaultHint = hint ? hint.textContent : '';
  var MM_PER_PX = 25.4 / 96;
  var SINGLE_PAD_MM = 4;

  function readStored() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify({ paper: paperSelect.value, margin: marginSelect.value })
      );
    } catch (err) {
      /* storage can be unavailable for local files */
    }
  }

  function current() {
    return {
      paper: CONFIG.papers[paperSelect.value] || CONFIG.papers.a4,
      margin: CONFIG.margins[marginSelect.value] || CONFIG.margins.normal
    };
  }

  function setHint(text) {
    if (hint) hint.textContent = text || defaultHint;
  }

  function measureHeight(widthMm) {
    /* Border-box: full page width keeps the content column identical to print. */
    var width = Math.max(40, widthMm);
    root.style.setProperty('--measure-width', width + 'mm');
    root.classList.add('sw-measuring');
    var sheet = document.querySelector('.sheet') || document.body;
    var px = sheet.scrollHeight;
    root.classList.remove('sw-measuring');
    root.style.removeProperty('--measure-width');
    return px * MM_PER_PX;
  }

  function apply(mode) {
    var size = current();
    var width = size.paper.width;
    var height = size.paper.height;
    var pad = size.margin.width;

    if (mode === 'single') {
      /* Keep the paginated content column, drop the A4 frame around it. */
      var column = Math.max(60, width - pad * 2);
      pad = SINGLE_PAD_MM;
      width = column + pad * 2;
      root.style.setProperty('--print-mx', pad + 'mm');
      root.style.setProperty('--print-my', pad + 'mm');
      var content = measureHeight(width);
      height = Math.ceil(Math.max(40, content + 2));
      if (height > CONFIG.maxPageMm) {
        root.removeAttribute('data-print-mode');
        setHint('This report is too long for a single PDF page. Use “Save paginated PDF” instead.');
        return false;
      }
      root.setAttribute('data-print-mode', 'single');
    } else {
      root.style.setProperty('--print-mx', pad + 'mm');
      root.style.setProperty('--print-my', pad + 'mm');
      root.removeAttribute('data-print-mode');
    }

    root.style.setProperty('--page-w', width + 'mm');
    root.style.setProperty('--page-h', height + 'mm');
    pageStyle.textContent =
      '@page { size: ' + width + 'mm ' + height + 'mm; margin: 0; }';
    return true;
  }

  function run(mode) {
    if (!apply(mode)) return;
    setHint(
      mode === 'single'
        ? 'Single page · ' + root.style.getPropertyValue('--page-w') + ' × ' +
          root.style.getPropertyValue('--page-h') +
          '. Keep the destination on “Save as PDF”; system printers shrink it onto A4.'
        : 'Paginated PDF: choose “Save as PDF” and set Margins to None.'
    );

    var restored = false;
    function restore() {
      if (restored) return;
      restored = true;
      window.removeEventListener('afterprint', restore);
      root.removeAttribute('data-print-mode');
      apply('paginated');
      setHint('');
    }
    window.addEventListener('afterprint', restore);
    window.print();
  }

  var params = new URLSearchParams(window.location.search);
  var stored = readStored();
  var initialPaper = params.get('paper') || stored.paper || CONFIG.paper;
  var initialMargin = params.get('margin') || stored.margin || CONFIG.margin;
  if (CONFIG.papers[initialPaper]) paperSelect.value = initialPaper;
  if (CONFIG.margins[initialMargin]) marginSelect.value = initialMargin;

  apply('paginated');

  var initialMode = params.get('mode');
  if (initialMode === 'single' || initialMode === 'paginated') apply(initialMode);

  paperSelect.addEventListener('change', function () { persist(); apply('paginated'); });
  marginSelect.addEventListener('change', function () { persist(); apply('paginated'); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-print-mode]'), function (button) {
    button.addEventListener('click', function () {
      run(button.getAttribute('data-print-mode'));
    });
  });
})();
</script>`;
}

module.exports = {
  PAPER,
  MARGINS,
  printCss,
  printToolbar,
  printScript,
};
