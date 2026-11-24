// Automatischer Garmin-Abruf: Der PC legt data.json in ein PRIVATES GitHub-Repository,
// die App holt sie dort mit einem Nur-Lese-Schlüssel ab und übernimmt sie ohne Dateiauswahl.
import { planImport, applyImport } from '../science/garmin.js';

const MIN_ABSTAND_MS = 10 * 60 * 1000; // automatisch höchstens alle 10 Minuten nachsehen
let lastCheck = 0;
let running = null;

export const remoteConfigured = (p) => !!(p && p.settings && p.settings.github && p.settings.github.repo && p.settings.github.token);

export async function fetchRemote(github) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${github.repo}/contents/data.json`, {
      headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store',
    });
  } catch (e) {
    throw new Error('Keine Internetverbindung.');
  }
  if (res.status === 401) throw new Error('Der Lese-Schlüssel ist ungültig oder abgelaufen. Bitte im Profil neu eintragen.');
  if (res.status === 403) throw new Error('Der Lese-Schlüssel darf dieses Repository nicht lesen.');
  if (res.status === 404) throw new Error('data.json nicht gefunden. Stimmt der Repository-Name, und hat der PC schon einmal synchronisiert?');
  if (!res.ok) throw new Error(`GitHub antwortet mit Fehler ${res.status}.`);
  const data = await res.json();
  if (!data || (!data.tage && !data.workouts)) throw new Error('Die Datei enthält keine Garmin-Daten.');
  return data;
}

// Ergebnis: { status: 'importiert' | 'aktuell' | 'uebersprungen' | 'fehler', stand, text }
export function autoImport(store, { force = false } = {}) {
  const p = store.profile();
  if (!remoteConfigured(p) || p.settings.modules.garmin === false) return Promise.resolve({ status: 'uebersprungen' });
  if (!force && Date.now() - lastCheck < MIN_ABSTAND_MS) return Promise.resolve({ status: 'uebersprungen' });
  if (running) return running;
  lastCheck = Date.now();
  running = (async () => {
    try {
      const data = await fetchRemote(p.settings.github);
      const stand = data.aktualisiert || null;
      const prev = p.garminImport && p.garminImport.stand;
      if (prev && stand && prev >= stand) return { status: 'aktuell', stand, text: `Schon aktuell (Stand ${fmtStand(stand)}).` };
      const plan = planImport(store.profile(), data);
      store.updateProfile((pr) => { applyImport(pr, plan); pr.garminImport.stand = stand; pr.garminImport.quelle = 'github'; });
      const n = plan.neu.length;
      return { status: 'importiert', stand, text: `Garmin-Daten übernommen (Stand ${fmtStand(stand)}${n ? `, ${n} neue ${n === 1 ? 'Einheit' : 'Einheiten'}` : ''}).` };
    } catch (e) {
      return { status: 'fehler', text: e.message };
    } finally {
      running = null;
    }
  })();
  return running;
}

export function fmtStand(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return 'unbekannt';
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? 'heute' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}
