// Ernährung: Kalorien und Makros pro Tag, Bilanz gegen Ruhe- und Belastungsbedarf.
import { h, card, field, numInput, select, sheet, confirmSheet, toast, badge, fmt, empty } from '../core/ui.js';
import { ymd, addDays, parseYmd, fmtDate } from '../core/dates.js';
import { uid } from '../core/store.js';
import { SPORTS } from '../science/endurance.js';
import { DEFAULT_PRESETS, CATS, PRESETS_VERSION } from '../data/meals.js';
import { bmr, dayNeed, targets, sumDay, balance, settings, kcalFromMacros, scaleFood, sessionKcal, DEFAULT_SETTINGS } from '../science/nutrition.js';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8a3 3 0 006 0V3M10 3v18"/><path d="M17 3c-2 2-2 6 0 8v10"/></svg>';
const n = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));

function ensure(p) {
  p.nutrition = p.nutrition || {};
  p.nutrition.foods = p.nutrition.foods || [];
  p.nutrition.days = p.nutrition.days || {};
  p.nutrition.settings = { ...DEFAULT_SETTINGS, ...(p.nutrition.settings || {}) };
  if (!p.nutrition.presets) { p.nutrition.presets = DEFAULT_PRESETS.map((x) => ({ id: uid(), ...x })); p.nutrition.presetsVersion = PRESETS_VERSION; }
  if ((p.nutrition.presetsVersion || 1) < PRESETS_VERSION) {
    // Standard-Frühstück auf die neuen Werte bringen, solange es nicht von Hand geändert wurde (frühere Werte 869 und 884 kcal)
    const std = p.nutrition.presets.find((x) => x.key === 'std-fruehstueck');
    const neu = DEFAULT_PRESETS.find((x) => x.key === 'std-fruehstueck');
    if (std && [869, 884].includes(std.kcal)) Object.assign(std, { kcal: neu.kcal, p: neu.p, c: neu.c, f: neu.f, note: neu.note });
    // Lahmacun von mager auf normales Hack umgestellt (nur wenn noch unverändert)
    const lah = p.nutrition.presets.find((x) => x.key === 'g-protein-lahmacun' && x.kcal === 1080);
    const lahNeu = DEFAULT_PRESETS.find((x) => x.key === 'g-protein-lahmacun');
    if (lah && lahNeu) Object.assign(lah, { kcal: lahNeu.kcal, p: lahNeu.p, c: lahNeu.c, f: lahNeu.f, note: lahNeu.note });
    // Neue Vorlagen ergänzen, selbst gelöschte nicht zurückholen
    const have = new Set(p.nutrition.presets.map((x) => x.key).filter(Boolean));
    const removed = new Set(p.nutrition.removedKeys || []);
    for (const x of DEFAULT_PRESETS) if (!have.has(x.key) && !removed.has(x.key)) p.nutrition.presets.push({ id: uid(), ...x });
    p.nutrition.presetsVersion = PRESETS_VERSION;
  }
  return p.nutrition;
}

// ---------- Einträge
const presetEntry = (pr, qty = 1) => {
  const r = (v) => Math.round(n(v) * qty * 10) / 10;
  return { id: uid(), name: qty === 1 ? pr.name : `${fmt(qty, 1)} × ${pr.name}`, kcal: Math.round(n(pr.kcal) * qty), p: r(pr.p), c: r(pr.c), f: r(pr.f), presetId: pr.id };
};
function pushEntry(ctx, date, entry) {
  ctx.store.updateProfile((x) => { const d = ensure(x).days; (d[date] = d[date] || []).push(entry); });
  try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
}
function removeEntries(ctx, date, ids) {
  ctx.store.updateProfile((x) => { const d = ensure(x).days; d[date] = (d[date] || []).filter((y) => !ids.includes(y.id)); if (!d[date].length) delete d[date]; });
}
function restoreEntries(ctx, date, list) {
  ctx.store.updateProfile((x) => { const d = ensure(x).days; d[date] = [...(d[date] || []), ...list]; });
}
// Für die Startseite (dort wird danach neu gezeichnet)
function addPreset(ctx, date, pr, qty = 1) {
  const entry = presetEntry(pr, qty);
  pushEntry(ctx, date, entry);
  toast(`${entry.name} eingetragen.`, { label: 'Rückgängig', fn: () => { removeEntries(ctx, date, [entry.id]); ctx.rerender(); } });
  ctx.rerender();
}

// Gleiche Einträge zusammenfassen (z. B. zweimal dasselbe Gericht)
const groupKey = (e) => (e.presetId ? `p:${e.presetId}` : `n:${e.name}|${e.kcal}|${e.g || ''}`);
function groupEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = groupKey(e);
    if (!map.has(k)) map.set(k, { key: k, items: [] });
    map.get(k).items.push(e);
  }
  return [...map.values()];
}

const standardBreakfast = (p) => ensure(p).presets.find((x) => x.standard) || ensure(p).presets.find((x) => x.cat === 'fruehstueck');

