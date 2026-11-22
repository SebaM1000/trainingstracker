// Modul Ausdauer & weitere Einheiten (Laufen, Rad, Rudern, Kampfsport …)
import { h, sheet, confirmSheet, toast, field, numInput, card, empty, fmt, select } from '../core/ui.js';
import { ICONS } from '../core/icons.js';
import { uid } from '../core/store.js';
import { ymd, fmtDate } from '../core/dates.js';
import { SPORTS, hrZones, powerZones, distribution, trimpEdwards, paceStr } from '../science/endurance.js';
import { sessionLoad } from '../science/load.js';
import { rpePicker } from './kraft.js';

let editing = null; // Einheit, die gerade bearbeitet wird

function blank() {
  return { id: uid(), type: 'ausdauer', sport: 'laufen', date: ymd(), durationMin: '', distanceKm: '', avgHr: '', avgPower: '', srpe: null, zoneMin: ['', '', '', '', ''], notes: '' };
}

function form(ctx) {
  const s = editing || blank();
  const sp = () => SPORTS[s.sport] || SPORTS.sonstiges;
  const opt = h('div', { class: 'grid2' });
  const drawOpt = () => opt.replaceChildren(
    field('Dauer (min)', numInput(s.durationMin, (v) => { s.durationMin = v; }, { label: 'Dauer' })),
    sp().distance ? field('Distanz (km)', numInput(s.distanceKm, (v) => { s.distanceKm = v; }, { decimal: true, label: 'Distanz', step: 0.01 })) : '',
    field('Ø Puls (bpm)', numInput(s.avgHr, (v) => { s.avgHr = v; }, { label: 'Durchschnittspuls' })),
    sp().power ? field('Ø Leistung (W)', numInput(s.avgPower, (v) => { s.avgPower = v; }, { label: 'Durchschnittsleistung' })) : '');
  drawOpt();
  const zones = h('details', { class: 'details' },
    h('summary', {}, 'Zeit in Herzfrequenzzonen (optional, z. B. aus Garmin)'),
    h('div', { class: 'grid5' }, s.zoneMin.map((v, i) => field(`Z${i + 1}`, numInput(v, (x) => { s.zoneMin[i] = x; }, { label: `Minuten in Zone ${i + 1}` })))),
    h('p', { class: 'field-hint' }, 'Mit Zonenminuten wird die Intensitätsverteilung genau berechnet. Ohne sie nutzt die App den Ø-Puls oder die RPE.'));

  return card(editing ? 'Einheit bearbeiten' : 'Einheit eintragen',
    h('div', { class: 'form' },
      h('div', { class: 'grid2' },
        field('Sportart', select(Object.fromEntries(Object.entries(SPORTS).map(([k, v]) => [k, v.label])), s.sport, (v) => { s.sport = v; drawOpt(); }, 'Sportart')),
        field('Datum', h('input', { type: 'date', value: s.date, onchange: (e) => { s.date = e.target.value; } }))),
      opt,
      h('p', { class: 'field-label' }, 'Anstrengung der Einheit (Session-RPE, CR-10)'),
      rpePicker(s.srpe, (v) => { s.srpe = v; if (s.source === 'garmin') s.srpeQuelle = 'manuell'; }),
      zones,
      field('Notiz', h('textarea', { rows: 2, placeholder: 'z. B. 4 × 4 min VO2max, Sparring …', oninput: (e) => { s.notes = e.target.value; } }, s.notes)),
      h('div', { class: 'row gap' },
        editing ? h('button', { class: 'btn ghost', onclick: () => { editing = null; ctx.rerender(); } }, 'Abbrechen') : null,
        h('button', { class: 'btn primary grow', onclick: () => {
          if (!s.durationMin) { toast('Bitte die Dauer eintragen.'); return; }
          if (!s.srpe) { toast('Bitte die Anstrengung (RPE) wählen.'); return; }
          ctx.store.updateProfile((p) => {
            p.sessions = p.sessions.filter((x) => x.id !== s.id);
            p.sessions.push({ ...s });
            p.sessions.sort((a, b) => a.date.localeCompare(b.date));
          });
          toast(editing ? 'Änderung gespeichert.' : 'Einheit gespeichert.');
          editing = null;
          ctx.rerender();
        } }, 'Speichern'))));
}

