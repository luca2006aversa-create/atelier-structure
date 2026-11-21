// Topologie : nœuds partagés, barres coupées aux nœuds, nettoyage, fusion après déplacement.
import { carteNoeuds, distSeg, dist, NON_COUPEES } from './geometrie.js';
import { uid } from './etat.js';

export const EPS = 1e-4; // même point
export const SUR = 1e-3; // point posé sur une barre

const arr = (v) => Math.round(v * 1e6) / 1e6;

export function noeudA(p, f) {
  let best = null;
  let bd = EPS;
  for (const n of f.noeuds) {
    const d = Math.hypot(n.x - p[0], n.y - p[1]);
    if (d <= bd) { bd = d; best = n; }
  }
  return best;
}

// Nœud existant à cet endroit, sinon nouveau nœud (qui coupe les barres sous lui).
export function obtenirNoeud(p, f, type = 'libre') {
  const q = [arr(p[0]), arr(p[1])];
  const ancien = noeudA(q, f);
  if (ancien) return ancien;
  const n = { id: uid('n'), x: q[0], y: q[1], type };
  f.noeuds.push(n);
  couperSurNoeud(n, f);
  return n;
}

// Coupe en deux les barres qui passent sous le nœud n (sauf treillis et toile).
export function couperSurNoeud(n, f) {
  const N = carteNoeuds(f);
  const p = [n.x, n.y];
  for (let i = 0; i < f.barres.length; i++) {
    const b = f.barres[i];
    if (NON_COUPEES.has(b.type) || b.a === n.id || b.b === n.id) continue;
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (!A || !B) continue;
    const a = [A.x, A.y];
    const c = [B.x, B.y];
    if (dist(p, a) < EPS || dist(p, c) < EPS) continue;
    if (distSeg(p, a, c).d >= SUR) continue;
    const b2 = structuredClone(b);
    b2.id = uid('b');
    b2.a = n.id;
    b.b = n.id;
    f.barres.splice(i + 1, 0, b2);
    i++;
  }
}

// Coupe la barre b (déjà dans f.barres) aux nœuds posés dessus. Renvoie les morceaux.
export function couperParNoeuds(b, f) {
  if (NON_COUPEES.has(b.type)) return [b];
  const N = carteNoeuds(f);
  const A = N.get(b.a);
  const B = N.get(b.b);
  if (!A || !B) return [b];
  const a = [A.x, A.y];
  const c = [B.x, B.y];
  const L = dist(a, c);
  if (L < EPS) return [b];
  const sur = [];
  for (const n of f.noeuds) {
    if (n.id === b.a || n.id === b.b) continue;
    const p = [n.x, n.y];
    if (dist(p, a) < EPS || dist(p, c) < EPS) continue;
    const r = distSeg(p, a, c);
    if (r.d < SUR) sur.push({ id: n.id, t: dist(p, a) / L });
  }
  if (!sur.length) return [b];
  sur.sort((u, v) => u.t - v.t);
  const ids = [b.a, ...sur.map((s) => s.id), b.b];
  const pos = f.barres.indexOf(b);
  const morceaux = [];
  for (let k = 0; k < ids.length - 1; k++) {
    const m = k === 0 ? b : structuredClone(b);
    if (k > 0) m.id = uid('b');
    m.a = ids[k];
    m.b = ids[k + 1];
    morceaux.push(m);
  }
  f.barres.splice(pos + 1, 0, ...morceaux.slice(1));
  return morceaux;
}

// Les bouts de cote accrochés à un nœud suivent ce nœud.
export function synchroCotes(f) {
  const N = carteNoeuds(f);
  for (const c of f.cotes) for (const k of ['a', 'b']) {
    const e = c[k];
    if (!e.n) continue;
    const n = N.get(e.n);
    if (n) { e.x = n.x; e.y = n.y; } else delete e.n;
  }
}

export function noeudsRelies(f) {
  const s = new Set();
  for (const b of f.barres) { s.add(b.a); s.add(b.b); }
  return s;
}

// Retire les barres cassées ou en double, puis les nœuds orphelins :
// les nœuds libres toujours, les autres seulement s'ils sont dans aRetirer.
export function nettoyerBarres(f, aRetirer = null) {
  synchroCotes(f);
  const N = carteNoeuds(f);
  const vues = new Set();
  f.barres = f.barres.filter((b) => {
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (!A || !B || b.a === b.b) return false;
    if (Math.hypot(A.x - B.x, A.y - B.y) < EPS) return false;
    const cle = (b.a < b.b ? b.a + '|' + b.b : b.b + '|' + b.a) + '|' + b.type;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
  const relies = noeudsRelies(f);
  f.noeuds = f.noeuds.filter((n) => relies.has(n.id) || (n.type !== 'libre' && !aRetirer?.has(n.id)));
  synchroCotes(f);
}

// Le nœud source disparaît dans la cible (qui prend son type si elle était libre).
export function fusionner(src, cib, f) {
  if (src === cib) return;
  for (const b of f.barres) {
    if (b.a === src.id) b.a = cib.id;
    if (b.b === src.id) b.b = cib.id;
  }
  for (const c of f.cotes) for (const k of ['a', 'b']) if (c[k].n === src.id) c[k].n = cib.id;
  if (cib.type === 'libre' && src.type !== 'libre') cib.type = src.type;
  f.noeuds = f.noeuds.filter((n) => n !== src);
}

// Après un déplacement : fusion avec les nœuds restés en place, coupes, nettoyage.
export function apresDeplacement(ids, f) {
  const bouges = new Set(ids);
  const fixes = f.noeuds.filter((n) => !bouges.has(n.id));
  const touches = new Set();
  for (const id of ids) {
    const n = f.noeuds.find((m) => m.id === id);
    if (!n) continue;
    n.x = arr(n.x);
    n.y = arr(n.y);
    const cible = fixes.find((m) => Math.hypot(m.x - n.x, m.y - n.y) < SUR);
    if (cible) { fusionner(n, cible, f); touches.add(cible.id); } else touches.add(n.id);
  }
  for (const id of touches) {
    const n = f.noeuds.find((m) => m.id === id);
    if (n) couperSurNoeud(n, f);
  }
  for (const b of [...f.barres]) if (touches.has(b.a) || touches.has(b.b)) couperParNoeuds(b, f);
  nettoyerBarres(f);
}
