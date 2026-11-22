// Vorgefertigte Essensauswahl. Wird beim ersten Öffnen ins Profil kopiert und ist dort
// frei änderbar. Nährwerte sind typische Packungs- bzw. Tabellenwerte (BLS/USDA, gerundet).
// cat: fruehstueck | snack | gericht | dessert

const sum = (items) => {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const i of items) { t.kcal += i.kcal; t.p += i.p; t.c += i.c; t.f += i.f; }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p * 10) / 10, c: Math.round(t.c * 10) / 10, f: Math.round(t.f * 10) / 10 };
};

// Standard-Frühstück, Bestandteile einzeln, damit Mengen später leicht anpassbar sind
export const STANDARD_BREAKFAST_ITEMS = [
  { name: 'Haferflocken 100 g', kcal: 370, p: 13.5, c: 58.7, f: 7.0 },
  { name: 'Magerquark 250 g', kcal: 168, p: 30.0, c: 10.0, f: 0.5 },
  { name: 'Fettarmer Joghurt 1,5 % 250 g', kcal: 120, p: 10.0, c: 12.0, f: 3.8 },
  { name: 'Eiweißpulver 1 Scoop (30 g)', kcal: 115, p: 23.0, c: 2.0, f: 1.5 },
  { name: 'Honig 1 EL (20 g)', kcal: 61, p: 0, c: 15.0, f: 0 },
  { name: 'TK-Beeren 1 Handvoll (80 g)', kcal: 35, p: 0.8, c: 6.0, f: 0.3 },
];

export const DEFAULT_PRESETS = [
  { key: 'std-fruehstueck', name: 'Standard-Frühstück', cat: 'fruehstueck', standard: true,
    note: STANDARD_BREAKFAST_ITEMS.map((i) => i.name).join(', '), ...sum(STANDARD_BREAKFAST_ITEMS) },

  { key: 'ei', name: '1 Ei (M)', cat: 'snack', kcal: 85, p: 7.5, c: 0.4, f: 6.0 },
  { key: 'riegel15', name: 'Eiweißriegel (15 g Protein)', cat: 'snack', kcal: 200, p: 15, c: 18, f: 7, note: 'Werte je nach Sorte prüfen' },
  { key: 'shake30', name: 'Eiweißshake (30 g Protein, mit Wasser)', cat: 'snack', kcal: 150, p: 30, c: 3, f: 2 },
  { key: 'milch250', name: 'Milch 1,5 % 250 ml', cat: 'snack', kcal: 118, p: 8.5, c: 12, f: 3.8 },
  { key: 'skyr150', name: 'Skyr natur 150 g', cat: 'snack', kcal: 95, p: 16.5, c: 6, f: 0.3 },
  { key: 'huettenkaese', name: 'Hüttenkäse 200 g', cat: 'snack', kcal: 196, p: 25, c: 6, f: 8.6 },
  { key: 'banane', name: 'Banane', cat: 'snack', kcal: 105, p: 1.3, c: 27, f: 0.4 },
  { key: 'apfel', name: 'Apfel', cat: 'snack', kcal: 78, p: 0.4, c: 17, f: 0.2 },
  { key: 'nuesse', name: 'Nüsse 1 Handvoll (30 g)', cat: 'snack', kcal: 185, p: 5, c: 4, f: 16 },
  { key: 'brot', name: 'Vollkornbrot 1 Scheibe (50 g)', cat: 'snack', kcal: 110, p: 3.5, c: 19, f: 1 },

  { key: 'hp-mousse', name: 'Milsani High Protein Mousse', cat: 'dessert', kcal: 130, p: 20, c: 10, f: 1.5, note: 'Werte von der Packung prüfen' },
  { key: 'hp-griess', name: 'Milsani High Protein Grießbrei', cat: 'dessert', kcal: 175, p: 20, c: 19, f: 2, note: 'Werte von der Packung prüfen' },
];

export const CATS = { fruehstueck: 'Frühstück', snack: 'Zwischenmahlzeiten', gericht: 'Gerichte', dessert: 'Desserts' };
