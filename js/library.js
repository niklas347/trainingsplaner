/* =========================================================
   Übungsbibliothek: Speicherung im Browser, Import/Export
   und die Übersichtsseite mit allen Übungen.
   Felder angelehnt an die Obsidian-Übungsdatenbank.
   ========================================================= */

const LIB_KEY = 'trainingsplaner.library.v1';
const OLD_KEY = 'trainingsplaner.v1';   // Version 1: nur eine einzelne Übung

const CATEGORIES = ['Aufwärmen', 'Technik', 'Taktik', 'Spielform', 'Athletik'];
const GOALS = ['Passspiel', 'Dribbling', 'Torschuss', 'Ballannahme', 'Umschalten', 'Ballgewinn', 'Kopfball', 'Zweikampf', 'Positionsspiel', 'Koordination'];
const INTENSITIES = ['niedrig', 'mittel', 'hoch'];
const META_FIELDS = ['category', 'goal', 'players', 'duration', 'intensity', 'setup', 'coaching'];

const HEX = /^#[0-9a-f]{6}$/i;
const validId = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
const newId =() => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const itemId = () => 'i' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);

function emptyDrill(fieldId) {
  const now = Date.now();
  const d = { id: newId(), title: '', fieldId: fieldId || FIELDS[0].id, items: [], created: now, updated: now };
  META_FIELDS.forEach(k => { d[k] = ''; });
  return d;
}

function isEmptyDrill(d) {
  return !d.items.length && !d.title.trim() && META_FIELDS.every(k => !String(d[k] || '').trim());
}

// Inhalt ohne Zeitstempel – zum Erkennen echter Änderungen
function drillContent(d) {
  const { created, updated, ...rest } = d;
  return JSON.stringify(rest);
}

function sanitizeItem(i, seen) {
  const out = { ...i };
  out.id = validId(i.id) && !seen.has(i.id) ? i.id : itemId();
  seen.add(out.id);
  if ('color' in out && !(typeof out.color === 'string' && HEX.test(out.color))) out.color = '#ffffff';
  for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'rot', 'scale', 'step']) {
    if (k in out) out[k] = Number(out[k]) || 0;
  }
  if (out.scale === 0) out.scale = 1;
  if ('label' in out) out.label = String(out.label).slice(0, 40);
  if (out.type === 'player' && !TEAM_NAMES[out.team]) out.team = 'home';
  if (out.type === 'arrow') {
    if (!['solid', 'dashed', 'wavy'].includes(out.line)) out.line = 'solid';
    out.curved = !!out.curved && 'cx' in out && 'cy' in out;
    out.head = out.head !== false;
    if (!(out.step > 0)) delete out.step;
    if (typeof out.note === 'string') out.note = out.note.slice(0, 300); else delete out.note;
  }
  return out;
}

// legacy = Datei aus Version 1: Pfeile bekommen Schritt-Nummern in Zeichenreihenfolge
function sanitizeDrill(d, legacy = false) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.items)) return null;
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const seen = new Set();
  const drill = {
    id: validId(d.id) ? d.id : newId(),
    title: str(d.title, 120),
    fieldId: FIELD_MAP[d.fieldId] ? d.fieldId : FIELDS[0].id,
    items: d.items.filter(i => i && ITEM_TYPES[i.type]).map(i => sanitizeItem(i, seen)),
    category: str(d.category, 40),
    goal: str(d.goal, 80),
    players: str(d.players, 40),
    duration: str(d.duration, 40),
    intensity: INTENSITIES.includes(d.intensity) ? d.intensity : '',
    setup: str(d.setup, 4000),
    coaching: str(d.coaching, 4000),
    created: Number(d.created) || Date.now(),
    updated: Number(d.updated) || Date.now(),
  };
  if (legacy && !drill.items.some(hasStep)) {
    let n = 0;
    drill.items.forEach(it => { if (it.type === 'arrow' && it.head !== false) it.step = ++n; });
  }
  normalizeSteps(drill.items);
  return drill;
}

function loadLibrary() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LIB_KEY)); } catch (e) { /* kein Zugriff */ }
  const lib = { currentId: null, drills: [] };
  if (raw && Array.isArray(raw.drills)) {
    lib.drills = raw.drills.map(d => sanitizeDrill(d)).filter(Boolean);
    lib.currentId = raw.currentId || null;
  } else {
    // Umzug aus Version 1
    try {
      const old = sanitizeDrill(JSON.parse(localStorage.getItem(OLD_KEY)), true);
      if (old && !isEmptyDrill(old)) { lib.drills.push(old); lib.currentId = old.id; }
    } catch (e) { /* nichts zu übernehmen */ }
  }
  return lib;
}

// Wirft bei vollem oder gesperrtem Speicher – der Aufrufer zeigt das an
function writeLibrary(lib) {
  localStorage.setItem(LIB_KEY, JSON.stringify(lib));
  try { localStorage.removeItem(OLD_KEY); } catch (e) { /* egal */ }
}

// Akzeptiert: einzelne Übung (neu oder Version 1) oder ein komplettes Backup
function parseImport(data) {
  if (!data || typeof data !== 'object') return [];
  const legacy = !(data.version >= 2);
  if (Array.isArray(data.drills)) return data.drills.map(d => sanitizeDrill(d, legacy)).filter(Boolean);
  const d = sanitizeDrill(data, legacy);
  return d ? [d] : [];
}

