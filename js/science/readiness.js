// Tagesform: bewertet die Erholungswerte von Garmin gegen deinen eigenen Normalbereich
// und passt die Trainingsvorschläge des Tages an.
//
// Wichtig zur Einordnung: HRV-gesteuertes Training ist vor allem für Ausdauer untersucht
// (Manresa-Rocamora et al. 2021, Düking et al. 2021). Für Krafttraining ist die Anpassung eine
// vorsichtige Übertragung. Die Schwellen unten sind praxisübliche Regeln, keine Studienwerte,
// und lassen sich hier zentral ändern.
import { ymd, parseYmd, addDays } from '../core/dates.js';

export const THRESHOLDS = {
  baselineDays: 28,        // Normalbereich aus den letzten 28 Tagen
  minBaselineValues: 7,    // so viele Werte braucht ein Normalbereich mindestens
  hrvSd: 1,                // HRV auffällig unter Mittelwert − 1 SD, stark unter − 2 SD
  rhrPlusMin: 5,           // Ruhepuls auffällig ab +5 Schlägen über dem Normalwert …
  rhrSd: 1.5,              // … und mehr als 1,5 SD
  sleepYellow: 6,          // Schlaf unter 6 h auffällig
  sleepRed: 5,             // unter 5 h stark
  readinessYellow: 50,     // Garmin-Readiness unter 50 („niedrig“)
  readinessRed: 25,        // unter 25 („schwach“)
  maxAgeDays: 1,           // Tageswerte älter als gestern gelten als veraltet
};

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => { if (a.length < 3) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// Tageswerte aus der data.json des Garmin-Syncs in ein schlankes Format bringen
export function wellnessFromGarmin(tage) {
  const out = {};
  for (const [d, t] of Object.entries(tage || {})) {
    out[d] = {
      hrv: num(t?.hrv?.nacht_ms), hrvLow: num(t?.hrv?.baseline_low), hrvHigh: num(t?.hrv?.baseline_high), hrvStatus: t?.hrv?.status || null,
      rhr: num(t?.ruhepuls), sleepH: num(t?.schlaf?.dauer_h), sleepScore: num(t?.schlaf?.score),
      readiness: num(t?.training_readiness?.score), readinessLevel: t?.training_readiness?.stufe || null,
      bbHigh: num(t?.body_battery?.hoch), stress: num(t?.stress), steps: num(t?.schritte),
    };
  }
  return out;
}

function baseline(well, key, beforeDate) {
  const vals = [];
  for (let i = 1; i <= THRESHOLDS.baselineDays; i++) {
    const v = well[ymd(addDays(parseYmd(beforeDate), -i))]?.[key];
    if (v !== null && v !== undefined) vals.push(v);
  }
  if (vals.length < THRESHOLDS.minBaselineValues) return null;
  return { mean: mean(vals), sd: sd(vals), n: vals.length };
}

// Ergebnis: { level: 'gruen'|'gelb'|'rot'|'unbekannt', date, stale, signals: [...], values }
export function assess(profile, today = new Date()) {
  const well = profile.wellness || {};
  const override = profile.tagesformOverride;
  const todayStr = ymd(today);
  const dates = Object.keys(well).filter((d) => d <= todayStr).sort();
  const date = dates[dates.length - 1];
  if (!date) return { level: 'unbekannt', signals: [], reason: 'Noch keine Tageswerte importiert.' };
  const v = well[date];
  const ageDays = Math.round((parseYmd(todayStr) - parseYmd(date)) / 86400000);
  const signals = [];
  const T = THRESHOLDS;

  // HRV gegen eigenen Normalbereich (Garmins Baseline, sonst eigener Mittelwert ± SD)
  if (v.hrv !== null) {
    const b = baseline(well, 'hrv', date);
    if (b && b.sd) {
      const z = (v.hrv - b.mean) / b.sd;
      if (z < -2 * T.hrvSd) signals.push({ key: 'hrv', points: 2, text: `HRV ${v.hrv} ms deutlich unter deinem Normalwert (Ø ${Math.round(b.mean)} ms)` });
      else if (z < -T.hrvSd) signals.push({ key: 'hrv', points: 1, text: `HRV ${v.hrv} ms unter deinem Normalbereich (Ø ${Math.round(b.mean)} ms)` });
      else signals.push({ key: 'hrv', points: 0, text: `HRV ${v.hrv} ms im Normalbereich` });
    } else if (v.hrvLow !== null && v.hrv < v.hrvLow) {
      signals.push({ key: 'hrv', points: 1, text: `HRV ${v.hrv} ms unter Garmins Baseline (${v.hrvLow}–${v.hrvHigh} ms)` });
    }
  }
  // Ruhepuls
  if (v.rhr !== null) {
    const b = baseline(well, 'rhr', date);
    if (b && b.sd !== null) {
      const diff = v.rhr - b.mean;
      if (diff >= T.rhrPlusMin + 3 && diff > 2 * b.sd) signals.push({ key: 'rhr', points: 2, text: `Ruhepuls ${v.rhr} bpm, ${Math.round(diff)} über deinem Normalwert` });
      else if (diff >= T.rhrPlusMin && diff > T.rhrSd * b.sd) signals.push({ key: 'rhr', points: 1, text: `Ruhepuls ${v.rhr} bpm, ${Math.round(diff)} über deinem Normalwert` });
      else signals.push({ key: 'rhr', points: 0, text: `Ruhepuls ${v.rhr} bpm im Normalbereich` });
    }
  }
  // Schlaf
  if (v.sleepH !== null) {
    const h = v.sleepH, txt = `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')} h`;
    if (h < T.sleepRed) signals.push({ key: 'sleep', points: 2, text: `Nur ${txt} Schlaf` });
    else if (h < T.sleepYellow) signals.push({ key: 'sleep', points: 1, text: `Kurze Nacht (${txt})` });
    else signals.push({ key: 'sleep', points: 0, text: `${txt} Schlaf` });
  }
  // Garmin Training Readiness
  if (v.readiness !== null) {
    if (v.readiness < T.readinessRed) signals.push({ key: 'readiness', points: 2, text: `Training Readiness ${v.readiness} (schwach)` });
    else if (v.readiness < T.readinessYellow) signals.push({ key: 'readiness', points: 1, text: `Training Readiness ${v.readiness} (niedrig)` });
    else signals.push({ key: 'readiness', points: 0, text: `Training Readiness ${v.readiness}` });
  }

  const points = signals.reduce((s, x) => s + x.points, 0);
  let level = !signals.length ? 'unbekannt' : points === 0 ? 'gruen' : points <= 2 ? 'gelb' : 'rot';
  let manual = false;
  if (override && override.date === todayStr) { level = override.level; manual = true; }
  return { level, date, stale: ageDays > T.maxAgeDays, ageDays, signals, points, manual, values: v };
}

export const LEVELS = {
  gruen: { label: 'Grün: gut erholt', status: 'good', short: 'grün' },
  gelb: { label: 'Gelb: etwas zurücknehmen', status: 'warning', short: 'gelb' },
  rot: { label: 'Rot: Erholung vor Leistung', status: 'serious', short: 'rot' },
  unbekannt: { label: 'Keine aktuellen Werte', status: 'neutral', short: '–' },
};

export function advice(level) {
  return {
    gruen: ['Training wie geplant, Progression normal.', 'Harte Einheiten (Intervalle, schwere Sätze) passen heute gut.'],
    gelb: ['Krafttraining: pro Übung ein Satz weniger und 1 Wiederholung mehr Reserve (RIR). Kein Gewicht steigern.', 'Ausdauer: nur locker (Zone 1–2), Intervalle verschieben.'],
    rot: ['Heute Erholung: Mobility, Spaziergang oder höchstens 20–40 min sehr locker (Zone 1).', 'Krafttraining nur leicht oder verschieben. Bei Krankheitszeichen ganz pausieren.'],
    unbekannt: ['Importiere die aktuelle data.json, dann wird die Tagesform bewertet.'],
  }[level];
}

// Trainingsvorschlag einer Übung an die Tagesform anpassen
export function adjustSuggestion(sug, level) {
  if (!sug || level === 'gruen' || level === 'unbekannt') return { ...sug, setsDelta: 0 };
  const s = { ...sug };
  if (level === 'gelb') {
    if (s.kind === 'up') { s.weight = sug.prevWeight ?? Math.max(0, (s.weight || 0) - (s.inc || 0)); s.reps = sug.prevReps ?? s.reps; s.kind = 'reps'; }
    if (s.rir !== null && s.rir !== undefined) s.rir += 1;
    s.text = `Tagesform gelb: Gewicht halten${s.bw ? ` (${s.weight > 0 ? `KG + ${String(s.weight).replace('.', ',')} kg` : 'Körpergewicht'} × ${s.reps})` : s.weight ? ` (${String(s.weight).replace('.', ',')} kg × ${s.reps})` : ''}, 1 RIR mehr Reserve, ein Satz weniger. Ohne Anpassung wäre es: ${sug.text}`;
    s.setsDelta = -1;
  } else if (level === 'rot') {
    if (s.bw) { s.weight = Math.min(0, s.weight || 0); } else if (s.weight) { const t = s.weight * 0.85; s.weight = s.loads ? s.loads.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), s.loads[0]) : Math.round(t / (s.inc || 1)) * (s.inc || 1); }
    if (s.rir !== null && s.rir !== undefined) s.rir += 2;
    s.kind = 'down';
    s.text = `Tagesform rot: Heute besser Erholung. Falls doch: ${s.bw ? 'ohne Zusatzgewicht' : `ca. 85 % Gewicht${s.weight ? ` (${String(s.weight).replace('.', ',')} kg)` : ''}`}, weit weg vom Versagen, halbes Volumen.`;
    s.setsDelta = -99; // halbiert, siehe Aufrufer
  }
  return s;
}
