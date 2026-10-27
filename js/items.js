/* =========================================================
   Elemente: Spieler, Ball, Material, Pfeile – und die Legende.
   Jedes Element wird um seinen Mittelpunkt (0,0) gezeichnet;
   Position, Drehung und Größe setzt app.js per transform.
   ========================================================= */

const SWATCHES = [
  { c: '#1d4ed8', n: 'Blau' }, { c: '#dc2626', n: 'Rot' }, { c: '#facc15', n: 'Gelb' },
  { c: '#f97316', n: 'Orange' }, { c: '#9333ea', n: 'Lila' }, { c: '#06b6d4', n: 'Türkis' },
  { c: '#111827', n: 'Schwarz' }, { c: '#ffffff', n: 'Weiß' },
];

const TEAM_NAMES = { home: 'Spieler', away: 'Gegenspieler', gk: 'Torwart', neutral: 'Neutraler Spieler' };

const FONT = 'font-family="Arial, Helvetica, sans-serif"';
const INK = '#1f2937';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isLight(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}

// amt < 0 dunkler, amt > 0 heller
function shade(hex, amt) {
  const f = v => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return '#' + hexToRgb(hex).map(v => f(v).toString(16).padStart(2, '0')).join('');
}

/* ---------- Zeichenfunktionen ---------- */

const JERSEY = 'M-10 -6.5L-4 -8Q0 -4 4 -8L10 -6.5L17 0L13.5 6.5L10 4.5V19Q10 21 8 21H-8Q-10 21 -10 19V4.5L-13.5 6.5L-17 0Z';

function renderPlayer(it) {
  const c = it.color, light = isLight(c);
  const outline = light ? INK : '#ffffff';
  const lbl = String(it.label ?? '');
  const fs = lbl.length <= 1 ? 12 : lbl.length === 2 ? 11 : lbl.length === 3 ? 8.5 : 7;
  return `<g filter="url(#shadow)">` +
    `<path d="${JERSEY}" fill="${c}" stroke="${outline}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cy="-14.5" r="6.8" fill="${c}" stroke="${outline}" stroke-width="1.8"/>` +
    (lbl ? `<text y="8" font-size="${fs}" font-weight="700" fill="${light ? '#111827' : '#ffffff'}" text-anchor="middle" dominant-baseline="central" ${FONT}>${esc(lbl)}</text>` : '') +
    `</g>`;
}

const BALL_SVG = (() => {
  const pent = (cx, cy, r, a0) => [0, 1, 2, 3, 4].map(k => {
    const a = (a0 + k * 72) * Math.PI / 180;
    return `${r2(cx + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}`;
  }).join(' ');
  let s = `<g filter="url(#shadow)"><circle r="8" fill="#fff"/><g clip-path="url(#ballClip)">`;
  s += `<polygon points="${pent(0, 0, 3.1, -90)}" fill="${INK}"/>`;
  for (let k = 0; k < 5; k++) {
    const deg = -90 + k * 72, a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    s += `<line x1="${r2(3.1 * cos)}" y1="${r2(3.1 * sin)}" x2="${r2(5.6 * cos)}" y2="${r2(5.6 * sin)}" stroke="${INK}" stroke-width=".9"/>`;
    s += `<polygon points="${pent(8.2 * cos, 8.2 * sin, 2.8, deg + 180)}" fill="${INK}"/>`;
  }
  return s + `</g><circle r="8" fill="none" stroke="${INK}" stroke-width="1.1"/></g>`;
})();

function renderCone(it) {
  const c = it.color, dark = shade(c, -0.35);
  return `<g filter="url(#shadow)">` +
    `<ellipse cy="10" rx="10.5" ry="3.2" fill="${dark}"/>` +
    `<path d="M-7.5 9.6L-1.8 -11Q0 -13 1.8 -11L7.5 9.6Q0 12.6 -7.5 9.6Z" fill="${c}" stroke="${dark}" stroke-width=".8"/>` +
    `<path d="M-5 .5H5L4.03 -3H-4.03Z" fill="#fff" fill-opacity=".85"/>` +
    `</g>`;
}