function breakfastButton(ctx, date, small = false) {
  const pr = standardBreakfast(ctx.profile);
  if (!pr) return null;
  const done = (ensure(ctx.profile).days[date] || []).some((e) => e.presetId === pr.id);
  return h('button', { class: `btn ${done ? 'ghost' : 'primary'} full ${small ? 'small' : 'big'}`, onclick: () => addPreset(ctx, date, pr) },
    done ? `${pr.name} nochmal eintragen` : `${pr.name} eintragen (${fmt(pr.kcal)} kcal, ${fmt(pr.p)} g Eiweiß)`);
}

// Auswahl: Reiter pro Kategorie und Suche. Ein Tipp auf + trägt eine Portion ein, ohne dass die Seite springt.
let quickCat = 'gericht';
function quickCard(ctx, date, live) {
  const nu = ensure(ctx.profile);
  const cats = Object.keys(CATS).filter((cat) => nu.presets.some((x) => x.cat === cat && !x.standard));
  if (!cats.includes(quickCat)) quickCat = cats[0];
  let q = '';
  let all = false;
  const tabs = h('div', { class: 'seg' });
  const list = h('div', { class: 'meal-list' });
  const counts = () => {
    const c = {};
    for (const e of (ensure(ctx.profile).days[date] || [])) if (e.presetId) c[e.presetId] = (c[e.presetId] || 0) + 1;
    return c;
  };
  const row = (pr, cnt) => {
    const minus = () => {
      const last = [...(ensure(ctx.profile).days[date] || [])].reverse().find((e) => e.presetId === pr.id);
      if (last) { removeEntries(ctx, date, [last.id]); live.refresh(); }
    };
    const plus = () => { pushEntry(ctx, date, presetEntry(pr)); live.refresh(pr.id); };
    return h('div', { class: `pick-row${cnt ? ' on' : ''}`, 'data-id': pr.id },
      h('span', { class: 'pick-name' }, pr.name, h('span', { class: 'muted small block' }, `${fmt(pr.kcal)} kcal | ${fmt(pr.p)} g Eiweiß`)),
      cnt ? h('span', { class: 'stepper' },
        h('button', { type: 'button', class: 'step-btn', 'aria-label': `Eine Portion ${pr.name} weniger`, onclick: minus }, '−'),
        h('span', { class: 'step-count', 'aria-live': 'polite' }, `${cnt}×`),
        h('button', { type: 'button', class: 'step-btn plus', 'aria-label': `Eine Portion ${pr.name} mehr`, onclick: plus }, '+'))
        : h('button', { type: 'button', class: 'add-btn', 'aria-label': `${pr.name} eintragen`, onclick: plus }, '+'));
  };
  const draw = () => {
    tabs.replaceChildren(...cats.map((cat) => h('button', { type: 'button', class: `seg-btn ${!q && cat === quickCat ? 'active' : ''}`,
      onclick: () => { quickCat = cat; q = ''; all = false; search.value = ''; draw(); } }, CATS[cat])));
    const c = counts();
    const items = nu.presets.filter((x) => (q ? x.name.toLowerCase().includes(q.toLowerCase()) : x.cat === quickCat && !x.standard))
      .sort((x, y) => x.name.localeCompare(y.name, 'de'));
    const LIMIT = 8;
    const shown = q || all ? items : items.slice(0, LIMIT);
    list.replaceChildren(...(items.length ? shown.map((pr) => row(pr, c[pr.id] || 0)) : [h('p', { class: 'muted small' }, 'Nichts gefunden. Unten bei „Meine Vorlagen“ kannst du neue Gerichte anlegen.')]),
      ...(shown.length < items.length ? [h('button', { type: 'button', class: 'btn ghost small full', onclick: () => { all = true; draw(); } }, `Alle ${items.length} anzeigen`)] : []));
  };
  const search = h('input', { type: 'search', placeholder: 'Suchen, z. B. Lachs', 'aria-label': 'Gerichte durchsuchen', oninput: (e) => { q = e.target.value.trim(); draw(); } });
  draw();
  const std = standardBreakfast(ctx.profile);
  const bf = h('div', {});
  const drawBf = () => {
    const done = std && (ensure(ctx.profile).days[date] || []).some((e) => e.presetId === std.id);
    bf.replaceChildren(...(std && !done ? [h('button', { type: 'button', class: 'btn primary full', onclick: () => { pushEntry(ctx, date, presetEntry(std)); live.refresh(std.id); } },
      `${std.name} eintragen (${fmt(std.kcal)} kcal)`)] : []));
  };
  drawBf();
  live.onChange.push(() => { draw(); drawBf(); });
  return card('Essen hinzufügen', bf, search, tabs, list,
    h('p', { class: 'muted small' }, 'Gerichte sind auf 4 Portionen ausgelegt, die Werte gelten für eine.'));
}

