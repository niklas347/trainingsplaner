/* =========================================================
   Trainingsplaner – Editor, Bedienung und Zusammenspiel
   der Teile (Spielfeld, Legende, Ablauf, Bibliothek)
   ========================================================= */
(function () {
  'use strict';

  const SELECT_COLOR = '#2563eb';
  const PANEL_KEY = 'trainingsplaner.panel';

  // Finger statt Maus: größere Griffe und Klickflächen
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  const HANDLE_PX = TOUCH ? 13 : 7, ROT_PX = TOUCH ? 30 : 20;
  if (TOUCH) { HIT.min = 44; ARROW.hit = 32; }

  const $ = id => document.getElementById(id);
  const board = $('board'), fieldLayer = $('fieldLayer'), hoverLayer = $('hoverLayer'), itemLayer = $('itemLayer'), uiLayer = $('uiLayer');
  const boardWrap = $('boardWrap'), contextBar = $('contextBar'), legendEl = $('legend'), fieldPicker = $('fieldPicker');
  const titleInput = $('title'), fileInput = $('fileInput'), detailsForm = $('detailsForm'), saveStatus = $('saveStatus');

  /* ---------- Zustand ---------- */

  let library = { currentId: null, drills: [] };   // alle Übungen
  let state = emptyDrill();                          // die geöffnete Übung
  let selectedId = null;   // ausgewähltes Element
  let hoverId = null;      // in der Ablauf-Liste überfahrener Pfeil
  let tool = null;         // aktives Legenden-Element (Klick-zum-Platzieren)
  let drag = null;         // laufende Zieh-Aktion auf dem Feld
  let ldrag = null;        // laufende Zieh-Aktion aus der Legende
  let inputUndoArmed = true;
  const undoStack = [], redoStack = [];

  const clone = o => JSON.parse(JSON.stringify(o));
  const field = () => FIELD_MAP[state.fieldId] || FIELDS[0];
  const byId = id => state.items.find(i => i.id === id);
  const selected = () => (selectedId ? byId(selectedId) || null : null);

  function clampPt(p) {
    const f = field();
    return { x: Math.min(f.width, Math.max(0, p.x)), y: Math.min(f.height, Math.max(0, p.y)) };
  }

  function toSvg(e) {
    const m = board.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function unitsPerPx() {
    const m = board.getScreenCTM();
    return m && m.a ? 1 / m.a : 1;
  }

  /* ---------- Rückgängig / Wiederholen (nur Zeichnung, nicht Name/Details) ---------- */

  const snapshot = () => JSON.stringify({ fieldId: state.fieldId, items: state.items });

  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  function restore(snap) {
    Object.assign(state, JSON.parse(snap));
    if (!selected()) selectedId = null;
    renderAll();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }

  function updateHistoryButtons() {
    $('btnUndo').disabled = !undoStack.length;
    $('btnRedo').disabled = !redoStack.length;
  }

  /* ---------- Speichern (automatisch, im Browser) ---------- */

  let saveTimer = null;
  let lastContent = '';

  function setStatus(ok) {
    saveStatus.classList.toggle('error', !ok);
    saveStatus.innerHTML = ok ? `${icon('check')}<span>Gespeichert</span>` : `${icon('alert')}<span>Nicht gespeichert</span>`;
    saveStatus.title = ok
      ? 'Alles wird automatisch in diesem Browser gespeichert.'
      : 'Der Browser-Speicher ist voll oder gesperrt. Bitte in der Bibliothek ein Backup speichern.';
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const content = drillContent(state);
    if (content !== lastContent) { state.updated = Date.now(); lastContent = content; }
    const idx = library.drills.findIndex(d => d.id === state.id);
    if (idx >= 0) library.drills[idx] = state;
    else if (!isEmptyDrill(state)) library.drills.push(state);
    library.currentId = state.id;
    try { writeLibrary(library); setStatus(true); } catch (e) { setStatus(false); }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  /* ---------- Übungen öffnen, anlegen, löschen ---------- */

  function openDrill(drill, saveCurrent = true) {
    if (saveCurrent) {
      persist();
      if (isEmptyDrill(state)) library.drills = library.drills.filter(d => d.id !== state.id);
    }
    state = clone(drill);
    lastContent = drillContent(state);
    undoStack.length = 0;
    redoStack.length = 0;
    selectedId = null;
    hoverId = null;
    drag = null;
    if (tool) setTool(null);
    titleInput.value = state.title;
    renderDetails();
    renderAll();
    persist();
  }

  function newestDrill() {
    return [...library.drills].sort((a, b) => b.updated - a.updated)[0] || null;
  }

  const libraryApi = {
    get drills() { return library.drills; },
    get currentId() { return state.id; },
    flush: persist,
    open(id) {
      const d = library.drills.find(x => x.id === id);
      if (d && d.id !== state.id) openDrill(d);
    },
    create() { openDrill(emptyDrill(state.fieldId)); },
    remove(id) {
      library.drills = library.drills.filter(d => d.id !== id);
      if (id === state.id) openDrill(newestDrill() || emptyDrill(state.fieldId), false);
      else persist();
    },
    duplicate(id) {
      persist();
      const src = library.drills.find(d => d.id === id);
      if (!src) return;
      const copy = clone(src);
      copy.id = newId();
      copy.title = (src.title || 'Unbenannte Übung') + ' (Kopie)';
      copy.created = copy.updated = Date.now();
      library.drills.push(copy);
      persist();
    },
    exportDrill(id) {
      persist();
      const d = library.drills.find(x => x.id === id);
      if (d) download(new Blob([JSON.stringify(drillFileData(d), null, 2)], { type: 'application/json' }), fileName(d.title, 'json'));
    },
    exportAll() {
      persist();
      const date = new Date().toISOString().slice(0, 10);
      download(new Blob([JSON.stringify(backupFileData(library.drills), null, 2)], { type: 'application/json' }), `Trainingsplaner-Backup-${date}.json`);
    },
    importFile() { fileInput.click(); },
  };

  // Import führt über die Kennung (id) zusammen: Vorhandene Übungen werden aktualisiert,
  // wenn die importierte Version neuer ist – sonst übersprungen. So entstehen keine Doppelten.
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let drills = [];
    try { drills = parseImport(JSON.parse(await file.text())); } catch (e) { drills = []; }
    if (!drills.length) {
      alert('Die Datei konnte nicht geladen werden. Ist es eine Übung oder ein Backup aus dem Trainingsplaner (.json)?');
      return;
    }

    persist();   // geöffnete Übung sichern, damit ihr Änderungsdatum stimmt
    const added = [], updated = [], kept = [];
    let openReplaced = null;
    for (const d of drills) {
      const idx = library.drills.findIndex(x => x.id === d.id);
      if (idx < 0) {
        library.drills.push(d);
        added.push(d);
      } else if (d.updated > library.drills[idx].updated) {
        library.drills[idx] = d;
        updated.push(d);
        if (d.id === state.id) openReplaced = d;
      } else {
        kept.push(d);
      }
    }
    if (openReplaced) openDrill(openReplaced, false); else persist();

    if (drills.length === 1) {
      if (kept.length) { alert('Diese Übung ist hier schon auf dem neuesten Stand – nichts geändert.'); return; }
      if (drills[0].id !== state.id) openDrill(drills[0]);
      libraryView.close();
      if (updated.length) alert('Übung aktualisiert (neuere Version importiert).');
      return;
    }
    libraryView.render();
    alert(`Import abgeschlossen:\n• ${added.length} neu hinzugefügt\n• ${updated.length} aktualisiert (neuere Version)\n` +
      `• ${kept.length} übersprungen (hier schon gleich oder neuer)`);
  });

  /* ---------- Darstellung ---------- */

  let shownField = null;
  function renderField() {
    const f = field();
    if (shownField === f.id) return;
    shownField = f.id;
    board.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
    fieldLayer.innerHTML = f.svg;
    fieldPicker.querySelectorAll('.field-btn').forEach(b => b.classList.toggle('active', b.dataset.field === f.id));
  }

  // Auswahlrahmen, Griffe und Hervorhebung (immer gleich groß auf dem Bildschirm)
  function renderUI() {
    const k = unitsPerPx();
    const hv = hoverId && byId(hoverId);
    hoverLayer.innerHTML = hv && hv.type === 'arrow'
      ? `<path d="${arrowPathD(hv)}" fill="none" stroke="#fde047" stroke-opacity=".75" stroke-width="${r2(14 * k)}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`
      : '';

    const it = selected();
    if (!it) { uiLayer.innerHTML = ''; return; }
    const handle = (name, x, y, filled) =>
      `<circle class="handle" data-handle="${name}" cx="${r2(x)}" cy="${r2(y)}" r="${r2(HANDLE_PX * k)}" ` +
      `fill="${filled ? SELECT_COLOR : '#fff'}" stroke="${filled ? '#fff' : SELECT_COLOR}" stroke-width="${r2(2 * k)}"/>`;
    let s = '';
    if (it.type === 'arrow') {
      const m = arrowMid(it);
      s += handle('p1', it.x1, it.y1) + handle('p2', it.x2, it.y2) + handle('mid', m.x, m.y, true);
    } else {
      const [w, h] = boxOf(it), sc = it.scale || 1, pad = 5 * k;
      const bw = w * sc + 2 * pad, bh = h * sc + 2 * pad;
      const rotatable = ITEM_TYPES[it.type].rotatable;
      s += `<g transform="translate(${r2(it.x)} ${r2(it.y)}) rotate(${it.rot || 0})" pointer-events="none">` +
        `<rect x="${r2(-bw / 2)}" y="${r2(-bh / 2)}" width="${r2(bw)}" height="${r2(bh)}" rx="${r2(4 * k)}" fill="none" ` +
        `stroke="${SELECT_COLOR}" stroke-width="${r2(1.5 * k)}" stroke-dasharray="${r2(5 * k)} ${r2(4 * k)}"/>` +
        (rotatable ? `<line x1="0" y1="${r2(-bh / 2)}" x2="0" y2="${r2(-bh / 2 - ROT_PX * k)}" stroke="${SELECT_COLOR}" stroke-width="${r2(1.5 * k)}"/>` : '') +
        `</g>`;
      if (rotatable) {
        const d = bh / 2 + ROT_PX * k, a = (it.rot || 0) * Math.PI / 180;
        s += handle('rot', it.x + d * Math.sin(a), it.y - d * Math.cos(a));
      }
    }
    uiLayer.innerHTML = s;
  }

  function render() {
    renderField();
    itemLayer.innerHTML = renderItemsMarkup(state.items);
    renderUI();
    stepsPanel.render();
    scheduleSave();
  }

  function renderAll() {
    render();
    renderContextBar();
    renderLegendActive();
    updateHistoryButtons();
  }

  /* ---------- Kontextleiste (Eigenschaften des ausgewählten Elements) ---------- */

  const group = (label, inner) => `<div class="cb-group"><span class="cb-label">${label}</span>${inner}</div>`;
  const seg = (prop, opts, cur) => `<div class="seg">${opts.map(([v, l]) =>
    `<button type="button" data-seg="${prop}" data-val="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  function renderContextBar() {
    closeColorPop();
    if (tool) {
      const en = LEGEND_MAP[tool];
      const how = en.type === 'arrow'
        ? 'Auf dem Feld ziehen, um zu zeichnen (oder antippen für einen Standardpfeil).'
        : 'Auf das Feld klicken, um es zu platzieren – beliebig oft.';
      contextBar.innerHTML = `<span class="cb-tool">${previewSvg(en)}<b>${esc(en.name)}</b></span>` +
        `<span class="cb-hint">${how}</span><span class="cb-spacer"></span>` +
        `<button class="btn primary" data-act="endTool">Fertig <kbd>Esc</kbd></button>`;
      return;
    }
    const it = selected();
    if (!it) {
      contextBar.innerHTML = `<span class="cb-hint">Elemente aus der Legende aufs Feld <b>ziehen</b> – oder <b>antippen</b> und aufs Feld klicken. ` +
        `Anklicken zum Bearbeiten.</span>`;
      return;
    }
    const t = ITEM_TYPES[it.type];
    let html = `<span class="cb-title">${esc(itemName(it))}</span>`;
    if (it.type === 'arrow') {
      html += group('Schritt', `<input class="cb-input num" type="number" min="1" max="99" data-prop="step" value="${it.step || ''}" placeholder="–" ` +
        `title="Leer lassen = ohne Nummer · gleiche Nummer wie ein anderer Pfeil = gleichzeitig">`);
      html += seg('kind', Object.entries(ARROW_KINDS).map(([k, v]) => [k, v.name]), arrowKindKey(it));
      html += seg('curved', [[false, 'Gerade'], [true, 'Bogen']], !!it.curved);
    }
    if (t.label) {
      html += group(it.type === 'player' ? 'Nr.' : 'Text', `<input class="cb-input${it.type === 'text' ? ' wide' : ''}" data-prop="label" value="${esc(it.label || '')}" ` +
        `maxlength="${it.type === 'text' ? 40 : 12}" autocomplete="off">`);
    }
    if (t.color) html += `<button type="button" class="color-btn" data-act="color" style="--c:${it.color}" title="Farbe ändern"></button>`;
    if (it.type !== 'arrow') html += group('Größe', `<input type="range" min="0.6" max="2" step="0.1" value="${it.scale || 1}" data-prop="scale">`);
    if (t.rotatable) html += `<button class="btn icon" data-act="rotate" title="Um 90° drehen">${icon('rotate')}</button>`;
    html += `<span class="cb-spacer"></span>` +
      `<button class="btn icon" data-act="duplicate" title="Duplizieren (Strg+D)">${icon('copy')}</button>` +
      `<button class="btn icon danger" data-act="delete" title="Löschen (Entf)">${icon('trash')}</button>`;
    contextBar.innerHTML = html;
  }

  // Farbauswahl als kleines Aufklapp-Feld
  let colorPop = null;
  function closeColorPop() {
    if (colorPop) { colorPop.remove(); colorPop = null; }
  }
  function openColorPop(btn) {
    const it = selected();
    if (!it) return;
    const r = btn.getBoundingClientRect();
    colorPop = document.createElement('div');
    colorPop.className = 'color-pop';
    colorPop.innerHTML = SWATCHES.map(s =>
      `<button type="button" class="swatch${s.c === it.color ? ' active' : ''}" data-color="${s.c}" style="--c:${s.c}" title="${s.n}"></button>`).join('');
    colorPop.style.left = `${Math.max(8, Math.min(r.left - 8, innerWidth - 160))}px`;
    colorPop.style.top = `${r.bottom + 6}px`;
    colorPop.addEventListener('click', e => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      if (it.color !== b.dataset.color) {
        pushUndo();
        it.color = b.dataset.color;
        render();
      }
      renderContextBar();
    });
    document.body.appendChild(colorPop);
  }
  document.addEventListener('pointerdown', e => {
    if (colorPop && !colorPop.contains(e.target) && !e.target.closest('[data-act="color"]')) closeColorPop();
  }, true);

  contextBar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'endTool') { setTool(null); return; }
    const it = selected();
    if (!it) return;
    const act = b.dataset.act;
    if (act === 'color') { if (colorPop) closeColorPop(); else openColorPop(b); return; }
    if (act === 'duplicate') { duplicateSelected(); return; }
    if (act === 'delete') { deleteSelected(); return; }
    if (act === 'rotate') {
      pushUndo();
      it.rot = ((it.rot || 0) + 90) % 360;
    } else if (b.dataset.seg === 'kind') {
      const key = b.dataset.val;
      if (arrowKindKey(it) === key) return;
      pushUndo();
      const kind = ARROW_KINDS[key];
      it.line = kind.line;
      it.head = kind.head;
      // Linien gehören nicht zum Ablauf, Pfeile schon
      if (!kind.head) delete it.step;
      else if (!hasStep(it)) it.step = maxStep(state.items) + 1;
      normalizeSteps(state.items);
    } else if (b.dataset.seg === 'curved') {
      const v = b.dataset.val === 'true';
      if (!!it.curved === v) return;
      pushUndo();
      it.curved = v;
      if (v) defaultBend(it);
    } else {
      return;
    }
    render();
    renderContextBar();
  });

  contextBar.addEventListener('focusin', e => { if (e.target.dataset.prop) inputUndoArmed = true; });
  contextBar.addEventListener('input', e => {
    const el = e.target, prop = el.dataset.prop, it = selected();
    if (!prop || !it) return;
    if (inputUndoArmed) { pushUndo(); inputUndoArmed = false; }
    if (prop === 'step') {
      const n = parseInt(el.value, 10);
      if (n > 0) it.step = n; else delete it.step;
    } else {
      it[prop] = prop === 'scale' ? parseFloat(el.value) : el.value;
    }
    render();
  });
  contextBar.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset.prop) return;
    inputUndoArmed = true;
    if (el.dataset.prop === 'step') {
      // erst nach dem Tippen lückenlos durchnummerieren
      normalizeSteps(state.items);
      const it = selected();
      el.value = it && it.step ? it.step : '';
      render();
    }
  });

  /* ---------- Element-Aktionen ---------- */

  function nextNumber(team) {
    if (team === 'gk') return 'TW';
    if (team === 'neutral') return '';
    const nums = state.items
      .filter(i => i.type === 'player' && i.team === team)
      .map(i => parseInt(i.label, 10))
      .filter(n => !isNaN(n));
    return String(nums.length ? Math.max(...nums) + 1 : 1);
  }

  function defaultBend(it) {
    const dx = it.x2 - it.x1, dy = it.y2 - it.y1;
    it.cx = (it.x1 + it.x2) / 2 + dy * 0.4;
    it.cy = (it.y1 + it.y2) / 2 - dx * 0.4;
  }

  function setArrowEnds(it, a, b) {
    it.x1 = a.x; it.y1 = a.y; it.x2 = b.x; it.y2 = b.y;
    if (it.curved) defaultBend(it);
  }

  function addItem(entry, p) {
    const it = Object.assign({ id: itemId() }, entry.make());
    if (it.type === 'arrow') {
      setArrowEnds(it, { x: p.x - 80, y: p.y }, { x: p.x + 80, y: p.y });
      if (it.head !== false) it.step = maxStep(state.items) + 1;   // nächster Schritt
    } else {
      it.x = p.x; it.y = p.y;
    }
    if (it.type === 'player' && it.label === undefined) it.label = nextNumber(it.team);
    state.items.push(it);
    return it;
  }

  // Element aus Ausgangslage o um (dx, dy) verschieben
  function placeFrom(it, o, dx, dy) {
    if (it.type === 'arrow') {
      it.x1 = o.x1 + dx; it.y1 = o.y1 + dy;
      it.x2 = o.x2 + dx; it.y2 = o.y2 + dy;
      if (o.cx != null) { it.cx = o.cx + dx; it.cy = o.cy + dy; }
    } else {
      Object.assign(it, clampPt({ x: o.x + dx, y: o.y + dy }));
    }
  }

  function deleteSelected() {
    if (!selected()) return;
    pushUndo();
    state.items = state.items.filter(i => i.id !== selectedId);
    normalizeSteps(state.items);
    selectedId = null;
    render();
    renderContextBar();
  }

  function duplicateSelected() {
    const it = selected();
    if (!it) return;
    pushUndo();
    const copy = clone(it);
    copy.id = itemId();
    placeFrom(copy, it, 24, 24);
    if (copy.type === 'player' && /^\d+$/.test(copy.label || '')) copy.label = nextNumber(copy.team);
    if (hasStep(copy)) copy.step = maxStep(state.items) + 1;
    state.items.push(copy);
    selectedId = copy.id;
    render();
    renderContextBar();
  }

  function select(id) {
    if (selectedId === id) return;
    selectedId = id;
    renderUI();
    renderContextBar();
    stepsPanel.markSelected();
  }

  function setTool(key) {
    tool = key;
    if (key) selectedId = null;
    boardWrap.classList.toggle('tool-active', !!key);
    renderLegendActive();
    renderUI();
    renderContextBar();
    stepsPanel.markSelected();
  }

  function setField(id) {
    if (id === state.fieldId || !FIELD_MAP[id]) return;
    pushUndo();
    // Positionen anteilig übertragen, damit nichts außerhalb landet
    const from = field(), to = FIELD_MAP[id];
    const fx = to.width / from.width, fy = to.height / from.height;
    for (const it of state.items) {
      if (it.type === 'arrow') {
        it.x1 *= fx; it.y1 *= fy; it.x2 *= fx; it.y2 *= fy;
        if (it.cx != null) { it.cx *= fx; it.cy *= fy; }
      } else {
        it.x *= fx; it.y *= fy;
      }
    }
    state.fieldId = id;
    render();
  }

  /* ---------- Ablauf-Liste und Details (rechte Spalte) ---------- */

  const stepsPanel = createStepsPanel({
    get state() { return state; },
    get selectedId() { return selectedId; },
    select(id) { if (tool) setTool(null); select(id); },
    hover(id) { if (hoverId !== id) { hoverId = id; renderUI(); } },
    change(fn) {
      pushUndo();
      fn(state.items);
      normalizeSteps(state.items);
      render();
      renderContextBar();
    },
    updateItem(id, fn, undoable) {
      const it = byId(id);
      if (!it) return;
      if (undoable) pushUndo();
      fn(it);
      scheduleSave();
    },
  });

  function renderDetails() {
    const sel = detailsForm.querySelector('[data-meta="category"]');
    const cats = [...new Set([...CATEGORIES, state.category].filter(Boolean))];
    sel.innerHTML = '<option value="">–</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
    detailsForm.querySelectorAll('[data-meta]').forEach(el => { el.value = state[el.dataset.meta] || ''; });
  }

  detailsForm.addEventListener('input', e => {
    const key = e.target.dataset.meta;
    if (!key) return;
    state[key] = e.target.value;
    scheduleSave();
  });

  function setTab(name) {
    document.querySelectorAll('.panel-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $('stepsList').hidden = name !== 'steps';
    detailsForm.hidden = name !== 'details';
  }
  document.querySelectorAll('.panel-tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  function setPanel(open) {
    document.body.classList.toggle('panel-closed', !open);
    $('btnPanel').classList.toggle('on', open);
    try { localStorage.setItem(PANEL_KEY, open ? '1' : '0'); } catch (e) { /* egal */ }
  }

  /* ---------- Bedienung auf dem Spielfeld ---------- */

  board.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = toSvg(e);
    const base = { start: p, sx: e.clientX, sy: e.clientY, moved: false };
    const handleEl = e.target.closest('[data-handle]');
    const itemEl = e.target.closest('.item');

    if (handleEl && selected()) {
      drag = { ...base, mode: 'handle', handle: handleEl.dataset.handle, id: selectedId, orig: clone(selected()) };
    } else if (tool) {
      const entry = LEGEND_MAP[tool];
      if (entry.type === 'arrow') {
        drag = { ...base, mode: 'draw', entry, id: null };
      } else {
        pushUndo();
        const it = addItem(entry, clampPt(p));
        // direkt weiterziehen erlaubt, ohne extra Rückgängig-Schritt
        drag = { ...base, mode: 'move', id: it.id, orig: clone(it), noUndo: true };
        render();
      }
    } else if (itemEl) {
      select(itemEl.dataset.id);
      drag = { ...base, mode: 'move', id: selectedId, orig: clone(selected()) };
    } else {
      select(null);
    }

    if (drag) {
      board.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });

  board.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      if (!drag.noUndo) pushUndo();
    }
    const p = toSvg(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;

    if (drag.mode === 'draw') {
      let it = drag.id && byId(drag.id);
      if (!it) { it = addItem(drag.entry, drag.start); drag.id = it.id; }
      setArrowEnds(it, drag.start, p);
    } else {
      const it = byId(drag.id), o = drag.orig;
      if (!it) return;
      if (drag.mode === 'move') placeFrom(it, o, dx, dy);
      else dragHandle(it, o, drag.handle, p, dx, dy, e.shiftKey);
    }
    render();
  });

  function dragHandle(it, o, h, p, dx, dy, free) {
    if (h === 'p1' || h === 'p2') {
      const n = h[1];
      it['x' + n] = o['x' + n] + dx;
      it['y' + n] = o['y' + n] + dy;
      // Bogen mitziehen, damit die Form ungefähr erhalten bleibt
      if (o.curved) { it.cx = o.cx + dx / 2; it.cy = o.cy + dy / 2; }
    } else if (h === 'mid') {
      const m = arrowMid(o);
      it.curved = true;
      it.cx = 2 * (m.x + dx) - (it.x1 + it.x2) / 2;
      it.cy = 2 * (m.y + dy) - (it.y1 + it.y2) / 2;
    } else if (h === 'rot') {
      let a = Math.atan2(p.x - it.x, -(p.y - it.y)) * 180 / Math.PI;
      if (!free) a = Math.round(a / 15) * 15;  // Shift = stufenlos
      it.rot = ((a % 360) + 360) % 360;
    }
  }

  function endBoardDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.mode === 'draw') {
      if (!d.moved) {
        pushUndo();
        addItem(d.entry, clampPt(d.start));
      } else {
        const it = byId(d.id);
        if (it && Math.hypot(it.x2 - it.x1, it.y2 - it.y1) < 10) {
          state.items = state.items.filter(i => i !== it);
          undoStack.pop();
          updateHistoryButtons();
        }
      }
    }
    // Nur neu zeichnen, wenn sich etwas geändert hat – sonst geht ein Doppelklick verloren
    if (d.moved || d.mode === 'draw') render();
    if (d.mode === 'handle' && d.handle === 'mid') renderContextBar();  // "Bogen" aktualisieren
  }
  board.addEventListener('pointerup', endBoardDrag);
  board.addEventListener('pointercancel', endBoardDrag);

  // Wegen setPointerCapture ist e.target hier das Feld – das Element wurde aber beim pointerdown ausgewählt
  board.addEventListener('dblclick', () => {
    if (tool || !selected()) return;
    const input = contextBar.querySelector('[data-prop="label"], [data-prop="step"]');
    if (input) { input.focus(); input.select(); }
  });

  /* ---------- Legende: Ziehen oder Antippen ---------- */

  function buildLegend() {
    legendEl.innerHTML = LEGEND.map(sec =>
      `<section><h2>${sec.title}</h2><div class="tiles">` +
      sec.items.map(en => `<button type="button" class="tile" data-key="${en.key}" title="${esc(en.name)}">${previewSvg(en)}<span>${esc(en.name)}</span></button>`).join('') +
      `</div>${sec.note ? `<p class="note">${sec.note}</p>` : ''}</section>`).join('');
  }

  function renderLegendActive() {
    legendEl.querySelectorAll('.tile').forEach(t => t.classList.toggle('active', t.dataset.key === tool));
  }

  function overBoard(e) {
    const r = board.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function makeGhost(key) {
    const el = document.createElement('div');
    el.className = 'ghost';
    el.innerHTML = previewSvg(LEGEND_MAP[key], 1 / unitsPerPx());
    document.body.appendChild(el);
    return el;
  }

  function endLegendDrag() {
    if (ldrag && ldrag.ghost) ldrag.ghost.remove();
    ldrag = null;
    boardWrap.classList.remove('drop-target');
    document.body.classList.remove('dragging');
  }

  legendEl.addEventListener('pointerdown', e => {
    const tile = e.target.closest('.tile');
    if (!tile || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    ldrag = { key: tile.dataset.key, sx: e.clientX, sy: e.clientY, ghost: null };
    tile.setPointerCapture(e.pointerId);
  });

  legendEl.addEventListener('pointermove', e => {
    if (!ldrag) return;
    if (!ldrag.ghost) {
      if (Math.hypot(e.clientX - ldrag.sx, e.clientY - ldrag.sy) < 6) return;
      ldrag.ghost = makeGhost(ldrag.key);
      document.body.classList.add('dragging');
    }
    ldrag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    boardWrap.classList.toggle('drop-target', overBoard(e));
  });

  legendEl.addEventListener('pointerup', e => {
    if (!ldrag) return;
    const { key, ghost } = ldrag;
    endLegendDrag();
    if (!ghost) {                       // nur angetippt → Platzier-Modus
      setTool(tool === key ? null : key);
      return;
    }
    if (overBoard(e)) {                 // auf dem Feld losgelassen
      if (tool) setTool(null);
      pushUndo();
      const it = addItem(LEGEND_MAP[key], clampPt(toSvg(e)));
      selectedId = it.id;
      render();
      renderContextBar();
      stepsPanel.markSelected();
    }
  });

  legendEl.addEventListener('pointercancel', endLegendDrag);

  // Tastatur-Bedienung der Legende (Enter/Leertaste)
  legendEl.addEventListener('click', e => {
    const tile = e.target.closest('.tile');
    if (tile && e.detail === 0) setTool(tool === tile.dataset.key ? null : tile.dataset.key);
  });

  /* ---------- Spielfeld-Auswahl ---------- */

  function buildFieldPicker() {
    fieldPicker.innerHTML = FIELDS.map(f =>
      `<button type="button" class="field-btn" data-field="${f.id}" title="${esc(f.name)}">` +
      `<svg viewBox="0 0 ${f.width} ${f.height}" aria-hidden="true">${f.svg}</svg><span>${esc(f.name)}</span></button>`).join('');
    fieldPicker.addEventListener('click', e => {
      const b = e.target.closest('.field-btn');
      if (b) setField(b.dataset.field);
    });
  }

  /* ---------- Tastatur ---------- */

  document.addEventListener('keydown', e => {
    const target = e.target instanceof Element ? e.target : null;
    const typing = target && target.matches('input, textarea, select');
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (libraryView.isOpen()) {
      if (e.key === 'Escape') libraryView.close();
      return;
    }
    if (typing) {
      if ((e.key === 'Enter' || e.key === 'Escape') && (target.dataset.prop || target.dataset.note)) target.blur();
      return;
    }
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); redo(); return; }
    if (mod && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (mod && key === 's') { e.preventDefault(); persist(); return; }
    if (mod) return;

    if (e.key === 'Escape') {
      closeColorPop();
      if (tool) setTool(null); else select(null);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected()) {
      e.preventDefault();
      deleteSelected();
    } else if (e.key.startsWith('Arrow') && selected()) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 2;
      const [dx, dy] = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      pushUndo();
      const it = selected();
      placeFrom(it, clone(it), dx, dy);
      render();
    }
  });

  /* ---------- Bild, Druck, Dateien ---------- */

  function fileName(title, ext) {
    const base = (title || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') || 'Uebung';
    return `${base}.${ext}`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Ablauf, Aufbau und Coaching-Punkte für Bild und Druck
  function infoBlocks() {
    const blocks = [];
    const groups = stepGroups(state.items);
    if (groups.length) {
      blocks.push({ heading: 'Ablauf', steps: groups.map(g => ({ n: g.step, multi: g.arrows.length > 1, lines: g.arrows.map(a => stepText(state.items, a)) })) });
    }
    if (state.setup.trim()) blocks.push({ heading: 'Aufbau', text: state.setup.trim() });
    const points = state.coaching.split('\n').map(s => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
    if (points.length) blocks.push({ heading: 'Coaching-Punkte', bullets: points });
    return blocks;
  }

  function wrapText(c, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + ' ' + word : word;
        if (line && c.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  // Zeichnet die Textblöcke (draw = false: nur Höhe messen)
  function drawInfo(c, blocks, x0, y0, width, draw) {
    const LH = 27;
    let y = y0;
    c.textBaseline = 'middle';
    for (const b of blocks) {
      c.font = 'bold 21px Arial, Helvetica, sans-serif';
      if (draw) { c.fillStyle = '#111827'; c.fillText(b.heading, x0, y + 12); }
      y += 38;
      c.font = '18px Arial, Helvetica, sans-serif';
      if (b.steps) {
        for (const s of b.steps) {
          const lines = s.lines.flatMap(l => wrapText(c, l, width - 46));
          if (s.multi) lines.push('(gleichzeitig)');
          if (draw) {
            c.fillStyle = '#111827';
            c.beginPath(); c.arc(x0 + 13, y + 13, 13, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#ffffff';
            c.font = 'bold 15px Arial, Helvetica, sans-serif';
            c.textAlign = 'center';
            c.fillText(String(s.n), x0 + 13, y + 14);
            c.textAlign = 'left';
            c.font = '18px Arial, Helvetica, sans-serif';
            lines.forEach((l, i) => {
              c.fillStyle = s.multi && i === lines.length - 1 ? '#6b7280' : '#1f2937';
              c.fillText(l, x0 + 40, y + 13 + i * LH);
            });
          }
          y += Math.max(32, lines.length * LH) + 8;
        }
      }
      if (b.text) {
        const lines = wrapText(c, b.text, width);
        if (draw) { c.fillStyle = '#1f2937'; lines.forEach((l, i) => c.fillText(l, x0, y + 13 + i * LH)); }
        y += lines.length * LH + 4;
      }
      if (b.bullets) {
        for (const t of b.bullets) {
          const lines = wrapText(c, t, width - 24);
          if (draw) {
            c.fillStyle = '#1f2937';
            c.fillText('•', x0 + 4, y + 13);
            lines.forEach((l, i) => c.fillText(l, x0 + 24, y + 13 + i * LH));
          }
          y += lines.length * LH + 2;
        }
      }
      y += 18;
    }
    return y;
  }

  async function exportPng() {
    persist();
    const f = field();
    const svg = board.cloneNode(true);
    svg.querySelector('#uiLayer').innerHTML = '';
    svg.querySelector('#hoverLayer').innerHTML = '';
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', f.width);
    svg.setAttribute('height', f.height);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    try {
      await img.decode();
    } catch (e) {
      alert('Das Bild konnte nicht erstellt werden.');
      return;
    }

    const W = f.width, PAD = 28, scale = 2;
    const title = state.title.trim(), meta = metaLine(state);
    const head = (title ? 58 : 0) + (meta ? 32 : 0) + (title || meta ? 14 : 0);
    const blocks = infoBlocks();
    const measure = document.createElement('canvas').getContext('2d');
    const infoH = blocks.length ? drawInfo(measure, blocks, PAD, PAD, W - 2 * PAD, false) : 0;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = (head + f.height + infoH) * scale;
    const c = canvas.getContext('2d');
    c.scale(scale, scale);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, head + f.height + infoH);
    c.textBaseline = 'middle';
    let y = 14;
    if (title) {
      c.fillStyle = '#111827';
      c.font = 'bold 32px Arial, Helvetica, sans-serif';
      c.fillText(title, PAD, y + 26);
      y += 58;
    }
    if (meta) {
      c.fillStyle = '#4b5563';
      c.font = '19px Arial, Helvetica, sans-serif';
      c.fillText(meta, PAD, y + 12);
    }
    c.drawImage(img, 0, head, f.width, f.height);
    if (blocks.length) drawInfo(c, blocks, PAD, head + f.height + PAD, W - 2 * PAD, true);
    canvas.toBlob(b => b && download(b, fileName(state.title, 'png')), 'image/png');
  }

  function fillPrint() {
    $('printTitle').textContent = state.title || '';
    $('printMeta').textContent = metaLine(state);
    $('printInfo').innerHTML = infoBlocks().map(b => `<section><h2>${esc(b.heading)}</h2>` + (
      b.steps
        ? `<ol class="p-steps">${b.steps.map(s => `<li><span class="p-badge">${s.n}</span><div>${s.lines.map(l => `<div>${esc(l)}</div>`).join('')}` +
          `${s.multi ? '<div class="p-muted">(gleichzeitig)</div>' : ''}</div></li>`).join('')}</ol>`
        : b.text
          ? `<p>${esc(b.text).replace(/\n/g, '<br>')}</p>`
          : `<ul>${b.bullets.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    ) + `</section>`).join('');
  }
  window.addEventListener('beforeprint', fillPrint);

  /* ---------- Kopfleiste ---------- */

  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnNew').addEventListener('click', () => libraryApi.create());
  $('btnLibrary').addEventListener('click', () => libraryView.open());
  $('btnPng').addEventListener('click', exportPng);
  $('btnPrint').addEventListener('click', () => { select(null); window.print(); });
  $('btnPanel').addEventListener('click', () => setPanel(document.body.classList.contains('panel-closed')));

  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    scheduleSave();
  });

  window.addEventListener('pagehide', persist);

  /* ---------- Start ---------- */

  const libraryView = createLibraryView(libraryApi);

  document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
  $('goalList').innerHTML = GOALS.map(g => `<option value="${esc(g)}">`).join('');

  library = loadLibrary();
  const current = library.drills.find(d => d.id === library.currentId) || newestDrill();
  state = current ? clone(current) : emptyDrill();
  lastContent = drillContent(state);

  let panelPref = null;
  try { panelPref = localStorage.getItem(PANEL_KEY); } catch (e) { /* egal */ }
  setPanel(panelPref ? panelPref === '1' : innerWidth >= 1200 || innerWidth <= 820);
  setTab('steps');

  buildFieldPicker();
  buildLegend();
  titleInput.value = state.title;
  renderDetails();
  renderAll();
  persist();
  new ResizeObserver(() => renderUI()).observe(boardWrap);

  // Als App installierbar und offline nutzbar (nur über https oder localhost möglich)
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus weiter */ });
  }
  // Browser bitten, die gespeicherten Übungen nicht automatisch aufzuräumen
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