function renderDisc(it) {
  const c = it.color;
  return `<g filter="url(#shadow)">` +
    `<circle r="8.5" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="1"/>` +
    `<circle r="5.6" fill="none" stroke="${shade(c, 0.35)}" stroke-width="1"/>` +
    `<circle r="2.6" fill="${shade(c, -0.35)}"/>` +
    `</g>`;
}

function renderPole(it) {
  const c = it.color;
  return `<g filter="url(#shadow)">` +
    `<ellipse cy="20.5" rx="5.5" ry="1.8" fill="#000" fill-opacity=".35"/>` +
    `<rect x="-2.3" y="-22" width="4.6" height="42" rx="2.3" fill="${c}" stroke="${shade(c, -0.4)}" stroke-width=".8"/>` +
    `<rect x="-2.3" y="-12" width="4.6" height="5" fill="${INK}"/>` +
    `<rect x="-2.3" y="2" width="4.6" height="5" fill="${INK}"/>` +
    `</g>`;
}

// Tor von oben gesehen, Öffnung zeigt nach unten (+y)
function renderGoal(it, w, depth, lw, frontW) {
  const c = it.color, x = -w / 2, top = -depth / 2 - 1, front = depth / 2 - 1;
  return `<g filter="url(#shadow)">` +
    `<rect x="${x}" y="${top}" width="${w}" height="${depth}" fill="#fff" fill-opacity=".14"/>` +
    `<rect x="${x}" y="${top}" width="${w}" height="${depth}" fill="url(#net)"/>` +
    `<path d="M${x} ${front}V${top}H${-x}V${front}" fill="none" stroke="${c}" stroke-width="${lw}" stroke-linejoin="round"/>` +
    `<path d="M${x} ${front}H${-x}" stroke="${c}" stroke-width="${frontW}" stroke-linecap="round"/>` +
    `</g>`;
}

function renderLadder(it) {
  const c = it.color;
  let s = `<g filter="url(#shadow)"><rect x="-45" y="-8" width="90" height="16" rx="1.5" fill="none" stroke="${c}" stroke-width="2"/>`;
  for (let x = -35; x <= 35; x += 10) s += `<line x1="${x}" y1="-8" x2="${x}" y2="8" stroke="${c}" stroke-width="2"/>`;
  return s + '</g>';
}

function renderText(it) {
  const c = it.color;
  return `<text font-size="20" font-weight="700" fill="${c}" stroke="${isLight(c) ? '#111827' : '#ffffff'}" stroke-opacity=".7" ` +
    `stroke-width="3" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" dominant-baseline="central" ${FONT}>${esc(it.label || '')}</text>`;
}

/* ---------- Pfeile ---------- */

const ARROW = { width: 3, head: 14, headWidth: 12, wave: 15, amp: 4.5, badgeOffset: 16, hit: 18 };

// Mindestgröße der Klickfläche; bei Touch-Bedienung vergrößert app.js beides
const HIT = { min: 24 };

// Pfeil-Arten: Linienstil + Spitze ergeben die Bedeutung
const ARROW_KINDS = {
  pass:    { name: 'Pass', line: 'solid', head: true },
  run:     { name: 'Laufweg', line: 'dashed', head: true },
  dribble: { name: 'Dribbling', line: 'wavy', head: true },
  line:    { name: 'Linie', line: 'solid', head: false },
};

function arrowKindKey(a) {
  if (a.head === false) return 'line';
  return { solid: 'pass', dashed: 'run', wavy: 'dribble' }[a.line] || 'pass';
}

const arrowKind = a => ARROW_KINDS[arrowKindKey(a)].name;

// Grundlinie als Punktliste: gerade oder quadratische Bézierkurve (Kontrollpunkt cx/cy)
function arrowBase(a) {
  if (!a.curved) return [[a.x1, a.y1], [a.x2, a.y2]];
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    pts.push([u * u * a.x1 + 2 * u * t * a.cx + t * t * a.x2, u * u * a.y1 + 2 * u * t * a.cy + t * t * a.y2]);
  }
  return pts;
}

