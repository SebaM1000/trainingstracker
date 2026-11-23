// Startseite: Wochenstand, Belastung, Hinweise, Schnellstart.
import { h, card, stat, badge, fmt, empty } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { startOfWeek, fmtDate, isoWeek } from '../core/dates.js';
import { weekSummary, acwr, acwrStatus } from '../science/load.js';
import { hints } from '../science/coach.js';
import { SPORTS } from '../science/endurance.js';
import { REFS } from '../science/references.js';
import { assess, advice, LEVELS } from '../science/readiness.js';
import { ymd, addDays } from '../core/dates.js';
import { sparkline } from '../core/charts.js';
import { abendCard } from './abend.js';
import { ernaehrungCard } from './ernaehrung.js';

// Erholungswerte der letzten 14 Tage, kompakt als Zeilen: Name | Wert | Verlauf
const METRICS = [
  { key: 'readiness', label: 'Readiness', unit: '', color: 'var(--m-green)' },
  { key: 'hrv', label: 'HRV', unit: 'ms', color: 'var(--m-blue)', band: true },
  { key: 'rhr', label: 'Ruhepuls', unit: 'bpm', color: 'var(--m-red)', band: true },
  { key: 'sleepH', label: 'Schlaf', unit: 'h', color: 'var(--m-yellow)', bars: true, ref: 7 },
  { key: 'bbHigh', label: 'Body Battery', unit: '', color: 'var(--m-green)', bars: true },
];
const fmtVal = (k, v) => (v === null || v === undefined ? '–' : k === 'sleepH' ? `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}` : String(Math.round(v)));

function erholungRows(p) {
  const well = p.wellness || {};
  const days = Object.keys(well).sort();
  if (!days.length) return null;
  const end = new Date(days[days.length - 1]);
  const range = Array.from({ length: 14 }, (_, i) => ymd(addDays(end, i - 13)));
  return h('div', { class: 'mrows' }, METRICS.map((m) => {
    const pts = range.map((d) => ({ y: well[d]?.[m.key] ?? null, tip: `${fmtDate(d, false)}: ${fmtVal(m.key, well[d]?.[m.key])} ${m.unit}` }));
    const vals = pts.map((x) => x.y).filter((v) => v !== null);
    const last = [...pts].reverse().find((x) => x.y !== null);
    let band = null;
    if (m.band && vals.length >= 5) {
      const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / (vals.length - 1));
      band = [mu - sd, mu + sd];
    }
    return h('div', { class: 'mrow' },
      h('span', { class: 'mrow-label' }, h('i', { class: 'mini-mark', style: { background: m.color } }), m.label),
      h('span', { class: 'mrow-val' }, last ? fmtVal(m.key, last.y) : '–', m.unit ? h('small', {}, ` ${m.unit}`) : null),
      sparkline(pts, { color: m.color, band, bars: m.bars, ref: m.ref ?? null, height: 30 }));
  }));
}

