// Übungsbibliothek. p = primär (direkte Sätze, zählt 1), s = sekundär (indirekt, zählt 0,5).
// Eigene Übungen legt man in der App an; sie landen im Profil.

export const MUSCLES = {
  brust: 'Brust',
  lat: 'Rücken (Lat)',
  ruecken_oben: 'Oberer Rücken',
  schulter_vorn: 'Schulter vorn',
  schulter_seite: 'Schulter seitlich',
  schulter_hinten: 'Schulter hinten',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  quadrizeps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  gesaess: 'Gesäß',
  waden: 'Waden',
  bauch: 'Bauch',
  unterer_ruecken: 'Unterer Rücken',
};

const e = (id, name, cat, p, s = [], equip = '') => ({ id, name, cat, p, s, equip });

export const EXERCISES = [
  // Push
  e('bankdruecken', 'Bankdrücken (LH)', 'compound', ['brust'], ['trizeps', 'schulter_vorn'], 'Langhantel'),
  e('schraegbank_kh', 'Schrägbankdrücken (KH)', 'compound', ['brust', 'schulter_vorn'], ['trizeps'], 'Kurzhantel'),
  e('dips', 'Dips', 'compound', ['brust', 'trizeps'], ['schulter_vorn'], 'Körpergewicht'),
  e('liegestuetz', 'Liegestütz', 'compound', ['brust'], ['trizeps', 'schulter_vorn'], 'Körpergewicht'),
  e('brustpresse', 'Brustpresse (Maschine)', 'compound', ['brust'], ['trizeps', 'schulter_vorn'], 'Maschine'),
  e('kabelzug_fly', 'Fliegende am Kabel', 'isolation', ['brust'], [], 'Kabel'),
  e('schulterdruecken', 'Schulterdrücken (KH)', 'compound', ['schulter_vorn'], ['trizeps', 'schulter_seite'], 'Kurzhantel'),
  e('overhead_press', 'Overhead Press (LH)', 'compound', ['schulter_vorn'], ['trizeps', 'schulter_seite'], 'Langhantel'),
  e('seitheben', 'Seitheben', 'isolation', ['schulter_seite'], [], 'Kurzhantel'),
  e('trizeps_kabel', 'Trizepsdrücken am Kabel', 'isolation', ['trizeps'], [], 'Kabel'),
  e('trizeps_ueberkopf', 'Trizeps Überkopf', 'isolation', ['trizeps'], [], 'Kabel'),
  // Pull
  e('klimmzug', 'Klimmzug', 'compound', ['lat'], ['bizeps', 'ruecken_oben'], 'Körpergewicht'),
  e('latzug', 'Latzug', 'compound', ['lat'], ['bizeps', 'ruecken_oben'], 'Kabel'),
  e('rudern_lh', 'Rudern vorgebeugt (LH)', 'compound', ['ruecken_oben', 'lat'], ['bizeps', 'schulter_hinten', 'unterer_ruecken'], 'Langhantel'),
  e('rudern_kabel', 'Rudern am Kabel', 'compound', ['ruecken_oben', 'lat'], ['bizeps', 'schulter_hinten'], 'Kabel'),
  e('rudern_kh', 'Einarmiges Rudern (KH)', 'compound', ['lat', 'ruecken_oben'], ['bizeps'], 'Kurzhantel'),
  e('facepull', 'Face Pull', 'isolation', ['schulter_hinten'], ['ruecken_oben'], 'Kabel'),
  e('reverse_fly', 'Reverse Fly', 'isolation', ['schulter_hinten'], ['ruecken_oben'], 'Maschine'),
  e('bizeps_curl', 'Bizepscurl (KH)', 'isolation', ['bizeps'], [], 'Kurzhantel'),
  e('hammer_curl', 'Hammercurl', 'isolation', ['bizeps'], [], 'Kurzhantel'),
  e('shrugs', 'Shrugs', 'isolation', ['ruecken_oben'], [], 'Kurzhantel'),
  // Beine
  e('kniebeuge', 'Kniebeuge (LH)', 'compound', ['quadrizeps', 'gesaess'], ['unterer_ruecken'], 'Langhantel'),
  e('frontkniebeuge', 'Frontkniebeuge', 'compound', ['quadrizeps'], ['gesaess', 'ruecken_oben'], 'Langhantel'),
  e('beinpresse', 'Beinpresse', 'compound', ['quadrizeps', 'gesaess'], [], 'Maschine'),
  e('bulgarian', 'Bulgarian Split Squat', 'compound', ['quadrizeps', 'gesaess'], [], 'Kurzhantel'),
  e('ausfallschritt', 'Ausfallschritte', 'compound', ['quadrizeps', 'gesaess'], ['hamstrings'], 'Kurzhantel'),
  e('kreuzheben', 'Kreuzheben', 'compound', ['gesaess', 'hamstrings', 'unterer_ruecken'], ['ruecken_oben', 'quadrizeps'], 'Langhantel'),
  e('rdl', 'Rumänisches Kreuzheben', 'compound', ['hamstrings', 'gesaess'], ['unterer_ruecken'], 'Langhantel'),
  e('hip_thrust', 'Hip Thrust', 'compound', ['gesaess'], ['hamstrings'], 'Langhantel'),
  e('beinstrecker', 'Beinstrecker', 'isolation', ['quadrizeps'], [], 'Maschine'),
  e('beinbeuger', 'Beinbeuger (sitzend)', 'isolation', ['hamstrings'], [], 'Maschine'),
  e('abduktoren', 'Abduktoren-Maschine', 'isolation', ['gesaess'], [], 'Maschine'),
  e('wadenheben', 'Wadenheben', 'isolation', ['waden'], [], 'Maschine'),
  // Rumpf
  e('plank', 'Unterarmstütz (Sek. als Wdh.)', 'isolation', ['bauch'], [], 'Körpergewicht'),
  e('cable_crunch', 'Crunch am Kabel', 'isolation', ['bauch'], [], 'Kabel'),
  e('beinheben', 'Hängendes Beinheben', 'isolation', ['bauch'], [], 'Körpergewicht'),
  e('rueckenstrecker', 'Rückenstrecker', 'isolation', ['unterer_ruecken'], ['gesaess', 'hamstrings'], 'Maschine'),
  // Funktionell / Kampfsport-relevant
  e('kettlebell_swing', 'Kettlebell Swing', 'compound', ['gesaess', 'hamstrings'], ['unterer_ruecken'], 'Kettlebell'),
  e('pallof', 'Pallof Press', 'isolation', ['bauch'], [], 'Kabel'),
];

export function allExercises(profile) {
  return [...EXERCISES, ...((profile && profile.customExercises) || [])];
}

export function exerciseById(profile, id) {
  return allExercises(profile).find((x) => x.id === id);
}