function presetForm(pr, onSave) {
  const d = { name: pr.name || '', cat: pr.cat || 'gericht', kcal: pr.kcal ?? '', p: pr.p ?? '', c: pr.c ?? '', f: pr.f ?? '', note: pr.note || '' };
  return h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', value: d.name, placeholder: 'z. B. Lachs mit Ofengemüse', oninput: (e) => { d.name = e.target.value; } })),
    field('Kategorie', select(CATS, d.cat, (v) => { d.cat = v; }, 'Kategorie')),
    h('p', { class: 'muted small' }, 'Werte für eine Portion.'),
    h('div', { class: 'grid2' },
      field('Eiweiß (g)', numInput(d.p, (v) => { d.p = v; }, { decimal: true, label: 'Eiweiß' })),
      field('Kohlenhydrate (g)', numInput(d.c, (v) => { d.c = v; }, { decimal: true, label: 'Kohlenhydrate' }))),
    h('div', { class: 'grid2' },
      field('Fett (g)', numInput(d.f, (v) => { d.f = v; }, { decimal: true, label: 'Fett' })),
      field('kcal', numInput(d.kcal, (v) => { d.kcal = v; }, { label: 'Kalorien' }), 'leer = aus Makros')),
    field('Notiz', h('input', { type: 'text', value: d.note, placeholder: 'z. B. Zutaten', oninput: (e) => { d.note = e.target.value; } })),
    h('button', { type: 'button', class: 'btn primary full', onclick: () => {
      if (!d.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
      const kcal = d.kcal !== '' ? n(d.kcal) : kcalFromMacros(d.p, d.c, d.f);
      onSave({ name: d.name.trim(), cat: d.cat, kcal, p: n(d.p), c: n(d.c), f: n(d.f), note: d.note.trim() });
    } }, 'Speichern'));
}

function presetsCard(ctx, date) {
  const nu = ensure(ctx.profile);
  const edit = (pr) => sheet(pr ? 'Vorlage bearbeiten' : 'Neue Vorlage', (close) => presetForm(pr || {}, (val) => {
    ctx.store.updateProfile((x) => {
      const list = ensure(x).presets;
      if (pr) Object.assign(list.find((y) => y.id === pr.id) || {}, val); else list.push({ id: uid(), ...val });
    });
    toast('Vorlage gespeichert.'); close(); ctx.rerender();
  }));
  const todays = nu.days[date] || [];
  const rows = Object.keys(CATS).flatMap((cat) => {
    const list = nu.presets.filter((x) => x.cat === cat);
    if (!list.length) return [];
    return [h('p', { class: 'field-label' }, CATS[cat]), ...list.map((pr) => h('div', { class: 'list-item static' },
      h('button', { type: 'button', class: 'linklike', onclick: () => edit(pr) },
        h('strong', {}, pr.name, pr.standard ? ' (Standard)' : ''),
        h('span', { class: 'muted small block' }, `${fmt(pr.kcal)} kcal | E ${fmt(pr.p, 1)} | K ${fmt(pr.c, 1)} | F ${fmt(pr.f, 1)}${pr.note ? ` | ${pr.note}` : ''}`)),
      h('button', { class: 'icon-btn', 'aria-label': `${pr.name} löschen`, onclick: () => confirmSheet(`„${pr.name}“ löschen?`, 'Bereits eingetragene Mahlzeiten bleiben erhalten.', 'Löschen', () => {
        ctx.store.updateProfile((x) => { const nu = ensure(x); if (pr.key) nu.removedKeys = [...new Set([...(nu.removedKeys || []), pr.key])]; nu.presets = nu.presets.filter((y) => y.id !== pr.id); }); ctx.rerender(); }) }, '✕')))];
  });
  return card(`Meine Vorlagen (${nu.presets.length})`,
    h('details', { class: 'details' }, h('summary', {}, 'Vorlagen ansehen und bearbeiten'),
      h('p', { class: 'muted small' }, 'Tippe auf eine Vorlage, um Name oder Werte zu ändern.'), rows,
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn ghost small', onclick: () => edit(null) }, '+ Neue Vorlage'),
        todays.length ? h('button', { class: 'btn ghost small', onclick: () => sheet('Gericht aus Einträgen', (close) => presetForm(
          { name: '', cat: 'gericht', ...(() => { const t = sumDay(todays); return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) }; })(), note: todays.map((e) => e.name).join(', ') },
          (val) => { ctx.store.updateProfile((x) => ensure(x).presets.push({ id: uid(), ...val })); toast('Gericht gespeichert.'); close(); ctx.rerender(); })) },
        'Einträge dieses Tages als Gericht speichern') : null)));
}

