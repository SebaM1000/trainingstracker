// Startseite: Wochenstand, Belastung, Hinweise, Schnellstart.
import { h, card, stat, badge, fmt, empty } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { startOfWeek, fmtDate, isoWeek } from '../core/dates.js';
import { weekSummary, acwr, acwrStatus } from '../science/load.js';
import { hints } from '../science/coach.js';
import { GOALS } from '../science/goals.js';
import { SPORTS } from '../science/endurance.js';
import { REFS } from '../science/references.js';
import { assess, advice, LEVELS } from '../science/readiness.js';
import { ymd, addDays } from '../core/dates.js';
import { sparkline } from '../core/charts.js';
import { abendCard } from './abend.js';
import { ernaehrungCard } from './ernaehrung.js';

// Kleines Erholungs-Dashboard: die letzten 14 Tage aus den Garmin-Tageswerten
const METRICS = [
  { key: 'readiness', label: 'Readiness', unit: '', color: 'var(--m-green)', hint: 'Garmins Bereitschaft 0–100' },
  { key: 'hrv', label: 'HRV', unit: 'ms', color: 'var(--m-blue)', band: true, hint: 'höher ist meist besser' },
  { key: 'rhr', label: 'Ruhepuls', unit: 'bpm', color: 'var(--m-red)', band: true, hint: 'niedriger ist meist besser' },
  { key: 'sleepH', label: 'Schlaf', unit: 'h', color: 'var(--m-yellow)', bars: true, ref: 7, hint: 'Linie = 7 h' },
  { key: 'bbHigh', label: 'Body Battery', unit: 'max', color: 'var(--m-green)', bars: true, hint: 'Höchstwert des Tages' },
];
const fmtVal = (k, v) => (v === null || v === undefined ? '–' : k === 'sleepH' ? `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}` : String(Math.round(v)));

function erholungCard(ctx) {
  const p = ctx.profile;
  const well = p.wellness || {};
  const days = Object.keys(well).sort();
  if (!days.length) return null;
  const end = new Date(days[days.length - 1]);
  const range = Array.from({ length: 14 }, (_, i) => ymd(addDays(end, i - 13)));
  const grid = h('div', { class: 'mini-grid' });
  for (const m of METRICS) {
    const pts = range.map((d) => ({ y: well[d]?.[m.key] ?? null, tip: `${fmtDate(d, false)}: ${fmtVal(m.key, well[d]?.[m.key])} ${m.unit}` }));
    const vals = pts.map((x) => x.y).filter((v) => v !== null);
    const last = [...pts].reverse().find((x) => x.y !== null);
    let band = null;
    if (m.band && vals.length >= 5) {
      const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / (vals.length - 1));
      band = [mu - sd, mu + sd];
    }
    grid.append(h('div', { class: 'mini' },
      h('div', { class: 'mini-label' }, h('i', { class: 'mini-mark', style: { background: m.color } }), m.label),
      h('div', { class: 'mini-val' }, last ? fmtVal(m.key, last.y) : '–', h('small', {}, ` ${m.unit}`)),
      sparkline(pts, { color: m.color, band, bars: m.bars, ref: m.ref ?? null }),
      h('div', { class: 'mini-hint' }, band ? 'Band = dein Normalbereich' : m.hint)));
  }
  return card('Erholung (14 Tage)', grid,
    h('p', { class: 'muted small' }, `Stand: ${fmtDate(days[days.length - 1])}. Tippe auf einen Verlauf für den Tageswert. Neue Werte holst du über den Garmin-Import.`),
    h('button', { class: 'btn ghost small', onclick: () => ctx.go('garmin') }, 'Garmin-Daten aktualisieren'));
}

function tagesformCard(ctx) {
  const p = ctx.profile;
  const r = assess(p);
  const L = LEVELS[r.level];
  const setOverride = (level) => { ctx.store.updateProfile((x) => { x.tagesformOverride = level ? { date: ymd(), level } : null; }); ctx.rerender(); };
  return card('Tagesform',
    h('div', { class: `tf-head tf-${r.level}` }, badge(L.status, L.label)),
    r.date ? h('p', { class: 'muted small' }, r.manual ? 'Von dir für heute selbst eingestuft.' : `Garmin-Werte vom ${fmtDate(r.date)}${r.stale ? ' (veraltet, bitte aktuelle data.json importieren)' : ''}.`) : null,
    r.signals.length ? h('ul', { class: 'hints' }, r.signals.map((x) => h('li', {}, badge(x.points === 0 ? 'good' : x.points === 1 ? 'warning' : 'serious', ''), h('span', {}, x.text)))) : h('p', { class: 'small' }, r.reason || ''),
    !r.date || r.stale ? h('button', { class: 'btn primary full', onclick: () => ctx.go('garmin') }, 'Garmin-Daten importieren') : null,
    h('div', { class: 'tf-advice' }, advice(r.level).map((t) => h('p', { class: 'small' }, t))),
    h('details', { class: 'details' }, h('summary', {}, 'Ich fühle mich anders'),
      h('p', { class: 'muted small' }, 'Dein eigenes Gefühl zählt: Subjektive Angaben spiegeln die Belastung oft besser als Messwerte. Hier kannst du die Einstufung für heute überschreiben.'),
      h('div', { class: 'chips wrap' },
        h('button', { class: 'chip', onclick: () => setOverride('gruen') }, 'Grün'),
        h('button', { class: 'chip', onclick: () => setOverride('gelb') }, 'Gelb'),
        h('button', { class: 'chip', onclick: () => setOverride('rot') }, 'Rot'),
        r.manual ? h('button', { class: 'chip', onclick: () => setOverride(null) }, 'Zurück zur automatischen Bewertung') : null)),
    h('a', { class: 'ref small', href: '#wissen' }, 'Wie wird das berechnet?'));
}

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

    if (m.tagesform !== false) { root.append(tagesformCard(ctx)); const ec = erholungCard(ctx); if (ec) root.append(ec); }

    if (m.ernaehrung !== false) root.append(ernaehrungCard(ctx));
    root.append(abendCard(ctx));

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
