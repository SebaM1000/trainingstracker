// Regelbasierte Hinweise aus den Daten der laufenden Woche.
// Jede Regel ist eine Funktion -> leicht erweiterbar oder abschaltbar.
import { startOfWeek, addDays, inRange } from '../core/dates.js';
import { volumeByMuscle } from './strength.js';
import { weekSummary, acwr, acwrStatus, monotony } from './load.js';
import { MUSCLES } from '../data/exercises.js';

const RULES = [
  // Volumen pro Muskel (Pelland et al. 2026; Schoenfeld et al. 2017)
  (p, c) => {
    if (!p.settings.modules.kraft || c.week.kraft === 0) return null;
    const low = Object.entries(c.vol.vol).filter(([, v]) => v < p.params.setsMin).map(([m]) => MUSCLES[m]);
    if (!low.length) return { level: 'good', text: `Alle Muskelgruppen erreichen diese Woche mindestens ${p.params.setsMin} Sätze.` };
    if (c.dayOfWeek < 3) return null;
    return { level: 'info', text: `Unter ${p.params.setsMin} Sätzen diese Woche: ${low.slice(0, 5).join(', ')}${low.length > 5 ? ` und ${low.length - 5} weitere` : ''}.`, ref: 'pelland2024' };
  },
  (p, c) => {
    const high = Object.entries(c.vol.perSessionPeak).filter(([, v]) => v > 10).map(([m]) => MUSCLES[m]);
    return high.length ? { level: 'info', text: `Mehr als 10 Sätze in einer Einheit für ${high.join(', ')}. Ein Teil davon wirkt auf mehrere Tage verteilt vermutlich besser.`, ref: 'remmert2025' } : null;
  },
  // Intensitätsverteilung (Seiler 2010)
  (p, c) => {
    const d = c.week.dist; const tot = d.low + d.mid + d.high;
    if (tot < 60) return null;
    const share = d.low / tot;
    if (share + 0.1 < p.params.lowShare)
      return { level: 'warning', text: `Nur ${Math.round(share * 100)} % deiner Ausdauerzeit war locker (Ziel ca. ${Math.round(p.params.lowShare * 100)} %). Mehr Grundlage, harte Einheiten gezielt setzen.`, ref: 'seiler2010' };
    return null;
  },
  // ACWR (Williams 2017) nur als Orientierung (Impellizzeri 2020)
  (p, c) => {
    if (!c.acwr || c.acwr.daysOfData < 21 || c.acwr.ratio === null) return null;
    const st = acwrStatus(c.acwr.ratio);
    if (st.level === 'warning' || st.level === 'serious')
      return { level: st.level, text: `Deine Belastung der letzten Tage liegt beim ${c.acwr.ratio.toFixed(2)}-fachen des Gewohnten. Steigerungen lieber schrittweise.`, ref: 'impellizzeri2020' };
    return null;
  },
  // Monotonie (Foster 1998)
  (p, c) => (c.mono.monotony && c.mono.monotony > 2 && c.mono.weekLoad > 0
    ? { level: 'warning', text: `Hohe Monotonie (${c.mono.monotony.toFixed(1)}): Die Tage sind sehr gleichförmig belastet. Leichte und harte Tage stärker abwechseln.`, ref: 'foster1998' }
    : null),
  // Wochenziele
  (p, c) => {
    const left = p.params.strengthDays - c.week.kraft;
    if (!p.settings.modules.kraft || left <= 0) return null;
    return c.dayOfWeek >= 4 ? { level: 'info', text: `Noch ${left} Krafteinheit${left > 1 ? 'en' : ''} bis zum Wochenziel.` } : null;
  },
];

export function hints(profile, now = new Date()) {
  const ws = startOfWeek(now);
  const ctx = {
    week: weekSummary(profile, ws),
    vol: volumeByMuscle(profile, profile.sessions.filter((s) => inRange(s.date, ws, addDays(ws, 6)))),
    acwr: acwr(profile.sessions, now),
    mono: monotony(profile.sessions, now),
    dayOfWeek: (now.getDay() + 6) % 7,
  };
  return RULES.map((r) => { try { return r(profile, ctx); } catch (e) { return null; } }).filter(Boolean);
}
