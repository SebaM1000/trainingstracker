// Ausdauer: Zonen, Intensitätsverteilung, TRIMP.

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export function age(profile) {
  const y = num(profile.body.birthYear);
  return y ? new Date().getFullYear() - y : null;
}

// Tanaka et al. (2001), falls keine gemessene HFmax vorliegt
export function hrMax(profile) {
  const m = num(profile.physio.hrMax);
  if (m) return { value: m, source: 'gemessen' };
  const a = age(profile);
  if (a) return { value: Math.round(208 - 0.7 * a), source: 'geschätzt (Tanaka)' };
  return null;
}

// 5 Herzfrequenzzonen. Priorität: LTHR (Friel) > HF-Reserve (Karvonen) > %HFmax
export function hrZones(profile) {
  const lthr = num(profile.physio.lthr);
  if (lthr) {
    const b = [0, 0.85, 0.9, 0.95, 1.0].map((f) => Math.round(lthr * f));
    return { method: 'Laktatschwelle (LTHR, nach Friel)', bounds: b, top: Math.round(lthr * 1.06) };
  }
  const max = hrMax(profile);
  if (!max) return null;
  const rest = num(profile.physio.hrRest);
  if (rest) {
    const r = max.value - rest;
    const b = [0.5, 0.6, 0.7, 0.8, 0.9].map((f) => Math.round(rest + r * f));
    return { method: `HF-Reserve (Karvonen), HFmax ${max.source}`, bounds: b, top: max.value };
  }
  const b = [0.5, 0.6, 0.7, 0.8, 0.9].map((f) => Math.round(max.value * f));
  return { method: `% HFmax, HFmax ${max.source}`, bounds: b, top: max.value };
}

export function zoneOfHr(profile, hr) {
  const z = hrZones(profile);
  if (!z || !hr) return null;
  let zone = 1;
  z.bounds.forEach((b, i) => { if (hr >= b) zone = i + 1; });
  return zone;
}

// Leistungszonen nach Coggan
export function powerZones(profile) {
  const ftp = num(profile.physio.ftp);
  if (!ftp) return null;
  const def = [
    ['Z1 Aktive Erholung', 0, 0.55], ['Z2 Grundlage', 0.56, 0.75], ['Z3 Tempo', 0.76, 0.9],
    ['Z4 Schwelle', 0.91, 1.05], ['Z5 VO2max', 1.06, 1.2], ['Z6 Anaerobe Kap.', 1.21, 1.5], ['Z7 Neuromuskulär', 1.51, null],
  ];
  // Grenzen lückenlos: Untergrenze = vorherige Obergrenze + 1 W
  let prev = -1;
  return def.map(([name, , hi]) => {
    const z = { name, lo: prev + 1, hi: hi ? Math.round(ftp * hi) : null };
    prev = z.hi;
    return z;
  });
}

// 3-Zonen-Modell (Seiler): locker = Z1–2, mittel = Z3, hart = Z4–5
export function distribution(profile, session) {
  const dur = num(session.durationMin) || 0;
  const zm = (session.zoneMin || []).map((x) => num(x) || 0);
  if (zm.some((x) => x > 0)) {
    return { low: zm[0] + zm[1], mid: zm[2], high: zm[3] + zm[4], source: 'zonen' };
  }
  const z = zoneOfHr(profile, num(session.avgHr));
  let cls;
  if (z) cls = z <= 2 ? 'low' : z === 3 ? 'mid' : 'high';
  else {
    const rpe = num(session.srpe);
    if (!rpe) return { low: 0, mid: 0, high: 0, source: 'keine' };
    cls = rpe <= 4 ? 'low' : rpe <= 6 ? 'mid' : 'high';
  }
  return { low: 0, mid: 0, high: 0, [cls]: dur, source: z ? 'puls' : 'rpe' };
}

// Edwards-TRIMP aus Zonenminuten
export function trimpEdwards(session) {
  const zm = (session.zoneMin || []).map((x) => num(x) || 0);
  if (!zm.some((x) => x > 0)) return null;
  return zm.reduce((a, m, i) => a + m * (i + 1), 0);
}

export const SPORTS = {
  laufen: { label: 'Laufen', endurance: true, distance: true, pace: true },
  rad: { label: 'Rad / Rennrad', endurance: true, distance: true, power: true },
  indoorrad: { label: 'Indoor-Rad', endurance: true, distance: true, power: true },
  rudern: { label: 'Rudern', endurance: true, distance: true, power: true },
  stepper: { label: 'Stepper', endurance: true },
  schwimmen: { label: 'Schwimmen', endurance: true, distance: true },
  wandern: { label: 'Wandern / Gehen', endurance: true, distance: true },
  ebike: { label: 'E-Bike (Alltag)', endurance: false, distance: true },
  kampfsport: { label: 'Kampfsport', endurance: false },
  mobility: { label: 'Mobility / Yoga', endurance: false },
  sonstiges: { label: 'Sonstiges', endurance: false },
};

export function paceStr(durationMin, distanceKm) {
  const d = num(distanceKm), t = num(durationMin);
  if (!d || !t) return null;
  const secPerKm = (t * 60) / d;
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`;
}
