/* =========================================================
   Spielfelder
   Maße in Metern. Jedes Feld wird so skaliert, dass die längere
   Seite (inkl. Rasenrand) 1000 SVG-Einheiten lang ist – dadurch
   wirken die Icons auf allen Feldern gleich groß.
   Neues Feld: einfach in FIELD_DEFS ergänzen.
   ========================================================= */

const FIELD_LINE = '#ffffff';
const FIELD_LW = 2.6;
const GRASS = ['#4c9a49', '#57a654'];

const r2 = n => Math.round(n * 100) / 100;

// Kreisbogen von Winkel a0 bis a1 (Grad, 0° = rechts, im Uhrzeigersinn)
function arcD(cx, cy, r, a0, a1) {
  const rad = Math.PI / 180;
  const x0 = r2(cx + r * Math.cos(a0 * rad)), y0 = r2(cy + r * Math.sin(a0 * rad));
  const x1 = r2(cx + r * Math.cos(a1 * rad)), y1 = r2(cy + r * Math.sin(a1 * rad));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function corners(d, w, h) {
  d.arc(0, 0, 1, 0, 90);
  d.arc(w, 0, 1, 90, 180);
  d.arc(w, h, 1, 180, 270);
  d.arc(0, h, 1, 270, 360);
}

// Strafraum mit Tor am oberen Rand (für hochkant dargestellte Felder)
function topPenaltyArea(d, cx) {
  d.rect(cx - 20.16, 0, 40.32, 16.5);
  d.rect(cx - 9.16, 0, 18.32, 5.5);
  d.spot(cx, 11);
  d.arc(cx, 11, 9.15, 36.87, 143.13);
  d.goal(cx - 3.66, -2, 7.32, 2);
}

// Strafraum mit Tor am unteren Rand (Feldtiefe h)
function bottomPenaltyArea(d, cx, h) {
  d.rect(cx - 20.16, h - 16.5, 40.32, 16.5);
  d.rect(cx - 9.16, h - 5.5, 18.32, 5.5);
  d.spot(cx, h - 11);
  d.arc(cx, h - 11, 9.15, 216.87, 323.13);
  d.goal(cx - 3.66, h, 7.32, 2);
}

const FIELD_DEFS = [
  {
    id: 'full', name: 'Ganzes Feld', w: 105, h: 68, margin: 4, stripes: 'v', stripe: 5.25,
    draw(d) {
      d.rect(0, 0, 105, 68);
      d.line(52.5, 0, 52.5, 68);
      d.circle(52.5, 34, 9.15);
      d.spot(52.5, 34);
      // links
      d.rect(0, 13.84, 16.5, 40.32);
      d.rect(0, 24.84, 5.5, 18.32);
      d.spot(11, 34);
      d.arc(11, 34, 9.15, -53.13, 53.13);
      d.goal(-2, 30.34, 2, 7.32);
      // rechts
      d.rect(88.5, 13.84, 16.5, 40.32);
      d.rect(99.5, 24.84, 5.5, 18.32);
      d.spot(94, 34);
      d.arc(94, 34, 9.15, 126.87, 233.13);
      d.goal(105, 30.34, 2, 7.32);
      corners(d, 105, 68);
    },
  },
  {
    id: 'full-v', name: 'Ganzes Feld hochkant', w: 68, h: 105, margin: 4, stripes: 'h', stripe: 5.25,
    draw(d) {
      d.rect(0, 0, 68, 105);
      d.line(0, 52.5, 68, 52.5);
      d.circle(34, 52.5, 9.15);
      d.spot(34, 52.5);
      topPenaltyArea(d, 34);
      bottomPenaltyArea(d, 34, 105);
      corners(d, 68, 105);
    },
  },
  {
    id: 'half', name: 'Halbes Feld', w: 68, h: 52.5, margin: 4, stripes: 'h', stripe: 5.25,
    draw(d) {
      d.rect(0, 0, 68, 52.5);
      topPenaltyArea(d, 34);
      d.arc(34, 52.5, 9.15, 180, 360);
      d.spot(34, 52.5);
      d.arc(0, 0, 1, 0, 90);
      d.arc(68, 0, 1, 90, 180);
    },
  },
  {
    id: 'box', name: 'Strafraum', w: 68, h: 30, margin: 4, stripes: 'h', stripe: 5.25,
    draw(d) {
      d.line(0, 0, 68, 0);
      d.line(0, 0, 0, 34);
      d.line(68, 0, 68, 34);
      topPenaltyArea(d, 34);
      d.arc(0, 0, 1, 0, 90);
      d.arc(68, 0, 1, 90, 180);
    },
  },
  {
    id: 'small', name: 'Kleinfeld 7 gegen 7', w: 55, h: 35, margin: 3, stripes: 'v', stripe: 5.5,
    draw(d) {
      d.rect(0, 0, 55, 35);
      d.line(27.5, 0, 27.5, 35);
      d.circle(27.5, 17.5, 6);
      d.spot(27.5, 17.5);
      d.rect(0, 5.5, 11, 24);
      d.spot(8, 17.5);
      d.goal(-1.5, 15, 1.5, 5);
      d.rect(44, 5.5, 11, 24);
      d.spot(47, 17.5);
      d.goal(55, 15, 1.5, 5);
      corners(d, 55, 35);
    },
  },
  {
    id: 'funino', name: 'Funino', w: 32, h: 25, margin: 2.5, stripes: 'v', stripe: 4,
    draw(d) {
      d.rect(0, 0, 32, 25);
      d.line(6, 0, 6, 25, true);   // Schusszonen
      d.line(26, 0, 26, 25, true);
      d.goal(-1, 4.25, 1, 1.5);
      d.goal(-1, 19.25, 1, 1.5);
      d.goal(32, 4.25, 1, 1.5);
      d.goal(32, 19.25, 1, 1.5);
    },
  },
  {
    id: 'grass', name: 'Freie Fläche', w: 40, h: 28, margin: 0, stripes: 'v', stripe: 5,
    draw() {},
  },
];

function buildField(def) {
  const m = def.margin || 0;
  const tw = def.w + 2 * m, th = def.h + 2 * m;
  const s = 1000 / Math.max(tw, th);
  const W = r2(tw * s), H = r2(th * s);
  const P = v => r2((v + m) * s);   // Position in Metern → Einheiten
  const L = v => r2(v * s);         // Länge in Metern → Einheiten
  const st = `class="fl" fill="none" stroke="${FIELD_LINE}" stroke-width="${FIELD_LW}"`;
  const out = [];

  const d = {
    rect: (x, y, w, h) => out.push(`<rect x="${P(x)}" y="${P(y)}" width="${L(w)}" height="${L(h)}" ${st}/>`),
    line: (x1, y1, x2, y2, dashed) => out.push(
      `<line x1="${P(x1)}" y1="${P(y1)}" x2="${P(x2)}" y2="${P(y2)}" ${st}${dashed ? ' stroke-dasharray="10 8"' : ''}/>`),
    circle: (cx, cy, r) => out.push(`<circle cx="${P(cx)}" cy="${P(cy)}" r="${L(r)}" ${st}/>`),
    arc: (cx, cy, r, a0, a1) => out.push(`<path d="${arcD(P(cx), P(cy), L(r), a0, a1)}" ${st}/>`),
    spot: (cx, cy) => out.push(`<circle cx="${P(cx)}" cy="${P(cy)}" r="${Math.max(3.2, L(0.25))}" fill="${FIELD_LINE}"/>`),
    goal: (x, y, w, h) => out.push(
      `<rect class="fl" x="${P(x)}" y="${P(y)}" width="${L(w)}" height="${L(h)}" fill="url(#net)" stroke="${FIELD_LINE}" stroke-width="${FIELD_LW}"/>`),
  };

  // Rasen mit Mähstreifen
  const grass = [`<rect width="${W}" height="${H}" fill="${GRASS[0]}"/>`];
  const alongX = def.stripes !== 'h';
  const len = alongX ? def.w : def.h, max = alongX ? W : H, sw = def.stripe;
  for (let i = Math.floor(-m / sw); i < Math.ceil((len + m) / sw); i++) {
    if (((i % 2) + 2) % 2 === 0) continue;
    const a = Math.max(0, P(i * sw)), b = Math.min(max, P((i + 1) * sw));
    if (b <= a) continue;
    grass.push(alongX
      ? `<rect x="${a}" y="0" width="${r2(b - a)}" height="${H}" fill="${GRASS[1]}"/>`
      : `<rect x="0" y="${a}" width="${W}" height="${r2(b - a)}" fill="${GRASS[1]}"/>`);
  }

  def.draw(d);
  return { id: def.id, name: def.name, width: W, height: H, svg: grass.join('') + out.join('') };
}

const FIELDS = FIELD_DEFS.map(buildField);
const FIELD_MAP = Object.fromEntries(FIELDS.map(f => [f.id, f]));
