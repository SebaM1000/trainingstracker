// Einstiegspunkt: lädt Daten, registriert Module, steuert Navigation.
import * as store from './core/store.js';
import * as registry from './core/registry.js';
import { h } from './core/ui.js';

import heute from './modules/heute.js';
import kraft from './modules/kraft.js';
import ausdauer from './modules/ausdauer.js';
import fortschritt from './modules/fortschritt.js';
import profil from './modules/profil.js';
import wissen from './modules/wissen.js';
import garmin from './modules/garmin.js';
import abend from './modules/abend.js';

[heute, kraft, ausdauer, fortschritt, profil, wissen, garmin, abend].forEach(registry.register);

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const header = document.getElementById('header-title');
const profileBtn = document.getElementById('profile-chip');

function currentRoute() {
  const id = location.hash.replace('#', '');
  return registry.get(id) ? id : 'heute';
}

export function go(id) {
  if (location.hash !== `#${id}`) location.hash = id;
  else render();
}

function renderNav(active) {
  const p = store.profile();
  nav.replaceChildren(...registry.enabled(p).filter((m) => m.nav).map((m) =>
    h('a', { href: `#${m.id}`, class: `tab ${m.id === active ? 'active' : ''}`, 'aria-current': m.id === active ? 'page' : null },
      h('span', { class: 'tab-icon', html: m.icon, 'aria-hidden': 'true' }),
      h('span', { class: 'tab-label' }, m.title))));
}

export function render() {
  const p = store.profile();
  let id = currentRoute();
  if (!p) id = 'profil';
  const mod = registry.get(id);
  if (p && mod.optional && p.settings.modules[id] === false) return go('heute');
  header.textContent = mod.title;
  profileBtn.textContent = p ? p.name.slice(0, 1).toUpperCase() : '?';
  profileBtn.setAttribute('aria-label', p ? `Profil: ${p.name}` : 'Profil');
  renderNav(id);
  const root = h('div', { class: `view view-${id}` });
  main.replaceChildren(root);
  mod.render(root, { store, go, rerender: render, profile: p });
  main.scrollTop = 0;
}

profileBtn.addEventListener('click', () => go('profil'));
window.addEventListener('hashchange', render);

store.load();
if (store.isMemoryOnly()) {
  document.getElementById('storage-warning').hidden = false;
}
render();

// Service Worker für Offline-Betrieb (nur bei echter Installation, z. B. GitHub Pages)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
