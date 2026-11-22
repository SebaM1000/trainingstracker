// Wissenschaftliche Grundlagen der App (nicht in der Tab-Leiste, erreichbar über Profil)
import { h, card } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { REFS } from '../science/references.js';

const METHODS = [
  ['Progression im Krafttraining', 'Doppelte Progression mit RIR-Steuerung: Erst Wiederholungen im Zielbereich steigern, dann Gewicht erhöhen. War eine Einheit deutlich zu leicht, rechnet die App das Gewicht über das geschätzte 1RM neu.', ['helms2016', 'robinson2024', 'epley1985']],
  ['Volumen pro Muskel', 'Harte Sätze pro Muskel und Woche, fraktional gezählt: direkte Sätze 1, indirekte 0,5. Zielbereich je nach Ziel, mit abnehmendem Zusatznutzen bei sehr hohem Volumen.', ['pelland2024', 'schoenfeld2017vol', 'remmert2025']],
  ['Nähe zum Muskelversagen', 'Für Hypertrophie RIR 0–3, für Kraft eher 1–3. Kraftzuwachs hängt kaum von der Nähe zum Versagen ab, Hypertrophie stärker.', ['robinson2024', 'refalo2023']],
  ['Belastung aller Einheiten', 'Session-RPE × Dauer macht Kraft, Ausdauer und Kampfsport vergleichbar. Daraus: Wochenlast, Monotonie, Strain und das Verhältnis akut : chronisch (nur als Orientierung).', ['foster2001', 'foster1998', 'williams2017', 'impellizzeri2020']],
  ['Ausdauerzonen', 'Puls-Zonen über Laktatschwelle (falls bekannt), sonst über HF-Reserve oder % HFmax. Rad-Zonen über FTP.', ['karvonen1957', 'tanaka2001', 'coggan2010', 'edwards1993']],
  ['Intensitätsverteilung', 'Drei-Zonen-Modell: locker (Z1–2), mittel (Z3), hart (Z4–5). Zielwert ca. 80 % locker.', ['seiler2010', 'stoggl2014']],
  ['Tagesform', 'Die App vergleicht HRV und Ruhepuls der letzten Nacht mit deinem eigenen Normalbereich der letzten 28 Tage und prüft Schlafdauer und Garmins Training Readiness. Jede Auffälligkeit gibt Punkte: 0 = grün, 1–2 = gelb, ab 3 = rot. Bei Gelb hält die App das Gewicht, plant einen Satz weniger und 1 RIR mehr Reserve, bei Rot empfiehlt sie Erholung. Die Schwellen sind praxisübliche Regeln, keine Studienwerte. Für Krafttraining ist die Datenlage dünn, die Anpassung ist eine vorsichtige Übertragung aus der Ausdauerforschung. Dein eigenes Gefühl kannst du jederzeit darüber stellen.', ['manresa2021', 'dueking2021', 'saw2016']],
  ['Kraft + Ausdauer', 'Paralleles Training ist für Muskelaufbau und Maximalkraft gut vereinbar; Krafttraining unterstützt die Ausdauerleistung.', ['schumann2022', 'ronnestad2014']],
];

export default {
  id: 'wissen', title: 'Wissenschaft', icon: ICONS.wissen, order: 9, nav: false,
  render(root, ctx) {
    root.append(h('button', { class: 'btn ghost small', onclick: () => ctx.go('profil') }, '‹ Zurück zum Profil'));
    METHODS.forEach(([t, text, refs]) => root.append(card(t, h('p', {}, text),
      h('ul', { class: 'refs' }, refs.map((r) => h('li', {}, h('span', { class: 'small' }, REFS[r].cite),
        h('span', { class: 'small muted block' }, REFS[r].use)))))));
    root.append(h('p', { class: 'muted small' }, 'Die App ersetzt keine sportmedizinische Untersuchung. Vorschläge sind Orientierungswerte und sollten an Tagesform und Erfahrung angepasst werden.'));
  },
};
