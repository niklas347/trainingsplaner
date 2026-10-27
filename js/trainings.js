/* =========================================================
   Trainings: Übungen aus der Bibliothek zu einer Einheit
   (Datum, Reihenfolge, Minuten) zusammenstellen.
   Die Übungen werden nur verknüpft, nicht kopiert – wer eine
   Übung ändert, sieht die Änderung auch im Training.
   ========================================================= */

/* api: { drills, trainings, flush(), save() → true/false, openDrill(id) } */

function createTrainingsView(api) {
  const root = document.getElementById('trainings');
  const body = document.getElementById('trBody');
  const heading = document.getElementById('trHeading');
  const backBtn = document.getElementById('trBack');
  const newBtn = document.getElementById('trNew');
  const printBtn = document.getElementById('trPrint');
  const printBox = document.getElementById('trainingPrint');
  const status = document.getElementById('trStatus');
  let openId = null;      // geöffnetes Training – sonst wird die Liste gezeigt
  let picking = false;    // Übungsauswahl aufgeklappt

  const drillById = id => api.drills.find(d => d.id === id);
  const current = () => api.trainings.find(t => t.id === openId) || null;
  const count = n => `${n} ${n === 1 ? 'Übung' : 'Übungen'}`;
  const summary = t => { const m = trainingMinutes(t); return [count(t.entries.length), m ? `${m} min` : ''].filter(Boolean).join(' · '); };

  function save(t) {
    if (t) t.updated = Date.now();
    status.hidden = api.save();
  }

  /* ---------- Liste aller Trainings ---------- */

  function renderList() {
    heading.textContent = 'Trainings';
    backBtn.hidden = true;
    printBtn.hidden = true;
    newBtn.hidden = false;
    const today = isoDay();
    const list = [...api.trainings].sort((a, b) => b.date.localeCompare(a.date) || b.updated - a.updated);
    if (!list.length) {
      body.innerHTML = `<div class="tr-list"><div class="lib-empty"><p><b>Noch kein Training geplant.</b></p>` +
        `<p>Leg mit „Neues Training“ eins an – z. B. für heute – und füge 3–4 Übungen aus deiner Bibliothek hinzu.</p></div></div>`;
      return;
    }
    body.innerHTML = `<div class="tr-list">` + list.map(t => {
      const d = dayDate(t.date);
      const drills = t.entries.map(e => drillById(e.drillId)).filter(Boolean);
      return `<article class="tr-card${t.date === today ? ' today' : ''}" data-id="${t.id}" tabindex="0">` +
        `<div class="tr-date"><span>${d.toLocaleDateString('de-DE', { weekday: 'short' })}</span><b>${shortDay(t.date)}</b><span>${d.getFullYear()}</span></div>` +
        `<div class="tr-card-main"><h3>${esc(trainingName(t))}${t.date === today ? '<span class="tag">heute</span>' : ''}</h3>` +
        `<p class="card-info">${esc(summary(t))}</p>` +
        (drills.length ? `<div class="tr-strip">${drills.slice(0, 6).map(x => `<span class="tr-mini">${drillThumb(x)}</span>`).join('')}</div>` : '') +
        `</div><div class="card-actions">` +
        `<button type="button" class="btn icon" data-act="duplicate" title="Kopieren – z. B. als Vorlage für das nächste Training">${icon('copy')}</button>` +
        `<button type="button" class="btn icon danger" data-act="remove" title="Training löschen">${icon('trash')}</button>` +
        `</div></article>`;
    }).join('') + `</div>`;
  }

  /* ---------- Ein Training ---------- */

  function renderDetail() {
    const t = current();
    heading.textContent = trainingName(t);
    backBtn.hidden = false;
    printBtn.hidden = false;
    newBtn.hidden = true;
    body.innerHTML = `<div class="tr-detail">` +
      `<div class="tr-form details">` +
      `<div class="row2"><label>Datum<input type="date" data-tf="date" value="${t.date}" required></label>` +
      `<label>Name<input data-tf="title" maxlength="120" value="${esc(t.title)}" placeholder="${esc(trainingName({ ...t, title: '' }))}"></label></div>` +
      `<label>Notizen<textarea data-tf="notes" rows="2" maxlength="4000" placeholder="Schwerpunkt, Material, wer fehlt …">${esc(t.notes)}</textarea></label>` +
      `</div>` +
      `<section><div class="tr-plan-head"><h2>Ablauf</h2><span id="trTotal" class="tr-total"></span></div>` +
      `<ol id="trEntries" class="tr-entries"></ol><div id="trPicker"></div></section>` +
      `<p class="tr-note">Tippe auf eine Übung, um sie zu öffnen. Über „Trainings“ oben kommst du wieder hierher zurück. ` +
      `Trainings sind im Backup (Bibliothek → Backup speichern) mit drin.</p>` +
      `</div>`;
    renderEntries();
    renderPicker();
  }

  function renderEntries() {
    const t = current();
    const ol = document.getElementById('trEntries');
    if (!t.entries.length) {
      ol.innerHTML = `<li class="tr-empty">Noch keine Übungen drin.</li>`;
    } else {
      ol.innerHTML = t.entries.map((e, i) => {
        const d = drillById(e.drillId);
        const ctrl = `<div class="tr-ctrl">` +
          `<label class="tr-min"><input type="number" min="0" max="300" inputmode="numeric" data-min="${i}" value="${e.minutes || ''}" placeholder="–"> min</label>` +
          `<span class="spacer"></span>` +
          `<button type="button" class="mini" data-act="up" data-i="${i}" title="Nach oben"${i ? '' : ' disabled'}>${icon('up')}</button>` +
          `<button type="button" class="mini" data-act="down" data-i="${i}" title="Nach unten"${i < t.entries.length - 1 ? '' : ' disabled'}>${icon('down')}</button>` +
          `<button type="button" class="mini danger" data-act="drop" data-i="${i}" title="Aus dem Training nehmen (bleibt in der Bibliothek)">${icon('close')}</button>` +
          `</div>`;
        if (!d) {
          return `<li class="tr-entry missing"><span class="tr-num">${i + 1}</span><span class="tr-thumb"></span>` +
            `<div class="tr-info"><b>Übung nicht mehr vorhanden</b><span>Wurde gelöscht – hier einfach herausnehmen.</span></div>${ctrl}</li>`;
        }
        return `<li class="tr-entry"><span class="tr-num">${i + 1}</span>` +
          `<button type="button" class="tr-thumb" data-act="open" data-i="${i}" title="Übung öffnen">${drillThumb(d)}</button>` +
          `<button type="button" class="tr-info" data-act="open" data-i="${i}" title="Übung öffnen">` +
          `<b>${esc(d.title || 'Unbenannte Übung')}</b><span>${esc(metaLine(d))}</span></button>${ctrl}</li>`;
      }).join('');
    }
    updateTotal();
  }

  function updateTotal() {
    document.getElementById('trTotal').textContent = summary(current());
  }

  function renderPicker() {
    const box = document.getElementById('trPicker');
    if (!picking) {
      box.innerHTML = `<button type="button" class="btn primary tr-add" data-act="pick">${icon('plus')}<span>Übung hinzufügen</span></button>`;
      return;
    }
    box.innerHTML = `<div class="tr-picker"><div class="tr-picker-head">` +
      `<label class="lib-search">${icon('search')}<input id="trSearch" type="search" placeholder="Übung suchen …" autocomplete="off"></label>` +
      `<button type="button" class="btn" data-act="pickDone">Fertig</button></div>` +
      `<div id="trPickList" class="tr-pick-list"></div></div>`;
    renderPickList();
  }

  // sortiert nach Kategorie (Aufwärmen zuerst), dann nach Name
  function renderPickList() {
    const t = current();
    const list = document.getElementById('trPickList');
    const q = document.getElementById('trSearch').value.trim().toLowerCase();
    const inPlan = new Set(t.entries.map(e => e.drillId));
    const rank = d => { const i = CATEGORIES.indexOf(d.category); return i < 0 ? CATEGORIES.length : i; };
    const drills = [...api.drills]
      .filter(d => !q || q.split(/\s+/).every(w => [d.title, d.category, d.goal].join(' ').toLowerCase().includes(w)))
      .sort((a, b) => rank(a) - rank(b) || (a.title || '').localeCompare(b.title || '', 'de'));
    if (!drills.length) {
      list.innerHTML = `<p class="tr-empty">${api.drills.length ? 'Keine Übung passt zur Suche.' : 'Die Bibliothek ist noch leer – zeichne zuerst eine Übung.'}</p>`;
      return;
    }
    list.innerHTML = drills.map(d => `<button type="button" class="tr-pick" data-add="${d.id}" title="Ans Ende des Trainings anhängen">` +
      `<span class="tr-thumb">${drillThumb(d)}</span>` +
      `<span class="tr-info"><b>${esc(d.title || 'Unbenannte Übung')}</b><span>${esc(metaLine(d))}</span></span>` +
      `<span class="tr-pick-state">${inPlan.has(d.id) ? `${icon('check')}drin` : icon('plus')}</span></button>`).join('');
  }

  function render() {
    if (current()) renderDetail();
    else { openId = null; renderList(); }
  }

  function show(id) {
    openId = id;
    render();
    root.scrollTop = 0;
  }

  /* ---------- Drucken: Ablaufplan, danach jede Übung mit Feld und Texten ---------- */

  function printHtml(t) {
    const day = dayDate(t.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const sum = trainingMinutes(t);
    const rows = t.entries.map((e, i) => {
      const d = drillById(e.drillId);
      const sub = d ? [d.category, d.goal].filter(Boolean).join(' · ') : '';
      return `<tr><td class="tp-n">${i + 1}</td><td><b>${esc(d ? d.title || 'Unbenannte Übung' : 'Übung nicht mehr vorhanden')}</b>` +
        `${sub ? `<span>${esc(sub)}</span>` : ''}</td><td class="tp-min">${e.minutes ? `${e.minutes} min` : ''}</td></tr>`;
    }).join('');
    const drills = t.entries.map((e, i) => {
      const d = drillById(e.drillId);
      if (!d) return '';
      const f = FIELD_MAP[d.fieldId] || FIELDS[0], meta = metaLine(d);
      return `<section class="tp-drill"><div class="tp-drill-head"><span class="tp-num">${i + 1}</span>` +
        `<h2>${esc(d.title || 'Unbenannte Übung')}</h2>${e.minutes ? `<span class="tp-min">${e.minutes} min</span>` : ''}</div>` +
        (meta ? `<p class="tp-meta">${esc(meta)}</p>` : '') +
        `<svg class="tp-field" viewBox="0 0 ${f.width} ${f.height}" aria-hidden="true">${f.svg}${renderItemsMarkup(d.items)}</svg>` +
        `<div class="print-info tp-info">${infoBlocksHtml(drillInfoBlocks(d))}</div></section>`;
    }).join('');
    return `<header class="tp-head"><h1>${esc(trainingName(t))}</h1>` +
      `<p>${esc([day, count(t.entries.length), sum ? `${sum} min` : ''].filter(Boolean).join(' · '))}</p>` +
      (t.notes.trim() ? `<p class="tp-notes">${esc(t.notes.trim()).replace(/\n/g, '<br>')}</p>` : '') + `</header>` +
      (rows ? `<table class="tp-plan"><tbody>${rows}</tbody>` +
        (sum ? `<tfoot><tr><td></td><td>Gesamt</td><td class="tp-min">${sum} min</td></tr></tfoot>` : '') + `</table>` : '') +
      drills;
  }

  // Ist ein Training geöffnet, wird es gedruckt (auch per Strg+P) – sonst wie bisher die Übung im Editor
  function fillPrint() {
    const t = !root.hidden && current();
    document.body.classList.toggle('print-training', !!t);
    printBox.innerHTML = t ? printHtml(t) : '';
  }
  window.addEventListener('beforeprint', fillPrint);
  printBtn.addEventListener('click', () => { api.flush(); fillPrint(); window.print(); });

  /* ---------- Aktionen ---------- */

  function duplicate(id) {
    const src = api.trainings.find(t => t.id === id);
    if (!src) return;
    const now = Date.now();
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newId('t'), date: isoDay(), created: now, updated: now };
    if (src.title.trim()) copy.title = `${src.title} (Kopie)`;
    api.trainings.push(copy);
    save();
    picking = false;
    show(copy.id);
  }

  function remove(id) {
    const i = api.trainings.findIndex(t => t.id === id);
    if (i < 0 || !confirm(`„${trainingName(api.trainings[i])}“ löschen? Die Übungen selbst bleiben in der Bibliothek.`)) return;
    api.trainings.splice(i, 1);
    save();
    renderList();
  }

  body.addEventListener('click', e => {
    const card = e.target.closest('.tr-card');
    if (card) {
      const b = e.target.closest('button[data-act]');
      if (!b) { picking = false; show(card.dataset.id); }
      else if (b.dataset.act === 'duplicate') duplicate(card.dataset.id);
      else if (b.dataset.act === 'remove') remove(card.dataset.id);
      return;
    }
    const t = current();
    if (!t) return;
    const add = e.target.closest('[data-add]');
    if (add) {
      const d = drillById(add.dataset.add);
      if (!d) return;
      t.entries.push({ drillId: d.id, minutes: parseMinutes(d.duration) });
      save(t);
      // Auswahl bleibt unter dem Finger, obwohl der Ablauf darüber wächst
      const box = document.getElementById('trPicker'), before = box.getBoundingClientRect().top;
      renderEntries();
      renderPickList();
      root.scrollTop += box.getBoundingClientRect().top - before;
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, i = Number(b.dataset.i);
    if (act === 'open') {
      if (!t.entries[i]) return;
      api.openDrill(t.entries[i].drillId);
      close();
      return;
    }
    if (act === 'pick' || act === 'pickDone') {
      picking = act === 'pick';
      renderPicker();
      if (picking && matchMedia('(pointer: fine)').matches) document.getElementById('trSearch').focus();
      return;
    }
    if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= t.entries.length) return;
      [t.entries[i], t.entries[j]] = [t.entries[j], t.entries[i]];
    } else if (act === 'drop') {
      t.entries.splice(i, 1);
    } else {
      return;
    }
    save(t);
    renderEntries();
    if (picking) renderPickList();
  });

  // Eingaben direkt übernehmen, ohne neu zu zeichnen (sonst springt der Cursor)
  function onInput(e) {
    const t = current();
    const el = e.target;
    if (!t) return;
    if (el.id === 'trSearch') { renderPickList(); return; }
    if (el.dataset.min != null) {
      const en = t.entries[Number(el.dataset.min)];
      if (!en) return;
      en.minutes = Math.min(300, Math.max(0, parseInt(el.value, 10) || 0));
      save(t);
      updateTotal();
      return;
    }
    const key = el.dataset.tf;
    if (!key) return;
    if (key === 'date') {
      if (!ISO_DAY.test(el.value) || el.value === t.date) return;
      t.date = el.value;
      body.querySelector('[data-tf="title"]').placeholder = trainingName({ ...t, title: '' });
    } else {
      t[key] = el.value;
    }
    save(t);
    heading.textContent = trainingName(t);
  }
  body.addEventListener('input', onInput);
  body.addEventListener('change', onInput);   // manche Datumsauswahlen melden nur "change"

  body.addEventListener('keydown', e => {
    const card = e.target.closest('.tr-card');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(card.dataset.id); }
  });

  newBtn.addEventListener('click', () => {
    const t = emptyTraining();
    api.trainings.push(t);
    save();
    picking = true;   // gleich Übungen auswählen
    show(t.id);
  });
  backBtn.addEventListener('click', () => { openId = null; picking = false; render(); });
  document.getElementById('trClose').addEventListener('click', close);

  function open() {
    api.flush();
    root.hidden = false;
    document.body.classList.add('lib-open');
    render();
  }

  function close() {
    root.hidden = true;
    document.body.classList.remove('lib-open', 'print-training');
  }

  return { open, close, isOpen: () => !root.hidden };
}
