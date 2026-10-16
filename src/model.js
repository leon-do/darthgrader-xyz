// Grade model, fitted to measured readings of the original calculator and to the
// method in the "Grading system in sport climbing" paper (darth-grader.net).
// Internal scale: one unit = one route grade step (4a = 0, 4a+ = 1, 4b = 2 ...).
// A route grade sits at idx + 0.5, "soft" at idx + 0.15, "hard" at idx + 0.85.

export const BOULDER_MAX = 31; // 9A+ = V18
export const ROUTE_MAX = 35; // 9c+ = 5.16a

export const FR_ROUTE = [];
for (let n = 4; n <= 10; n++) for (const l of 'abc') for (const p of ['', '+']) FR_ROUTE.push(n + l + p);
FR_ROUTE.length = ROUTE_MAX + 1; // top of the scale: 9c+ (5.16a)

// French <-> YDS from the Sportrock conversion chart. A few grades share a cell:
// 5.10a/b = 6a+ and 5.12d/5.13a = 7c+. French grades the chart has no YDS for sit between neighbours.
const YDS_CHART = {
  '5.5': '4c+', '5.6': '5a', '5.7': '5b', '5.8': '5c', '5.9': '6a', '5.10a': '6a+', '5.10b': '6a+', '5.10c': '6b',
  '5.10d': '6b+', '5.11a': '6c', '5.11b': '6c+', '5.11c': '7a', '5.11d': '7a+', '5.12a': '7b', '5.12b': '7b+',
  '5.12c': '7c', '5.12d': '7c+', '5.13a': '7c+', '5.13b': '8a', '5.13c': '8a+', '5.13d': '8b', '5.14a': '8b+',
  '5.14b': '8c', '5.14c': '8c+', '5.14d': '9a', '5.15a': '9a+', '5.15b': '9b', '5.15c': '9b+', '5.15d': '9c',
  '5.16a': '9c+',
};
const YDS_TO_IDX = {};
const ydsFor = {}; // French grade -> YDS label
for (const [y, f] of Object.entries(YDS_CHART)) {
  const i = FR_ROUTE.indexOf(f);
  YDS_TO_IDX[y] = i;
  const rest = y.slice(-1);
  ydsFor[f] = ydsFor[f] && /\d[a-d]$/.test(y) ? `${ydsFor[f]}/${y.startsWith('5.1') && ydsFor[f].slice(0, -1) === y.slice(0, -1) ? rest : y}` : y;
}
// 4a..4c, 5a+, 5b+, 5c+ have no row in the chart
const FR_TO_YDS = FR_ROUTE.map((f, i) => {
  if (ydsFor[f]) return ydsFor[f];
  if (i < 6) return '5.5';
  const lo = FR_ROUTE.findLastIndex((g, j) => j < i && ydsFor[g]);
  const hi = FR_ROUTE.findIndex((g, j) => j > i && ydsFor[g]);
  return `${ydsFor[FR_ROUTE[lo]].split('/').pop()}/${ydsFor[FR_ROUTE[hi]].split('/')[0]}`;
});

// Boulder scale u: 4A = 0, 4A+ = 1 ... (matches the Fr table, minus 18.5).
const US_BOULDER_U = {
  'V0-': 19.0, V0: 21.0, 'V0+': 23.0, V1: 25.2, V2: 27.7, V3: 30.25, V4: 32.75, V5: 34.65, V6: 35.9,
  V7: 37.25, V8: 38.6, V9: 39.85, V10: 41.25, V11: 42.5,
};
for (let v = 12; v <= 18; v++) US_BOULDER_U['V' + v] = 43.5 + (v - 12) * 1;
for (const k in US_BOULDER_U) US_BOULDER_U[k] -= 18.5;
const US_BOULDER_LIST = Object.entries(US_BOULDER_U).sort((a, b) => a[1] - b[1]);

// Rest curves. With d = second - first grade (in steps), the result sits above the first
// grade by  R(d) = d + e0 (1 - d/c)^p    for d >= 0   (R = d once d >= c: the second section just wins)
//                  e0 (1 + d/cl)^q       for d < 0    (R = 0 once d <= -cl: the first section just wins)
// e0 = bonus for two equal sections; c, cl = reach of the effect above / below the first grade.
// Fitted to ~100 readings of the original calculator: pairs of route sections stay within 0.01 grade steps.
export const REST_PARAMS = {
  G: { e0: 1.748, c: 8.163, cl: 5.388, p: 2.131, q: 1.676 },
  M: { e0: 1.987, c: 8.952, cl: 6.022, p: 2.026, q: 1.623 },
  B: { e0: 2.221, c: 8.928, cl: 6.76, p: 1.917, q: 1.587 },
  N: { e0: 2.545, c: 9.854, cl: 7.351, p: 1.831, q: 1.52 },
};
// A boulder (route tab) or a one-move section (boulder tab) after another section follows the
// same curve with a bigger bonus and reach. Within 0.012 of the measured readings.
export const AFTER_PARAMS = {
  G: { e0: 2.702, c: 15.968, cl: 8.35, p: 2.503, q: 1.761 },
  M: { e0: 3.164, c: 16.647, cl: 8.65, p: 2.195, q: 1.562 },
  B: { e0: 3.343, c: 17.696, cl: 8.945, p: 2.181, q: 1.542 },
  N: { e0: 3.494, c: 17.766, cl: 9.446, p: 2.137, q: 1.554 },
};

