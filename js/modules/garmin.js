// Modul Garmin-Import: data.json aus dem Garmin-Sync einlesen, Anstrengung (RPE) nachtragen.
import { h, card, toast, empty, fmt } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { fmtDate } from '../core/dates.js';
import { SPORTS } from '../science/endurance.js';
import { planImport, applyImport } from '../science/garmin.js';

let pending = null; // berechnete Vorschau bis zum Bestätigen

function rpeChips(value, onPick) {
  const wrap = h('div', { class: 'rpe' });
  for (let i = 1; i <= 10; i++) {
    wrap.append(h('button', { type: 'button', class: i === value ? 'active' : '', 'aria-pressed': String(i === value),
      onclick: () => { wrap.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('active', j + 1 === i); b.setAttribute('aria-pressed', String(j + 1 === i)); }); onPick(i); } }, String(i)));
  }
  return wrap;
}

function preview(ctx) {
  const p = pending;
  const skipped = Object.entries(p.uebersprungen);
  const all = [...p.neu, ...p.aktualisiert];
  const count = (pred) => all.filter(pred).length;
  return card('Vorschau',
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Neu'), h('div', { class: 'stat-value' }, String(p.neu.length))),
      h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Aktualisiert'), h('div', { class: 'stat-value' }, String(p.aktualisiert.length))),
      h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Mit App-Training verknüpft'), h('div', { class: 'stat-value' }, String(p.verknuepft.length)))),
    h('ul', { class: 'plain small' },
      h('li', {}, `Davon Krafttraining nur von der Uhr (ohne Sätze): ${count((s) => s.type === 'kraft')}`),
      h('li', {}, `Anstrengung von der Uhr: ${count((s) => s.srpeQuelle === 'uhr') + p.verknuepft.filter((v) => v.patch.garminRpe).length}`),
      h('li', {}, `Anstrengung aus dem Puls geschätzt: ${count((s) => String(s.srpeQuelle).startsWith('geschätzt'))}`),
      h('li', {}, `Ohne Anstrengung (bitte nachtragen): ${p.ohneRpe}`),
      p.doppelt.length ? h('li', {}, `Nicht übernommen, weil vermutlich schon von Hand eingetragen: ${p.doppelt.length}`) : null,
      skipped.map(([why, n]) => h('li', { class: 'muted' }, `Nicht übernommen: ${n} × ${why}`))),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost', onclick: () => { pending = null; ctx.rerender(); } }, 'Abbrechen'),
      h('button', { class: 'btn primary grow', disabled: !all.length && !p.verknuepft.length, onclick: () => {
        ctx.store.updateProfile((pr) => applyImport(pr, pending));
        toast(`${all.length + pending.verknuepft.length} Einheiten aus Garmin übernommen.`);
        pending = null;
        ctx.rerender();
      } }, 'Importieren')));
}

function needsRpe(ctx) {
  const p = ctx.store.profile();
  const list = p.sessions.filter((s) => !s.srpe || (s.source === 'garmin' && String(s.srpeQuelle).startsWith('geschätzt'))).slice(-12).reverse();
  if (!list.length) return null;
  return card('Anstrengung prüfen',
    h('p', { class: 'muted small' }, 'Für diese Einheiten fehlt die Anstrengung oder sie ist aus dem Puls geschätzt. Tippe die tatsächliche RPE (1–10) an, das macht die Belastung genauer.'),
    list.map((s) => h('div', { class: 'rpe-row' },
      h('div', { class: 'small' }, h('strong', {}, s.type === 'kraft' ? (s.name || 'Krafttraining') : (SPORTS[s.sport]?.label || s.sport)), ` ${fmtDate(s.date)}, ${s.durationMin} min`,
        h('span', { class: 'muted block' }, s.srpe ? `aktuell RPE ${s.srpe}, ${s.srpeQuelle}` : 'keine Angabe')),
      rpeChips(s.srpe, (v) => {
        ctx.store.updateProfile((pr) => { const x = pr.sessions.find((y) => y.id === s.id); if (x) { x.srpe = v; x.srpeQuelle = 'manuell'; } });
        toast('Gespeichert.');
      }))));
}

export default {
  id: 'garmin', title: 'Garmin-Import', icon: ICONS.ausdauer, order: 8, nav: false, optional: true,
  render(root, ctx) {
    const p = ctx.profile;
    root.append(h('button', { class: 'btn ghost small', onclick: () => ctx.go('profil') }, '‹ Zurück zum Profil'));
    root.append(card('Garmin-Daten übernehmen',
      h('p', { class: 'small' }, 'Wähle die Datei ', h('code', {}, 'data.json'), ' aus deinem OneDrive-Ordner ', h('code', {}, 'GARMIN/garmin'), '. Der Garmin-Sync aktualisiert sie jeden Morgen.'),
      h('p', { class: 'muted small' }, 'Übernommen werden alle Trainings außer Meditation. Bei Krafttraining gilt: Hast du am selben Tag ein Training in der App eingetragen, werden beide verknüpft. Die Sätze kommen dann aus der App, Dauer, Puls, Anstrengung und Gefühl von der Uhr. Sonst entsteht eine Einheit nur von der Uhr, ohne Sätze. Mehrfaches Importieren ist unbedenklich, deine nachgetragene RPE bleibt erhalten.'),
      h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'data.json auswählen', onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { pending = planImport(ctx.store.profile(), JSON.parse(await f.text())); ctx.rerender(); }
        catch (err) { toast(`Datei nicht lesbar: ${err.message}`); }
      } }),
      p.garminImport ? h('p', { class: 'muted small' }, `Letzter Import: ${fmtDate(p.garminImport.zuletzt.slice(0, 10))}, ${p.garminImport.anzahl} Einheiten.`) : null));
    if (pending) root.append(preview(ctx));
    const rp = needsRpe(ctx);
    if (rp) root.append(rp);
    const n = p.sessions.filter((s) => s.source === 'garmin').length;
    if (!pending && !n) root.append(empty('Noch keine Garmin-Einheiten übernommen.'));
    root.append(card('So wird gerechnet',
      h('p', { class: 'small' }, 'Die Belastung jeder Einheit ist Anstrengung (RPE) × Minuten. Nach jedem Training fragt die Uhr zwei Dinge ab: „Wie hast du dich gefühlt?“ und „Wahrgenommene Anstrengung“ (1–10). Die Anstrengung geht in die Belastung ein, das Gefühl wird mitgespeichert. Fehlt die Anstrengung bei einer Ausdauereinheit, schätzt die App sie aus den Pulszonen (Zone 1 = RPE 2 bis Zone 5 = 9). Bei Krafttraining wird nicht geschätzt, weil der Puls dort wenig über die Anstrengung sagt.'),
      h('p', { class: 'muted small' }, `E-Bike-Fahrten zählen zur Wochenlast, aber nicht zu deinen Ausdauerminuten, weil die Intensität sehr niedrig ist. Insgesamt sind ${fmt(n)} Garmin-Einheiten in der App.`)));
  },
};
