
import { computeBoth, curve, REST_PARAMS, AFTER_PARAMS, FR_ROUTE, FR_BOULDER, routeLabel, boulderLabel } from './model.js';

const TYPES = [
  ['Route', 'Route'],
  ['Boulder', 'Boulder'],
  ['Multipitch', 'Multi-Pitch'],
];
const TYPE_LABEL = { Route: 'Route', Boulder: 'Boulder', Multipitch: 'Multi-pitch' };

const RESTS = [
  ['G', 'Good rest', 'recover 90–100%'],
  ['M', 'Medium rest', 'calm down'],
  ['B', 'Bad rest', 'short shake-out'],
  ['N', 'No rest', 'keep going'],
];

// ---- state: sections are kept as rows, the model reads them as a string ---------
// row: { grade: '8b+' | '' , mod: '' | 'h' | 's' | '/', move: bool, rest: 'G'|'M'|'B'|'N' (rest before this row) }
const newRow = (type) => ({ grade: '', mod: '', move: false, rest: 'G' });

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const state = {
  type: store.get('dg2-type', 'Route'),
  rows: store.get('dg2-rows', { Route: [newRow(), newRow()], Boulder: [newRow(), newRow()], Multipitch: [newRow(), newRow()] }),
  history: store.get('dg2-history', []),
};
const persist = () => {
  store.set('dg2-type', state.type);
  store.set('dg2-rows', state.rows);
  store.set('dg2-history', state.history);
};

const nextGrade = (grade, boulder) => {
  const list = boulder ? FR_BOULDER : FR_ROUTE;
  const i = list.indexOf(grade);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
};

function rowToken(row, type) {
  if (!row.grade) return '';
  const boulder = type === 'Boulder' || FR_BOULDER.includes(row.grade);
  const star = row.move && type === 'Boulder' ? '*' : '';
  let tok = row.grade + star;
  if (row.mod === '/') {
    const n = nextGrade(row.grade, boulder);
    if (n) tok += '/' + n + star;
  } else if (row.mod) tok += '.' + row.mod;
  return tok;
}

function buildString(type, rows) {
  const out = [];
  rows.forEach((row) => {
    const tok = rowToken(row, type);
    if (!tok) return;
    if (out.length && type === 'Route') out.push(row.rest);
    out.push(tok);
  });
  return out.join(' ');
}

function parseToRows(str) {
  const rows = [];
  let rest = 'G';
  for (const t of str.trim().split(/\s+/)) {
    if (/^[GMBN]$/.test(t)) { rest = t; continue; }
    const mm = /\.([hs])$/.exec(t);
    const core = mm ? t.slice(0, -2) : t;
    const parts = core.split('/');
    const move = parts[0].endsWith('*');
    rows.push({ grade: parts[0].replace('*', ''), mod: parts.length > 1 ? '/' : mm ? mm[1] : '', move, rest });
    rest = 'G';
  }
  return rows;
}

