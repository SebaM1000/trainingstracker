// Kleine UI-Bausteine ohne Framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export function toast(msg, action = null) {
  document.querySelectorAll('.toast').forEach((x) => x.remove()); // nie zwei Meldungen übereinander
  const t = h('div', { class: `toast${action ? ' has-action' : ''}`, role: 'status' }, h('span', {}, msg),
    action ? h('button', { type: 'button', class: 'toast-btn', onclick: () => { action.fn(); t.remove(); } }, action.label) : null);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, action ? 5000 : 2600);
}

// Bottom-Sheet als Dialog-Ersatz (alert/confirm sind in manchen Umgebungen blockiert)
export function sheet(title, body, actions = []) {
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 250); };
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Schließen', onclick: close }, '✕')),
      h('div', { class: 'sheet-body' }, typeof body === 'function' ? body(close) : body),
      actions.length ? h('div', { class: 'sheet-actions' },
        actions.map((a) => h('button', { class: `btn ${a.kind || ''}`, onclick: () => { const r = a.onClick?.(); if (r !== false) close(); } }, a.label))) : null));
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return close;
}

export function confirmSheet(title, text, okLabel, onOk, danger = true) {
  sheet(title, h('p', { class: 'muted' }, text), [
    { label: 'Abbrechen' },
    { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: onOk },
  ]);
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function numInput(value, onInput, opts = {}) {
  return h('input', {
    type: 'number', inputmode: opts.decimal ? 'decimal' : 'numeric', value: value ?? '',
    step: opts.step || 'any', min: opts.min, max: opts.max, placeholder: opts.placeholder || '',
    class: opts.class || '', 'aria-label': opts.label,
    oninput: (e) => onInput(e.target.value === '' ? '' : Number(e.target.value)),
  });
}

export function select(options, value, onChange, label) {
  return h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
    Object.entries(options).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card-title' }, title) : null, ...children);
}

export function stat(label, value, sub) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label),
    h('div', { class: 'stat-value' }, value), sub ? h('div', { class: 'stat-sub' }, sub) : null);
}

export function badge(level, text) {
  const icon = { good: '●', warning: '▲', serious: '◆', info: '○', neutral: '–' }[level] || '•';
  return h('span', { class: `badge ${level}` }, h('span', { 'aria-hidden': 'true' }, icon), ' ', text);
}

export const fmt = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });

export function empty(text, action) {
  return h('div', { class: 'empty' }, h('p', {}, text), action || null);
}
