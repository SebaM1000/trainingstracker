// Abend-Zettel: vier Angaben pro Abend für die Schlafauswertung
// (Ende der harten Einheit, letzter Kaffee, Alkohol, Bettzeit).
// Eine Nacht gehört zu dem Abend, an dem man ins Bett geht; vor 12 Uhr gilt der Vorabend.
import { h, card, toast } from '../core/ui.js';
import { ymd, addDays, fmtDate, pad } from '../core/dates.js';

const ZIEL_ABENDE = 14;

export function defaultEvening(now = new Date()) {
  return ymd(now.getHours() < 12 ? addDays(now, -1) : now);
}

// Uhrzeit aus Tipp-Eingabe lesen: "1930", "19:30", "19.30", "930", "7" -> "HH:MM", sonst null
export function parseTime(raw) {
  const t = String(raw || '').trim();
  let hh; let mm;
  const sep = t.match(/^(\d{1,2})\s*[:.,h ]\s*(\d{1,2})$/);
  if (sep) { hh = +sep[1]; mm = +sep[2]; }
  else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) { hh = +t; mm = 0; }
    else { hh = +t.slice(0, t.length - 2); mm = +t.slice(-2); }
  } else return null;
  if (hh === 24 && mm === 0) hh = 0;
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const blank = () => ({ hardEnd: '', noHard: false, coffee: '', noCoffee: false, alcohol: null, bed: '' });

function fromEntry(e) {
  if (!e) return blank();
  return {
    hardEnd: e.hardEnd || '', noHard: e.hardEnd === null,
    coffee: e.coffee || '', noCoffee: e.coffee === null,
    alcohol: e.alcohol ?? null, bed: e.bed || '',
  };
}

function lineFor(date, e) {
  const hard = e.hardEnd === null ? 'keine' : e.hardEnd || '?';
  const coffee = e.coffee === null ? 'keiner' : e.coffee || '?';
  const alc = e.alcohol === true ? 'ja' : e.alcohol === false ? 'nein' : '?';
  return `Abend ${fmtDate(date)}: harte Einheit Ende ${hard} | letzter Kaffee ${coffee} | Alkohol ${alc} | Bett ${e.bed || '?'}`;
}

export function exportText(p) {
  const log = p.sleepLog || {};
  const days = Object.keys(log).sort();
  if (!days.length) return '';
  return ['ABEND-ZETTEL', ...days.map((d) => lineFor(d, log[d]))].join('\n');
}

// Formular, das auf „Heute“ und in der eigenen Ansicht verwendet wird
function form(ctx, date, onSaved) {
  const p = ctx.profile;
  const st = fromEntry((p.sleepLog || {})[date]);
  const wrap = h('div', { class: 'form' });

  const timeRow = (label, key, noKey, noLabel, chips = []) => {
    const chipEls = [];
    const refresh = () => {
      chipEls.forEach((el) => el.classList.toggle('active',
        el.dataset.no ? !!st[noKey] : !st[noKey] && st[key] === el.dataset.value));
      input.classList.toggle('invalid', input.value !== '' && !parseTime(input.value));
    };
    // Eintippen statt Drehrad: 1930, 19:30, 19.30 oder 7 werden zu 19:30 bzw. 07:00
    const input = h('input', { type: 'text', inputmode: 'numeric', value: st[key], placeholder: 'z. B. 1930',
      autocomplete: 'off', 'aria-label': label,
      oninput: (e) => { st[key] = e.target.value; if (noKey && e.target.value) st[noKey] = false; refresh(); },
      onchange: (e) => { const t = parseTime(e.target.value); if (t) { st[key] = t; e.target.value = t; } refresh(); } });
    for (const c of chips) {
      const el = h('button', { type: 'button', class: 'chip',
        onclick: () => { const v = c.value === 'jetzt' ? nowHM() : c.value; st[key] = v; input.value = v; if (noKey) st[noKey] = false; refresh(); } }, c.label);
      el.dataset.value = c.value;
      chipEls.push(el);
    }
    if (noKey) {
      const el = h('button', { type: 'button', class: 'chip',
        onclick: () => { st[noKey] = !st[noKey]; if (st[noKey]) { st[key] = ''; input.value = ''; } refresh(); } }, noLabel);
      el.dataset.no = '1';
      chipEls.push(el);
    }
    refresh();
    return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label),
      h('div', { class: 'abend-row' }, input, h('div', { class: 'chips wrap' }, chipEls)));
  };

  const save = () => {
    for (const k of ['hardEnd', 'coffee', 'bed']) if (st[k]) {
      const t = parseTime(st[k]);
      if (!t) { toast(`Uhrzeit „${st[k]}“ verstehe ich nicht, bitte z. B. 1930 eingeben.`); return; }
      st[k] = t;
    }
    const entry = {
      hardEnd: st.noHard ? null : st.hardEnd,
      coffee: st.noCoffee ? null : st.coffee,
      alcohol: st.alcohol,
      bed: st.bed,
      savedAt: new Date().toISOString(),
    };
    const missing = [];
    if (!st.noHard && !st.hardEnd) missing.push('harte Einheit');
    if (!st.noCoffee && !st.coffee) missing.push('Kaffee');
    if (st.alcohol === null) missing.push('Alkohol');
    if (!st.bed) missing.push('Bettzeit');
    ctx.store.updateProfile((x) => { x.sleepLog = x.sleepLog || {}; x.sleepLog[date] = entry; });
    toast(missing.length ? `Gespeichert, offen: ${missing.join(', ')}` : 'Gespeichert. Gute Nacht!');
    onSaved?.();
  };

  function draw() {
    wrap.replaceChildren(
      timeRow('Harte Einheit endete um', 'hardEnd', 'noHard', 'Keine harte Einheit', [{ label: 'Jetzt', value: 'jetzt' }]),
      timeRow('Letzter Kaffee um', 'coffee', 'noCoffee', 'Kein Kaffee', [{ label: '14:30', value: '14:30' }, { label: '16:00', value: '16:00' }]),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Alkohol heute Abend'),
        h('div', { class: 'chips' },
          h('button', { type: 'button', class: `chip ${st.alcohol === false ? 'active' : ''}`, onclick: () => { st.alcohol = false; draw(); } }, 'Nein'),
          h('button', { type: 'button', class: `chip ${st.alcohol === true ? 'active' : ''}`, onclick: () => { st.alcohol = true; draw(); } }, 'Ja'))),
      timeRow('Ins Bett um', 'bed', null, '', [{ label: 'Jetzt', value: 'jetzt' }]),
      h('button', { type: 'button', class: 'btn primary full', onclick: save }, 'Speichern'));
  }
  draw();
  return wrap;
}