// Punkt + Richtung an Bogenlänge d entlang einer Punktliste
function walker(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  function at(d) {
    d = Math.max(0, Math.min(total, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    return { x: x0 + dx * t, y: y0 + dy * t, tx: dx / L, ty: dy / L };
  }
  return { total, cum, at };
}

// Mittelpunkt auf der Linie (dort sitzt der Griff zum Biegen)
function arrowMid(a) {
  if (!a.curved) return { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2 };
  return { x: 0.25 * a.x1 + 0.5 * a.cx + 0.25 * a.x2, y: 0.25 * a.y1 + 0.5 * a.cy + 0.25 * a.y2 };
}

const pointsToD = arr => 'M' + arr.map(p => `${r2(p[0])} ${r2(p[1])}`).join('L');

// Grundlinie als SVG-Pfad (für Hervorhebung)
const arrowPathD = a => pointsToD(arrowBase(a));

// Nummer des Schritts: neben der Pfeilmitte, außen am Bogen bzw. oberhalb
function renderStepBadge(a, w) {
  const mid = w.at(w.total / 2);
  let nx = mid.ty, ny = -mid.tx;
  const m = arrowMid(a), bx = m.x - (a.x1 + a.x2) / 2, by = m.y - (a.y1 + a.y2) / 2;
  if (a.curved && Math.hypot(bx, by) > 3) {
    if (nx * bx + ny * by < 0) { nx = -nx; ny = -ny; }
  } else if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx > 0)) {
    nx = -nx; ny = -ny;
  }
  const x = r2(mid.x + nx * ARROW.badgeOffset), y = r2(mid.y + ny * ARROW.badgeOffset);
  const c = a.color, light = isLight(c), n = String(a.step);
  return `<g transform="translate(${x} ${y})">` +
    `<circle r="9.5" fill="${c}" stroke="${light ? INK : '#ffffff'}" stroke-width="1.6"/>` +
    `<text font-size="${n.length > 1 ? 10 : 11.5}" font-weight="700" fill="${light ? '#111827' : '#ffffff'}" text-anchor="middle" dominant-baseline="central" ${FONT}>${esc(n)}</text>` +
    `</g>`;
}

