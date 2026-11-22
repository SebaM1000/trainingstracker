// Datumshilfen (lokale Zeit, Wochen beginnen am Montag)
export const pad = (n) => String(n).padStart(2, '0');

export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mo = 0
  return addDays(x, -day);
}

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

export function daysBetween(a, b) {
  return Math.round((parseYmd(ymd(b)) - parseYmd(ymd(a))) / 86400000);
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function fmtDate(s, withWeekday = true) {
  const d = parseYmd(s);
  const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
  return withWeekday ? `${WD[d.getDay()]}, ${base}` : base;
}

export function inRange(sessionDate, from, to) {
  const d = sessionDate.slice(0, 10);
  return d >= ymd(from) && d <= ymd(to);
}