const BOULDER_TO_ROUTE = 3.8; // boulder step u (4A = 0) -> route value (3.3 steps + half a grade)

// grade gained over the first section, as a function of the grade gap d
export function curve(rest, d, after = false) {
  const { e0, c, cl, p, q } = (after ? AFTER_PARAMS : REST_PARAMS)[rest];
  if (d >= 0) return d >= c ? d : d + e0 * (1 - d / c) ** p;
  return d <= -cl ? 0 : e0 * (1 + d / cl) ** q;
}

export function combine(a, rest, b, after = false) {
  return a + curve(rest, b - a, after);
}

// ---- token parsing -------------------------------------------------------
const FR_ROUTE_RE = /^(\d{1,2})([abc])(\+?)$/;
const FR_BOULDER_RE = /^(\d{1,2})([ABC])(\+?)(\*?)$/;
const US_ROUTE_RE = /^5\.\d{1,2}[abcd]?$/;
const US_BOULDER_RE = /^(V\d{1,2}[-+]?)(\*?)$/;

function parseOne(tok, key) {
  let m;
  if (key === 'Fr') {
    if ((m = FR_ROUTE_RE.exec(tok))) {
      const i = FR_ROUTE.indexOf(m[1] + m[2] + m[3]);
      return i < 0 ? null : { kind: 'route', v: i + 0.5 };
    }
    if ((m = FR_BOULDER_RE.exec(tok))) {
      const n = +m[1];
      if (n < 4 || n > 10) return null;
      const u = (n - 4) * 6 + 2 * 'ABC'.indexOf(m[2]) + (m[3] ? 1 : 0);
      if (u > BOULDER_MAX) return null;
      return { kind: 'boulder', u, move: !!m[4] };
    }
  } else {
    if ((m = US_ROUTE_RE.exec(tok))) {
      const i = YDS_TO_IDX[m[0]];
      return i === undefined ? null : { kind: 'route', v: i + 0.5 };
    }
    if ((m = US_BOULDER_RE.exec(tok))) {
      const u = US_BOULDER_U[m[1]];
      return u === undefined ? null : { kind: 'boulder', u, move: !!m[2] };
    }
  }
  return null;
}

// returns { kind, v|u, move } or null; slashes average, .h/.s shift by 0.35
export function parseSection(tok, key) {
  let mod = 0;
  const mm = /\.([hs])$/.exec(tok);
  if (mm) { mod = mm[1] === 'h' ? 0.35 : -0.35; tok = tok.slice(0, -2); }
  const parts = tok.split('/');
  if (parts.length > 2) return null;
  const ps = parts.map((p) => parseOne(p, key));
  if (ps.some((p) => !p) || (ps.length === 2 && ps[0].kind !== ps[1].kind)) return null;
  const out = { ...ps[0] };
  const k = out.kind === 'route' ? 'v' : 'u';
  if (ps.length === 2) out[k] = (ps[0][k] + ps[1][k]) / 2;
  out[k] += mod;
  return out;
}

export function parseBreakdown(str, key) {
  const toks = str.trim().split(/\s+/).filter(Boolean);
  return toks.map((t) => (/^[GMBN]$/.test(t) ? { type: 'rest', rest: t } : { type: 'section', tok: t, sec: parseSection(t, key) }));
}

