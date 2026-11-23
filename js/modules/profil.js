// Profil: Personen, Körper- und Leistungsdaten, Ziele, Parameter, Module, Backup.
import { h, card, field, numInput, select, sheet, confirmSheet, toast } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { GOALS, PARAM_META, defaultParamsFor } from '../science/goals.js';
import { hrMax } from '../science/endurance.js';
import { ymd } from '../core/dates.js';

function onboarding(root, ctx) {
  const d = { name: '', goal: 'hypertrophie' };
  root.append(h('div', { class: 'hello' }, h('h1', {}, 'Willkommen'),
    h('p', { class: 'muted' }, 'Lege dein Profil an. Jede Person hat eigene Daten und eigene Ziele. Alles bleibt lokal auf diesem Gerät.')),
  card('Neues Profil', h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', placeholder: 'z. B. Sebastian', oninput: (e) => { d.name = e.target.value; } })),
    h('p', { class: 'field-label' }, 'Hauptziel'),
    goalPicker(d.goal, (g) => { d.goal = g; }),
    h('button', { class: 'btn primary full', onclick: () => {
      if (!d.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
      ctx.store.addProfile(d.name.trim(), d.goal);
      toast('Profil angelegt. Ergänze deine Daten für Zonen und Vorschläge.');
      ctx.go('profil');
    } }, 'Profil anlegen'))),
  card('Daten übernehmen', h('p', { class: 'muted small' }, 'Du hast schon ein Backup? Dann hier importieren.'), importBox(ctx)));
}

function goalPicker(value, onChange) {
  const wrap = h('div', { class: 'goal-grid', role: 'radiogroup', 'aria-label': 'Ziel' });
  const draw = (v) => wrap.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.g === v; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
  Object.entries(GOALS).forEach(([k, g]) => wrap.append(h('button', { type: 'button', role: 'radio', 'data-g': k, class: 'goal-opt',
    onclick: () => { onChange(k); draw(k); } }, h('strong', {}, g.label), h('span', { class: 'small muted' }, g.text))));
  draw(value);
  return wrap;
}

function importBox(ctx) {
  let text = '';
  const doImport = (mode) => {
    try { ctx.store.importJSON(text, mode); toast('Import erfolgreich.'); ctx.rerender(); }
    catch (e) { toast(`Import fehlgeschlagen: ${e.message}`); }
  };
  const ta = h('textarea', { rows: 3, placeholder: '… oder Backup-Text hier einfügen', 'aria-label': 'Backup-Text', oninput: (e) => { text = e.target.value; } });
  return h('div', { class: 'form' },
    h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Backup-Datei wählen', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return; text = await f.text(); ta.value = `Datei „${f.name}“ geladen (${Math.round(text.length / 1024)} KB).`; } }),
    ta,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost grow', onclick: () => doImport('merge') }, 'Zusammenführen'),
      h('button', { class: 'btn danger-ghost', onclick: () => confirmSheet('Alles ersetzen?', 'Alle Profile auf diesem Gerät werden durch das Backup ersetzt.', 'Ersetzen', () => doImport('replace')) }, 'Ersetzen')));
}

function exportBox(ctx) {
  const run = (onlyActive) => {
    const json = ctx.store.exportJSON(onlyActive);
    const name = `trainingstracker-${onlyActive ? ctx.store.profile().name.toLowerCase() : 'alle'}-${ymd()}.json`;
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {}
    sheet('Backup', h('div', { class: 'form' },
      h('p', { class: 'muted small' }, `Falls kein Download startet: Text kopieren und z. B. in einer Notiz oder Datei „${name}“ sichern.`),
      h('textarea', { rows: 8, readonly: true, class: 'mono small' }, json)), [
      { label: 'Kopieren', kind: 'primary', onClick: () => { navigator.clipboard?.writeText(json).then(() => toast('Kopiert.'), () => toast('Kopieren nicht möglich, bitte manuell markieren.')); return false; } },
    ]);
  };
  return h('div', { class: 'row gap wrap' },
    h('button', { class: 'btn ghost grow', onclick: () => run(true) }, 'Dieses Profil sichern'),
    h('button', { class: 'btn ghost grow', onclick: () => run(false) }, 'Alle Profile sichern'));
}