function detail(ctx, s) {
  const p = ctx.store.profile();
  const d = distribution(p, s);
  const trimp = trimpEdwards(s);
  const pace = SPORTS[s.sport]?.pace ? paceStr(s.durationMin, s.distanceKm) : null;
  sheet(SPORTS[s.sport]?.label || 'Einheit', h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, fmtDate(s.date), s.source === 'garmin' ? ' – aus Garmin' : ''),
    s.source === 'garmin' && s.srpeQuelle && s.srpeQuelle !== 'manuell' ? h('p', { class: 'small muted' }, `RPE-Quelle: ${s.srpeQuelle === 'uhr' ? 'Eingabe auf der Uhr' : s.srpeQuelle}. Über „Bearbeiten“ korrigierbar.`) : null,
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Dauer'), h('div', { class: 'stat-value' }, `${s.durationMin} min`)),
      s.distanceKm ? h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Distanz'), h('div', { class: 'stat-value' }, `${fmt(s.distanceKm, 2)} km`), pace ? h('div', { class: 'stat-sub' }, pace) : null) : null,
      h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Last (sRPE)'), h('div', { class: 'stat-value' }, `${sessionLoad(s)} AU`), h('div', { class: 'stat-sub' }, `RPE ${s.srpe}`)),
      trimp ? h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'TRIMP (Edwards)'), h('div', { class: 'stat-value' }, fmt(trimp))) : null),
    SPORTS[s.sport]?.endurance && d.source !== 'keine'
      ? h('p', { class: 'small' }, `Verteilung: ${Math.round(d.low)} min locker, ${Math.round(d.mid)} min mittel, ${Math.round(d.high)} min hart (Quelle: ${{ zonen: 'Zonenminuten', puls: 'Ø-Puls', rpe: 'RPE' }[d.source]}).`) : null,
    s.avgHr ? h('p', { class: 'small' }, `Ø Puls ${s.avgHr} bpm`, s.avgPower ? `, Ø Leistung ${s.avgPower} W` : '') : null,
    s.notes ? h('p', { class: 'small' }, s.notes) : null), [
    { label: 'Löschen', kind: 'danger-ghost', onClick: () => confirmSheet('Einheit löschen?', 'Das lässt sich nicht rückgängig machen.', 'Löschen', () => {
      ctx.store.updateProfile((pp) => { pp.sessions = pp.sessions.filter((x) => x.id !== s.id); }); ctx.rerender(); }) },
    { label: 'Bearbeiten', kind: 'primary', onClick: () => { editing = JSON.parse(JSON.stringify(s)); editing.zoneMin ||= ['', '', '', '', '']; ctx.rerender(); } },
  ]);
}

function zonesCard(p, ctx) {
  const z = hrZones(p);
  const pw = powerZones(p);
  const c = card('Deine Zonen');
  if (!z && !pw) {
    c.append(h('p', { class: 'muted small' }, 'Trage im Profil Geburtsjahr, Ruhepuls, HFmax, Laktatschwellenpuls oder FTP ein, dann berechnet die App deine Zonen.'),
      h('button', { class: 'btn ghost small', onclick: () => ctx.go('profil') }, 'Zum Profil'));
    return c;
  }
  if (z) {
    const names = ['Z1 Regeneration', 'Z2 Grundlage', 'Z3 Tempo', 'Z4 Schwelle', 'Z5 VO2max'];
    c.append(h('p', { class: 'small muted' }, `Puls: ${z.method}`),
      h('table', { class: 'table' }, h('tbody', {}, names.map((n, i) => h('tr', {},
        h('td', {}, n), h('td', { class: 'num' }, `${z.bounds[i]}–${i < 4 ? z.bounds[i + 1] - 1 : z.top} bpm`))))));
  }
  if (pw) {
    c.append(h('p', { class: 'small muted' }, `Leistung: Coggan-Zonen, FTP ${p.physio.ftp} W`),
      h('table', { class: 'table' }, h('tbody', {}, pw.map((x) => h('tr', {},
        h('td', {}, x.name), h('td', { class: 'num' }, x.hi ? `${x.lo}–${x.hi} W` : `> ${x.lo} W`))))));
  }
  return c;
}

export default {
  id: 'ausdauer', title: 'Ausdauer', icon: ICONS.ausdauer, order: 3, nav: true, optional: true,
  render(root, ctx) {
    const p = ctx.store.profile();
    root.append(form(ctx));
    const hist = p.sessions.filter((s) => s.type === 'ausdauer').slice(-10).reverse();
    root.append(card('Verlauf', hist.length ? hist.map((s) => h('button', { class: 'list-item', onclick: () => detail(ctx, s) },
      h('span', {}, h('strong', {}, SPORTS[s.sport]?.label || s.sport), h('span', { class: 'muted small block' }, fmtDate(s.date))),
      h('span', { class: 'muted small' }, `${s.durationMin} min${s.distanceKm ? `, ${fmt(s.distanceKm, 1)} km` : ''}`))) : empty('Noch keine Einheiten gespeichert.')));
    root.append(zonesCard(p, ctx));
  },
};
