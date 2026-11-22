// Speicher-Schicht: alle Daten liegen lokal auf dem Gerät (localStorage).
// Ein einziger Schlüssel, versioniertes Schema, Migrationen für spätere Änderungen.

import { GOALS, defaultParamsFor } from '../science/goals.js';

const KEY = 'trainingstracker.v1';
export const SCHEMA_VERSION = 1;

const listeners = new Set();
let state = null;
let memoryOnly = false;

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function newProfile(name = 'Ich', goal = 'hypertrophie') {
  return {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    body: { sex: '', birthYear: '', weightKg: '' },
    physio: { hrMax: '', hrRest: '', lthr: '', ftp: '', thresholdPace: '' },
    goal,
    params: defaultParamsFor(goal),
    settings: {
      modules: { kraft: true, ausdauer: true, fortschritt: true, garmin: true, tagesform: true },
      increments: { compound: 2.5, isolation: 1 },
    },
    customExercises: [],
    templates: [],
    sessions: [],
    draft: null,
  };
}

function emptyState() {
  return { version: SCHEMA_VERSION, activeProfileId: null, profiles: {} };
}

// Migrationen: bei Schemaänderungen hier eine Stufe ergänzen.
const MIGRATIONS = {
  // 1: (s) => { ...; s.version = 2; return s; },
};

function migrate(s) {
  while (s.version < SCHEMA_VERSION && MIGRATIONS[s.version]) {
    s = MIGRATIONS[s.version](s);
  }
  // Fehlende Felder in Profilen ergänzen (vorwärtskompatibel)
  for (const p of Object.values(s.profiles)) {
    const base = newProfile(p.name, p.goal || 'hypertrophie');
    for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
    p.params = { ...defaultParamsFor(p.goal), ...p.params };
    p.settings.modules = { ...base.settings.modules, ...p.settings.modules };
    p.settings.increments = { ...base.settings.increments, ...p.settings.increments };
    if (!GOALS[p.goal]) p.goal = 'hypertrophie';
  }
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : emptyState();
  } catch (e) {
    memoryOnly = true;
    state = emptyState();
  }
  return state;
}

function persist() {
  if (memoryOnly) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    memoryOnly = true;
  }
}

export const isMemoryOnly = () => memoryOnly;
export const getState = () => state;

export function profile() {
  return state.profiles[state.activeProfileId] || null;
}

export function update(fn) {
  fn(state);
  persist();
  listeners.forEach((l) => l(state));
}

export function updateProfile(fn) {
  update((s) => fn(s.profiles[s.activeProfileId]));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addProfile(name, goal) {
  const p = newProfile(name, goal);
  update((s) => {
    s.profiles[p.id] = p;
    s.activeProfileId = p.id;
  });
  return p;
}

export function switchProfile(id) {
  update((s) => { if (s.profiles[id]) s.activeProfileId = id; });
}

export function deleteProfile(id) {
  update((s) => {
    delete s.profiles[id];
    if (s.activeProfileId === id) s.activeProfileId = Object.keys(s.profiles)[0] || null;
  });
}

// Backup: Export/Import als JSON
export function exportJSON(onlyActive = false) {
  const data = onlyActive
    ? { ...emptyState(), activeProfileId: state.activeProfileId,
        profiles: { [state.activeProfileId]: profile() } }
    : state;
  return JSON.stringify({ app: 'trainingstracker', exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importJSON(text, mode = 'merge') {
  const parsed = JSON.parse(text);
  const incoming = migrate(parsed.data || parsed);
  if (!incoming.profiles) throw new Error('Keine Profile in der Datei gefunden.');
  update((s) => {
    if (mode === 'replace') {
      s.profiles = incoming.profiles;
      s.activeProfileId = incoming.activeProfileId;
    } else {
      for (const [id, p] of Object.entries(incoming.profiles)) {
        const existing = s.profiles[id];
        if (!existing) { s.profiles[id] = p; continue; }
        const known = new Set(existing.sessions.map((x) => x.id));
        existing.sessions.push(...p.sessions.filter((x) => !known.has(x.id)));
        existing.sessions.sort((a, b) => a.date.localeCompare(b.date));
      }
      if (!s.activeProfileId) s.activeProfileId = incoming.activeProfileId;
    }
  });
}
