// Startseite: Wochenstand, Belastung, Hinweise, Schnellstart.
import { h, card, stat, badge, fmt, empty } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { startOfWeek, fmtDate, isoWeek } from '../core/dates.js';
import { weekSummary, acwr, acwrStatus } from '../science/load.js';
import { hints } from '../science/coach.js';
import { GOALS } from '../science/goals.js';
import { SPORTS } from '../science/endurance.js';
import { REFS } from '../science/references.js';

export default {
  id: 'heute', title: 'Heute', icon: ICONS.heute, order: 1, nav: true,
  render(root, ctx) {
    const p = ctx.profile;
    const m = p.settings.modules;
    const now = new Date();
    const w = weekSummary(p, startOfWeek(now));
    const a = acwr(p.sessions, now);
    const st = acwrStatus(a && a.daysOfData >= 21 ? a.ratio : null);

    root.append(h('div', { class: 'hello' },
      h('h1', {}, `Hallo ${p.name}`),
      h('span', { class: 'goal-chip' }, `Ziel: ${GOALS[p.goal].label}`)));

    const actions = h('div', { class: 'quick' });
    if (m.kraft !== false) actions.append(h('button', { class: 'btn primary', onclick: () => ctx.go('kraft') },
      p.draft ? 'Training fortsetzen' : 'Krafttraining starten'));
    if (m.ausdauer !== false) actions.append(h('button', { class: 'btn ghost', onclick: () => ctx.go('ausdauer') }, 'Einheit eintragen'));
    root.append(actions);

    const stats = h('div', { class: 'stats' });
    if (m.kraft !== false) stats.append(stat('Krafteinheiten', `${w.kraft} / ${p.params.strengthDays}`, 'diese Woche'));
    if (m.ausdauer !== false) stats.append(stat('Ausdauer', `${fmt(w.endMin)} / ${p.params.enduranceMin}`, 'Minuten'));
    stats.append(stat('Wochenlast', fmt(w.load), 'AU (sRPE × min)'));
    stats.append(h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Belastungstrend'),
      h('div', { class: 'stat-value' }, a && a.daysOfData >= 21 && a.ratio ? a.ratio.toFixed(2) : '–'),
      h('div', { class: 'stat-sub' }, badge(st.level, st.label))));
    root.append(card(`KW ${isoWeek(now)}`, stats,
      a && a.daysOfData < 21 ? h('p', { class: 'muted small' }, `Der Belastungstrend (akut : chronisch) wird nach 3 Wochen Daten angezeigt (aktuell ${a.daysOfData} Tage).`) : null));

    const hs = hints(p, now);
    if (hs.length) root.append(card('Hinweise', h('ul', { class: 'hints' }, hs.map((x) =>
      h('li', {}, badge(x.level, ''), h('span', {}, x.text,
        x.ref ? h('a', { class: 'ref', href: '#wissen', title: REFS[x.ref]?.cite }, ' Quelle') : null))))));

    const recent = p.sessions.slice(-5).reverse();
    root.append(card('Zuletzt', recent.length ? recent.map((s) => h('div', { class: 'list-item static' },
      h('span', {}, h('strong', {}, s.type === 'kraft' ? (s.name || 'Krafttraining') : (SPORTS[s.sport]?.label || 'Einheit')),
        h('span', { class: 'muted small block' }, fmtDate(s.date))),
      h('span', { class: 'muted small' }, `${s.durationMin} min, RPE ${s.srpe ?? '–'}`))) : empty('Noch keine Einheiten. Starte dein erstes Training!')));
  },
};
