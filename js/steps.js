/* =========================================================
   Schritte: Abfolge der Pfeile und die Ablauf-Liste rechts.
   Jeder Pfeil kann eine Schritt-Nummer haben (it.step).
   Gleiche Nummer = passiert gleichzeitig.
   ========================================================= */

const hasStep = it => it.type === 'arrow' && typeof it.step === 'number' && it.step > 0;

function maxStep(items) {
  return items.reduce((m, it) => (hasStep(it) ? Math.max(m, it.step) : m), 0);
}

// Lückenlos 1, 2, 3 … durchnummerieren; Reihenfolge und Gleichzeitigkeit bleiben erhalten
function normalizeSteps(items) {
  const values = [...new Set(items.filter(hasStep).map(it => it.step))].sort((a, b) => a - b);
  const map = new Map(values.map((v, i) => [v, i + 1]));
  items.forEach(it => { if (hasStep(it)) it.step = map.get(it.step); });
}

function stepGroups(items) {
  const map = new Map();
  items.filter(hasStep).forEach(it => {
    if (!map.has(it.step)) map.set(it.step, []);
    map.get(it.step).push(it);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([step, arrows]) => ({ step, arrows }));
}

// Spieler am Anfang / Ende eines Pfeils erkennen
function playerNear(items, x, y, r = 45) {
  let best = null, bestD = r;
  for (const it of items) {
    if (it.type !== 'player') continue;
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bestD) { best = it; bestD = d; }
  }
  return best;
}

function arrowPlayers(items, a) {
  const from = playerNear(items, a.x1, a.y1);
  let to = playerNear(items, a.x2, a.y2);
  if (to === from) to = null;
  return { from, to };
}

const playerShort = p => (p.label ? String(p.label) : TEAM_NAMES[p.team] || 'Spieler');

// Kurzbeschreibung für Bild-Export und Druck, z. B. "Pass 6 → 8 – flach in den Fuß"
function stepText(items, a) {
  const { from, to } = arrowPlayers(items, a);
  let who = '';
  if (from && to) who = `${playerShort(from)} → ${playerShort(to)}`;
  else if (from) who = playerShort(from);
  else if (to) who = `→ ${playerShort(to)}`;
  return arrowKind(a) + (who ? ' ' + who : '') + (a.note ? ' – ' + a.note : '');
}

/* ---------- Ablauf-Liste ----------
   ctx: { state, selectedId, select(id), hover(id), change(fn), updateItem(id, fn, undoable) } */

