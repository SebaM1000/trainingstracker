// Modul Krafttraining: Training loggen, Vorlagen, Verlauf, Pausentimer.
import { h, sheet, confirmSheet, toast, field, numInput, card, empty, fmt } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { uid } from '../core/store.js';
import { ymd, fmtDate } from '../core/dates.js';
import { allExercises, exerciseById, MUSCLES } from '../data/exercises.js';
import { suggestNext, historyFor, doneSets, sessionBestE1rm, tonnage } from '../science/strength.js';
import { sessionLoad } from '../science/load.js';
import { absorbLoadOnly } from '../science/garmin.js';
import { assess, adjustSuggestion, LEVELS } from '../science/readiness.js';

const tagesform = (profile) => (profile.settings.modules.tagesform === false ? 'unbekannt' : assess(profile).level);
const daySuggestion = (profile, exId) => adjustSuggestion(suggestNext(profile, exId), tagesform(profile));
const daySets = (n, sug) => Math.max(1, sug.setsDelta === -99 ? Math.ceil(n / 2) : n + (sug.setsDelta || 0));

const T = (id, sets = 3) => ({ exId: id, sets });
export const PRESET_TEMPLATES = [
  { name: 'Push', items: [T('bankdruecken'), T('schraegbank_kh'), T('schulterdruecken'), T('seitheben', 3), T('trizeps_kabel'), T('trizeps_ueberkopf', 2)] },
  { name: 'Pull', items: [T('klimmzug'), T('rudern_kabel'), T('latzug'), T('facepull'), T('bizeps_curl'), T('hammer_curl', 2)] },
  { name: 'Beine', items: [T('kniebeuge'), T('rdl'), T('beinpresse'), T('beinbeuger'), T('wadenheben'), T('cable_crunch')] },
  { name: 'Ganzkörper A', items: [T('kniebeuge'), T('bankdruecken'), T('rudern_kabel'), T('rdl', 2), T('seitheben', 2), T('cable_crunch', 2)] },
  { name: 'Ganzkörper B', items: [T('kreuzheben', 2), T('schulterdruecken'), T('latzug'), T('bulgarian'), T('hip_thrust'), T('pallof', 2)] },
];

let restTimer = null;

function startRest(seconds) {
  stopRest();
  const end = Date.now() + seconds * 1000;
  const bar = h('button', { class: 'rest-bar', 'aria-live': 'polite', onclick: stopRest });
  const plus = h('button', { class: 'rest-plus', onclick: (e) => { e.stopPropagation(); restTimer.end += 15000; } }, '+15 s');
  const wrap = h('div', { class: 'rest-wrap' }, bar, plus);
  document.body.append(wrap);
  restTimer = { end, wrap, iv: null };
  const tick = () => {
    const left = Math.round((restTimer.end - Date.now()) / 1000);
    if (left <= 0) {
      bar.textContent = 'Pause vorbei – nächster Satz';
      bar.classList.add('done');
      try { navigator.vibrate?.([200, 100, 200]); } catch (e) {}
      clearInterval(restTimer.iv);
      setTimeout(stopRest, 4000);
      return;
    }
    bar.textContent = `Pause ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} – tippen zum Beenden`;
  };
  tick();
  restTimer.iv = setInterval(tick, 500);
}

function stopRest() {
  if (!restTimer) return;
  clearInterval(restTimer.iv);
  restTimer.wrap.remove();
  restTimer = null;
}

function newSetFrom(sug, prev) {
  if (prev) return { w: prev.w, reps: prev.reps, rir: prev.rir, done: false };
  return { w: sug.weight ?? '', reps: sug.reps ?? '', rir: sug.rir ?? '', done: false };
}

function makeExercise(profile, exId, nSets = 3) {
  const sug = daySuggestion(profile, exId);
  return { exId, sets: Array.from({ length: daySets(nSets, sug) }, () => newSetFrom(sug)) };
}