// Balken: gegessene kcal mit Markierungen für Ruhe- und Belastungsbedarf und Zielbereich
function scale(eaten, need, tg) {
  const max = Math.max(eaten, tg.kcalHigh, need.total) * 1.12;
  const pos = (v) => `${Math.min(100, (v / max) * 100)}%`;
  return h('div', { class: 'kcal-scale', 'aria-hidden': 'true' },
    h('div', { class: 'kcal-band', style: { left: pos(tg.kcalLow), width: `calc(${pos(tg.kcalHigh)} - ${pos(tg.kcalLow)})` } }),
    h('div', { class: 'kcal-fill', style: { width: pos(eaten) } }),
    h('div', { class: 'kcal-mark', style: { left: pos(need.bmr) } }, h('span', {}, 'Ruhe')),
    h('div', { class: 'kcal-mark strong', style: { left: pos(need.total) } }, h('span', {}, 'Belastung')));
}

function macroBar(label, eaten, target, extra) {
  const pct = target ? Math.min(100, (eaten / target) * 100) : 0;
  return h('div', { class: 'macro' },
    h('div', { class: 'macro-head' }, h('span', {}, label), h('span', { class: 'muted small' }, `${fmt(eaten)} / ${fmt(target)} g${extra ? `  ${extra}` : ''}`)),
    h('div', { class: 'macro-track' }, h('div', { class: `macro-fill ${eaten > target * 1.1 ? 'over' : ''}`, style: { width: `${pct}%` } })));
}

function addSheet(ctx, date, live) {
  const p = ctx.profile;
  const nu = ensure(p);
  const add = (entry) => {
    pushEntry(ctx, date, { id: uid(), ...entry });
    toast(`${entry.name}: ${fmt(entry.kcal)} kcal eingetragen.`);
    live.refresh();
  };
  sheet(`Essen eintragen: ${fmtDate(date)}`, (close) => {
    let mode = 'vorlagen';
    const box = h('div', {});
    const recent = [];
    const seen = new Set();
    for (const d of Object.keys(nu.days).sort().reverse()) for (const e of [...nu.days[d]].reverse()) {
      if (recent.length >= 8) break;
      if (!seen.has(e.name)) { seen.add(e.name); recent.push(e); }
    }
    const draw = () => {
      const tabs = h('div', { class: 'chips' },
        h('button', { type: 'button', class: `chip ${mode === 'vorlagen' ? 'active' : ''}`, onclick: () => { mode = 'vorlagen'; draw(); } }, 'Vorlagen'),
        h('button', { type: 'button', class: `chip ${mode === 'liste' ? 'active' : ''}`, onclick: () => { mode = 'liste'; draw(); } }, 'Lebensmittel'),
        h('button', { type: 'button', class: `chip ${mode === 'schnell' ? 'active' : ''}`, onclick: () => { mode = 'schnell'; draw(); } }, 'Schnell eintippen'));
      const parts = [tabs];
      if (recent.length) parts.push(h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Zuletzt gegessen, nochmal'),
        h('div', { class: 'chips wrap' }, recent.map((e) => h('button', { type: 'button', class: 'chip',
          onclick: () => { add({ name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, g: e.g, foodId: e.foodId }); close(); } },
          `${e.name}${e.g ? ` ${e.g} g` : ''}`)))));
      if (mode === 'vorlagen') {
        for (const cat of Object.keys(CATS)) {
          const list = nu.presets.filter((x) => x.cat === cat);
          if (!list.length) continue;
          parts.push(h('div', { class: 'field' }, h('span', { class: 'field-label' }, CATS[cat]),
            list.map((pr) => {
              let qty = 1;
              const q = numInput(qty, (v) => { qty = v; }, { label: `Anzahl ${pr.name}`, class: 'narrow', decimal: true });
              return h('div', { class: 'food-row' },
                h('div', {}, h('strong', {}, pr.name), h('div', { class: 'muted small' }, `${fmt(pr.kcal)} kcal | E ${fmt(pr.p, 1)} | K ${fmt(pr.c, 1)} | F ${fmt(pr.f, 1)}`)),
                h('div', { class: 'row gap' }, q, h('span', { class: 'muted small' }, '×'),
                  h('button', { type: 'button', class: 'btn primary small', onclick: () => { const e = presetEntry(pr, n(qty) || 1); pushEntry(ctx, date, e); toast(`${e.name} eingetragen.`); live.refresh(); close(); } }, '+')));
            })));
        }
      } else if (mode === 'liste') {
        let q = '';
        const list = h('div', {});
        const drawList = () => list.replaceChildren(...(nu.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
          .map((f) => {
            let g = f.portionG || 100;
            const info = h('span', { class: 'muted small' });
            const upd = () => { const v = scaleFood(f, g); info.textContent = `${v.kcal} kcal | E ${v.p} | K ${v.c} | F ${v.f}`; };
            upd();
            return h('div', { class: 'food-row' },
              h('div', {}, h('strong', {}, f.name), h('div', {}, info)),
              h('div', { class: 'row gap' },
                numInput(g, (v) => { g = v; upd(); }, { label: `Gramm ${f.name}`, class: 'narrow', decimal: true }),
                h('span', { class: 'muted small' }, 'g'),
                h('button', { type: 'button', class: 'btn primary small', onclick: () => { add({ name: f.name, g: n(g), foodId: f.id, ...scaleFood(f, g) }); close(); } }, '+')));
          })));
        drawList();
        parts.push(h('input', { type: 'search', placeholder: 'Lebensmittel suchen', 'aria-label': 'Lebensmittel suchen', oninput: (e) => { q = e.target.value; drawList(); } }), list,
          nu.foods.length ? null : h('p', { class: 'muted small' }, 'Noch keine Lebensmittel gespeichert. Leg sie unten auf der Ernährungsseite an oder nutze „Schnell eintippen“.'));
      } else {
        const d = { name: '', kcal: '', p: '', c: '', f: '' };
        parts.push(h('div', { class: 'form' },
          field('Was', h('input', { type: 'text', placeholder: 'z. B. Mittagessen Mensa', oninput: (e) => { d.name = e.target.value; } })),
          h('div', { class: 'grid2' },
            field('Eiweiß (g)', numInput('', (v) => { d.p = v; }, { decimal: true, label: 'Eiweiß' })),
            field('Kohlenhydrate (g)', numInput('', (v) => { d.c = v; }, { decimal: true, label: 'Kohlenhydrate' }))),
          h('div', { class: 'grid2' },
            field('Fett (g)', numInput('', (v) => { d.f = v; }, { decimal: true, label: 'Fett' })),
            field('kcal', numInput('', (v) => { d.kcal = v; }, { label: 'Kalorien' }), 'leer = aus Makros')),
          h('button', { type: 'button', class: 'btn primary full', onclick: () => {
            const kcal = d.kcal !== '' ? n(d.kcal) : kcalFromMacros(d.p, d.c, d.f);
            if (!kcal) { toast('Bitte kcal oder Makros eintragen.'); return; }
            add({ name: d.name.trim() || 'Eintrag', kcal, p: n(d.p), c: n(d.c), f: n(d.f) }); close();
          } }, 'Eintragen')));
      }
      box.replaceChildren(...parts);
    };
    draw();
    return box;
  });
}