function render(root, ctx) {
  const st = ctx.store.getState();
  const p = ctx.store.profile();
  if (!p) return onboarding(root, ctx);
  const set = (fn) => ctx.store.updateProfile(fn);

  // Profilwechsel
  root.append(card('Profile', h('div', { class: 'chips wrap' },
    Object.values(st.profiles).map((x) => h('button', { class: `chip ${x.id === p.id ? 'active' : ''}`, 'aria-pressed': String(x.id === p.id),
      onclick: () => { ctx.store.switchProfile(x.id); ctx.rerender(); } }, x.name)),
    h('button', { class: 'chip add', onclick: () => {
      let name = '', goal = 'hypertrophie';
      sheet('Weiteres Profil', h('div', { class: 'form' },
        field('Name', h('input', { type: 'text', oninput: (e) => { name = e.target.value; } })),
        goalPicker(goal, (g) => { goal = g; })), [
        { label: 'Abbrechen' },
        { label: 'Anlegen', kind: 'primary', onClick: () => { if (!name.trim()) { toast('Bitte Namen eingeben.'); return false; } ctx.store.addProfile(name.trim(), goal); ctx.rerender(); } },
      ]);
    } }, '+ Profil')),
    h('p', { class: 'muted small' }, 'Tipp: Für zwei Personen am besten jeweils auf dem eigenen Handy ein Profil. Auf einem gemeinsamen Gerät kann man hier wechseln.')));

  // Persönliche Daten
  const hm = hrMax(p);
  root.append(card('Persönliche Daten', h('div', { class: 'form' },
    field('Name', h('input', { type: 'text', value: p.name, oninput: (e) => set((x) => { x.name = e.target.value; }) })),
    h('div', { class: 'grid2' },
      field('Geburtsjahr', numInput(p.body.birthYear, (v) => set((x) => { x.body.birthYear = v; }), { label: 'Geburtsjahr' })),
      field('Gewicht (kg)', numInput(p.body.weightKg, (v) => set((x) => { x.body.weightKg = v; }), { decimal: true, label: 'Gewicht', step: 0.1 }))),
    h('div', { class: 'grid2' },
      field('Ruhepuls', numInput(p.physio.hrRest, (v) => set((x) => { x.physio.hrRest = v; }), { label: 'Ruhepuls' }), 'morgens liegend'),
      field('HFmax', numInput(p.physio.hrMax, (v) => set((x) => { x.physio.hrMax = v; }), { label: 'Maximalpuls' }),
        hm && hm.source !== 'gemessen' ? `leer = Schätzung ${hm.value}` : 'gemessen, falls bekannt')),
    h('div', { class: 'grid2' },
      field('Schwellenpuls (LTHR)', numInput(p.physio.lthr, (v) => set((x) => { x.physio.lthr = v; }), { label: 'Laktatschwellenpuls' }), 'z. B. aus Garmin'),
      field('FTP (Watt)', numInput(p.physio.ftp, (v) => set((x) => { x.physio.ftp = v; }), { label: 'FTP' }), 'für Rad-Zonen')))));

  // Ziel
  root.append(card('Ziel', goalPicker(p.goal, (g) => {
    set((x) => { x.goal = g; });
    confirmSheet('Zielwerte übernehmen?', `Sollen die empfohlenen Parameter für „${GOALS[g].label}“ deine aktuellen Einstellungen ersetzen?`, 'Übernehmen', () => {
      set((x) => { x.params = defaultParamsFor(g); }); ctx.rerender(); }, false);
  })));

  // Parameter
  const params = h('div', { class: 'grid2' });
  Object.entries(PARAM_META).forEach(([k, m]) => params.append(field(m.label,
    numInput(p.params[k], (v) => set((x) => { x.params[k] = v === '' ? defaultParamsFor(x.goal)[k] : v; }), { label: m.label, step: m.step, min: m.min, max: m.max, decimal: m.step < 1 }))));
  root.append(card('Trainingsparameter',
    h('p', { class: 'muted small' }, 'Startwerte kommen aus deinem Ziel. Jeder Wert ist frei anpassbar.'),
    params,
    h('div', { class: 'grid2' },
      field('Steigerung Grundübung (kg)', numInput(p.settings.increments.compound, (v) => set((x) => { x.settings.increments.compound = v || 2.5; }), { decimal: true, step: 0.5, label: 'Steigerung Grundübung' })),
      field('Steigerung Isolation (kg)', numInput(p.settings.increments.isolation, (v) => set((x) => { x.settings.increments.isolation = v || 1; }), { decimal: true, step: 0.5, label: 'Steigerung Isolation' }))),
    h('button', { class: 'btn ghost small', onclick: () => { set((x) => { x.params = defaultParamsFor(x.goal); }); ctx.rerender(); toast('Auf Zielwerte zurückgesetzt.'); } }, 'Auf Zielwerte zurücksetzen')));

  // Module
  const mods = [['kraft', 'Krafttraining'], ['ausdauer', 'Ausdauer & weitere Sportarten'], ['fortschritt', 'Fortschritt & Auswertung'], ['ernaehrung', 'Ernährung (Kalorien und Makros)'], ['abend', 'Abend-Zettel für die Schlafauswertung'], ['garmin', 'Garmin-Import'], ['tagesform', 'Tagesform aus Garmin-Erholungswerten']];
  root.append(card('Module', h('div', { class: 'stack' }, mods.map(([k, l]) => h('label', { class: 'switch-row' },
    h('span', {}, l),
    h('input', { type: 'checkbox', role: 'switch', checked: p.settings.modules[k] !== false, onchange: (e) => { set((x) => { x.settings.modules[k] = e.target.checked; }); ctx.rerender(); } })))),
    h('p', { class: 'muted small' }, 'Ausgeschaltete Module verschwinden aus der App, deine Daten darin bleiben erhalten. Du kannst sie jederzeit wieder einschalten.')));

  if (p.settings.modules.garmin !== false) root.append(card('Garmin',
    h('p', { class: 'muted small' }, 'Ausdauereinheiten aus deiner Garmin-Uhr übernehmen und die Anstrengung nachtragen.'),
    h('button', { class: 'btn ghost full', onclick: () => ctx.go('garmin') }, 'Garmin-Import öffnen')));

  // Backup
  root.append(card('Datensicherung',
    h('p', { class: 'muted small' }, 'Die Daten liegen nur auf diesem Gerät. Sichere regelmäßig ein Backup, z. B. in iCloud Drive.'),
    exportBox(ctx), h('hr'), importBox(ctx)));

  root.append(card('Wissenschaftliche Grundlagen',
    h('p', { class: 'muted small' }, 'Welche Studien hinter Vorschlägen, Zonen und Hinweisen stehen.'),
    h('button', { class: 'btn ghost full', onclick: () => ctx.go('wissen') }, 'Quellen und Methoden ansehen')));

  root.append(h('button', { class: 'btn danger-ghost full', onclick: () => confirmSheet(`Profil „${p.name}“ löschen?`, 'Alle Einheiten dieses Profils werden auf diesem Gerät gelöscht.', 'Löschen', () => {
    ctx.store.deleteProfile(p.id); ctx.rerender(); }) }, 'Profil löschen'));
}

export default { id: 'profil', title: 'Profil', icon: ICONS.profil, order: 5, nav: true, render };