function renderArrow(a) {
  const pts = arrowBase(a);
  const w = walker(pts);
  const withHead = a.head !== false && w.total > 8;
  const headLen = Math.min(ARROW.head, w.total * 0.45);
  const end = withHead ? w.total - headLen * 0.75 : w.total;
  const line = [];

  if (a.line === 'wavy') {
    const waveAt = s => {
      const p = w.at(s);
      const taper = Math.max(0, Math.min(1, s / 8, (end - s) / 8));
      const off = Math.sin(s / ARROW.wave * 2 * Math.PI) * ARROW.amp * taper;
      return [p.x - p.ty * off, p.y + p.tx * off];
    };
    for (let s = 0; s < end; s += 1.5) line.push(waveAt(s));
    line.push(waveAt(end));
  } else {
    for (let i = 0; i < pts.length && w.cum[i] < end; i++) line.push(pts[i]);
    const p = w.at(end);
    line.push([p.x, p.y]);
  }

  const dashed = a.line === 'dashed';
  // unsichtbare, breite Linie als Klickfläche
  let s = `<path d="${pointsToD(pts)}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="${ARROW.hit}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${pointsToD(line)}" fill="none" stroke="${a.color}" stroke-width="${ARROW.width}" stroke-linecap="${dashed ? 'butt' : 'round'}" ` +
    `stroke-linejoin="round"${dashed ? ' stroke-dasharray="10 7"' : ''}/>`;

  if (withHead) {
    const tip = w.at(w.total), back = w.at(w.total - headLen);
    let ux = tip.x - back.x, uy = tip.y - back.y;
    const L = Math.hypot(ux, uy) || 1;
    ux /= L; uy /= L;
    const bx = tip.x - ux * headLen, by = tip.y - uy * headLen, hw = ARROW.headWidth / 2;
    s += `<polygon points="${r2(tip.x)},${r2(tip.y)} ${r2(bx - uy * hw)},${r2(by + ux * hw)} ${r2(bx + uy * hw)},${r2(by - ux * hw)}" ` +
      `fill="${a.color}" stroke="${a.color}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  if (a.step > 0) s += renderStepBadge(a, w);
  return s;
}

/* ---------- Typen ---------- */

const ITEM_TYPES = {
  player:   { name: 'Spieler', box: [34, 43], color: true, label: true, render: renderPlayer },
  ball:     { name: 'Ball', box: [17, 17], render: () => BALL_SVG },
  cone:     { name: 'Hütchen', box: [21, 26], color: true, render: renderCone },
  disc:     { name: 'Markierungsteller', box: [18, 18], color: true, render: renderDisc },
  pole:     { name: 'Stange', box: [12, 46], color: true, render: renderPole },
  minigoal: { name: 'Minitor', box: [36, 13], color: true, rotatable: true, render: it => renderGoal(it, 34, 10, 2, 3.2) },
  goal:     { name: 'Tor', box: [78, 22], color: true, rotatable: true, render: it => renderGoal(it, 74, 18, 2.6, 4.5) },
  ladder:   { name: 'Koordinationsleiter', box: [92, 18], color: true, rotatable: true, render: renderLadder },
  text:     { name: 'Text', box: it => [Math.max(30, String(it.label || '').length * 11.5 + 8), 28], color: true, label: true, rotatable: true, render: renderText },
  arrow:    { name: 'Pfeil', color: true, render: renderArrow },
};

// Zeichenreihenfolge: Bodenmaterial unten, dann Pfeile, Hütchen, Spieler, Ball, Text
const ITEM_RANK = { goal: 0, minigoal: 0, ladder: 0, disc: 0, arrow: 1, cone: 2, pole: 2, player: 3, ball: 4, text: 5 };

function boxOf(it) {
  const b = ITEM_TYPES[it.type].box;
  return typeof b === 'function' ? b(it) : b;
}

function itemName(it) {
  if (it.type === 'player') return TEAM_NAMES[it.team] || 'Spieler';
  if (it.type === 'arrow') return arrowKind(it);
  return ITEM_TYPES[it.type].name;
}

function renderItem(it) {
  const t = ITEM_TYPES[it.type];
  if (!t) return '';
  if (it.type === 'arrow') return `<g class="item" data-id="${it.id}">${t.render(it)}</g>`;
  const [w, h] = boxOf(it);
  const hw = Math.max(w, HIT.min) / 2, hh = Math.max(h, HIT.min) / 2;
  let tr = `translate(${r2(it.x)} ${r2(it.y)})`;
  if (it.rot) tr += ` rotate(${it.rot})`;
  if (it.scale && it.scale !== 1) tr += ` scale(${it.scale})`;
  // transparente Fläche: macht auch kleine Elemente gut greifbar
  return `<g class="item" data-id="${it.id}" transform="${tr}">` +
    `<rect x="${-hw}" y="${-hh}" width="${2 * hw}" height="${2 * hh}" fill="#000" fill-opacity="0"/>${t.render(it)}</g>`;
}

// Alle Elemente in Zeichenreihenfolge (für Spielfeld und Vorschaubilder)
function renderItemsMarkup(items) {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => ((ITEM_RANK[a.it.type] ?? 9) - (ITEM_RANK[b.it.type] ?? 9)) || a.i - b.i)
    .map(o => renderItem(o.it))
    .join('');
}

/* ---------- Legende ---------- */

const arrowEntry = (kind, curved) => () => ({
  type: 'arrow', line: ARROW_KINDS[kind].line, head: ARROW_KINDS[kind].head, curved, color: '#111827',
});

const LEGEND = [
  {
    title: 'Spieler', items: [
      { key: 'home', name: 'Spieler', preview: '7', make: () => ({ type: 'player', team: 'home', color: '#1d4ed8' }) },
      { key: 'away', name: 'Gegenspieler', preview: '9', make: () => ({ type: 'player', team: 'away', color: '#dc2626' }) },
      { key: 'gk', name: 'Torwart', preview: 'TW', make: () => ({ type: 'player', team: 'gk', color: '#facc15' }) },
      { key: 'neutral', name: 'Neutraler', preview: '', make: () => ({ type: 'player', team: 'neutral', color: '#9333ea' }) },
    ],
  },
  {
    title: 'Ball & Material', items: [
      { key: 'ball', name: 'Ball', make: () => ({ type: 'ball' }) },
      { key: 'cone', name: 'Hütchen', make: () => ({ type: 'cone', color: '#f97316' }) },
      { key: 'cone-y', name: 'Hütchen gelb', make: () => ({ type: 'cone', color: '#facc15' }) },
      { key: 'disc', name: 'Teller', make: () => ({ type: 'disc', color: '#1d4ed8' }) },
      { key: 'pole', name: 'Stange', make: () => ({ type: 'pole', color: '#facc15' }) },
      { key: 'minigoal', name: 'Minitor', make: () => ({ type: 'minigoal', color: '#ffffff' }) },
      { key: 'goal', name: 'Tor', make: () => ({ type: 'goal', color: '#ffffff' }) },
      { key: 'ladder', name: 'Leiter', make: () => ({ type: 'ladder', color: '#facc15' }) },
    ],
  },
  {
    title: 'Pfeile & Linien',
    note: 'Jeder Pfeil bekommt automatisch die nächste Schritt-Nummer. Gleiche Nummer = passiert gleichzeitig.',
    items: [
      { key: 'a-pass', name: 'Pass gerade', make: arrowEntry('pass', false) },
      { key: 'a-run', name: 'Laufweg gerade', make: arrowEntry('run', false) },
      { key: 'a-pass-c', name: 'Pass geschwungen', make: arrowEntry('pass', true) },
      { key: 'a-run-c', name: 'Laufweg geschwungen', make: arrowEntry('run', true) },
      { key: 'a-dribble', name: 'Dribbling', make: arrowEntry('dribble', false) },
      { key: 'a-line', name: 'Linie', make: arrowEntry('line', false) },
    ],
  },
  {
    title: 'Sonstiges', items: [
      { key: 'text', name: 'Text', make: () => ({ type: 'text', label: 'Text', color: '#ffffff' }) },
    ],
  },
];

const LEGEND_MAP = {};
LEGEND.forEach(sec => sec.items.forEach(en => { en.type = en.make().type; LEGEND_MAP[en.key] = en; }));

function previewItem(entry) {
  const it = Object.assign(entry.make(), { id: 'preview' });
  if (it.type === 'arrow') {
    Object.assign(it, { x1: -21, y1: 13, x2: 21, y2: -13 });
    if (it.curved) Object.assign(it, { cx: -17, cy: -19 });
  } else {
    it.x = 0; it.y = 0;
    if (it.type === 'player') it.label = entry.preview;
  }
  return it;
}

// Vorschau-Icon. Ohne pxPerUnit: für die Legende (Größe per CSS).
// Mit pxPerUnit: exakt so groß wie später auf dem Feld (Drag-Vorschau).
function previewSvg(entry, pxPerUnit) {
  const it = previewItem(entry);
  const isArrow = it.type === 'arrow';
  let e = 26;
  if (!isArrow) {
    const [w, h] = boxOf(it);
    e = Math.max(w, h) / 2 + 3;
    if (!pxPerUnit) e = Math.max(e, 24);
  }
  const size = pxPerUnit ? (isArrow ? 64 : 2 * e * pxPerUnit) : 0;
  const dim = size ? ` width="${r2(size)}" height="${r2(size)}"` : '';
  return `<svg viewBox="${-e} ${-e} ${2 * e} ${2 * e}"${dim} aria-hidden="true">${ITEM_TYPES[it.type].render(it)}</svg>`;
}
