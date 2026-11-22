// Garmin-Import: wandelt die data.json des Garmin-Syncs in Einheiten der App um.
// Reine Funktionen ohne Oberfläche, damit sie leicht zu testen und zu ändern sind.
//
// Krafttraining: Die Sätze trägst du in der App ein, die Uhr liefert Dauer, Puls und
// deine Selbsteinschätzung nach dem Training (Anstrengung und Gefühl). Gibt es am selben
// Tag schon ein Krafttraining in der App, werden beide zu einer Einheit verknüpft.
// Sonst entsteht eine Einheit „nur von der Uhr“ (ohne Sätze), die später automatisch
// mit deinem App-Eintrag zusammengeführt wird.
import { zoneOfHr } from './endurance.js';
import { wellnessFromGarmin } from './readiness.js';

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// Garmin-Typ -> Sportart der App. sport 'kraft' = Krafttraining, null = wird nicht übernommen.
const RULES = [
  [/e_bike/, 'ebike'],
  [/strength|hiit|weight/, 'kraft'],
  [/meditation|breathwork/, null, 'Meditation und Atemübungen'],
  [/yoga|pilates|mobility/, 'mobility'],
  [/run/, 'laufen'],
  [/virtual_ride|indoor_cycling/, 'indoorrad'],
  [/cycl|bik|ride/, 'rad'],
  [/rowing/, 'rudern'],
  [/swim/, 'schwimmen'],
  [/hik|walk/, 'wandern'],
  [/stair|stepper|elliptical/, 'stepper'],
  [/box|martial|mma|kick|judo|karate|wrestl/, 'kampfsport'],
];

export function mapType(typ) {
  const t = String(typ || '').toLowerCase();
  for (const [re, sport, reason] of RULES) if (re.test(t)) return { sport, reason };
  return { sport: 'sonstiges' };
}

// RPE-Schätzung aus dem Puls (nur Ausdauer), wenn auf der Uhr keine Anstrengung eingegeben wurde.
// Zuordnung Zone -> RPE (CR-10) als grobe Näherung: Z1 2, Z2 3, Z3 5, Z4 7, Z5 9.
// Für Krafttraining wird bewusst nicht geschätzt: Der Puls sagt dort wenig über die Anstrengung.
const ZONE_RPE = [2, 3, 5, 7, 9];

export function estimateRpe(profile, w) {
  const zm = (w.zonen_min || []).map((x) => num(x) || 0);
  const total = zm.reduce((a, b) => a + b, 0);
  if (total > 0) {
    const r = zm.reduce((a, m, i) => a + m * ZONE_RPE[i], 0) / total;
    return { value: Math.round(r), source: 'zonen' };
  }
  const z = zoneOfHr(profile, num(w.puls_avg));
  if (z) return { value: ZONE_RPE[z - 1], source: 'puls' };
  return null;
}

const watchRpe = (w) => (num(w.rpe) ? Math.min(10, Math.max(1, Math.round(num(w.rpe)))) : null);

// Felder, die bei einem Krafttraining aus der App von der Uhr ergänzt werden
function garminFields(w) {
  return {
    garminId: String(w.id), garminTyp: w.typ,
    avgHr: num(w.puls_avg) || '', garminRpe: watchRpe(w), gefuehl: w.gefuehl || null,
    garminDauer: num(w.dauer_min) ? Math.round(num(w.dauer_min)) : null,
    garminLast: num(w.trainingslast), teAerob: num(w.te_aerob), kcal: num(w.kalorien),
  };
}

