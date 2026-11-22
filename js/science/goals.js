// Zielprofile. Jedes Ziel setzt Startwerte für die Trainingsparameter.
// Alle Werte sind im Profil einzeln überschreibbar.
// Quellen-Kürzel verweisen auf die Liste in js/science/references.js.

export const GOALS = {
  hypertrophie: {
    label: 'Muskelaufbau',
    short: 'Hypertrophie',
    text: 'Viel effektives Volumen pro Muskel, nah am Muskelversagen. Die Last ist zweitrangig, solange Sätze ausreichend hart sind.',
    refs: ['schoenfeld2017vol', 'schoenfeld2017load', 'pelland2024', 'refalo2023', 'robinson2024'],
    params: {
      repMin: 6, repMax: 15, rirMin: 0, rirMax: 3,
      setsMin: 10, setsMax: 20, freqPerMuscle: 2,
      strengthDays: 4, enduranceMin: 90, lowShare: 0.8,
      restCompound: 150, restIsolation: 90,
    },
  },
  kraft: {
    label: 'Maximalkraft',
    short: 'Kraft',
    text: 'Schwere Lasten (ca. 80–95 % 1RM) in Grundübungen, wenige Wiederholungen, nicht ständig bis zum Versagen.',
    refs: ['schoenfeld2017load', 'robinson2024', 'pelland2024', 'helms2016'],
    params: {
      repMin: 2, repMax: 6, rirMin: 1, rirMax: 3,
      setsMin: 6, setsMax: 12, freqPerMuscle: 2,
      strengthDays: 3, enduranceMin: 60, lowShare: 0.8,
      restCompound: 210, restIsolation: 120,
    },
  },
  rekomposition: {
    label: 'Körperkomposition',
    short: 'Rekomposition',
    text: 'Muskelmasse erhalten bzw. aufbauen und gleichzeitig Ausdauerumfang für Energieverbrauch und Gesundheit.',
    refs: ['schoenfeld2017vol', 'pelland2024', 'who2020', 'seiler2010'],
    params: {
      repMin: 6, repMax: 15, rirMin: 1, rirMax: 3,
      setsMin: 8, setsMax: 16, freqPerMuscle: 2,
      strengthDays: 3, enduranceMin: 150, lowShare: 0.8,
      restCompound: 120, restIsolation: 75,
    },
  },
  ausdauer: {
    label: 'Ausdauerleistung',
    short: 'Ausdauer',
    text: 'Hoher Anteil lockerer Einheiten (ca. 80 %) plus gezielte intensive Intervalle. Krafttraining zur Verletzungsprophylaxe und Ökonomie.',
    refs: ['seiler2010', 'stoggl2014', 'ronnestad2014', 'foster2001'],
    params: {
      repMin: 4, repMax: 10, rirMin: 2, rirMax: 4,
      setsMin: 4, setsMax: 10, freqPerMuscle: 2,
      strengthDays: 2, enduranceMin: 300, lowShare: 0.8,
      restCompound: 150, restIsolation: 90,
    },
  },
  hybrid: {
    label: 'Hybrid (Kraft + Ausdauer)',
    short: 'Hybrid',
    text: 'Paralleles Training. Interferenz ist vor allem bei hohem Ausdauerumfang relevant; Abstand zwischen harten Einheiten einplanen.',
    refs: ['schumann2022', 'pelland2024', 'seiler2010'],
    params: {
      repMin: 5, repMax: 12, rirMin: 1, rirMax: 3,
      setsMin: 8, setsMax: 16, freqPerMuscle: 2,
      strengthDays: 4, enduranceMin: 180, lowShare: 0.8,
      restCompound: 150, restIsolation: 90,
    },
  },
  gesundheit: {
    label: 'Gesundheit & Fitness',
    short: 'Gesundheit',
    text: 'WHO-Empfehlung: 150–300 min moderate oder 75–150 min intensive Ausdaueraktivität pro Woche und Krafttraining an mindestens 2 Tagen.',
    refs: ['who2020', 'pelland2024'],
    params: {
      repMin: 8, repMax: 15, rirMin: 2, rirMax: 4,
      setsMin: 4, setsMax: 10, freqPerMuscle: 2,
      strengthDays: 2, enduranceMin: 150, lowShare: 0.8,
      restCompound: 120, restIsolation: 75,
    },
  },
};

export const PARAM_META = {
  repMin: { label: 'Wiederholungen min.', step: 1, min: 1, max: 30 },
  repMax: { label: 'Wiederholungen max.', step: 1, min: 1, max: 40 },
  rirMin: { label: 'RIR min. (Reserve)', step: 1, min: 0, max: 5 },
  rirMax: { label: 'RIR max. (Reserve)', step: 1, min: 0, max: 6 },
  setsMin: { label: 'Sätze/Muskel/Woche min.', step: 1, min: 0, max: 40 },
  setsMax: { label: 'Sätze/Muskel/Woche max.', step: 1, min: 0, max: 40 },
  freqPerMuscle: { label: 'Frequenz pro Muskel/Woche', step: 1, min: 1, max: 6 },
  strengthDays: { label: 'Krafteinheiten/Woche', step: 1, min: 0, max: 7 },
  enduranceMin: { label: 'Ausdauer-Minuten/Woche', step: 10, min: 0, max: 1500 },
  lowShare: { label: 'Anteil locker (Z1–2)', step: 0.05, min: 0.5, max: 1 },
  restCompound: { label: 'Pause Grundübung (s)', step: 15, min: 30, max: 420 },
  restIsolation: { label: 'Pause Isolation (s)', step: 15, min: 30, max: 300 },
};

export function defaultParamsFor(goal) {
  return { ...(GOALS[goal] || GOALS.hypertrophie).params };
}