function foodsCard(ctx) {
  const p = ctx.profile;
  const nu = ensure(p);
  const d = { name: '', kcal: '', p: '', c: '', f: '', portionG: '' };
  const form = h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', placeholder: 'z. B. Skyr natur', oninput: (e) => { d.name = e.target.value; } })),
    h('p', { class: 'muted small' }, 'Werte pro 100 g, wie auf der Packung.'),
    h('div', { class: 'grid2' },
      field('Eiweiß', numInput('', (v) => { d.p = v; }, { decimal: true, label: 'Eiweiß pro 100 g' })),
      field('Kohlenhydrate', numInput('', (v) => { d.c = v; }, { decimal: true, label: 'Kohlenhydrate pro 100 g' }))),
    h('div', { class: 'grid2' },
      field('Fett', numInput('', (v) => { d.f = v; }, { decimal: true, label: 'Fett pro 100 g' })),
      field('kcal', numInput('', (v) => { d.kcal = v; }, { label: 'kcal pro 100 g' }), 'leer = aus Makros')),
    field('Übliche Portion (g)', numInput('', (v) => { d.portionG = v; }, { label: 'Portion in Gramm' }), 'wird beim Eintragen vorgeschlagen'),
    h('button', { type: 'button', class: 'btn primary full', onclick: () => {
      if (!d.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
      const kcal = d.kcal !== '' ? n(d.kcal) : kcalFromMacros(d.p, d.c, d.f);
      ctx.store.updateProfile((x) => ensure(x).foods.push({ id: uid(), name: d.name.trim(), kcal, p: n(d.p), c: n(d.c), f: n(d.f), portionG: n(d.portionG) || 100 }));
      ctx.store.updateProfile((x) => ensure(x).foods.sort((a, b) => a.name.localeCompare(b.name, 'de')));
      toast('Lebensmittel gespeichert.'); ctx.rerender();
    } }, 'Speichern'));
  return card(`Meine Lebensmittel (${nu.foods.length})`,
    nu.foods.map((f) => h('div', { class: 'list-item static' },
      h('span', {}, h('strong', {}, f.name), h('span', { class: 'muted small block' }, `pro 100 g: ${fmt(f.kcal)} kcal | E ${fmt(f.p, 1)} | K ${fmt(f.c, 1)} | F ${fmt(f.f, 1)} | Portion ${fmt(f.portionG)} g`)),
      h('button', { class: 'icon-btn', 'aria-label': `${f.name} löschen`, onclick: () => confirmSheet(`„${f.name}“ löschen?`, 'Bereits eingetragene Mahlzeiten bleiben erhalten.', 'Löschen', () => {
        ctx.store.updateProfile((x) => { ensure(x).foods = ensure(x).foods.filter((y) => y.id !== f.id); }); ctx.rerender(); }) }, '✕'))),
    h('details', { class: 'details' }, h('summary', {}, 'Neues Lebensmittel anlegen'), form));
}