function createStepsPanel(ctx) {
  const list = document.getElementById('stepsList');
  const count = document.getElementById('stepCount');
  let lastHtml = '';
  let noteUndoArmed = true;

  const chip = p => `<span class="pchip" style="--c:${p.color};--t:${isLight(p.color) ? '#111827' : '#fff'}">${esc(p.label || '')}</span>`;

  function kindIcon(a) {
    const sample = { ...a, x1: 6, y1: 12, x2: 54, y2: 12, curved: false, step: 0 };
    return `<svg class="kind-ico" viewBox="0 0 60 24" aria-hidden="true">${renderArrow(sample)}</svg>`;
  }

  function who(items, a) {
    const { from, to } = arrowPlayers(items, a);
    if (!from && !to) return '';
    return `<span class="who">${from ? chip(from) : ''}${to ? `<span class="to">→</span>${chip(to)}` : ''}</span>`;
  }

  function row(items, a, g, gi, multi) {
    let action = '';
    if (multi) action = `<button type="button" class="link-btn" data-act="split" data-id="${a.id}" title="Als eigenen Schritt danach einordnen">eigener Schritt</button>`;
    else if (gi > 0) action = `<button type="button" class="link-btn" data-act="merge" data-id="${a.id}" title="Passiert gleichzeitig mit Schritt ${g.step - 1}">gleichzeitig mit ${g.step - 1}</button>`;
    return `<div class="step-row" data-id="${a.id}">${kindIcon(a)}<div class="step-main">` +
      `<div class="step-line"><b>${arrowKind(a)}</b>${who(items, a)}<span class="spacer"></span>${action}</div>` +
      `<input class="step-note" data-note="${a.id}" value="${esc(a.note || '')}" placeholder="Notiz, z. B. flach in den Fuß" maxlength="300" autocomplete="off">` +
      `</div></div>`;
  }

  function build() {
    const items = ctx.state.items;
    const groups = stepGroups(items);
    if (!groups.length) {
      return `<div class="steps-empty"><p><b>Noch keine Schritte.</b></p>` +
        `<p>Zieh Pfeile aufs Feld – jeder Pfeil bekommt automatisch die nächste Nummer: der erste die 1, der zweite die 2 …</p>` +
        `<p>Pfeile mit <b>gleicher Nummer</b> passieren <b>gleichzeitig</b>.</p></div>`;
    }
    return groups.map((g, gi) => {
      const multi = g.arrows.length > 1;
      return `<div class="step-group">` +
        `<div class="step-head"><span class="step-badge">${g.step}</span><span class="step-title">Schritt ${g.step}</span>` +
        (multi ? `<span class="step-chip">gleichzeitig</span>` : '') + `<span class="spacer"></span>` +
        `<button type="button" class="mini" data-act="up" data-step="${g.step}" title="Schritt früher"${gi === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
        `<button type="button" class="mini" data-act="down" data-step="${g.step}" title="Schritt später"${gi === groups.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
        `</div>` + g.arrows.map(a => row(items, a, g, gi, multi)).join('') + `</div>`;
    }).join('') +
      `<p class="steps-hint">Nummer ändern: Pfeil anklicken und oben bei „Schritt“ eintragen – oder hier verschieben und verbinden.</p>`;
  }

  function markSelected() {
    list.querySelectorAll('.step-row').forEach(r => r.classList.toggle('sel', r.dataset.id === ctx.selectedId));
  }

  function render() {
    const n = stepGroups(ctx.state.items).length;
    count.textContent = n ? n : '';
    // Nicht neu aufbauen, während eine Notiz getippt wird (sonst geht der Fokus verloren)
    const active = document.activeElement;
    if (active && list.contains(active) && active.matches('input')) return;
    const html = build();
    if (html !== lastHtml) { list.innerHTML = html; lastHtml = html; }
    markSelected();
  }

  function swapSteps(items, a, b) {
    items.forEach(it => {
      if (!hasStep(it)) return;
      if (it.step === a) it.step = b; else if (it.step === b) it.step = a;
    });
  }

  list.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (b) {
      const act = b.dataset.act, step = Number(b.dataset.step), id = b.dataset.id;
      ctx.change(items => {
        if (act === 'up') swapSteps(items, step, step - 1);
        else if (act === 'down') swapSteps(items, step, step + 1);
        else {
          const it = items.find(i => i.id === id);
          if (!it) return;
          if (act === 'merge') it.step -= 1;        // gleiche Nummer wie der Schritt davor
          else if (act === 'split') it.step += 0.5; // eigener Schritt direkt danach
        }
      });
      return;
    }
    const r = e.target.closest('.step-row');
    if (r && !e.target.matches('input')) ctx.select(r.dataset.id);
  });

  list.addEventListener('focusin', e => {
    if (e.target.dataset.note) { noteUndoArmed = true; ctx.select(e.target.dataset.note); }
  });
  list.addEventListener('input', e => {
    const id = e.target.dataset.note;
    if (!id) return;
    ctx.updateItem(id, it => { it.note = e.target.value; }, noteUndoArmed);
    noteUndoArmed = false;
  });
  list.addEventListener('change', e => { if (e.target.dataset.note) noteUndoArmed = true; });
  list.addEventListener('focusout', () => setTimeout(() => { if (!list.contains(document.activeElement)) render(); }));

  list.addEventListener('mouseover', e => {
    const r = e.target.closest('.step-row');
    ctx.hover(r ? r.dataset.id : null);
  });
  list.addEventListener('mouseleave', () => ctx.hover(null));

  return { render, markSelected };
}