// ---- computation ---------------------------------------------------------
// Returns the internal value (route scale for Route/Multipitch, boulder scale u for Boulder) or null.
export function computeValue(climbType, key, str) {
  const items = parseBreakdown(str, key);
  if (!items.length || items.some((i) => i.type === 'section' && !i.sec)) return null;
  const secs = []; // [{rest, sec}]
  let rest = null;
  for (const it of items) {
    if (it.type === 'rest') { if (rest) return null; rest = it.rest; continue; }
    secs.push({ rest, sec: it.sec });
    rest = null;
  }
  if (!secs.length) return null;
  if (climbType === 'Route') {
    let acc = null;
    for (const { rest: r, sec } of secs) {
      const boulder = sec.kind === 'boulder';
      const val = boulder ? sec.u + BOULDER_TO_ROUTE : sec.v;
      acc = acc === null ? val : combine(acc, r || 'N', val, boulder);
    }
    return acc;
  }
  const want = climbType === 'Boulder' ? 'boulder' : 'route';
  if (secs.some(({ sec }) => sec.kind !== want)) return null;
  if (climbType === 'Boulder') {
    // sections: like route sections without rests; one-move sections behave like boulders in a route
    let acc = null;
    for (const { sec } of secs) {
      const val = sec.u + 0.5;
      acc = acc === null ? val : combine(acc, 'N', val, sec.move);
    }
    return acc;
  }
  // multi-pitch: pitches follow each other like route sections after a good rest
  return secs.slice(1).reduce((acc, { sec }) => combine(acc, 'G', sec.v), secs[0].sec.v);
}

// ---- formatting ----------------------------------------------------------
const SLASH_BAND = 0.06;

function usBoulderName(u) {
  // nearest V grade on the scale
  let best = US_BOULDER_LIST[0];
  for (const e of US_BOULDER_LIST) if (Math.abs(e[1] - u) < Math.abs(best[1] - u)) best = e;
  return best[0];
}

function routeName(i, key) {
  if (key === 'US') return FR_TO_YDS[i];
  return FR_ROUTE[i];
}

export function formatResult(climbType, key, value) {
  if (value === null) return { gradeStr: '-', position: 0 };
  if (climbType === 'Boulder') {
    const fr = withPos(value, frBoulderName, 0, BOULDER_MAX);
    if (key === 'Fr') return fr;
    return { gradeStr: fr.gradeStr.startsWith('>') ? '> ' + usBoulderName(BOULDER_MAX) : usBoulderName(value - 0.5), position: fr.position };
  }
  const res = withPos(value, (i) => routeName(i, key), 0, ROUTE_MAX);
  // the original shows multi-pitch results in square brackets
  return climbType === 'Multipitch' ? { ...res, gradeStr: `[${res.gradeStr}]` } : res;
}

function frBoulderName(i) {
  const n = 4 + Math.floor(i / 6), r = i % 6;
  return n + 'ABC'[r >> 1] + (r & 1 ? '+' : '');
}

function withPos(v, name, lo, hi) {
  if (v < lo) return { gradeStr: '< ' + name(lo), position: 0 };
  if (v >= hi + 1) return { gradeStr: '> ' + name(hi), position: 0 };
  const edge = Math.round(v);
  if (Math.abs(v - edge) < SLASH_BAND && edge > lo && edge <= hi) {
    return { gradeStr: name(edge - 1) + '/' + name(edge), position: 0 };
  }
  const i = Math.floor(v);
  const pos = Math.round((v - i) * 100);
  const mod = pos > 75 ? ' hard' : pos <= 25 ? ' soft' : '';
  return { gradeStr: name(i) + mod, position: pos };
}

export function compute(climbType, key, str) {
  return formatResult(climbType, key, computeValue(climbType, key, str));
}

// ---- translation between grading systems ----------------------------------
function translatePart(part, from, to) {
  const m = /^(.*?)(\*?)$/.exec(part);
  const o = parseOne(m[1], from);
  if (!o) return part;
  if (o.kind === 'route') {
    const i = Math.floor(o.v);
    return to === 'US' ? FR_TO_YDS[i] : FR_ROUTE[i];
  }
  const name = to === 'US' ? usBoulderName(o.u) : frBoulderName(Math.round(o.u));
  return name + m[2];
}

export function translate(str, from, to) {
  if (from === to) return str;
  return str.replace(/\S+/g, (tok) => {
    if (/^[GMBN]$/.test(tok)) return tok;
    const mm = /(\.[hs])$/.exec(tok);
    const core = mm ? tok.slice(0, -2) : tok;
    return core.split('/').map((p) => translatePart(p, from, to)).join('/') + (mm ? mm[1] : '');
  });
}

// ---- helpers for the dropdown UI (grades are stored in French notation) ----------
export const FR_BOULDER = Array.from({ length: BOULDER_MAX + 1 }, (_, i) => frBoulderName(i));

export function routeLabel(i) {
  return `${FR_ROUTE[i]} · ${FR_TO_YDS[i]}`;
}

export function boulderLabel(i) {
  return `${FR_BOULDER[i]} · ${usBoulderName(i)}`;
}

// French and US readings of the same description
export function computeBoth(climbType, str) {
  const value = computeValue(climbType, 'Fr', str);
  return { Fr: formatResult(climbType, 'Fr', value), US: formatResult(climbType, 'US', value) };
}

