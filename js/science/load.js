// Belastungssteuerung über Session-RPE (Foster 2001) für alle Einheiten.
import { ymd, addDays, parseYmd, startOfWeek, inRange } from '../core/dates.js';
import { distribution } from './endurance.js';
import { SPORTS } from './endurance.js';

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export function sessionLoad(s) {
  const rpe = num(s.srpe), dur = num(s.durationMin);
  return rpe && dur ? rpe * dur : 0;
}

export function dailyLoads(sessions, days, end = new Date()) {
  const map = {};
  for (const s of sessions) {
    const d = s.date.slice(0, 10);
    map[d] = (map[d] || 0) + sessionLoad(s);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = ymd(addDays(end, -i));
    out.push({ date: d, load: map[d] || 0 });
  }
  return out;
}

// EWMA-ACWR (Williams et al. 2017). Nur Orientierung (Impellizzeri et al. 2020).
export function acwr(sessions, end = new Date()) {
  if (!sessions.length) return null;
  const first = parseYmd(sessions.map((s) => s.date).sort()[0]);
  const days = Math.max(1, Math.round((parseYmd(ymd(end)) - first) / 86400000) + 1);
  const loads = dailyLoads(sessions, days, end);
  const la = 2 / (7 + 1), lc = 2 / (28 + 1);
  let a = 0, c = 0;
  for (const { load } of loads) {
    a = load * la + (1 - la) * a;
    c = load * lc + (1 - lc) * c;
  }
  return { acute: a, chronic: c, ratio: c > 0 ? a / c : null, daysOfData: days };
}

// Monotonie und Strain (Foster 1998), letzte 7 Tage
export function monotony(sessions, end = new Date()) {
  const l = dailyLoads(sessions, 7, end).map((x) => x.load);
  const mean = l.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / 7);
  const week = mean * 7;
  const mono = sd > 0 ? mean / sd : null;
  return { weekLoad: week, monotony: mono, strain: mono ? week * mono : null };
}

export function acwrStatus(r) {
  if (r === null || r === undefined) return { level: 'neutral', label: 'Zu wenig Daten' };
  if (r < 0.8) return { level: 'info', label: 'Belastung unter dem Gewohnten' };
  if (r <= 1.3) return { level: 'good', label: 'Im gewohnten Rahmen' };
  if (r <= 1.5) return { level: 'warning', label: 'Deutlich gesteigert' };
  return { level: 'serious', label: 'Sprunghafter Anstieg' };
}

export function weekSummary(profile, weekStart) {
  const from = weekStart, to = addDays(weekStart, 6);
  const sessions = profile.sessions.filter((s) => inRange(s.date, from, to));
  let endMin = 0, kraft = 0, load = 0;
  const dist = { low: 0, mid: 0, high: 0 };
  for (const s of sessions) {
    load += sessionLoad(s);
    if (s.type === 'kraft') kraft++;
    if (s.type === 'ausdauer' && SPORTS[s.sport]?.endurance) {
      endMin += num(s.durationMin) || 0;
      const d = distribution(profile, s);
      dist.low += d.low; dist.mid += d.mid; dist.high += d.high;
    }
  }
  return { sessions, endMin, kraft, load, dist };
}

export function weeksBack(n, end = new Date()) {
  const ws = startOfWeek(end);
  return Array.from({ length: n }, (_, i) => addDays(ws, -7 * (n - 1 - i)));
}
