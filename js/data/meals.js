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
  { name: 'Eiweißpulver 1 Scoop (ca. 23 g Eiweiß)', kcal: 115, p: 23.0, c: 2.0, f: 1.5 },
  { name: 'Honig 1 EL (25 g)', kcal: 76, p: 0, c: 19.0, f: 0 },
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
  { key: 'quark250', name: 'Magerquark 250 g', cat: 'snack', kcal: 168, p: 30, c: 10, f: 0.5 },
  { key: 'brot-ei', name: 'Brot mit 2 Eiern (2 Scheiben)', cat: 'snack', kcal: 390, p: 22, c: 39, f: 14 },
  { key: 'brot-huettenkaese', name: 'Brot mit Hüttenkäse (2 Scheiben)', cat: 'snack', kcal: 320, p: 20, c: 41, f: 6 },
  { key: 'hummus-gemuese', name: 'Gemüsesticks mit Hummus', cat: 'snack', kcal: 150, p: 5, c: 14, f: 8 },
  { key: 'reiswaffeln', name: 'Reiswaffeln (3 Stück)', cat: 'snack', kcal: 105, p: 2, c: 23, f: 0.8 },

  // Gerichte: Werte je Portion. Rezepte sind auf 4 Portionen ausgelegt (2 × Abendessen + 2 × Mittagessen am Folgetag).
  { key: 'g-haehnchen-reis', name: 'Hähnchenbrust mit Reis und Gemüse', cat: 'gericht', kcal: 615, p: 51, c: 70, f: 14, note: '180 g Hähnchen, 80 g Reis (roh), 200 g Gemüse, 1 EL Öl' },
  { key: 'g-bolognese', name: 'Spaghetti Bolognese', cat: 'gericht', kcal: 650, p: 45, c: 77, f: 17, note: '100 g Vollkornspaghetti (roh), 125 g Rinderhack 5 %, Tomatensoße, 10 g Parmesan' },
  { key: 'g-lachs-ofenkartoffeln', name: 'Lachs mit Ofenkartoffeln und Brokkoli', cat: 'gericht', kcal: 690, p: 42, c: 56, f: 31, note: '150 g Lachs, 300 g Kartoffeln, 200 g Brokkoli, 1 EL Öl' },
  { key: 'g-ofenkartoffeln-quark', name: 'Ofenkartoffeln mit Kräuterquark', cat: 'gericht', kcal: 470, p: 32, c: 72, f: 6, note: '400 g Kartoffeln, 200 g Magerquark, Kräuter, 1 TL Öl' },
  { key: 'g-chili', name: 'Chili con Carne mit Reis', cat: 'gericht', kcal: 640, p: 41, c: 88, f: 12, note: '125 g Rinderhack 5 %, Kidneybohnen, Mais, Paprika, 70 g Reis (roh)' },
  { key: 'g-pute-geschnetzeltes', name: 'Putengeschnetzeltes mit Reis', cat: 'gericht', kcal: 600, p: 51, c: 66, f: 13, note: '180 g Pute, Champignons, 50 ml Kochsahne 15 %, 80 g Reis (roh)' },
  { key: 'g-haehnchen-curry', name: 'Hähnchen-Curry mit Reis', cat: 'gericht', kcal: 560, p: 45, c: 64, f: 12, note: '160 g Hähnchen, 100 ml Kokosmilch light, Gemüse, 70 g Reis (roh)' },
  { key: 'g-gyros-bowl', name: 'Hähnchen-Gyros-Bowl mit Tzatziki', cat: 'gericht', kcal: 590, p: 53, c: 63, f: 13, note: '180 g Hähnchen, 70 g Reis (roh), 100 g Joghurt-Tzatziki, Gurke, Tomate' },
  { key: 'g-couscous-salat', name: 'Couscous-Salat mit Hähnchen und Feta', cat: 'gericht', kcal: 580, p: 43, c: 56, f: 20, note: '70 g Couscous (roh), 120 g Hähnchen, 30 g Feta, Gemüse, 1 EL Öl' },
  { key: 'g-wraps', name: 'Hähnchen-Wraps mit Bohnen', cat: 'gericht', kcal: 520, p: 42, c: 58, f: 10, note: '2 Vollkornwraps, 120 g Hähnchen, Bohnen, Gemüse, Joghurtsoße' },
  { key: 'g-steak-suesskartoffel', name: 'Rindersteak mit Süßkartoffel und Bohnen', cat: 'gericht', kcal: 610, p: 48, c: 67, f: 17, note: '180 g Hüftsteak, 300 g Süßkartoffel, 150 g grüne Bohnen, 1 EL Öl' },
  { key: 'g-hackbaellchen-bulgur', name: 'Hackbällchen in Tomatensoße mit Bulgur', cat: 'gericht', kcal: 540, p: 38, c: 62, f: 13, note: '125 g Rinderhack 5 %, 70 g Bulgur (roh), Tomatensoße' },
  { key: 'g-gefuellte-paprika', name: 'Gefüllte Paprika mit Hack und Feta', cat: 'gericht', kcal: 490, p: 32, c: 50, f: 17, note: '100 g Rinderhack, 50 g Reis (roh), 30 g Feta, Tomaten' },
  { key: 'g-lasagne', name: 'Lasagne (leichte Variante)', cat: 'gericht', kcal: 640, p: 45, c: 60, f: 24, note: 'Rinderhack 5 %, Hüttenkäse statt Béchamel, Vollkornplatten' },
  { key: 'g-thunfisch-pasta', name: 'Thunfisch-Pasta mit Tomaten', cat: 'gericht', kcal: 630, p: 42, c: 78, f: 16, note: '100 g Pasta (roh), 1 Dose Thunfisch natur, Tomaten, Oliven, 1 EL Öl' },
  { key: 'g-lachs-spinat-pasta', name: 'Lachs-Spinat-Pasta', cat: 'gericht', kcal: 620, p: 41, c: 63, f: 21, note: '90 g Pasta (roh), 120 g Lachs, Spinat, 30 g Frischkäse light' },
  { key: 'g-kabeljau', name: 'Kabeljau mit Kartoffeln und Spinat', cat: 'gericht', kcal: 510, p: 47, c: 52, f: 11, note: '200 g Kabeljau oder Seelachs, 300 g Kartoffeln, 200 g Spinat' },
  { key: 'g-shakshuka', name: 'Shakshuka mit Feta und Brot', cat: 'gericht', kcal: 555, p: 34, c: 33, f: 31, note: '3 Eier, Tomaten, Paprika, 30 g Feta, 1 Scheibe Brot' },
  { key: 'g-omelett', name: 'Gemüse-Omelett mit Käse und Brot', cat: 'gericht', kcal: 475, p: 36, c: 25, f: 25, note: '3 Eier, 30 g Käse light, Gemüse, 1 Scheibe Brot' },
  { key: 'g-ruehrei-lachs', name: 'Rührei mit Räucherlachs und Brot', cat: 'gericht', kcal: 555, p: 39, c: 39, f: 25, note: '3 Eier, 50 g Räucherlachs, 2 Scheiben Brot' },
  { key: 'g-kartoffelpfanne-ei', name: 'Kartoffel-Gemüse-Pfanne mit Spiegeleiern', cat: 'gericht', kcal: 570, p: 25, c: 66, f: 23, note: '350 g Kartoffeln, 2 Eier, 200 g Gemüse, 1 EL Öl' },
  { key: 'g-ofengemuese-feta', name: 'Ofengemüse mit Kichererbsen und Feta', cat: 'gericht', kcal: 570, p: 27, c: 44, f: 30, note: '400 g Gemüse, 120 g Kichererbsen, 75 g Feta, 1 EL Öl' },
  { key: 'g-linsencurry', name: 'Rotes Linsencurry mit Reis', cat: 'gericht', kcal: 620, p: 26, c: 95, f: 14, note: '80 g rote Linsen (roh), Kokosmilch light, Gemüse, 60 g Reis (roh)' },
  { key: 'g-gnocchi', name: 'Gnocchi aus dem Ofen mit Tomate und Mozzarella', cat: 'gericht', kcal: 580, p: 22, c: 90, f: 12, note: '250 g Gnocchi, Tomaten, 60 g Mozzarella light' },
  { key: 'g-frei', name: 'Freies Essen (Restaurant, grob)', cat: 'gericht', kcal: 900, p: 40, c: 90, f: 40, note: 'grobe Schätzung, z. B. für den freien Sonntag' },
  { key: 'g-pizza', name: 'Pizza Margherita (ganze)', cat: 'gericht', kcal: 950, p: 38, c: 120, f: 33, note: 'Restaurant oder Tiefkühl, grob' },


  { key: 'hp-mousse', name: 'Milsani High Protein Mousse', cat: 'dessert', kcal: 130, p: 20, c: 10, f: 1.5, note: 'Werte von der Packung prüfen' },
  { key: 'hp-griess', name: 'Milsani High Protein Grießbrei', cat: 'dessert', kcal: 175, p: 20, c: 19, f: 2, note: 'Werte von der Packung prüfen' },
  { key: 'skyr-beeren', name: 'Skyr mit Beeren und Honig', cat: 'dessert', kcal: 200, p: 17, c: 30, f: 0.5 },
  { key: 'schoki20', name: 'Zartbitterschokolade 20 g', cat: 'dessert', kcal: 115, p: 2, c: 9, f: 8 },
];

export const CATS = { gericht: 'Gerichte', snack: 'Zwischenmahlzeiten', dessert: 'Desserts', fruehstueck: 'Frühstück' };

// Versionsstand der Vorlagen. Bei neuen Vorlagen oder Änderungen am Standard-Frühstück hochzählen:
// fehlende Vorlagen kommen dann ins Profil (außer selbst gelöschte), ein unverändertes Frühstück wird angepasst.
export const PRESETS_VERSION = 3;