// Vorschau berechnen, ohne etwas zu verändern
export function planImport(profile, data) {
  const workouts = Object.values((data && data.workouts) || {});
  if (!workouts.length && !(data && data.tage)) throw new Error('Das ist keine data.json aus dem Garmin-Sync.');
  const existing = new Map(profile.sessions.map((s) => [s.id, s]));
  const byGarminId = new Map(profile.sessions.filter((s) => s.garminId && s.source !== 'garmin').map((s) => [s.garminId, s]));
  const manual = profile.sessions.filter((s) => s.source !== 'garmin');
  const linkedAppIds = new Set();
  const result = { neu: [], aktualisiert: [], verknuepft: [], doppelt: [], uebersprungen: {}, ohneRpe: 0, wellness: wellnessFromGarmin(data && data.tage) };
  const skip = (why) => { result.uebersprungen[why] = (result.uebersprungen[why] || 0) + 1; };

  // Älteste zuerst, damit bei mehreren Garmin-Krafteinheiten an einem Tag die erste verknüpft wird
  workouts.sort((a, b) => String(a.start || a.datum).localeCompare(String(b.start || b.datum)));

  for (const w of workouts) {
    const { sport, reason } = mapType(w.typ);
    if (!sport) { skip(reason); continue; }
    if (!w.datum || !num(w.dauer_min)) { skip('ohne Datum oder Dauer'); continue; }
    const id = `garmin_${w.id}`;
    const old = existing.get(id);

    // ---------- Krafttraining
    if (sport === 'kraft') {
      const linked = byGarminId.get(String(w.id));
      const appSession = linked || manual.find((m) => m.type === 'kraft' && m.date === w.datum && !m.garminId && !linkedAppIds.has(m.id));
      if (appSession) {
        linkedAppIds.add(appSession.id);
        result.verknuepft.push({ targetId: appSession.id, patch: garminFields(w), name: appSession.name, date: w.datum });
        continue;
      }
      const keepManual = old && old.srpeQuelle === 'manuell';
      const srpe = keepManual ? old.srpe : watchRpe(w);
      if (!srpe) result.ohneRpe++;
      const session = {
        id, type: 'kraft', name: w.name || 'Krafttraining', date: w.datum,
        durationMin: Math.round(num(w.dauer_min)),
        srpe, srpeQuelle: keepManual ? 'manuell' : (srpe ? 'uhr' : null),
        notes: '', exercises: [], loadOnly: true, source: 'garmin',
        ...garminFields(w),
      };
      (old ? result.aktualisiert : result.neu).push(session);
      continue;
    }

    // ---------- Ausdauer und weitere Sportarten
    let srpe = null, srpeQuelle = null;
    if (old && old.srpeQuelle === 'manuell') { srpe = old.srpe; srpeQuelle = 'manuell'; }
    else if (watchRpe(w)) { srpe = watchRpe(w); srpeQuelle = 'uhr'; }
    else {
      const est = estimateRpe(profile, w);
      if (est) { srpe = est.value; srpeQuelle = `geschätzt (${est.source === 'zonen' ? 'Zonen' : 'Ø-Puls'})`; }
    }
    if (!srpe) result.ohneRpe++;

    const session = {
      id, type: 'ausdauer', sport, date: w.datum,
      durationMin: Math.round(num(w.dauer_min)),
      distanceKm: num(w.distanz_km) || '',
      avgHr: num(w.puls_avg) || '',
      avgPower: num(w.leistung_avg) || '',
      srpe, srpeQuelle, gefuehl: w.gefuehl || null,
      zoneMin: (w.zonen_min || ['', '', '', '', '']).map((x) => (num(x) === null ? '' : num(x))),
      notes: w.name || '',
      source: 'garmin', garminId: String(w.id), garminTyp: w.typ,
      teAerob: num(w.te_aerob), garminLast: num(w.trainingslast), kcal: num(w.kalorien),
    };

    if (old) { result.aktualisiert.push(session); continue; }
    // Mögliche Doppelung: gleiche Sportart am gleichen Tag, Dauer ähnlich (±15 %)
    const dup = manual.find((m) => m.type === 'ausdauer' && m.sport === sport && m.date === w.datum &&
      Math.abs((num(m.durationMin) || 0) - session.durationMin) <= Math.max(5, session.durationMin * 0.15));
    if (dup) { result.doppelt.push({ session, dup }); continue; }
    result.neu.push(session);
  }
  return result;
}

// Eine App-Einheit mit Garmin-Daten ergänzen. Deine Anstrengung aus der App hat Vorrang;
// fehlt sie, wird die von der Uhr genommen. Die Dauer kommt immer von der Uhr.
export function linkGarmin(session, patch) {
  Object.assign(session, patch);
  if (!session.srpe && patch.garminRpe) { session.srpe = patch.garminRpe; session.srpeQuelle = 'uhr'; }
  // Die Uhr misst die echte Trainingsdauer; in der App trägst du Sätze oft erst danach ein
  if (patch.garminDauer) { session.appDauer ??= session.durationMin; session.durationMin = patch.garminDauer; }
  return session;
}

export function applyImport(profile, plan) {
  const idx = () => new Map(profile.sessions.map((s, i) => [s.id, i]));
  let byId = idx();
  for (const s of plan.aktualisiert) profile.sessions[byId.get(s.id)] = s;
  for (const v of plan.verknuepft) {
    const target = profile.sessions[byId.get(v.targetId)];
    if (!target) continue;
    // Eine früher angelegte „nur Uhr“-Einheit für dasselbe Training entfernen
    profile.sessions = profile.sessions.filter((s) => !(s.loadOnly && s.garminId === v.patch.garminId));
    byId = idx();
    linkGarmin(target, v.patch);
  }
  profile.sessions.push(...plan.neu);
  profile.sessions.sort((a, b) => a.date.localeCompare(b.date));
  // Tageswerte zusammenführen, nur die letzten 180 Tage behalten
  const well = { ...(profile.wellness || {}), ...(plan.wellness || {}) };
  profile.wellness = Object.fromEntries(Object.entries(well).sort().slice(-180));
  profile.garminImport = { zuletzt: new Date().toISOString(), anzahl: plan.neu.length + plan.aktualisiert.length + plan.verknuepft.length };
}

// Wird beim Speichern eines Krafttrainings in der App aufgerufen: Gibt es für denselben Tag
// eine Einheit „nur von der Uhr“, wird sie in den App-Eintrag übernommen und entfernt.
export function absorbLoadOnly(profile, session) {
  const twin = profile.sessions.find((s) => s.loadOnly && s.type === 'kraft' && s.date === session.date && s.id !== session.id);
  if (!twin) return false;
  linkGarmin(session, {
    garminId: twin.garminId, garminTyp: twin.garminTyp, avgHr: twin.avgHr,
    garminRpe: twin.srpeQuelle === 'uhr' ? twin.srpe : twin.garminRpe ?? null,
    gefuehl: twin.gefuehl, garminDauer: twin.durationMin, garminLast: twin.garminLast, teAerob: twin.teAerob, kcal: twin.kcal ?? null,
  });
  if (!session.srpe && twin.srpe) { session.srpe = twin.srpe; session.srpeQuelle = twin.srpeQuelle; }
  profile.sessions = profile.sessions.filter((s) => s.id !== twin.id);
  return true;
}
