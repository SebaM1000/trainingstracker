// Modul-Registry: Jedes Modul meldet sich hier an.
// Ein Modul ist ein Objekt:
// { id, title, icon, order, nav (in Tab-Leiste?), optional (abschaltbar?), render(root, ctx) }
// Neues Modul: Datei in js/modules/ anlegen, in js/app.js importieren, fertig.

const modules = new Map();

export function register(mod) {
  modules.set(mod.id, mod);
}

export function get(id) {
  return modules.get(id);
}

export function all() {
  return [...modules.values()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function enabled(profile) {
  return all().filter((m) => !m.optional || !profile || profile.settings.modules[m.id] !== false);
}