const drillFileData = d => ({ app: 'trainingsplaner', version: 2, ...d });
const backupFileData = drills => ({ app: 'trainingsplaner', version: 2, type: 'backup', exported: Date.now(), drills });

function metaLine(d) {
  return [d.category, d.goal, d.players && `${d.players} Spieler`, d.duration, d.intensity && `Intensität ${d.intensity}`]
    .filter(Boolean).join(' · ');
}

/* ---------- Übersichtsseite ----------
   api: { drills, currentId, flush(), open(id), create(), remove(id), duplicate(id), exportDrill(id), exportAll(), importFile() } */

function createLibraryView(api) {
  const root = document.getElementById('library');
  const grid = document.getElementById('libGrid');
  const filters = document.getElementById('libFilters');
  const search = document.getElementById('libSearch');
  let category = '';

  const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function thumb(d) {
    const f = FIELD_MAP[d.fieldId] || FIELDS[0];
    return `<svg viewBox="0 0 ${f.width} ${f.height}" aria-hidden="true">${f.svg}${renderItemsMarkup(d.items)}</svg>`;
  }

  function matches(d, q) {
    if (category && (d.category || '') !== category) return false;
    if (!q) return true;
    const text = [d.title, d.category, d.goal, d.setup, d.coaching, ...d.items.map(i => i.note || '')].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => text.includes(w));
  }

  function renderFilters(drills) {
    const counts = {};
    drills.forEach(d => { if (d.category) counts[d.category] = (counts[d.category] || 0) + 1; });
    const cats = [...new Set([...CATEGORIES, ...Object.keys(counts)])];
    if (category && !cats.includes(category)) category = '';
    filters.innerHTML = [`<button type="button" class="chip${category ? '' : ' on'}" data-cat="">Alle <span>${drills.length}</span></button>`]
      .concat(cats.map(c => `<button type="button" class="chip${category === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)} <span>${counts[c] || 0}</span></button>`))
      .join('');
  }

  function render() {
    const drills = [...api.drills].sort((a, b) => b.updated - a.updated);
    renderFilters(drills);
    const q = search.value.trim().toLowerCase();
    const shown = drills.filter(d => matches(d, q));
    if (!drills.length) {
      grid.innerHTML = `<div class="lib-empty"><p><b>Noch keine Übungen gespeichert.</b></p><p>Alles, was du zeichnest, landet automatisch hier. Starte mit „Neue Übung“.</p></div>`;
      return;
    }
    if (!shown.length) {
      grid.innerHTML = `<div class="lib-empty"><p>Keine Übung passt zu deiner Suche.</p></div>`;
      return;
    }
    grid.innerHTML = shown.map(d => {
      const steps = stepGroups(d.items).length;
      const info = [d.duration, steps ? `${steps} Schritt${steps === 1 ? '' : 'e'}` : '', `geändert ${fmtDate(d.updated)}`].filter(Boolean).join(' · ');
      return `<article class="card${d.id === api.currentId ? ' current' : ''}" data-id="${d.id}" tabindex="0">` +
        `<div class="thumb">${thumb(d)}${d.id === api.currentId ? '<span class="badge-open">geöffnet</span>' : ''}</div>` +
        `<div class="card-body"><h3>${esc(d.title || 'Unbenannte Übung')}</h3>` +
        `<div class="card-tags">${d.category ? `<span class="tag">${esc(d.category)}</span>` : ''}${d.goal ? `<span class="tag light">${esc(d.goal)}</span>` : ''}</div>` +
        `<p class="card-info">${esc(info)}</p></div>` +
        `<div class="card-actions">` +
        `<button type="button" class="btn icon" data-act="duplicate" title="Duplizieren">${icon('copy')}</button>` +
        `<button type="button" class="btn icon" data-act="export" title="Als Datei exportieren (zum Teilen)">${icon('download')}</button>` +
        `<button type="button" class="btn icon danger" data-act="remove" title="Löschen">${icon('trash')}</button>` +
        `</div></article>`;
    }).join('');
  }

  function open() {
    api.flush();
    root.hidden = false;
    document.body.classList.add('lib-open');
    render();
  }

  function close() {
    root.hidden = true;
    document.body.classList.remove('lib-open');
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    const b = e.target.closest('button[data-act]');
    if (!b) { api.open(id); close(); return; }
    const act = b.dataset.act;
    if (act === 'duplicate') api.duplicate(id);
    else if (act === 'export') api.exportDrill(id);
    else if (act === 'remove') {
      const d = api.drills.find(x => x.id === id);
      if (!d || !confirm(`„${d.title || 'Unbenannte Übung'}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
      api.remove(id);
    }
    render();
  });

  grid.addEventListener('keydown', e => {
    const card = e.target.closest('.card');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); api.open(card.dataset.id); close(); }
  });

  filters.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    if (!c) return;
    category = c.dataset.cat;
    render();
  });

  search.addEventListener('input', render);
  document.getElementById('libClose').addEventListener('click', close);
  document.getElementById('libNew').addEventListener('click', () => { api.create(); close(); });
  document.getElementById('libImport').addEventListener('click', () => api.importFile());
  document.getElementById('libBackup').addEventListener('click', () => api.exportAll());

  return { open, close, render, isOpen: () => !root.hidden };
}