// ---- DOM ------------------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('#app').innerHTML = `
  <header class="top"><h1>Climbing Grade <span>Calc</span></h1></header>
  <main class="layout">
    <section class="card calc">
      <div class="seg" id="typeSeg" role="tablist"></div>
      <div class="result" aria-live="polite">
        <div class="dual">
          <div><small>French</small><div class="grade" id="gradeFr">–</div></div>
          <div><small>American</small><div class="grade" id="gradeUS">–</div></div>
        </div>
        <div class="meter"><div class="zones"><i></i><i></i><i></i></div><div class="marker" id="marker"></div></div>
        <div class="meter-labels"><span>soft</span><span>hard</span></div>
      </div>
      <div id="rows" class="rows"></div>
      <div class="actions">
        <button class="btn ghost" id="addBtn">+ Add section</button>
        <button class="btn primary" id="saveBtn">Save result</button>
      </div>
    </section>
    <section class="card history">
      <div class="console-bar">
        <h2>History</h2>
        <div class="tools">
          <button class="text-btn" id="shareBtn">Share</button>
          <button class="text-btn" id="clearHist">Clear</button>
        </div>
      </div>
      <ul id="histList"></ul>
      <p class="empty" id="histEmpty">Press “Save result” to keep a result here.</p>
    </section>
  </main>
  <footer class="about">
    <details>
      <summary>The equation behind the grades</summary>
      <div class="about-body">
        <p>Grades live on one scale where a step is one route grade (4a = 0.5, 4a+ = 1.5, 4b = 2.5…). For two sections <i>g</i><sub>1</sub> then <i>g</i><sub>2</sub> separated by a rest, with gap <i>d</i> = <i>g</i><sub>2</sub> − <i>g</i><sub>1</sub>, the pair is worth:</p>
        <div class="eq">
          <div><i>g</i> = <i>g</i><sub>1</sub> + <i>R</i>(<i>d</i>)</div>
          <div><i>R</i>(<i>d</i>) = <i>d</i> + <i>e</i><sub>0</sub>·(1 − <i>d</i>/<i>c</i>)<sup><i>p</i></sup> <span>for 0 ≤ <i>d</i> &lt; <i>c</i></span></div>
          <div><i>R</i>(<i>d</i>) = <i>e</i><sub>0</sub>·(1 + <i>d</i>/<i>c</i><sub>L</sub>)<sup><i>q</i></sup> <span>for −<i>c</i><sub>L</sub> &lt; <i>d</i> &lt; 0</span></div>
          <div><i>R</i>(<i>d</i>) = <i>d</i> for <i>d</i> ≥ <i>c</i>, and 0 for <i>d</i> ≤ −<i>c</i><sub>L</sub></div>
        </div>
        <p class="cap">Two route sections: the bonus over the harder one</p>
        <div class="plot" id="plot"></div>
        <table class="params">
          <thead><tr><th>Rest</th><th><i>e</i><sub>0</sub></th><th><i>c</i></th><th><i>c</i><sub>L</sub></th><th><i>p</i></th><th><i>q</i></th></tr></thead>
          <tbody>${[['G', 'Good'], ['M', 'Medium'], ['B', 'Bad'], ['N', 'None']].map(([k, n]) => `<tr><td><span class="dot r${k}"></span>${n}</td>${['e0', 'c', 'cl', 'p', 'q'].map((f) => `<td>${REST_PARAMS[k][f]}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p><i>e</i><sub>0</sub> is the bonus for two equal sections; <i>c</i> and <i>c</i><sub>L</sub> are how far above and below the first grade the second section still matters; <i>p</i> and <i>q</i> shape the fall-off. With more than two sections, the result of each pair becomes <i>g</i><sub>1</sub> of the next.</p>
        <p class="cap">A boulder after another section</p>
        <p>A boulder section <i>u</i> (4A = 0, 4A+ = 1…) counts as <i>u</i> + 3.8 on the route scale, whether it comes first or not. After another section it follows the same equation with larger constants, because it is easier to be pumped after a boulder than to boulder when pumped:</p>
        <div class="plot" id="plotAfter"></div>
        <table class="params">
          <thead><tr><th>Rest</th><th><i>e</i><sub>0</sub></th><th><i>c</i></th><th><i>c</i><sub>L</sub></th><th><i>p</i></th><th><i>q</i></th></tr></thead>
          <tbody>${[['G', 'Good'], ['M', 'Medium'], ['B', 'Bad'], ['N', 'None']].map(([k, n]) => `<tr><td><span class="dot r${k}"></span>${n}</td>${['e0', 'c', 'cl', 'p', 'q'].map((f) => `<td>${AFTER_PARAMS[k][f]}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <ul>
          <li><b>Boulder tab</b>: sections combine like route sections with no rest, and a one-move section (<code>*</code>) after another section uses the boulder-after constants, with no grade offset.</li>
          <li><b>Multi-pitch tab</b>: pitches combine like route sections after a good rest; the result is shown in brackets.</li>
          <li><b>Soft / hard</b>: <i>g</i> ∓ 0.35. <b>Slash</b>: the mean of the two grades.</li>
          <li><b>Result</b>: grade = ⌊<i>g</i>⌋; the fraction <i>g</i> − ⌊<i>g</i>⌋ ≤ 0.25 reads “soft”, above 0.75 “hard”, and within 0.05 of a boundary a slash such as 7a/7a+.</li>
        </ul>
      </div>
    </details>
  </footer>`;

function gradeOptions(type, selected) {
  const ph = `<option value="">Choose a grade…</option>`;
  const o = (v, l) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`;
  const routes = `<optgroup label="Route sections (lowercase)">${FR_ROUTE.map((g, i) => o(g, routeLabel(i))).join('')}</optgroup>`;
  const boulders = `<optgroup label="${type === 'Route' ? 'Boulder sections (uppercase)' : 'Boulder grades'}">${FR_BOULDER.map((g, i) => o(g, boulderLabel(i))).join('')}</optgroup>`;
  if (type === 'Boulder') return ph + boulders;
  if (type === 'Multipitch') return ph + routes;
  return ph + routes + boulders;
}

function renderRows() {
  const type = state.type;
  const rows = state.rows[type];
  $('#rows').innerHTML = rows
    .map((row, i) => {
      const restSel = i > 0 && type === 'Route'
        ? `<label class="rest-pick"><span>Rest</span><select data-i="${i}" data-f="rest" aria-label="Rest before section ${i + 1}">${RESTS.map(([v, l, d]) => `<option value="${v}"${v === row.rest ? ' selected' : ''}>${l} — ${d}</option>`).join('')}</select></label>`
        : '';
      const boulder = row.grade && FR_BOULDER.includes(row.grade);
      const kindCls = !row.grade ? '' : boulder ? 'boulder' : 'route';
      return `${restSel}
      <div class="row ${kindCls}">
        <div class="row-head">
          <span class="row-title">${type === 'Multipitch' ? 'Pitch' : 'Section'} ${i + 1}</span>
          ${rows.length > 1 ? `<button class="icon" data-remove="${i}" aria-label="Remove section ${i + 1}">✕</button>` : ''}
        </div>
        <select class="grade-sel" data-i="${i}" data-f="grade" aria-label="Grade of section ${i + 1}">${gradeOptions(type, row.grade)}</select>
        <div class="row-opts">
          <label>Difficulty
            <select data-i="${i}" data-f="mod">
              <option value=""${row.mod === '' ? ' selected' : ''}>Standard</option>
              <option value="s"${row.mod === 's' ? ' selected' : ''}>Soft for the grade</option>
              <option value="h"${row.mod === 'h' ? ' selected' : ''}>Hard for the grade</option>
              <option value="/"${row.mod === '/' ? ' selected' : ''}>Between this and next grade</option>
            </select>
          </label>
          ${type === 'Boulder' ? `<label class="check"><input type="checkbox" data-i="${i}" data-f="move"${row.move ? ' checked' : ''} /> One move</label>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

function renderTabs() {
  $('#typeSeg').innerHTML = TYPES.map(([v, l]) => `<button role="tab" data-type="${v}" aria-selected="${v === state.type}">${l}</button>`).join('');
}

let last = null;
function renderResult() {
  const str = buildString(state.type, state.rows[state.type]);
  const res = str ? computeBoth(state.type, str) : null;
  const ok = res && res.Fr.gradeStr !== '-';
  $('#gradeFr').textContent = ok ? res.Fr.gradeStr : '–';
  $('#gradeUS').textContent = ok ? res.US.gradeStr : '–';
  $('#gradeFr').classList.toggle('empty', !ok);
  $('#gradeUS').classList.toggle('empty', !ok);
  $('#marker').style.left = (ok ? res.Fr.position : 50) + '%';
  $('#marker').style.opacity = ok ? 1 : 0;
  $('#saveBtn').disabled = !ok;
  last = ok ? { str, res } : null;
}

function renderHistory() {
  $('#histList').innerHTML = state.history
    .map((h, i) => `<li data-i="${i}"><button class="hist-load"><span class="h-type">${esc(TYPE_LABEL[h.type])}</span><span class="h-str">${esc(h.str)}</span></button><b class="h-grade">${esc(h.fr)}<small>${esc(h.us)}</small></b><button class="icon" data-del="${i}" aria-label="Delete">✕</button></li>`)
    .join('');
  $('#histEmpty').hidden = state.history.length > 0;
}

function update() {
  renderResult();
  persist();
}

function renderAll() {
  renderTabs();
  renderRows();
  update();
  renderHistory();
}

// ---- events -----------------------------------------------------------------------
$('#typeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.type = b.dataset.type;
  renderAll();
});

$('#rows').addEventListener('change', (e) => {
  const el = e.target;
  const i = +el.dataset.i, f = el.dataset.f;
  if (Number.isNaN(i) || !f) return;
  const row = state.rows[state.type][i];
  row[f] = f === 'move' ? el.checked : el.value;
  if (f === 'grade') renderRows(); // refresh row colour
  update();
});

$('#rows').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (!rm) return;
  state.rows[state.type].splice(+rm.dataset.remove, 1);
  renderRows();
  update();
});

$('#addBtn').addEventListener('click', () => {
  state.rows[state.type].push(newRow());
  renderRows();
  update();
  const sels = document.querySelectorAll('.grade-sel');
  sels[sels.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
});

$('#saveBtn').addEventListener('click', () => {
  if (!last) return;
  const { str, res } = last;
  state.history = [{ type: state.type, str, fr: res.Fr.gradeStr, us: res.US.gradeStr }, ...state.history.filter((h) => !(h.str === str && h.type === state.type))].slice(0, 50);
  renderHistory();
  persist();
  [$('#gradeFr'), $('#gradeUS')].forEach((el) => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
});

$('#histList').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) { state.history.splice(+del.dataset.del, 1); renderHistory(); persist(); return; }
  const li = e.target.closest('li');
  if (!li) return;
  const h = state.history[+li.dataset.i];
  state.type = h.type;
  state.rows[h.type] = parseToRows(h.str);
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#clearHist').addEventListener('click', () => { state.history = []; renderHistory(); persist(); });
$('#shareBtn').addEventListener('click', async () => {
  const text = last ? `${last.str} = ${last.res.Fr.gradeStr} (${last.res.US.gradeStr})` : 'Climbing Grade Calc';
  try {
    if (navigator.share) await navigator.share({ text, url: location.href });
    else { await navigator.clipboard.writeText(text); const b = $('#shareBtn'); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Share'), 1200); }
  } catch { /* cancelled */ }
});

function renderPlot(el, after) {
  const W = 340, H = 220, L = 34, R = 10, T = 10, B = 30;
  const x0 = -10, x1 = 16, y0 = 0, y1 = after ? 4 : 3;
  const X = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const Y = (y) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const path = (f) => {
    let d = '';
    for (let x = x0; x <= x1 + 1e-9; x += 0.1) d += `${d ? 'L' : 'M'}${X(x).toFixed(1)},${Y(f(x)).toFixed(1)}`;
    return d;
  };
  const col = { G: 'var(--good)', M: 'var(--accent)', B: 'var(--boulder)', N: 'var(--bad)' };
  const grid = [];
  for (let x = x0; x <= x1; x += 2) grid.push(`<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H - B}" class="g"/><text x="${X(x)}" y="${H - B + 14}" text-anchor="middle">${x}</text>`);
  for (let y = 0; y <= y1; y += 1) grid.push(`<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" class="g"/><text x="${L - 6}" y="${Y(y) + 3}" text-anchor="end">${y}</text>`);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bonus over the harder section against the grade gap, for each rest quality">
    ${grid.join('')}
    ${['N', 'B', 'M', 'G'].map((k) => `<path d="${path((x) => curve(k, x, after) - Math.max(x, 0))}" stroke="${col[k]}" class="c"/>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle" class="ax">gap d = second − first grade (steps)</text>
    <text x="10" y="${(T + H - B) / 2}" text-anchor="middle" class="ax" transform="rotate(-90 10 ${(T + H - B) / 2})">bonus R(d) − max(d, 0)</text>
  </svg>
  <div class="legend">${['G', 'M', 'B', 'N'].map((k) => `<span><i style="background:${col[k]}"></i>${{ G: 'Good', M: 'Medium', B: 'Bad', N: 'None' }[k]}</span>`).join('')}</div>`;
}

renderPlot($('#plot'), false);
renderPlot($('#plotAfter'), true);
renderAll();

// offline support: cache the app after the first visit (production builds only)
if ('serviceWorker' in navigator && false) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

