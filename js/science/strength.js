// Krafttraining: e1RM, Progressionsvorschläge, Volumen pro Muskel.
import { exerciseById, MUSCLES } from '../data/exercises.js';

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// Geschätztes 1RM nach Epley, RIR-bereinigt (Helms et al. 2016)
export function e1rm(weight, reps, rir = 0) {
  const w = num(weight), r = num(reps), q = num(rir) || 0;
  if (!w || !r) return null;
  const total = r + q;
  if (total <= 1) return w;
  return w * (1 + total / 30);
}

// Gewicht für Zielwiederholungen bei Ziel-RIR aus e1RM
export function weightFor(e1, reps, rir) {
  return e1 / (1 + (reps + rir) / 30);
}

const kg = (v) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 });

export const roundTo = (v, inc) => Math.round(v / inc) * inc;

export const doneSets = (ex) => (ex.sets || []).filter((s) => s.done && num(s.reps));

export function sessionBestE1rm(ex) {
  let best = null;
  for (const s of doneSets(ex)) {
    const v = e1rm(s.w, s.reps, s.rir);
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

export function historyFor(profile, exId) {
  const out = [];
  for (const s of profile.sessions) {
    if (s.type !== 'kraft') continue;
    for (const ex of s.exercises || []) {
      if (ex.exId === exId && doneSets(ex).length) out.push({ date: s.date, ex, sessionId: s.id });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Progressionsvorschlag: doppelte Progression, RIR-gesteuert.
// 1) Alle Sätze am oberen Wdh-Ende und RIR im Ziel -> Gewicht erhöhen.
// 2) Deutlich zu leicht (RIR > Ziel+1) -> Gewicht über e1RM neu berechnen.
// 3) Unter dem unteren Wdh-Ende und kein Puffer -> Gewicht senken.
// 4) Sonst: gleiches Gewicht, mehr Wiederholungen anstreben.
export function suggestNext(profile, exId) {
  const p = profile.params;
  const ex = exerciseById(profile, exId);
  const inc = ex && ex.cat === 'compound'
    ? Number(profile.settings.increments.compound) || 2.5
    : Number(profile.settings.increments.isolation) || 1;
  const hist = historyFor(profile, exId);
  const opts = loadOptions(profile, exId);
  const up = (w) => (opts ? snapUp(opts, w) : roundTo(w + inc, inc));
  const down = (w) => (opts ? snapDown(opts, w) : Math.max(0, roundTo(w - inc, inc)));
  const near = (w) => (opts ? snapNearest(opts, w) : roundTo(w, inc));
  const rirTarget = Math.round((p.rirMin + p.rirMax) / 2);
  if (!hist.length) {
    return {
      kind: 'start', weight: null, reps: p.repMax, rir: p.rirMax, inc,
      text: `Erste Einheit: Gewicht wählen, mit dem ${p.repMin}–${p.repMax} Wdh. bei ca. ${p.rirMax} RIR klappen.`,
    };
  }
  const last = hist[hist.length - 1].ex;
  const sets = doneSets(last);
  const weights = sets.map((s) => num(s.w) || 0);
  const w = Math.max(...weights);
  const work = sets.filter((s) => (num(s.w) || 0) === w);
  const reps = work.map((s) => num(s.reps));
  const rirs = work.map((s) => (num(s.rir) === null ? rirTarget : num(s.rir)));
  const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
  const best = sessionBestE1rm(last);
  const repMid = Math.round((p.repMin + p.repMax) / 2);

  if (avgRir > p.rirMax + 1 && best) {
    const nw = near(weightFor(best, repMid, rirTarget));
    if (nw > w) return { kind: 'up', weight: nw, reps: repMid, rir: rirTarget, inc, loads: opts,
      text: `Letztes Mal deutlich zu leicht (Ø ${kg(avgRir.toFixed(1))} RIR). Neu berechnet aus e1RM: ${kg(nw)} kg × ${repMid}.` };
  }
  if (reps.every((r) => r >= p.repMax) && avgRir >= p.rirMin) {
    const nw = up(w);
    // Großer Sprung (z. B. Kabelzug-Platte): nicht gleich ans untere Ende, sondern Wiederholungen
    // so wählen, dass die Belastung ungefähr gleich bleibt (über das geschätzte 1RM).
    const jump = w > 0 ? (nw - w) / w : 0;
    let target = p.repMin;
    if (best && jump > 0.1) target = Math.max(1, Math.min(p.repMax, Math.round(best / nw * 30 - 30 - rirTarget)));
    // Ist der nächste Schritt so groß, dass du unter deinen Wiederholungsbereich fallen würdest,
    // bleibt das Gewicht und die Wiederholungen steigen über den Bereich hinaus (bis 25).
    // Muskelaufbau gelingt über weite Lastbereiche, solange die Sätze nah am Versagen enden.
    const EXT_MAX = 25;
    const topReps = Math.max(...reps);
    if (target < p.repMin && topReps < EXT_MAX) {
      const t = topReps + 1;
      return { kind: 'reps', weight: w, reps: t, rir: rirTarget, inc, loads: opts,
        text: `Nächste Stufe wäre ${kg(nw)} kg (+${Math.round(jump * 100)} %), zu großer Sprung. Gewicht halten (${kg(w)} kg) und Wiederholungen steigern: Ziel ${t} Wdh. bei ca. ${rirTarget} RIR. Ab ${EXT_MAX} Wdh. geht es auf ${kg(nw)} kg.` };
    }
    if (target < p.repMin) target = Math.max(5, target);
    return { kind: 'up', weight: nw, reps: target, prevWeight: w, prevReps: Math.max(...reps), rir: rirTarget, inc, loads: opts,
      text: `Oberes Ende (${p.repMax} Wdh.) in allen Sätzen erreicht: ${kg(nw)} kg (+${kg(Math.round((nw - w) * 100) / 100)} kg), Ziel ${target} Wdh.${target < p.repMin ? ` Das liegt unter deinem Bereich (${p.repMin}–${p.repMax}), weil der Gewichtssprung groß ist. Arbeite dich von dort wieder hoch.` : ''}` };
  }
  if (Math.min(...reps) < p.repMin && avgRir <= p.rirMin) {
    const nw = down(w);
    return { kind: 'down', weight: nw, reps: p.repMin, rir: rirTarget, inc, loads: opts,
      text: `Unter ${p.repMin} Wdh. ohne Reserve: Gewicht auf ${kg(nw)} kg reduzieren.` };
  }
  const target = Math.min(p.repMax, Math.max(...reps) + 1);
  return { kind: 'reps', weight: w, reps: target, rir: rirTarget, inc, loads: opts,
    text: `Gewicht halten (${kg(w)} kg), Ziel ${target} Wdh. pro Satz bei ca. ${rirTarget} RIR.` };
}

// ---------- Verfügbare Gewichte je Übung (z. B. Kabelzug mit festen Plattenstufen)
// Einstellung im Profil: equipment[exId] = { start, step, max, addOns: [kg, ...] }
// Mögliche Lasten = start + k × step, jeweils auch plus jede Kombination der Zusatzgewichte.
export function loadOptions(profile, exId) {
  const eq = profile.equipment && profile.equipment[exId];
  if (!eq || !(Number(eq.step) > 0)) return null;
  const start = Number(eq.start) || Number(eq.step);
  const step = Number(eq.step), max = Number(eq.max) || start + step * 30;
  const adds = (eq.addOns || []).map(Number).filter((x) => x > 0);
  const combos = [0];
  for (const a of adds) for (const c of [...combos]) combos.push(c + a);
  const set = new Set();
  for (let base = start; base <= max + 1e-9; base += step) for (const c of combos) set.add(Math.round((base + c) * 100) / 100);
  return [...set].sort((a, b) => a - b);
}
const snapUp = (opts, w) => opts.find((x) => x > w + 1e-9) ?? opts[opts.length - 1];
const snapDown = (opts, w) => [...opts].reverse().find((x) => x < w - 1e-9) ?? opts[0];
export const snapNearest = (opts, w) => opts.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), opts[0]);

// Fraktionales Volumen (Pelland et al.): primär 1, sekundär 0,5 pro Satz
export function volumeByMuscle(profile, sessions) {
  const vol = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  const perSessionPeak = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  for (const s of sessions) {
    if (s.type !== 'kraft') continue;
    const local = {};
    for (const ex of s.exercises || []) {
      const def = exerciseById(profile, ex.exId);
      if (!def) continue;
      const n = doneSets(ex).length;
      for (const m of def.p) local[m] = (local[m] || 0) + n;
      for (const m of def.s) if (!def.p.includes(m)) local[m] = (local[m] || 0) + n * 0.5;
    }
    for (const [m, v] of Object.entries(local)) {
      vol[m] += v;
      perSessionPeak[m] = Math.max(perSessionPeak[m], v);
    }
  }
  return { vol, perSessionPeak };
}

export function tonnage(session) {
  let t = 0;
  for (const ex of session.exercises || []) for (const s of doneSets(ex)) t += (num(s.w) || 0) * num(s.reps);
  return t;
}
