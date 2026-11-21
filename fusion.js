// Fusion à trois : base (avant), mien, leur. Sert au travail à plusieurs et à l'annulation.
// Règle : ce que j'ai changé depuis la base gagne ; le reste vient de « leur ».

// Texte stable d'un objet (clés triées, sans la vue) : pour comparer deux feuilles.
export function canon(o) {
  if (o === undefined) return 'undefined';
  if (o === null || typeof o !== 'object') return JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
  return '{' + Object.keys(o).filter((k) => k !== 'vue' && o[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
}

export const copie = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const sansVue = (f) => { const c = copie(f); delete c.vue; return c; };

const LISTES = new Set(['noeuds', 'barres', 'cotes', 'textes', 'traits']);

function fusionListe(b = [], m = [], t = []) {
  const B = new Map(b.map((o) => [o.id, o]));
  const M = new Map(m.map((o) => [o.id, o]));
  const out = [];
  const vus = new Set();
  for (const o of t) {
    vus.add(o.id);
    if (B.has(o.id) && !M.has(o.id)) continue; // je l'ai supprimé
    const mien = M.get(o.id);
    out.push(mien && canon(mien) !== canon(B.get(o.id)) ? mien : o);
  }
  for (const o of m) if (!vus.has(o.id) && !B.has(o.id)) out.push(o); // mes nouveaux éléments
  return out;
}

// Fusion de deux feuilles. Renvoie une nouvelle feuille (la vue de « mien » est gardée).
export function fusion(b, m, t) {
  if (!b) return copie(m || t);
  if (!t) return copie(m);
  if (!m) return copie(t);
  const r = copie(t);
  const cles = new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)]);
  for (const k of cles) {
    if (k === 'id' || k === 'vue') continue;
    if (LISTES.has(k)) { r[k] = copie(fusionListe(b[k], m[k], t[k])); continue; }
    if (canon(m[k]) !== canon(b[k])) {
      if (m[k] === undefined) delete r[k];
      else r[k] = copie(m[k]);
    }
  }
  if (m.vue) r.vue = m.vue;
  return r;
}

// Ordre des feuilles : par « ordre », puis par version.
export function trier(feuilles) {
  return feuilles.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.groupe).localeCompare(String(b.groupe)) || (a.v || 1) - (b.v || 1));
}