// Karte für die Startseite
export function abendCard(ctx) {
  const p = ctx.profile;
  const date = defaultEvening();
  const log = p.sleepLog || {};
  const done = !!log[date];
  const count = Object.keys(log).length;
  const sec = h('section', { class: 'card compact' });
  const head = (open) => h('div', { class: 'row-between' },
    h('div', {}, h('strong', {}, 'Abend-Zettel'),
      h('div', { class: 'muted small' }, done ? `${fmtDate(date, false)} eingetragen, ${count} von ${ZIEL_ABENDE} Abenden` : `${fmtDate(date, false)} noch offen, ${count} von ${ZIEL_ABENDE} Abenden`)),
    open ? null : h('button', { class: `btn ${done ? 'ghost' : 'primary'} small`, onclick: () => draw(true) }, done ? 'Ändern' : 'Ausfüllen'));
  const draw = (open) => sec.replaceChildren(head(open), ...(open ? [form(ctx, date, () => ctx.rerender()),
    h('a', { class: 'ref small', href: '#abend' }, 'Alle Abende ansehen und für die Auswertung kopieren')] : []));
  draw(false);
  return sec;
}

function render(root, ctx) {
  const p = ctx.profile;
  let date = defaultEvening();
  const formBox = h('div', {});
  const drawForm = () => formBox.replaceChildren(
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Abend'),
      h('input', { type: 'date', value: date, onchange: (e) => { if (e.target.value) { date = e.target.value; drawForm(); } } })),
    form(ctx, date, () => ctx.rerender()));
  drawForm();
  root.append(card('Eintrag', formBox));

  const log = p.sleepLog || {};
  const days = Object.keys(log).sort().reverse();
  const text = exportText(p);
  root.append(card(`Gesammelt: ${days.length} Abende`,
    days.length ? days.map((d) => h('button', { class: 'list-item', type: 'button', onclick: () => { date = d; drawForm(); window.scrollTo(0, 0); } },
      h('span', { class: 'small' }, lineFor(d, log[d]).replace(/^Abend /, '')))) : h('p', { class: 'muted small' }, 'Noch keine Einträge.'),
    days.length ? h('button', { class: 'btn primary full', onclick: () => navigator.clipboard?.writeText(text)
      .then(() => toast('Kopiert. Jetzt mit der Schlaf-Karte in den Chat einfügen.'), () => toast('Kopieren nicht möglich.')) }, 'Für die Auswertung kopieren') : null,
    h('p', { class: 'muted small' }, 'Eine Nacht zählt zum Abend, an dem du ins Bett gehst. Einträge vor 12 Uhr landen automatisch beim Vorabend.')));
}

export default { id: 'abend', title: 'Abend-Zettel', icon: '', order: 7, nav: false, optional: true, render };