// ---------- Übungsauswahl ----------
export function pickExercise(ctx, onPick) {
  const p = ctx.store.profile();
  let q = '', muscle = '';
  const list = h('div', { class: 'pick-list' });
  const draw = () => {
    const items = allExercises(p).filter((e) =>
      (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!muscle || e.p.includes(muscle) || e.s.includes(muscle)));
    list.replaceChildren(...items.map((e) => h('button', { class: 'pick-item', onclick: () => { close(); onPick(e.id); } },
      h('span', { class: 'pick-name' }, e.name),
      h('span', { class: 'pick-meta' }, e.p.map((m) => MUSCLES[m]).join(', ')))),
    items.length ? '' : h('p', { class: 'muted' }, 'Keine Übung gefunden.'));
  };
  const close = sheet('Übung hinzufügen', h('div', {},
    h('input', { type: 'search', placeholder: 'Suchen …', class: 'search', 'aria-label': 'Übung suchen', oninput: (e) => { q = e.target.value; draw(); } }),
    h('div', { class: 'chips scroll' },
      [['', 'Alle'], ...Object.entries(MUSCLES)].map(([k, v]) => h('button', {
        class: `chip ${k === muscle ? 'active' : ''}`,
        onclick: (e) => { muscle = k; e.target.parentNode.querySelectorAll('.chip').forEach((c) => c.classList.remove('active')); e.target.classList.add('active'); draw(); },
      }, v))),
    list,
    h('button', { class: 'btn ghost full', onclick: () => { close(); customExercise(ctx, onPick); } }, '+ Eigene Übung anlegen')));
  draw();
}

function customExercise(ctx, onPick) {
  const ex = { id: 'eigen_' + uid(), name: '', cat: 'compound', p: [], s: [], equip: '', custom: true };
  const muscleChips = (key) => h('div', { class: 'chips wrap' }, Object.entries(MUSCLES).map(([k, v]) =>
    h('button', { class: 'chip', 'aria-pressed': 'false', onclick: (e) => {
      const arr = ex[key]; const i = arr.indexOf(k);
      if (i >= 0) arr.splice(i, 1); else arr.push(k);
      e.target.classList.toggle('active'); e.target.setAttribute('aria-pressed', String(i < 0));
    } }, v)));
  sheet('Eigene Übung', h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', oninput: (e) => { ex.name = e.target.value; } })),
    field('Art', h('select', { onchange: (e) => { ex.cat = e.target.value; } },
      h('option', { value: 'compound' }, 'Grundübung (mehrgelenkig)'), h('option', { value: 'isolation' }, 'Isolationsübung'))),
    h('p', { class: 'field-label' }, 'Primäre Muskeln (zählen voll)'), muscleChips('p'),
    h('p', { class: 'field-label' }, 'Sekundäre Muskeln (zählen halb)'), muscleChips('s')), [
    { label: 'Abbrechen' },
    { label: 'Speichern', kind: 'primary', onClick: () => {
      if (!ex.name.trim() || !ex.p.length) { toast('Name und mindestens einen primären Muskel angeben.'); return false; }
      ctx.store.updateProfile((p) => p.customExercises.push(ex));
      onPick(ex.id);
    } },
  ]);
}

