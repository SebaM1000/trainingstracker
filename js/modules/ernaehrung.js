// Ernährung: Kalorien und Makros pro Tag, Bilanz gegen Ruhe- und Belastungsbedarf.
import { h, card, field, numInput, select, sheet, confirmSheet, toast, badge, fmt, empty } from '../core/ui.js';
import { ymd, addDays, parseYmd, fmtDate } from '../core/dates.js';
import { uid } from '../core/store.js';
import { SPORTS } from '../science/endurance.js';
import { bmr, dayNeed, targets, sumDay, balance, settings, kcalFromMacros, scaleFood, sessionKcal, DEFAULT_SETTINGS } from '../science/nutrition.js';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8a3 3 0 006 0V3M10 3v18"/><path d="M17 3c-2 2-2 6 0 8v10"/></svg>';
const n = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));

function ensure(p) {
  p.nutrition = p.nutrition || {};
  p.nutrition.foods = p.nutrition.foods || [];
  p.nutrition.days = p.nutrition.days || {};
  p.nutrition.settings = { ...DEFAULT_SETTINGS, ...(p.nutrition.settings || {}) };
  return p.nutrition;
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

function addSheet(ctx, date) {
  const p = ctx.profile;
  const nu = ensure(p);
  const add = (entry) => {
    ctx.store.updateProfile((x) => { const d = ensure(x).days; (d[date] = d[date] || []).push({ id: uid(), ...entry }); });
    toast(`${entry.name}: ${fmt(entry.kcal)} kcal eingetragen.`);
    ctx.rerender();
  };
  sheet(`Essen eintragen: ${fmtDate(date)}`, (close) => {
    let mode = nu.foods.length ? 'liste' : 'schnell';
    const box = h('div', {});
    const recent = [];
    const seen = new Set();
    for (const d of Object.keys(nu.days).sort().reverse()) for (const e of [...nu.days[d]].reverse()) {
      if (recent.length >= 8) break;
      if (!seen.has(e.name)) { seen.add(e.name); recent.push(e); }
    }
    const draw = () => {
      const tabs = h('div', { class: 'chips' },
        h('button', { type: 'button', class: `chip ${mode === 'liste' ? 'active' : ''}`, onclick: () => { mode = 'liste'; draw(); } }, 'Aus meiner Liste'),
        h('button', { type: 'button', class: `chip ${mode === 'schnell' ? 'active' : ''}`, onclick: () => { mode = 'schnell'; draw(); } }, 'Schnell eintippen'));
      const parts = [tabs];
      if (recent.length) parts.push(h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Zuletzt gegessen, nochmal'),
        h('div', { class: 'chips wrap' }, recent.map((e) => h('button', { type: 'button', class: 'chip',
          onclick: () => { add({ name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, g: e.g, foodId: e.foodId }); close(); } },
          `${e.name}${e.g ? ` ${e.g} g` : ''}`)))));
      if (mode === 'liste') {
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

// Kleine Karte für die Startseite
export function ernaehrungCard(ctx) {
  const p = ctx.profile;
  const d = ymd();
  const need = dayNeed(p, d);
  const eaten = sumDay(((p.nutrition || {}).days || {})[d]);
  const tg = need.ready ? targets(p, need) : null;
  const bal = tg && eaten.kcal ? balance(eaten.kcal, need, tg) : null;
  return card('Ernährung heute',
    need.ready
      ? h('p', { class: 'small' }, `${fmt(eaten.kcal)} von ${fmt(tg.kcalMid)} kcal | Eiweiß ${fmt(eaten.p)} von ${fmt(tg.protein)} g `, bal ? badge(bal.level, bal.label) : null)
      : h('p', { class: 'muted small' }, 'Trag einmal deine Körperdaten ein, dann rechnet die App deinen Bedarf.'),
    h('button', { class: 'btn ghost small', onclick: () => ctx.go('ernaehrung') }, 'Essen eintragen'));
}

function render(root, ctx) {
  const p = ctx.profile;
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
  const entries = p.nutrition.days[date] || [];
  const eaten = sumDay(entries);

  if (!need.ready) {
    root.append(card('Bedarf', h('p', { class: 'muted small' }, `Damit die App Ruhe- und Belastungsbedarf rechnen kann, fehlt noch: ${need.missing}.`)));
    root.append(basicsCard(ctx, true));
  } else {
    const tg = targets(p, need);
    const bal = balance(eaten.kcal, need, tg);
    const sess = p.sessions.filter((s) => s.date && s.date.slice(0, 10) === date);
    root.append(card('Kalorienbilanz',
      h('div', { class: 'kcal-big' }, h('strong', {}, fmt(eaten.kcal)), h('span', { class: 'muted' }, ' kcal gegessen'),
        bal ? h('span', { class: 'kcal-badge' }, badge(bal.level, `${bal.label}, ${bal.diff > 0 ? '+' : ''}${fmt(bal.diff)} kcal`)) : null),
      scale(eaten.kcal, need, tg),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Ruhebedarf'), h('div', { class: 'stat-value' }, fmt(need.bmr)), h('div', { class: 'stat-sub' }, 'Grundumsatz')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Belastungsbedarf'), h('div', { class: 'stat-value' }, fmt(need.total)),
          h('div', { class: 'stat-sub' }, `Alltag ${fmt(need.daily)} + Training ${fmt(need.training)}`))),
      h('p', { class: 'muted small' }, `Ziel für ${GOAL_TEXT(p)}: ${tg.band.label}, also ${fmt(tg.kcalLow)} bis ${fmt(tg.kcalHigh)} kcal (grüner Bereich).`),
      sess.length ? h('details', { class: 'details' }, h('summary', {}, `Training an diesem Tag (${sess.length})`),
        sess.map((s) => h('p', { class: 'small' }, `${s.type === 'kraft' ? (s.name || 'Krafttraining') : (SPORTS[s.sport]?.label || s.sport)}, ${fmt(s.durationMin)} min: ${fmt(sessionKcal(p, s, need.bmr))} kcal ${s.kcal ? '(Garmin)' : '(geschätzt)'}`))) : null));

    root.append(card('Makros',
      macroBar('Eiweiß', eaten.p, tg.protein, p.body.weightKg ? `(${fmt(eaten.p / n(p.body.weightKg), 1)} g/kg)` : ''),
      macroBar('Kohlenhydrate', eaten.c, tg.carbs),
      macroBar('Fett', eaten.f, tg.fat)));
  }

  root.append(h('button', { class: 'btn primary full big', onclick: () => addSheet(ctx, date) }, '+ Essen eintragen'));

  root.append(card(`Eingetragen (${entries.length})`, entries.length ? entries.map((e) => h('div', { class: 'list-item static' },
    h('span', {}, h('strong', {}, e.name, e.g ? ` (${fmt(e.g)} g)` : ''),
      h('span', { class: 'muted small block' }, `${fmt(e.kcal)} kcal | E ${fmt(e.p, 1)} | K ${fmt(e.c, 1)} | F ${fmt(e.f, 1)}`)),
    h('button', { class: 'icon-btn', 'aria-label': `${e.name} löschen`, onclick: () => confirmSheet(`„${e.name}“ entfernen?`, '', 'Entfernen', () => {
      ctx.store.updateProfile((x) => { const d = ensure(x).days; d[date] = (d[date] || []).filter((y) => y.id !== e.id); if (!d[date].length) delete d[date]; }); ctx.rerender(); }) }, '✕')))
    : empty('Noch nichts eingetragen.')));

  if (need.ready) root.append(weekCard(p, date));
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
