// Ernährung: Energiebedarf, Zielbereich und Makros. Reine Funktionen ohne Oberfläche.
//
// Ruhebedarf (Grundumsatz):
//   mit Körperfettanteil  -> Katch-McArdle: 370 + 21,6 × fettfreie Masse (kg)
//   sonst                 -> Mifflin-St Jeor (Gewicht, Größe, Alter, Geschlecht)
// Belastungsbedarf eines Tages = Ruhebedarf × Alltagsfaktor (PAL) + Trainingskalorien netto.
// Trainingskalorien: Garmin-Kalorien der Einheit, sonst Schätzung über MET; jeweils abzüglich
// des Grundumsatzes, der in dieser Zeit ohnehin angefallen wäre (sonst doppelt gezählt).
import { age } from './endurance.js';

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export const DEFAULT_SETTINGS = { pal: 1.4, proteinPerKg: 2.0, fatPerKg: 1.0 };

// Zielbereich relativ zum Belastungsbedarf, je Trainingsziel
export const TARGET_BAND = {
  hypertrophie: { low: 1.05, high: 1.15, label: 'leichter Überschuss (+5 bis +15 %)' },
  kraft: { low: 1.05, high: 1.15, label: 'leichter Überschuss (+5 bis +15 %)' },
  rekomposition: { low: 0.9, high: 1.0, label: 'leichtes Defizit bis ausgeglichen' },
  ausdauer: { low: 0.95, high: 1.05, label: 'ausgeglichen' },
  hybrid: { low: 1.0, high: 1.1, label: 'ausgeglichen bis leichter Überschuss' },
  gesundheit: { low: 0.95, high: 1.05, label: 'ausgeglichen' },
};

// MET-Werte (Compendium of Physical Activities, gerundet) für Einheiten ohne Garmin-Kalorien
const MET = { kraft: 5, laufen: 9.8, rad: 8, indoorrad: 7, rudern: 7, stepper: 9, schwimmen: 7, wandern: 4,
  ebike: 4, kampfsport: 7, mobility: 2.5, sonstiges: 5 };

export function settings(p) {
  return { ...DEFAULT_SETTINGS, ...((p.nutrition && p.nutrition.settings) || {}) };
}

export function bmr(p) {
  const kg = num(p.body.weightKg);
  if (!kg) return { value: null, missing: 'Gewicht' };
  const bf = num(p.body.bodyFatPct);
  if (bf && bf > 2 && bf < 60) {
    const lbm = kg * (1 - bf / 100);
    return { value: Math.round(370 + 21.6 * lbm), method: 'Katch-McArdle (mit Körperfett)', lbm };
  }
  const cm = num(p.body.heightCm), a = age(p);
  if (!cm || !a || !p.body.sex) return { value: null, missing: 'Körperfettanteil oder Größe, Geburtsjahr und Geschlecht' };
  const base = 10 * kg + 6.25 * cm - 5 * a;
  return { value: Math.round(base + (p.body.sex === 'w' ? -161 : 5)), method: 'Mifflin-St Jeor' };
}

export function sessionKcal(p, s, bmrValue) {
  const min = num(s.durationMin) || 0;
  if (!min) return 0;
  const restShare = (bmrValue / 1440) * min;
  const garmin = num(s.kcal);
  if (garmin) return Math.max(0, Math.round(garmin - restShare));
  const kg = num(p.body.weightKg) || 75;
  const key = s.type === 'kraft' ? 'kraft' : s.sport;
  const base = MET[key] ?? 5;
  const rpe = num(s.srpe);
  const factor = rpe ? Math.min(1.2, Math.max(0.7, rpe / 6)) : 1; // härter = etwas mehr, grob
  const gross = base * factor * kg * (min / 60);
  return Math.max(0, Math.round(gross - restShare));
}

export function dayNeed(p, date) {
  const b = bmr(p);
  if (!b.value) return { ...b, ready: false };
  const st = settings(p);
  const daily = Math.round(b.value * st.pal);
  const sessions = p.sessions.filter((s) => s.date && s.date.slice(0, 10) === date);
  const training = sessions.reduce((a, s) => a + sessionKcal(p, s, b.value), 0);
  return { ready: true, bmr: b.value, method: b.method, daily, training, total: daily + training, sessions: sessions.length };
}

export function targets(p, need) {
  const st = settings(p);
  const band = TARGET_BAND[p.goal] || TARGET_BAND.gesundheit;
  const kg = num(p.body.weightKg) || 0;
  const kcalMid = Math.round(need.total * (band.low + band.high) / 2);
  const protein = Math.round(kg * st.proteinPerKg);
  const fat = Math.round(kg * st.fatPerKg);
  const carbs = Math.max(0, Math.round((kcalMid - protein * 4 - fat * 9) / 4));
  return { band, kcalLow: Math.round(need.total * band.low), kcalHigh: Math.round(need.total * band.high), kcalMid, protein, fat, carbs };
}

export function sumDay(entries = []) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of entries) { t.kcal += num(e.kcal) || 0; t.p += num(e.p) || 0; t.c += num(e.c) || 0; t.f += num(e.f) || 0; }
  return t;
}

// Einstufung der gegessenen Kalorien gegen Ruhe- und Belastungsbedarf
export function balance(eaten, need, tg) {
  if (!need.ready || !eaten) return null;
  const r = eaten / need.total;
  let level, label;
  if (eaten < need.bmr) { level = 'serious'; label = 'unter dem Ruhebedarf'; }
  else if (r < 0.95) { level = 'warning'; label = 'Defizit'; }
  else if (r <= 1.05) { level = 'info'; label = 'ausgeglichen'; }
  else { level = 'info'; label = r <= 1.15 ? 'leichter Überschuss' : 'großer Überschuss'; }
  const inTarget = eaten >= tg.kcalLow && eaten <= tg.kcalHigh;
  if (inTarget) level = 'good';
  return { level, label, inTarget, diff: Math.round(eaten - need.total), pct: Math.round((r - 1) * 100) };
}

// kcal aus Makros, falls nicht angegeben
export const kcalFromMacros = (p, c, f) => Math.round((num(p) || 0) * 4 + (num(c) || 0) * 4 + (num(f) || 0) * 9);

export function scaleFood(food, grams) {
  const k = (num(grams) || 0) / 100;
  const r = (v) => Math.round((num(v) || 0) * k * 10) / 10;
  return { kcal: Math.round((num(food.kcal) || 0) * k), p: r(food.p), c: r(food.c), f: r(food.f) };
}