function basicsCard(ctx, open) {
  const p = ctx.profile;
  const st = settings(p);
  const set = (fn) => ctx.store.updateProfile(fn);
  const setS = (k, v, def) => set((x) => { ensure(x).settings[k] = v === '' ? def : v; });
  const b = bmr(p);
  return card('Grundlagen',
    h('details', { class: 'details', open: open || null }, h('summary', {}, open ? 'Bitte ausfüllen' : 'Körperdaten und Faktoren anpassen'),
      h('div', { class: 'form' },
        h('div', { class: 'grid2' },
          field('Gewicht (kg)', numInput(p.body.weightKg, (v) => set((x) => { x.body.weightKg = v; }), { decimal: true, step: 0.1, label: 'Gewicht' })),
          field('Körperfett (%)', numInput(p.body.bodyFatPct, (v) => set((x) => { x.body.bodyFatPct = v; }), { decimal: true, step: 0.1, label: 'Körperfett in Prozent' }), 'z. B. aus der Körperanalyse')),
        h('div', { class: 'grid2' },
          field('Größe (cm)', numInput(p.body.heightCm, (v) => set((x) => { x.body.heightCm = v; }), { label: 'Größe' })),
          field('Geburtsjahr', numInput(p.body.birthYear, (v) => set((x) => { x.body.birthYear = v; }), { label: 'Geburtsjahr' }))),
        field('Geschlecht', select({ '': 'bitte wählen', m: 'männlich', w: 'weiblich' }, p.body.sex || '', (v) => set((x) => { x.body.sex = v; }), 'Geschlecht'),
          'nur nötig, wenn kein Körperfettanteil eingetragen ist'),
        field('Alltagsfaktor (PAL)', numInput(st.pal, (v) => setS('pal', v, DEFAULT_SETTINGS.pal), { decimal: true, step: 0.05, label: 'Alltagsfaktor' }),
          '1,3 viel Sitzen | 1,4 Lehrer, viel Stehen und Gehen | 1,6 körperliche Arbeit. Training ist hier nicht enthalten, es kommt je Einheit dazu.'),
        h('div', { class: 'grid2' },
          field('Eiweiß (g/kg)', numInput(st.proteinPerKg, (v) => setS('proteinPerKg', v, DEFAULT_SETTINGS.proteinPerKg), { decimal: true, step: 0.1, label: 'Eiweiß pro kg' }), 'Muskelaufbau 1,6 bis 2,2'),
          field('Fett (g/kg)', numInput(st.fatPerKg, (v) => setS('fatPerKg', v, DEFAULT_SETTINGS.fatPerKg), { decimal: true, step: 0.1, label: 'Fett pro kg' }), 'mindestens etwa 0,8')),
        h('p', { class: 'muted small' }, b.value ? `Ruhebedarf ${fmt(b.value)} kcal nach ${b.method}.` : `Für den Ruhebedarf fehlt: ${b.missing}.`),
        h('button', { class: 'btn ghost small', onclick: () => ctx.rerender() }, 'Neu berechnen'))));
}

function weekCard(p, end) {
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = ymd(addDays(parseYmd(end), -i));
    const entries = (p.nutrition.days || {})[d] || [];
    const need = dayNeed(p, d);
    const eaten = sumDay(entries).kcal;
    const tg = need.ready ? targets(p, need) : null;
    const bal = entries.length && tg ? balance(eaten, need, tg) : null;
    rows.push(h('div', { class: 'list-item static' },
      h('span', {}, h('strong', {}, fmtDate(d)), h('span', { class: 'muted small block' },
        entries.length ? `${fmt(eaten)} kcal gegessen | Bedarf ${need.ready ? fmt(need.total) : '–'}` : `nichts eingetragen | Bedarf ${need.ready ? fmt(need.total) : '–'}`)),
      bal ? badge(bal.level, `${bal.diff > 0 ? '+' : ''}${fmt(bal.diff)}`) : h('span', { class: 'muted small' }, '–')));
  }
  return card('Letzte 7 Tage', rows);
}

// Vorlagen anlegen bzw. auf den neuen Stand bringen und dauerhaft speichern
function migrate(ctx) {
  const p = ctx.profile;
  if (!p.nutrition || !p.nutrition.presets || (p.nutrition.presetsVersion || 1) < PRESETS_VERSION) ctx.store.updateProfile((x) => ensure(x));
}