// ---------- Aktives Training ----------
function renderDraft(root, ctx) {
  const p = ctx.store.profile();
  const d = p.draft;
  const save = (fn) => ctx.store.updateProfile((pp) => fn(pp.draft));
  const elapsed = h('span', { class: 'mono' });
  const tick = () => {
    if (iv && !document.body.contains(elapsed)) return clearInterval(iv);
    const m = Math.floor((Date.now() - new Date(d.startedAt)) / 60000);
    elapsed.textContent = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
  };
  let iv = null; tick(); iv = setInterval(tick, 15000);

  const lvl = tagesform(p);
  if (lvl === 'gelb' || lvl === 'rot') root.append(h('div', { class: `hint ${lvl === 'rot' ? 'down' : ''}` },
    `${LEVELS[lvl].label}. Die Vorschläge unten sind für heute angepasst. `, h('a', { href: '#heute' }, 'Details')));
  root.append(h('div', { class: 'draft-head' },
    h('input', { class: 'title-input', value: d.name, 'aria-label': 'Name der Einheit', oninput: (e) => save((x) => { x.name = e.target.value; }) }),
    h('div', { class: 'muted small' }, d.editingId ? `Bearbeitung vom ${fmtDate(d.date)}` : 'Läuft seit ', d.editingId ? null : elapsed)));

  d.exercises.forEach((ex, ei) => {
    const def = exerciseById(p, ex.exId) || { name: 'Unbekannte Übung', cat: 'compound', p: [], s: [] };
    const sug = daySuggestion(p, ex.exId);
    const hist = historyFor(p, ex.exId).filter((x) => x.sessionId !== d.editingId);
    const last = hist[hist.length - 1];
    const rest = def.cat === 'compound' ? p.params.restCompound : p.params.restIsolation;
    const rows = h('div', { class: 'sets' },
      h('div', { class: 'set-row set-head' }, h('span', {}, 'Satz'), h('span', {}, 'kg'), h('span', {}, 'Wdh.'), h('span', {}, 'RIR'), h('span', {}, '')));
    ex.sets.forEach((st, si) => {
      const row = h('div', { class: `set-row ${st.done ? 'done' : ''}` },
        h('button', { class: 'set-no', 'aria-label': `Satz ${si + 1} löschen`, onclick: () => {
          save((x) => x.exercises[ei].sets.splice(si, 1)); ctx.rerender(); } }, String(si + 1)),
        numInput(st.w, (v) => save((x) => { x.exercises[ei].sets[si].w = v; }), { decimal: true, label: 'Gewicht in kg', step: 0.5 }),
        numInput(st.reps, (v) => save((x) => { x.exercises[ei].sets[si].reps = v; }), { label: 'Wiederholungen', step: 1 }),
        numInput(st.rir, (v) => save((x) => { x.exercises[ei].sets[si].rir = v; }), { label: 'Wiederholungen in Reserve', step: 1, min: 0, max: 10 }),
        h('button', { class: `check ${st.done ? 'on' : ''}`, 'aria-pressed': String(!!st.done), 'aria-label': 'Satz erledigt', onclick: () => {
          const nowDone = !ctx.store.profile().draft.exercises[ei].sets[si].done;
          save((x) => { x.exercises[ei].sets[si].done = nowDone; });
          if (nowDone) startRest(rest);
          ctx.rerender();
        } }, '✓'));
      rows.append(row);
    });
    root.append(h('section', { class: 'card ex-card' },
      h('div', { class: 'ex-head' },
        h('div', {}, h('h3', { class: 'card-title' }, def.name),
          h('div', { class: 'muted small' }, def.p.map((m) => MUSCLES[m]).join(', '))),
        h('button', { class: 'icon-btn', 'aria-label': 'Übungsoptionen', onclick: () => exMenu(ctx, ei) }, '⋯')),
      h('div', { class: `hint ${sug.kind}` }, sug.text),
      last ? h('div', { class: 'muted small' }, `Zuletzt (${fmtDate(last.date, false)}): `,
        doneSets(last.ex).map((s) => `${fmt(s.w, s.w % 1 ? 1 : 0)}×${s.reps}${s.rir !== '' && s.rir !== undefined ? ` @${s.rir}` : ''}`).join(', ')) : null,
      rows,
      h('button', { class: 'btn ghost small', onclick: () => {
        save((x) => { const s = x.exercises[ei].sets; s.push(newSetFrom(sug, s[s.length - 1])); }); ctx.rerender(); } }, '+ Satz')));
  });

  root.append(
    h('button', { class: 'btn ghost full', onclick: () => pickExercise(ctx, (id) => {
      ctx.store.updateProfile((pp) => pp.draft.exercises.push(makeExercise(pp, id))); ctx.rerender(); }) }, '+ Übung hinzufügen'),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn danger-ghost', onclick: () => confirmSheet('Training verwerfen?', 'Alle Eingaben dieser Einheit gehen verloren.', 'Verwerfen', () => {
        ctx.store.updateProfile((pp) => { pp.draft = null; }); stopRest(); ctx.rerender(); }) }, 'Verwerfen'),
      h('button', { class: 'btn primary grow', onclick: () => finish(ctx) }, 'Training beenden')));
}

