// Accroche : où tombe le pointeur (nœud, point du treillis, milieu, barre, grille, angle).
import { etat, feuille } from './etat.js';
import { carteNoeuds, primitivesBarre, distSeg, dist, lerp } from './geometrie.js';

export const NOM_ACCROCHE = {
  noeud: 'Nœud', point: 'Point du treillis', milieu: 'Milieu', barre: 'Sur la barre',
  grille: 'Grille', angle: 'Angle', libre: 'Libre',
};

const K1 = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 } };
const arr = (v) => Math.round(v * 1e6) / 1e6;
const libre = (m) => ({ p: [arr(m[0]), arr(m[1])], type: 'libre' });
const grille = (m, pas) => ({ p: [arr(Math.round(m[0] / pas) * pas), arr(Math.round(m[1] / pas) * pas)], type: 'grille' });

// Angle par pas de 15°, longueur arrondie au pas de la grille.
export function accrocheAngle(m, depart, pas = etat.pas) {
  const dx = m[0] - depart[0];
  const dy = m[1] - depart[1];
  const cran = Math.PI / 12;
  const a = Math.round(Math.atan2(dy, dx) / cran) * cran;
  const l = Math.max(pas, Math.round(Math.hypot(dx, dy) / pas) * pas);
  return { p: [arr(depart[0] + l * Math.cos(a)), arr(depart[1] + l * Math.sin(a))], type: 'angle' };
}

// m : point souris (m). depart : début du trait en cours. exclure : ids de nœuds à ignorer (ceux qu'on déplace).
export function accrocher(m, { depart = null, exclure = [] } = {}) {
  const pas = etat.pas;
  if (etat.touches.alt) return libre(m);
  if (etat.touches.shift && depart) return accrocheAngle(m, depart, pas);
  if (!etat.aimant) return libre(m);
  const f = feuille();
  if (!f) return grille(m, pas);
  const tol = 10 / etat.vue.z;
  const ex = new Set(exclure);

  // 1. Nœuds
  let best = null;
  let bd = tol;
  for (const n of f.noeuds) {
    if (ex.has(n.id)) continue;
    const d = Math.hypot(n.x - m[0], n.y - m[1]);
    if (d <= bd) { bd = d; best = n; }
  }
  if (best) return { p: [best.x, best.y], type: 'noeud', id: best.id };

  const N = carteNoeuds(f);
  const barres = [];
  for (const b of f.barres) {
    if (ex.has(b.a) || ex.has(b.b)) continue;
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (A && B) barres.push({ b, A: [A.x, A.y], B: [B.x, B.y] });
  }

  // 2. Points du treillis (bouts des membrures et des diagonales)
  let cand = null;
  bd = tol;
  const segs = []; // segments où l'on peut se poser : axes + 2e membrure des treillis
  for (const { b, A, B } of barres) {
    if (b.type === 'toile') continue;
    segs.push({ b, a: A, c: B });
    if (b.type !== 'treillis') continue;
    const out = [];
    primitivesBarre(b, A, B, K1, out);
    let haut = null;
    for (const pr of out) {
      if (pr.st !== 'membrure' && pr.st !== 'diagonale') continue;
      if (pr.st === 'membrure') haut = pr.p; // la 2e membrure arrive en dernier
      for (const p of pr.p) {
        const d = dist(p, m);
        if (d <= bd) { bd = d; cand = { p: [arr(p[0]), arr(p[1])], type: 'point', id: b.id }; }
      }
    }
    if (haut) segs.push({ b, a: haut[0], c: haut[1] });
  }
  if (cand) return cand;

  // 3. Milieux
  bd = tol;
  for (const s of segs) {
    const p = lerp(s.a, s.c, 0.5);
    const d = dist(p, m);
    if (d <= bd) { bd = d; cand = { p: [arr(p[0]), arr(p[1])], type: 'milieu', id: s.b.id }; }
  }
  if (cand) return cand;

  // 4. Sur une barre : distance depuis le début arrondie au pas
  bd = tol * 0.8;
  for (const s of segs) {
    const r = distSeg(m, s.a, s.c);
    if (r.d > bd) continue;
    const L = dist(s.a, s.c);
    if (L < 1e-9) continue;
    const l = Math.min(L, Math.max(0, Math.round((r.t * L) / pas) * pas));
    const p = lerp(s.a, s.c, l / L);
    bd = r.d;
    cand = { p: [arr(p[0]), arr(p[1])], type: 'barre', id: s.b.id };
  }
  if (cand) return cand;

  // 5. Grille
  return grille(m, pas);
}