// Kleine Karte für die Startseite: zwei Fortschrittsbalken und zwei Knöpfe
export function ernaehrungCard(ctx) {
  migrate(ctx);
  const p = ctx.profile;
  const d = ymd();
  const need = dayNeed(p, d);
  const eaten = sumDay(((p.nutrition || {}).days || {})[d]);
  const tg = need.ready ? targets(p, need) : null;
  const pr = standardBreakfast(p);
  const done = pr && ((p.nutrition.days || {})[d] || []).some((e) => e.presetId === pr.id);
  const bar = (label, val, target, unit) => h('div', { class: 'macro' },
    h('div', { class: 'macro-head' }, h('span', {}, label), h('span', { class: 'muted small' }, `${fmt(val)} / ${fmt(target)} ${unit}`)),
    h('div', { class: 'macro-track' }, h('div', { class: 'macro-fill', style: { width: `${target ? Math.min(100, (val / target) * 100) : 0}%` } })));
  return card('Ernährung heute',
    tg ? [bar('Kalorien', eaten.kcal, tg.kcalMid, 'kcal'), bar('Eiweiß', eaten.p, tg.protein, 'g')]
      : h('p', { class: 'muted small' }, 'Trag einmal deine Körperdaten ein, dann rechnet die App deinen Bedarf.'),
    h('div', { class: 'quick tight' },
      pr && !done ? h('button', { class: 'btn primary small', onclick: () => addPreset(ctx, d, pr) }, 'Frühstück eintragen') : null,
      h('button', { class: `btn ghost small${pr && !done ? '' : ' span2'}`, onclick: () => ctx.go('ernaehrung') }, '+ Essen eintragen')));
}