function tagesformCard(ctx) {
  const p = ctx.profile;
  const r = assess(p);
  const L = LEVELS[r.level];
  const [word, ...rest] = L.label.split(': ');
  const setOverride = (level) => { ctx.store.updateProfile((x) => { x.tagesformOverride = level ? { date: ymd(), level } : null; }); ctx.rerender(); };
  const rows = erholungRows(p);
  const needImport = !r.date || r.stale;
  return h('section', { class: `card tf tf-${r.level}` },
    h('div', { class: 'tf-top' },
      h('div', {},
        h('div', { class: 'tf-kicker' }, 'Tagesform'),
        h('div', { class: 'tf-word' }, h('i', { class: 'tf-dot' }), rest.length ? word : L.label),
        rest.length ? h('div', { class: 'tf-sub' }, rest.join(': ')) : null),
      h('div', { class: 'tf-src muted small' }, r.manual ? 'selbst eingestuft' : r.date ? `Garmin ${fmtDate(r.date, false)}` : '')),
    h('div', { class: 'tf-advice' }, advice(r.level).map((t) => h('p', { class: 'small' }, t))),
    needImport ? h('button', { class: 'btn primary full', onclick: () => ctx.go('garmin') }, r.stale ? 'Neue Garmin-Daten importieren' : 'Garmin-Daten importieren') : null,
    rows,
    h('details', { class: 'details' }, h('summary', {}, 'Warum diese Einstufung?'),
      r.signals.length ? h('ul', { class: 'hints' }, r.signals.map((x) => h('li', {}, badge(x.points === 0 ? 'good' : x.points === 1 ? 'warning' : 'serious', ''), h('span', {}, x.text)))) : h('p', { class: 'small' }, r.reason || ''),
      rows ? h('p', { class: 'muted small' }, 'Verläufe der letzten 14 Tage. Graues Band = dein Normalbereich, Linie beim Schlaf = 7 h. Tippe auf einen Verlauf für den Tageswert.') : null,
      h('p', { class: 'muted small' }, 'Fühlst du dich anders? Dein Gefühl zählt, du kannst die Einstufung für heute überschreiben:'),
      h('div', { class: 'chips wrap' },
        h('button', { class: 'chip', onclick: () => setOverride('gruen') }, 'Grün'),
        h('button', { class: 'chip', onclick: () => setOverride('gelb') }, 'Gelb'),
        h('button', { class: 'chip', onclick: () => setOverride('rot') }, 'Rot'),
        r.manual ? h('button', { class: 'chip', onclick: () => setOverride(null) }, 'Automatisch') : null),
      h('div', { class: 'row gap wrap' },
        !needImport ? h('button', { class: 'btn ghost small', onclick: () => ctx.go('garmin') }, 'Garmin-Daten aktualisieren') : null,
        h('a', { class: 'ref small', href: '#wissen' }, 'Wie wird das berechnet?'))));
}

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

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
      h('div', { class: 'hello-date' }, WEEKDAY.format(now)),
      h('h1', {}, `Hallo ${p.name}`)));

    const actions = h('div', { class: 'quick' });
    if (m.kraft !== false) actions.append(h('button', { class: 'btn primary', onclick: () => ctx.go('kraft') },
      p.draft ? 'Training fortsetzen' : 'Krafttraining'));
    if (m.ausdauer !== false) actions.append(h('button', { class: 'btn ghost', onclick: () => ctx.go('ausdauer') }, 'Einheit eintragen'));
    if (actions.children.length) root.append(actions);

    if (m.tagesform !== false) root.append(tagesformCard(ctx));
    if (m.ernaehrung !== false) root.append(ernaehrungCard(ctx));
    root.append(abendCard(ctx));

    const stats = h('div', { class: 'stats' });
    if (m.kraft !== false) stats.append(stat('Kraft', `${w.kraft} / ${p.params.strengthDays}`, 'Einheiten'));
    if (m.ausdauer !== false) stats.append(stat('Ausdauer', `${fmt(w.endMin)} / ${p.params.enduranceMin}`, 'Minuten'));
    stats.append(stat('Wochenlast', fmt(w.load), 'AU (sRPE × min)'));
    stats.append(h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Belastungstrend'),
      h('div', { class: 'stat-value' }, a && a.daysOfData >= 21 && a.ratio ? a.ratio.toFixed(2) : '–'),
      h('div', { class: 'stat-sub' }, badge(st.level, st.label))));
    root.append(card(`Diese Woche (KW ${isoWeek(now)})`, stats,
      a && a.daysOfData < 21 ? h('p', { class: 'muted small' }, `Der Belastungstrend erscheint nach 3 Wochen Daten (aktuell ${a.daysOfData} Tage).`) : null));

    const hs = hints(p, now);
    if (hs.length) root.append(card('Hinweise', h('ul', { class: 'hints' }, hs.map((x) =>
      h('li', {}, badge(x.level, ''), h('span', {}, x.text,
        x.ref ? h('a', { class: 'ref', href: '#wissen', title: REFS[x.ref]?.cite }, ' Quelle') : null))))));

    const recent = p.sessions.slice(-3).reverse();
    root.append(card('Zuletzt', recent.length ? recent.map((s) => h('div', { class: 'list-item static' },
      h('span', {}, h('strong', {}, s.type === 'kraft' ? (s.name || 'Krafttraining') : (SPORTS[s.sport]?.label || 'Einheit')),
        h('span', { class: 'muted small block' }, fmtDate(s.date))),
      h('span', { class: 'muted small' }, `${s.durationMin} min, RPE ${s.srpe ?? '–'}`))) : empty('Noch keine Einheiten. Starte dein erstes Training!')));
  },
};