function exMenu(ctx, ei) {
  sheet('Übung', (close) => h('div', { class: 'stack' },
    h('button', { class: 'btn ghost full', onclick: () => { close(); ctx.store.updateProfile((p) => {
      if (ei > 0) { const a = p.draft.exercises; [a[ei - 1], a[ei]] = [a[ei], a[ei - 1]]; } }); ctx.rerender(); } }, 'Nach oben verschieben'),
    h('button', { class: 'btn ghost full', onclick: () => { close(); pickExercise(ctx, (id) => {
      ctx.store.updateProfile((p) => { p.draft.exercises[ei] = makeExercise(p, id, p.draft.exercises[ei].sets.length); }); ctx.rerender(); }); } }, 'Übung tauschen'),
    h('button', { class: 'btn danger-ghost full', onclick: () => { close(); ctx.store.updateProfile((p) => p.draft.exercises.splice(ei, 1)); ctx.rerender(); } }, 'Übung entfernen')));
}

function finish(ctx) {
  const p = ctx.store.profile();
  const d = p.draft;
  const nDone = d.exercises.reduce((a, e) => a + doneSets(e).length, 0);
  if (!nDone) { toast('Noch kein Satz abgehakt.'); return; }
  const mins = d.durationMin || Math.max(1, Math.round((Date.now() - new Date(d.startedAt)) / 60000));
  const data = { srpe: d.srpe ?? null, durationMin: mins, date: d.date || ymd(), notes: d.notes || '' };
  sheet('Training abschließen', h('div', { class: 'form' },
    h('p', { class: 'muted small' }, `${nDone} Sätze erledigt. Die Anstrengung (Session-RPE) kannst du hier eintragen oder wie gewohnt nach dem Training auf der Uhr. Dann wird sie beim nächsten Garmin-Import übernommen, ebenso die genaue Dauer.`),
    rpePicker(data.srpe, (v) => { data.srpe = v; }),
    h('div', { class: 'grid2' },
      field('Dauer (min)', numInput(data.durationMin, (v) => { data.durationMin = v; }, { label: 'Dauer' })),
      field('Datum', h('input', { type: 'date', value: data.date, onchange: (e) => { data.date = e.target.value; } }))),
    field('Notiz', h('textarea', { rows: 2, oninput: (e) => { data.notes = e.target.value; } }, data.notes))), [
    { label: 'Zurück' },
    { label: 'Speichern', kind: 'primary', onClick: () => {
      ctx.store.updateProfile((pp) => {
        const dr = pp.draft;
        const session = {
          id: dr.editingId || uid(), type: 'kraft', name: dr.name, date: data.date,
          durationMin: data.durationMin, srpe: data.srpe, notes: data.notes,
          exercises: dr.exercises.map((e) => ({ exId: e.exId, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length),
        };
        const prev = pp.sessions.find((s) => s.id === session.id);
        if (prev && prev.garminId) Object.assign(session, { garminId: prev.garminId, garminTyp: prev.garminTyp, avgHr: prev.avgHr, garminRpe: prev.garminRpe, gefuehl: prev.gefuehl, garminDauer: prev.garminDauer, garminLast: prev.garminLast, durationMin: prev.garminDauer || session.durationMin });
        if (data.srpe) session.srpeQuelle = 'manuell';
        else if (session.garminRpe) { session.srpe = session.garminRpe; session.srpeQuelle = 'uhr'; }
        pp.sessions = pp.sessions.filter((s) => s.id !== session.id);
        pp.sessions.push(session);
        if (!session.garminId) absorbLoadOnly(pp, session);
        pp.sessions.sort((a, b) => a.date.localeCompare(b.date));
        pp.draft = null;
      });
      stopRest();
      toast('Training gespeichert.');
      ctx.rerender();
    } },
  ]);
}

export function rpePicker(value, onChange) {
  const labels = ['Ruhe', 'Sehr, sehr leicht', 'Leicht', 'Moderat', 'Etwas schwer', 'Schwer', '', 'Sehr schwer', 'Sehr schwer', 'Fast maximal', 'Maximal'];
  const out = h('div', { class: 'rpe' });
  const desc = h('div', { class: 'rpe-desc' });
  const draw = (v) => {
    out.querySelectorAll('button').forEach((b) => { const on = Number(b.dataset.v) === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    desc.textContent = v === null || v === undefined ? 'RPE wählen' : `RPE ${v}: ${labels[v] || labels[v - 1]}`;
  };
  for (let i = 1; i <= 10; i++) out.append(h('button', { 'data-v': i, type: 'button', onclick: () => { onChange(i); draw(i); } }, String(i)));
  const wrap = h('div', {}, out, desc);
  draw(value);
  return wrap;
}

// ---------- Vorlagen ----------
function startFrom(ctx, tpl) {
  ctx.store.updateProfile((p) => {
    p.draft = {
      id: uid(), type: 'kraft', name: tpl ? tpl.name : 'Krafttraining', date: ymd(), startedAt: new Date().toISOString(),
      exercises: tpl ? tpl.items.map((it) => makeExercise(p, it.exId, it.sets)) : [],
    };
  });
  ctx.rerender();
}

function editTemplate(ctx, tpl) {
  const t = tpl ? JSON.parse(JSON.stringify(tpl)) : { id: uid(), name: '', items: [] };
  const p = ctx.store.profile();
  const list = h('div', { class: 'stack' });
  const draw = () => list.replaceChildren(...t.items.map((it, i) => h('div', { class: 'tpl-row' },
    h('span', { class: 'grow' }, exerciseById(p, it.exId)?.name || it.exId),
    numInput(it.sets, (v) => { it.sets = v || 1; }, { label: 'Sätze', class: 'narrow', min: 1, max: 10 }),
    h('span', { class: 'muted small' }, 'Sätze'),
    h('button', { class: 'icon-btn', 'aria-label': 'Entfernen', onclick: () => { t.items.splice(i, 1); draw(); } }, '✕'))));
  draw();
  sheet(tpl ? 'Vorlage bearbeiten' : 'Neue Vorlage', h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', value: t.name, oninput: (e) => { t.name = e.target.value; } })),
    list,
    h('button', { class: 'btn ghost full', onclick: () => pickExercise(ctx, (id) => { t.items.push({ exId: id, sets: 3 }); draw(); }) }, '+ Übung')), [
    tpl ? { label: 'Löschen', kind: 'danger-ghost', onClick: () => { ctx.store.updateProfile((pp) => { pp.templates = pp.templates.filter((x) => x.id !== t.id); }); ctx.rerender(); } } : { label: 'Abbrechen' },
    { label: 'Speichern', kind: 'primary', onClick: () => {
      if (!t.name.trim()) { toast('Bitte einen Namen eingeben.'); return false; }
      ctx.store.updateProfile((pp) => { pp.templates = pp.templates.filter((x) => x.id !== t.id); pp.templates.push(t); });
      ctx.rerender();
    } },
  ]);
}

function sessionDetail(ctx, s) {
  const p = ctx.store.profile();
  sheet(s.name || 'Krafttraining', h('div', {},
    h('p', { class: 'muted small' }, `${fmtDate(s.date)} – ${s.durationMin} min – RPE ${s.srpe ?? 'fehlt'} – Last ${sessionLoad(s)} AU${s.exercises.length ? ` – ${fmt(tonnage(s))} kg bewegt` : ''}`),
    s.garminId ? h('p', { class: 'small' }, `Von der Uhr: ${[s.garminDauer ? `${s.garminDauer} min` : null, s.avgHr ? `Puls Ø ${s.avgHr}` : null, s.garminRpe ? `Anstrengung ${s.garminRpe}` : null, s.gefuehl ? `Gefühl ${s.gefuehl}` : null].filter(Boolean).join(', ') || 'keine Zusatzwerte'}`) : null,
    s.loadOnly ? h('p', { class: 'small muted' }, 'Nur von der Uhr, ohne Sätze. Sobald du für diesen Tag ein Training in der App speicherst, werden beide zusammengeführt.') : null,
    s.exercises.map((ex) => h('div', { class: 'detail-ex' },
      h('strong', {}, exerciseById(p, ex.exId)?.name || ex.exId),
      h('div', { class: 'small' }, ex.sets.map((st) => `${fmt(st.w, st.w % 1 ? 1 : 0)} kg × ${st.reps}${st.rir !== '' && st.rir !== undefined ? ` (RIR ${st.rir})` : ''}`).join(' | ')),
      h('div', { class: 'muted small' }, `e1RM ${fmt(sessionBestE1rm(ex), 1)} kg`))),
    s.notes ? h('p', { class: 'small' }, s.notes) : null), [
    { label: 'Löschen', kind: 'danger-ghost', onClick: () => { confirmSheet('Einheit löschen?', 'Das lässt sich nicht rückgängig machen.', 'Löschen', () => {
      ctx.store.updateProfile((pp) => { pp.sessions = pp.sessions.filter((x) => x.id !== s.id); }); ctx.rerender(); }); } },
    { label: 'Bearbeiten', kind: 'primary', onClick: () => {
      if (ctx.store.profile().draft) { toast('Erst das laufende Training beenden.'); return false; }
      ctx.store.updateProfile((pp) => {
        pp.draft = { id: uid(), editingId: s.loadOnly ? null : s.id, type: 'kraft', name: s.name, date: s.date, startedAt: new Date().toISOString(),
          durationMin: s.durationMin, srpe: s.srpe, notes: s.notes,
          exercises: s.exercises.map((e) => ({ exId: e.exId, sets: e.sets.map((x) => ({ ...x, done: true })) })) };
      });
      ctx.rerender();
    } },
  ]);
}

function renderHome(root, ctx) {
  const p = ctx.store.profile();
  root.append(card(null,
    h('button', { class: 'btn primary full big', onclick: () => startFrom(ctx, null) }, 'Freies Training starten'),
    h('p', { class: 'muted small' }, 'Oder mit einer Vorlage starten. Gewichte und Wiederholungen werden aus deinem letzten Training vorgeschlagen.')));

  const tplCard = card('Vorlagen');
  if (!p.templates.length) {
    tplCard.append(h('p', { class: 'muted small' }, 'Noch keine Vorlagen. Übernimm Vorschläge oder erstelle eigene.'),
      h('button', { class: 'btn ghost full', onclick: () => {
        ctx.store.updateProfile((pp) => { pp.templates.push(...PRESET_TEMPLATES.map((t) => ({ ...JSON.parse(JSON.stringify(t)), id: uid() }))); });
        ctx.rerender();
      } }, 'Vorschläge übernehmen (Push/Pull/Beine, Ganzkörper)'));
  }
  p.templates.forEach((t) => tplCard.append(h('div', { class: 'tpl-item' },
    h('button', { class: 'tpl-start', onclick: () => startFrom(ctx, t) },
      h('strong', {}, t.name),
      h('span', { class: 'muted small' }, t.items.map((it) => exerciseById(p, it.exId)?.name).filter(Boolean).join(', '))),
    h('button', { class: 'icon-btn', 'aria-label': `Vorlage ${t.name} bearbeiten`, onclick: () => editTemplate(ctx, t) }, '✎'))));
  tplCard.append(h('button', { class: 'btn ghost small', onclick: () => editTemplate(ctx, null) }, '+ Neue Vorlage'));
  root.append(tplCard);

  const hist = p.sessions.filter((s) => s.type === 'kraft').slice(-15).reverse();
  root.append(card('Verlauf', hist.length ? hist.map((s) => h('button', { class: 'list-item', onclick: () => sessionDetail(ctx, s) },
    h('span', {}, h('strong', {}, s.name || 'Krafttraining'), h('span', { class: 'muted small block' }, fmtDate(s.date))),
    h('span', { class: 'muted small' }, s.loadOnly ? 'nur Uhr' : `${s.exercises.reduce((a, e) => a + e.sets.length, 0)} Sätze${s.garminId ? ' + Uhr' : ''}`))) : empty('Noch keine Krafteinheiten gespeichert.')));
}

export default {
  id: 'kraft', title: 'Kraft', icon: ICONS.kraft, order: 2, nav: true, optional: true,
  render(root, ctx) {
    const p = ctx.store.profile();
    if (p.draft && p.draft.type === 'kraft') renderDraft(root, ctx);
    else renderHome(root, ctx);
  },
};