function render(root, ctx) {
  const p = ctx.profile;
  migrate(ctx);
  ensure(p);
  const today = ymd();
  let date = sessionStorageGet() || today;
  if (date > today) date = today;
  const go = (d) => { sessionStorageSet(d); ctx.rerender(); };

  root.append(h('div', { class: 'day-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Vortag', onclick: () => go(ymd(addDays(parseYmd(date), -1))) }, '‹'),
    h('strong', {}, date === today ? `Heute, ${fmtDate(date, false)}` : fmtDate(date)),
    h('button', { class: 'icon-btn', 'aria-label': 'Folgetag', disabled: date >= today, onclick: () => go(ymd(addDays(parseYmd(date), 1))) }, '›')));

  const need = dayNeed(p, date);
  const tg = need.ready ? targets(p, need) : null;
  const sess = p.sessions.filter((s) => s.date && s.date.slice(0, 10) === date);
  const live = { onChange: [], refresh: null };
  // Zuletzt angetipptes Element merken (iOS gibt Knöpfen beim Tippen keinen Fokus)
  let lastTap = null;
  root.addEventListener('pointerdown', (e) => { lastTap = e.target; }, true);

  // Übersicht: Bilanz und Makros, wird bei jeder Änderung neu gefüllt
  const summary = h('section', { class: 'card' });
  const drawSummary = () => {
    const eaten = sumDay(p.nutrition.days[date] || []);
    if (!need.ready) {
      summary.replaceChildren(h('h2', { class: 'card-title' }, 'Heute gegessen'),
        h('div', { class: 'kcal-big' }, h('strong', {}, fmt(eaten.kcal)), h('span', { class: 'muted' }, ' kcal')),
        h('p', { class: 'muted small' }, `Für Bedarf und Ziele fehlt noch: ${need.missing}.`));
      return;
    }
    const bal = balance(eaten.kcal, need, tg);
    summary.replaceChildren(h('h2', { class: 'card-title' }, 'Kalorienbilanz'),
      h('div', { class: 'kcal-big' }, h('strong', {}, fmt(eaten.kcal)), h('span', { class: 'muted' }, ` von ${fmt(tg.kcalLow)} bis ${fmt(tg.kcalHigh)} kcal`),
        bal ? h('span', { class: 'kcal-badge' }, badge(bal.level, `${bal.label}, ${bal.diff > 0 ? '+' : ''}${fmt(bal.diff)} kcal`)) : null),
      scale(eaten.kcal, need, tg),
      macroBar('Eiweiß', eaten.p, tg.protein, p.body.weightKg ? `(${fmt(eaten.p / n(p.body.weightKg), 1)} g/kg)` : ''),
      macroBar('Kohlenhydrate', eaten.c, tg.carbs),
      macroBar('Fett', eaten.f, tg.fat),
      h('details', { class: 'details' }, h('summary', {}, 'Bedarf im Detail'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Ruhebedarf'), h('div', { class: 'stat-value' }, fmt(need.bmr)), h('div', { class: 'stat-sub' }, 'Grundumsatz')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Belastungsbedarf'), h('div', { class: 'stat-value' }, fmt(need.total)),
            h('div', { class: 'stat-sub' }, `Alltag ${fmt(need.daily)} + Training ${fmt(need.training)}`))),
        h('p', { class: 'muted small' }, `Ziel für ${GOAL_TEXT(p)}: ${tg.band.label}, also ${fmt(tg.kcalLow)} bis ${fmt(tg.kcalHigh)} kcal (grüner Bereich).`),
        ...sess.map((s) => h('p', { class: 'small' }, `${s.type === 'kraft' ? (s.name || 'Krafttraining') : (SPORTS[s.sport]?.label || s.sport)}, ${fmt(s.durationMin)} min: ${fmt(sessionKcal(p, s, need.bmr))} kcal ${s.kcal ? '(Garmin)' : '(geschätzt)'}`))));
  };

  // Gegessen: gleiche Einträge zusammengefasst, mit − und + und Entfernen (mit Rückgängig)
  const eatenCard = h('section', { class: 'card' });
  const drawEaten = (flashId) => {
    const entries = p.nutrition.days[date] || [];
    const groups = groupEntries(entries);
    const presets = ensure(p).presets;
    eatenCard.replaceChildren(h('h2', { class: 'card-title' }, date === today ? 'Heute gegessen' : 'Gegessen', entries.length ? h('span', { class: 'muted small' }, `  ${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`) : null),
      ...(groups.length ? groups.map((g) => {
        const e = g.items[0];
        const cnt = g.items.length;
        const sum = sumDay(g.items);
        const pr = e.presetId ? presets.find((x) => x.id === e.presetId) : null;
        const plus = () => { pushEntry(ctx, date, pr ? presetEntry(pr) : { ...e, id: uid() }); live.refresh(e.presetId); };
        const minus = () => { removeEntries(ctx, date, [g.items[cnt - 1].id]); live.refresh(); };
        const drop = () => {
          const gone = g.items;
          removeEntries(ctx, date, gone.map((x) => x.id)); live.refresh();
          toast(`${e.name} entfernt.`, { label: 'Rückgängig', fn: () => { restoreEntries(ctx, date, gone); live.refresh(); } });
        };
        return h('div', { class: `eat-row${flashId && e.presetId === flashId ? ' flash' : ''}` },
          h('span', { class: 'eat-main' }, h('strong', {}, e.name, e.g ? ` (${fmt(e.g)} g)` : ''),
            h('span', { class: 'muted small block' }, `${fmt(sum.kcal)} kcal | E ${fmt(sum.p)} g | K ${fmt(sum.c)} g | F ${fmt(sum.f)} g`)),
          h('span', { class: 'stepper' },
            h('button', { type: 'button', class: 'step-btn', 'aria-label': `${e.name}: eine weniger`, onclick: cnt > 1 ? minus : drop }, '−'),
            h('span', { class: 'step-count' }, `${cnt}×`),
            h('button', { type: 'button', class: 'step-btn plus', 'aria-label': `${e.name}: eine mehr`, onclick: plus }, '+')),
          cnt > 1 ? h('button', { type: 'button', class: 'eat-drop', onclick: drop }, 'alle entfernen') : null);
      }) : [empty('Noch nichts eingetragen. Wähle unten ein Gericht aus.')]));
  };

  live.refresh = (flashId) => {
    const anchor = lastTap && lastTap.isConnected ? lastTap.closest('.pick-row, .eat-row, .card') : null;
    const id = anchor && anchor.dataset.id;
    const inPick = anchor && anchor.closest('.meal-list');
    const before = anchor ? anchor.getBoundingClientRect().top : null;
    drawSummary(); drawEaten(flashId); live.onChange.forEach((fn) => fn());
    if (before !== null && inPick) {
      const now = (id && root.querySelector(`.meal-list .pick-row[data-id="${id}"]`)) || quick;
      window.scrollBy(0, now.getBoundingClientRect().top - before);
    }
  };
  drawSummary();
  drawEaten();
  root.append(summary, eatenCard);
  const quick = quickCard(ctx, date, live);
  root.append(quick);
  root.append(h('button', { class: 'btn ghost full', onclick: () => addSheet(ctx, date, live) }, '+ Andere Menge, Lebensmittel oder frei eintippen'));
  if (!need.ready) root.append(basicsCard(ctx, true));

  if (need.ready) root.append(weekCard(p, date));
  root.append(presetsCard(ctx, date));
  root.append(foodsCard(ctx));
  if (need.ready) root.append(basicsCard(ctx, false));
  root.append(h('p', { class: 'muted small' }, 'Alle Bedarfswerte sind Schätzungen mit etwa ±10 % Spielraum. Aussagekräftiger als ein einzelner Tag ist der Wochentrend zusammen mit deinem Gewichtsverlauf.'));
}

const GOAL_TEXT = (p) => ({ hypertrophie: 'Muskelaufbau', kraft: 'Maximalkraft', rekomposition: 'Körperkomposition', ausdauer: 'Ausdauer', hybrid: 'Hybrid', gesundheit: 'Gesundheit' }[p.goal] || 'dein Ziel');

// Gewählter Tag bleibt beim Neuzeichnen erhalten
function sessionStorageGet() { try { return sessionStorage.getItem('ernaehrung.date'); } catch (e) { return memDate; } }
let memDate = null;
function sessionStorageSet(d) { memDate = d; try { sessionStorage.setItem('ernaehrung.date', d); } catch (e) {} }

export default { id: 'ernaehrung', title: 'Ernährung', icon: ICON, order: 3.5, nav: true, optional: true, render };
