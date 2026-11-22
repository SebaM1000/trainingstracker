// Fortschritt: Belastung, Volumen pro Muskel, Intensitätsverteilung, Kraftverlauf.
import { h, card, select, fmt, stat, badge, empty } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { startOfWeek, addDays, fmtDate, isoWeek, inRange, ymd } from '../core/dates.js';
import { barChart, lineChart, rangeBars, distBar } from '../core/charts.js';
import { weekSummary, weeksBack, acwr, acwrStatus, monotony } from '../science/load.js';
import { volumeByMuscle, historyFor, sessionBestE1rm } from '../science/strength.js';
import { exerciseById, MUSCLES } from '../data/exercises.js';

let weekOffset = 0;
let chosenEx = null;

export default {
  id: 'fortschritt', title: 'Fortschritt', icon: ICONS.fortschritt, order: 4, nav: true, optional: true,
  render(root, ctx) {
    const p = ctx.profile;
    if (!p.sessions.length) { root.append(empty('Sobald du Einheiten speicherst, erscheinen hier deine Auswertungen.')); return; }

    // Wochenauswahl
    const ws = addDays(startOfWeek(new Date()), 7 * weekOffset);
    const we = addDays(ws, 6);
    root.append(h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Vorherige Woche', onclick: () => { weekOffset--; ctx.rerender(); } }, '‹'),
      h('strong', {}, `KW ${isoWeek(ws)}: ${fmtDate(ymd(ws), false)} bis ${fmtDate(ymd(we), false)}`),
      h('button', { class: 'icon-btn', 'aria-label': 'Nächste Woche', disabled: weekOffset >= 0, onclick: () => { weekOffset++; ctx.rerender(); } }, '›')));

    const w = weekSummary(p, ws);
    if (p.settings.modules.kraft !== false) {
      const { vol } = volumeByMuscle(p, w.sessions);
      const rows = Object.entries(MUSCLES).map(([k, l]) => ({ label: l, value: vol[k] }));
      root.append(card('Sätze pro Muskel',
        h('p', { class: 'muted small' }, `Zielbereich ${p.params.setsMin}–${p.params.setsMax} Sätze (Band). Direkte Sätze zählen 1, indirekte 0,5.`),
        rangeBars(rows, p.params.setsMin, p.params.setsMax)));
    }
    if (p.settings.modules.ausdauer !== false) {
      root.append(card('Intensitätsverteilung Ausdauer', distBar(w.dist, p.params.lowShare)));
    }

    // Verläufe über 8 Wochen
    const weeks = weeksBack(8).map((d) => ({ d, s: weekSummary(p, d) }));
    root.append(card('Wochenlast (8 Wochen)',
      barChart(weeks.map(({ d, s }, i) => ({ label: `KW${isoWeek(d)}`, value: s.load, current: i === 7,
        tip: `KW ${isoWeek(d)}: ${fmt(s.load)} AU, ${s.sessions.length} Einheiten` })), { unit: 'AU', title: 'Wochenlast' })));
    if (p.settings.modules.ausdauer !== false) {
      root.append(card('Ausdauer-Minuten (8 Wochen)',
        barChart(weeks.map(({ d, s }, i) => ({ label: `KW${isoWeek(d)}`, value: s.endMin, current: i === 7 })),
          { unit: 'min', target: p.params.enduranceMin, title: 'Ausdauerminuten' })));
    }

    const a = acwr(p.sessions);
    const mo = monotony(p.sessions);
    const st = acwrStatus(a && a.daysOfData >= 21 ? a.ratio : null);
    root.append(card('Belastungssteuerung',
      h('div', { class: 'stats' },
        stat('Akut (7 T.)', fmt(a?.acute * 7), 'AU/Woche, gewichtet'),
        stat('Chronisch (28 T.)', fmt(a?.chronic * 7), 'AU/Woche, gewichtet'),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Verhältnis'),
          h('div', { class: 'stat-value' }, a && a.daysOfData >= 21 && a.ratio ? a.ratio.toFixed(2) : '–'), h('div', { class: 'stat-sub' }, badge(st.level, st.label))),
        stat('Monotonie', mo.monotony ? mo.monotony.toFixed(1) : '–', mo.monotony > 2 ? 'hoch (> 2)' : 'letzte 7 Tage')),
      h('p', { class: 'muted small' }, 'Das Verhältnis akut : chronisch ist nur ein grober Hinweis auf sprunghafte Steigerungen, keine Verletzungsprognose.')));

    // Kraftverlauf
    if (p.settings.modules.kraft !== false) {
      const used = [...new Set(p.sessions.filter((s) => s.type === 'kraft').flatMap((s) => s.exercises.map((e) => e.exId)))];
      if (used.length) {
        if (!used.includes(chosenEx)) chosenEx = used[0];
        const hist = historyFor(p, chosenEx);
        const pts = hist.map((x) => ({ label: fmtDate(x.date, false).slice(0, 5), y: sessionBestE1rm(x.ex),
          tip: `${fmtDate(x.date, false)}: e1RM ${fmt(sessionBestE1rm(x.ex), 1)} kg` })).filter((x) => x.y);
        const best = Math.max(...pts.map((x) => x.y));
        root.append(card('Kraftentwicklung (e1RM)',
          select(Object.fromEntries(used.map((id) => [id, exerciseById(p, id)?.name || id])), chosenEx, (v) => { chosenEx = v; ctx.rerender(); }, 'Übung wählen'),
          h('p', { class: 'muted small' }, `Geschätztes 1RM aus Gewicht, Wiederholungen und RIR. Bestwert: ${fmt(best, 1)} kg.`),
          lineChart(pts, { unit: 'kg', title: 'e1RM-Verlauf' })));
      }
    }
  },
};
