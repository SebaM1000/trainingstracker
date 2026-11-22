// Schlanke SVG-Diagramme mit Tooltip (Hover und Tippen).
import { h, s, fmt } from './ui.js';

function withTooltip(svg, wrap) {
  const tip = h('div', { class: 'chart-tip', role: 'tooltip' });
  wrap.append(tip);
  const show = (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.classList.remove('show'); return; }
    tip.textContent = t.getAttribute('data-tip');
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX ?? 0) - r.left, y = (e.clientY ?? 0) - r.top;
    tip.style.left = `${Math.min(Math.max(x, 60), r.width - 60)}px`;
    tip.style.top = `${Math.max(y - 44, 0)}px`;
    tip.classList.add('show');
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => tip.classList.remove('show'));
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

// Säulendiagramm (eine Reihe), optional Zielwert als Linie
export function barChart(data, { height = 160, unit = '', target = null, title = '' } = {}) {
  const W = 340, H = height, padL = 34, padB = 22, padT = 10;
  const raw = Math.max(1, ...data.map((d) => d.value), target || 0);
  const step = niceStep(raw / 3);
  const max = Math.ceil((raw * 1.05) / step) * step;
  const bw = (W - padL) / data.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title });
  for (let v = 0; v <= max + 1e-9; v += step) {
    svg.append(s('line', { x1: padL, x2: W, y1: y(v), y2: y(v), class: 'grid' }),
      s('text', { x: padL - 4, y: y(v) + 3, class: 'axis', 'text-anchor': 'end' }, fmt(v)));
  }
  data.forEach((d, i) => {
    const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
    const top = y(d.value), hgt = Math.max(0, H - padB - top);
    // Balken mit abgerundetem oberen Ende (Pfad), Basis gerade
    const r = Math.min(4, w / 2, hgt);
    const path = hgt > 0
      ? `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${H - padB} Z`
      : '';
    svg.append(s('rect', { x: padL + i * bw, y: padT, width: bw, height: H - padT - padB, fill: 'transparent', 'data-tip': d.tip || `${d.label}: ${fmt(d.value)} ${unit}` }));
    if (path) svg.append(s('path', { d: path, class: d.current ? 'bar bar-current' : 'bar', 'pointer-events': 'none' }));
    svg.append(s('text', { x: padL + i * bw + bw / 2, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, d.label));
  });
  if (target) {
    svg.append(s('line', { x1: padL, x2: W, y1: y(target), y2: y(target), class: 'target' }),
      s('text', { x: W - 2, y: y(target) - 4, class: 'axis', 'text-anchor': 'end' }, `Ziel ${fmt(target)}`));
  }
  const wrap = h('div', { class: 'chart-wrap' }, svg);
  withTooltip(svg, wrap);
  return wrap;
}

// Liniendiagramm (eine Reihe)
export function lineChart(points, { height = 170, unit = '', title = '' } = {}) {
  const W = 340, H = height, padL = 38, padB = 22, padT = 12, padR = 10;
  if (points.length < 2) return h('p', { class: 'muted small' }, 'Ab zwei Einheiten erscheint hier der Verlauf.');
  const vals = points.map((p) => p.y);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const x = (i) => padL + (W - padL - padR) * (i / (points.length - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title });
  [lo, (lo + hi) / 2, hi].forEach((v) => svg.append(
    s('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid' }),
    s('text', { x: padL - 4, y: y(v) + 3, class: 'axis', 'text-anchor': 'end' }, fmt(v))));
  svg.append(s('path', { d: points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' '), class: 'line' }));
  const step = Math.ceil(points.length / 5);
  points.forEach((p, i) => {
    svg.append(s('circle', { cx: x(i), cy: y(p.y), r: 4, class: 'dot', 'pointer-events': 'none' }));
    svg.append(s('rect', { x: x(i) - 12, y: padT, width: 24, height: H - padT - padB, fill: 'transparent', 'data-tip': p.tip || `${p.label}: ${fmt(p.y, 1)} ${unit}` }));
    const isLast = i === points.length - 1;
    if ((i % step === 0 && (isLast || points.length - 1 - i >= step * 0.6)) || isLast)
      svg.append(s('text', { x: x(i), y: H - 6, class: 'axis', 'text-anchor': 'middle' }, p.label));
  });
  const wrap = h('div', { class: 'chart-wrap' }, svg);
  withTooltip(svg, wrap);
  return wrap;
}

// Horizontale Balken je Muskel mit Zielbereich (setsMin–setsMax)
export function rangeBars(rows, min, max) {
  const scaleMax = Math.max(max * 1.25, ...rows.map((r) => r.value), 1);
  const pct = (v) => `${(v / scaleMax) * 100}%`;
  return h('div', { class: 'range-bars', role: 'table', 'aria-label': 'Sätze pro Muskel und Woche' },
    rows.map((r) => {
      const status = r.value < min ? 'low' : r.value > max ? 'high' : 'ok';
      const icon = { low: '↓', high: '↑', ok: '✓' }[status];
      return h('div', { class: 'rb-row', role: 'row' },
        h('span', { class: 'rb-label', role: 'cell' }, r.label),
        h('div', { class: 'rb-track', role: 'cell' },
          h('div', { class: 'rb-band', style: { left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` } }),
          h('div', { class: `rb-fill ${status}`, style: { width: pct(r.value) } })),
        h('span', { class: `rb-val ${status}`, role: 'cell' }, `${fmt(r.value, r.value % 1 ? 1 : 0)} ${icon}`));
    }));
}

// Gestapelter Balken der Intensitätsverteilung (locker / mittel / hart)
export function distBar(dist, targetLow) {
  const total = dist.low + dist.mid + dist.high;
  if (!total) return h('p', { class: 'muted small' }, 'Noch keine Ausdauerminuten in dieser Woche.');
  const parts = [
    ['low', 'Locker (Z1–2)', dist.low], ['mid', 'Mittel (Z3)', dist.mid], ['high', 'Hart (Z4–5)', dist.high],
  ];
  return h('div', {},
    h('div', { class: 'dist-bar', role: 'img', 'aria-label': 'Intensitätsverteilung' },
      parts.filter((p) => p[2] > 0).map(([k, l, v]) =>
        h('div', { class: `dist-seg ${k}`, style: { flexGrow: v }, title: `${l}: ${Math.round(v)} min` }))),
    h('div', { class: 'legend' }, parts.map(([k, l, v]) =>
      h('span', { class: 'legend-item' }, h('i', { class: `sw ${k}` }), `${l} ${Math.round((v / total) * 100)} %`))),
    h('p', { class: 'small muted' }, `Ziel: ca. ${Math.round(targetLow * 100)} % locker. Aktuell ${Math.round((dist.low / total) * 100)} %.`));
}
