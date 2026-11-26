// Géométrie de l'atelier : types, calculs de vecteurs, et formes à dessiner (écran, papier, 3D).
// Unités : mètres, y vers le haut, sol à 0.
import { sectionDe } from './matieres.js';
import { chargesBarre, chargesNoeud, position, UNITES } from './charges.js';

export const TYPES_BARRE = [
  ['poteau', 'Poteau'], ['poutre', 'Poutre'], ['bequille', 'Béquille'], ['entretoise', 'Entretoise'],
  ['cable', 'Câble'], ['treillis', 'Treillis'], ['toit', 'Toit'], ['toile', 'Toile'], ['dalle', 'Dalle'],
  ['sol', 'Sol'], ['mur', 'Mur'],
  // Plan (vue de dessus)
  ['murp', 'Mur'], ['cloison', 'Cloison'], ['porte', 'Porte'], ['fenetre', 'Fenêtre'],
  ['escalier', 'Escalier'], ['trame', 'Trame'],
];
export const NOM_BARRE = Object.fromEntries(TYPES_BARRE);
export const BARRES_PLAN = new Set(['murp', 'cloison', 'porte', 'fenetre', 'escalier', 'trame']);
export const TYPES_NOEUD = [
  ['libre', 'Libre'], ['rotule', 'Rotule'], ['rigide', 'Rigide'],
  ['appui', 'Appui'], ['encastrement', 'Encastré'], ['glissant', 'Glissant'], ['poteau', 'Poteau'],
];
export const NOM_NOEUD = Object.fromEntries(TYPES_NOEUD);
export const FORMES_TOIT = [['2pentes', '2 pentes'], ['1pente', '1 pente'], ['plat', 'Plat'], ['courbe', 'Courbe']];
export const FORMES_TREILLIS = [['warren', 'Warren'], ['warren_m', 'Warren +'], ['pratt', 'Pratt'], ['howe', 'Howe']];
// Barres qu'on ne coupe pas quand un nœud tombe dessus (leur dessin dépend de leurs deux bouts).
export const NON_COUPEES = new Set(['treillis', 'toit', 'toile', 'porte', 'fenetre', 'escalier', 'trame']);

// Feuille en plan (vue de dessus). Sans type : une coupe.
export const estPlan = (f) => f?.type === 'plan';
// Barres à leur vraie épaisseur : oui, sauf si la feuille l'a éteint.
export const sectionsVisibles = (f) => f?.sections !== false;
export const MURS = new Set(['murp', 'cloison']);
export const OUVERTURES = new Set(['porte', 'fenetre']);
export const EP_MUR = { murp: 0.2, cloison: 0.1 };
export const epaisseur = (b) => { const e = +b[b.type]?.e; return e > 0 ? e : EP_MUR[b.type] || 0.2; };
// Hauteurs pour la 3D d'un plan (m) : haut des portes, allège et haut des fenêtres.
export const H_PORTE = 2.1;
export const H_ALLEGE = 1;
export const H_LINTEAU = 2.1;

// ---------- Vecteurs ----------
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const norme = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const unite = (a) => { const n = norme(a) || 1; return [a[0] / n, a[1] / n]; };
export const normale = (u) => [-u[1], u[0]];
export const borne = (v, a, b) => Math.min(b, Math.max(a, v));

// Distance d'un point à un segment : d, position t (0..1) et point le plus proche q.
export function distSeg(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 ? borne(dot(sub(p, a), ab) / l2, 0, 1) : 0;
  const q = lerp(a, b, t);
  return { d: dist(p, q), t, q };
}

export function dansPolygone(p, pts) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

// Simplification d'un trait à main levée (Ramer-Douglas-Peucker).
export function simplifier(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const garde = new Uint8Array(pts.length);
  garde[0] = 1;
  garde[pts.length - 1] = 1;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [i0, i1] = pile.pop();
    let dmax = 0;
    let imax = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distSeg(pts[i], pts[i0], pts[i1]).d;
      if (d > dmax) { dmax = d; imax = i; }
    }
    if (dmax > tol && imax > 0) { garde[imax] = 1; pile.push([i0, imax], [imax, i1]); }
  }
  return pts.filter((_, i) => garde[i]);
}

export const carteNoeuds = (f) => new Map(f.noeuds.map((n) => [n.id, n]));

// Bout de cote : accroché à un nœud (il le suit) ou point libre.
export function pointCote(p, N) {
  const nd = p.n && N.get(p.n);
  return nd ? [nd.x, nd.y] : [p.x, p.y];
}

export function boitePoints(pts) {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

// Boîte de tout ce qui est dessiné sur une feuille (sans le croquis de fond).
export function boite(f) {
  const N = carteNoeuds(f);
  const pts = f.noeuds.map((n) => [n.x, n.y]);
  for (const c of f.cotes || []) pts.push(pointCote(c.a, N), pointCote(c.b, N));
  for (const t of f.textes || []) pts.push([t.x, t.y]);
  for (const s of f.traits || []) pts.push(...s.pts);
  return boitePoints(pts);
}

export function boitePrims(prims) {
  const pts = [];
  for (const pr of prims) {
    if (pr.k === 'l' || pr.k === 'p') pts.push(...pr.p);
    else if (pr.k === 'c') pts.push([pr.c[0] - pr.r, pr.c[1] - pr.r], [pr.c[0] + pr.r, pr.c[1] + pr.r]);
    else if (pr.k === 't') {
      const w = largeurTexte(pr);
      pts.push([pr.c[0] - w, pr.c[1] - pr.h * 0.3], [pr.c[0] + w, pr.c[1] + pr.h]);
    }
  }
  return boitePoints(pts);
}

export const largeurTexte = (pr) => Math.max(1, String(pr.txt).length) * pr.h * 0.58;

// Nombre en français : virgule, 2 décimales au plus, jamais « -0 ».
export function fr(v, d = 2) {
  const k = 10 ** d;
  const s = String(Math.round(v * k) / k);
  return (s === '-0' ? '0' : s).replace('.', ',');
}

// Normale d'une barre qui pointe vers le bas (vers -x si la barre est verticale).
export function versLeBas(u) {
  let n = normale(u);
  if (Math.abs(n[1]) < 1e-9) { if (n[0] > 0) n = mul(n, -1); }
  else if (n[1] > 0) n = mul(n, -1);
  return n;
}

// Hachures à 45° le long de AB, du côté « cote » (vecteur unitaire).
export function hachures(A, B, cote, su, out, ref, pas = 0.5, longueur = 0.45) {
  const L = dist(A, B);
  if (L < 1e-9) return;
  const u = unite(sub(B, A));
  const dir = mul(unite(sub(cote, u)), longueur * su);
  const p = pas * su;
  const n = Math.min(1500, Math.floor(L / p));
  const debut = (L - n * p) / 2;
  for (let i = 0; i <= n; i++) {
    const a = add(A, mul(u, debut + i * p));
    out.push({ k: 'l', st: 'hachure', id: ref, p: [a, add(a, dir)] });
  }
}

// ---------- Plan : murs, ouvertures, jonctions ----------
// Un morceau de mur dont les deux bouts sont sur une porte ou une fenêtre est caché (l'ouverture le remplace).
export function analysePlan(f, N = carteNoeuds(f)) {
  const pt = (id) => { const n = N.get(id); return n ? [n.x, n.y] : null; };
  const ouv = [];
  for (const b of f.barres) {
    if (!OUVERTURES.has(b.type)) continue;
    const A = pt(b.a);
    const B = pt(b.b);
    if (A && B) ouv.push({ b, A, B });
  }
  const cache = new Map(); // id du mur → ouverture qui le cache
  const ep = new Map(); // id de l'ouverture → épaisseur du mur dessous
  const parNoeud = new Map(); // id du nœud → murs visibles qui y arrivent
  for (const b of f.barres) {
    if (!MURS.has(b.type)) continue;
    const A = pt(b.a);
    const B = pt(b.b);
    if (!A || !B) continue;
    const o = ouv.find((o) => distSeg(A, o.A, o.B).d < 1e-3 && distSeg(B, o.A, o.B).d < 1e-3);
    if (o) {
      cache.set(b.id, o.b);
      ep.set(o.b.id, Math.max(ep.get(o.b.id) || 0, epaisseur(b)));
      continue;
    }
    for (const id of [b.a, b.b]) {
      if (!parNoeud.has(id)) parNoeud.set(id, []);
      parNoeud.get(id).push(b);
    }
  }
  return { cache, ep, parNoeud };
}

// Coins d'un bout de mur : [gauche, droite] vus du bout P (nœud idP) vers l'autre bout Q.
// Seul → bout droit ; avec un autre mur → onglet ; à 3 murs ou plus → le mur entre dans le nœud.
function coinsBout(b, idP, P, Q, J, N) {
  const v = unite(sub(Q, P));
  const n = normale(v);
  const h = epaisseur(b) / 2;
  const droit = (recul = 0) => { const C = sub(P, mul(v, recul)); return [add(C, mul(n, h)), sub(C, mul(n, h))]; };
  const autres = (J.parNoeud.get(idP) || []).filter((m) => m !== b);
  if (!autres.length) return droit();
  if (autres.length > 1) return droit(Math.max(...autres.map(epaisseur)) / 2);
  const m = autres[0];
  const R = N.get(m.a === idP ? m.b : m.a);
  if (!R) return droit();
  const v2 = unite(sub([R.x, R.y], P));
  const n2 = normale(v2);
  const h2 = epaisseur(m) / 2;
  const cr = v[0] * v2[1] - v[1] * v2[0];
  if (Math.abs(cr) < 1e-3) return droit(); // dans le prolongement
  // Le bord gauche de ce mur rencontre le bord droit de l'autre, et inversement.
  const coin = (a, c) => { const d = sub(c, a); return add(add(P, a), mul(v, (d[0] * v2[1] - d[1] * v2[0]) / cr)); };
  const g = coin(mul(n, h), mul(n2, -h2));
  const dr = coin(mul(n, -h), mul(n2, h2));
  const limite = 6 * Math.max(h, h2); // angle trop fermé : pas d'onglet en pointe
  if (dist(g, P) > limite || dist(dr, P) > limite) return droit();
  return [g, dr];
}

// Contour d'un mur avec ses jonctions (J = analysePlan).
export function bandeMur(b, A, B, J, N) {
  const [ga, da] = coinsBout(b, b.a, A, B, J, N);
  const [gb, db] = coinsBout(b, b.b, B, A, J, N); // vu de B, la gauche est la droite de A
  return [ga, db, gb, da];
}

const bande = (A, B, u, e) => { const n = mul(normale(u), e / 2); return [add(A, n), add(B, n), sub(B, n), sub(A, n)]; };

// Barres linéaires qu'on peut dessiner à leur vraie largeur (mode « sections » de la feuille).
export const BARRES_LIN = new Set(['poteau', 'poutre', 'bequille', 'entretoise', 'cable', 'toit']);
// Hauteur de section vue dans le plan de la feuille (la flexion se fait dans ce plan).
export const hauteurVue = (b) => sectionDe(b).h;

// Un élément linéaire : simple trait, ou bande à sa vraie largeur si K.sections est actif.
function lin(out, st, id, A, B, K, e, sec = null) {
  if (K.sections && e > 0.004) {
    // ax et h servent aux jonctions (raccorderBandes) ; ax0 garde l'axe dessiné ; sec aux détails.
    out.push({ k: 'p', st: st + '-vol', id, p: bande(A, B, unite(sub(B, A)), e), ferme: true, ax: [A, B], ax0: [A, B], h: e / 2, sec });
    return;
  }
  out.push({ k: 'l', st, id, p: [A, B] });
}

// ---------- Jonctions des barres à leur vraie largeur ----------
// Qui passe devant qui quand deux barres se touchent : la plus forte reste entière,
// l'autre s'arrête contre sa face. Deux barres de même rang se coupent en onglet.
const RANG = { 'poteau-vol': 9, 'poutre-vol': 8, 'membrure-vol': 7, 'bequille-vol': 6, 'entretoise-vol': 5, 'diagonale-vol': 4, 'cable-vol': 3 };
// Choix de croisement d'un nœud (nd.jonction).
export const JONCTIONS = [
  ['auto', 'Automatique'], ['vertical', 'Poteau passant'], ['horizontal', 'Poutre passante'],
  ['onglet', 'Onglet'], ['coupe', 'Pièces séparées'],
];
const croix2 = (a, b) => a[0] * b[1] - a[1] * b[0];
// Paramètre t sur la droite P + t·v là où elle coupe la droite Q + s·w.
const inter = (P, v, Q, w) => { const c = croix2(v, w); return Math.abs(c) < 1e-9 ? null : croix2(sub(Q, P), w) / c; };
const clePt = (P) => P[0].toFixed(3) + ',' + P[1].toFixed(3);

// Mode de jonction de chaque nœud, rangé par sa position : Map('x,y' → mode).
export function modesJonction(f) {
  const J = new Map();
  for (const n of f.noeuds || []) if (n.jonction && n.jonction !== 'auto') J.set(clePt([n.x, n.y]), n.jonction);
  return J;
}

// Une pièce devient un tronçon : invisible, elle garde sa forme pour qu'on puisse la cliquer.
function enTroncon(b) {
  b.ex = b.st; b.h0 = b.h; // ce qu'elle était (les pannes en ont besoin)
  b.st = 'troncon';
  delete b.ax; delete b.h; delete b.sec;
}

// Calcule les nouveaux bouts de chaque bande ; modifie p et ax en place.
// J : modes de jonction des nœuds (modesJonction).
export function raccorderBandes(prims, J = new Map()) {
  const mode = (P) => J.get(clePt(P)) || 'auto';
  // Moises : doublées de part et d'autre, elles ne coupent personne et ne sont pas coupées.
  for (const m of prims) {
    if (!m.ax || !RANG[m.st] || !m.bar?.moise) continue;
    const u = unite(sub(m.ax[1], m.ax[0]));
    const A = sub(m.ax[0], mul(u, m.h * 2));
    const B = add(m.ax[1], mul(u, m.h * 2));
    m.p = bande(A, B, u, 2 * m.h);
    m.ax = [A, B];
    m.moise = true;
  }
  let B = prims.filter((p) => p.ax && RANG[p.st] && !p.moise);
  const tol = 1e-3;
  for (const b of B) { b._u = unite(sub(b.ax[1], b.ax[0])); b._L = dist(b.ax[0], b.ax[1]); }

  // 0a. Barres dans le prolongement, même pièce : une seule pièce continue.
  const pere = new Map(B.map((b) => [b, b]));
  const racine = (b) => { while (pere.get(b) !== b) b = pere.get(b); return b; };
  const meme = (a, b) => a.st === b.st && a.st !== 'diagonale-vol' && Math.abs(a.h - b.h) < 1e-6
    && JSON.stringify(a.sec || null) === JSON.stringify(b.sec || null) && (a.bar?.mat || '') === (b.bar?.mat || '');
  for (let i = 0; i < B.length; i++) {
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i];
      const b = B[j];
      if (!meme(a, b) || Math.abs(croix2(a._u, b._u)) > 0.01) continue;
      for (const ka of [0, 1]) for (const kb of [0, 1]) {
        const E = a.ax[ka];
        if (dist(E, b.ax[kb]) > tol) continue;
        const va = ka === 1 ? a._u : mul(a._u, -1); // vers l'extérieur de a
        const vb = kb === 1 ? b._u : mul(b._u, -1);
        if (dot(va, vb) > -0.99) continue; // il faut qu'elles repartent de chaque côté
        const md = mode(E);
        const ok = md === 'auto' || (md === 'vertical' && Math.abs(a._u[1]) > 0.7) || (md === 'horizontal' && Math.abs(a._u[0]) > 0.7);
        if (ok) pere.set(racine(b), racine(a));
      }
    }
  }
  const groupes = new Map();
  for (const b of B) { const r = racine(b); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(b); }
  for (const g of groupes.values()) {
    if (g.length < 2) continue;
    const t = g[0];
    const O = t.ax[0];
    let s0 = Infinity;
    let s1 = -Infinity;
    for (const b of g) for (const P of b.ax) { const s = dot(sub(P, O), t._u); s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    const A = add(O, mul(t._u, s0));
    const Z = add(O, mul(t._u, s1));
    t.ax = [A, Z];
    t._L = s1 - s0;
    t.p = bande(A, Z, t._u, 2 * t.h);
    t.ids = g.map((b) => b.id);
    for (const b of g.slice(1)) enTroncon(b);
  }
  B = B.filter((b) => b.st !== 'troncon');

  // 0b. Une barre plus faible couchée dans une plus forte (montant de bout de treillis dans un poteau) disparaît.
  for (const w of B) {
    for (const s of B) {
      if (s === w || !s.ax || !w.ax || RANG[s.st] <= RANG[w.st] || Math.abs(croix2(w._u, s._u)) > 0.02) continue;
      const dans = (P) => { const q = distSeg(P, s.ax[0], s.ax[1]); return q.d <= s.h + tol && q.t > -1e-6 && q.t < 1 + 1e-6; };
      if (dans(w.ax[0]) && dans(w.ax[1])) { enTroncon(w); break; }
    }
  }
  B = B.filter((b) => b.st !== 'troncon');
  if (B.length < 2) { for (const b of B) { delete b._u; delete b._L; } return prims; }

  // Rang d'une barre à un nœud, selon le croisement choisi.
  const rang = (b, E) => {
    const md = mode(E);
    if (md === 'onglet') return 5;
    const u = b._u;
    return RANG[b.st] + (md === 'vertical' ? 100 * Math.abs(u[1]) : md === 'horizontal' ? 100 * Math.abs(u[0]) : 0);
  };

  const coupes = new Map();
  for (const b of B) {
    const bouts = [];
    for (const k of [0, 1]) {
      const E = b.ax[k];
      const v = k === 0 ? b._u : mul(b._u, -1); // du bout vers l'intérieur de la barre
      const n = normale(v);
      const h = b.h;
      const lim = 6 * h + 0.05;
      const rb = rang(b, E);
      const auBout = [];
      const traverse = [];
      for (const o of B) {
        if (o === b || o._L < 1e-6) continue;
        if (distSeg(E, o.ax[0], o.ax[1]).d > tol) continue;
        const bout = dist(E, o.ax[0]) < tol || dist(E, o.ax[1]) < tol;
        const vo = dist(E, o.ax[0]) < tol ? o._u : dist(E, o.ax[1]) < tol ? mul(o._u, -1) : o._u;
        const s = croix2(v, vo);
        (bout ? auBout : traverse).push({ o, vo, s, c: v[0] * vo[0] + v[1] * vo[1], r: rang(o, E) });
      }
      let tg = 0;
      let td = 0;
      let fait = false;
      // 1. Contre une barre plus forte, ou une barre qu'on touche en son milieu : on s'arrête à sa face.
      const fortes = [...traverse, ...auBout.filter((x) => x.r > rb)].filter((x) => Math.abs(x.s) > 0.05);
      for (const { o } of fortes) {
        const no = normale(o._u);
        const cote = Math.sign(croix2(o._u, sub(b.ax[1 - k], o.ax[0]))) || 1; // face tournée vers nous
        const F = add(o.ax[0], mul(no, cote * o.h));
        const g = inter(add(E, mul(n, h)), v, F, o._u);
        const d = inter(sub(E, mul(n, h)), v, F, o._u);
        if (g === null || d === null || g < -lim || d < -lim || g > b._L * 0.45 || d > b._L * 0.45) continue;
        // La face ne compte que là où la barre existe vraiment (pas sur son prolongement).
        const dedans = (P) => { const s = (P[0] - o.ax[0][0]) * o._u[0] + (P[1] - o.ax[0][1]) * o._u[1]; return s > -(o.h + h) && s < o._L + o.h + h; };
        if (!dedans(add(add(E, mul(n, h)), mul(v, g))) || !dedans(sub(add(E, mul(v, d)), mul(n, h)))) continue;
        if (!fait) { tg = g; td = d; fait = true; } else { tg = Math.max(tg, g); td = Math.max(td, d); }
      }
      if (!fait) {
        const egales = auBout.filter((x) => x.r === rb);
        // Une barre aussi forte continue dans le prolongement (poteau d'étage…) : on ne dépasse pas.
        const suite = auBout.some((x) => Math.abs(x.s) < 0.05 && x.c < 0 && x.r >= rb);
        const angle = egales.filter((x) => Math.abs(x.s) > 0.05);
        if (egales.length === 1 && angle.length === 1) {
          // 2. Onglet : le bord gauche de l'une rencontre le bord droit de l'autre.
          const { o, vo, s } = angle[0];
          const n2 = normale(vo);
          const g = croix2(sub(mul(n2, -o.h), mul(n, h)), vo) / s;
          const d = croix2(sub(mul(n2, o.h), mul(n, -h)), vo) / s;
          if (Math.abs(g) < lim && Math.abs(d) < lim) { tg = g; td = d; }
        } else if (!suite) {
          // 3. On est la barre forte du nœud : on dépasse juste assez pour couvrir le bout des autres.
          let t = 0;
          for (const { o, vo, s, r } of auBout) {
            if (r >= rb || Math.abs(s) < 0.05) continue;
            // Les bords de l'autre barre rencontrent nos faces : on monte jusqu'au plus haut de ces coins.
            const no = normale(vo);
            for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
              const P = add(E, mul(n, s1 * h));
              const Q = add(E, mul(no, s2 * o.h));
              const ti = inter(P, v, Q, vo);
              const si = inter(Q, vo, P, v);
              if (ti !== null && si !== null && si > -o.h) t = Math.min(t, ti);
            }
          }
          tg = td = Math.max(t, -lim);
        }
      }
      bouts.push({ E, v, n, tg, td });
    }
    coupes.set(b, bouts);
  }
  for (const [b, [a, z]] of coupes) {
    const aG = add(add(a.E, mul(a.v, a.tg)), mul(a.n, b.h));
    const aD = sub(add(a.E, mul(a.v, a.td)), mul(a.n, b.h));
    const zG = add(add(z.E, mul(z.v, z.tg)), mul(z.n, b.h));
    const zD = sub(add(z.E, mul(z.v, z.td)), mul(z.n, b.h));
    b.p = [aG, zD, zG, aD]; // même ordre que bande() : [A+n, B+n, B-n, A-n]
    b.ax = [lerp(aG, aD, 0.5), lerp(zG, zD, 0.5)];
    delete b._u; delete b._L;
  }
  return prims;
}

// Détails dans l'épaisseur : ailes d'un profilé, parois d'un tube, axe de la barre.
export function detailsBandes(prims) {
  const out = [];
  for (const b of prims) {
    if (!b.ax || !RANG[b.st]) continue;
    const [aG, zD, zG, aD] = b.p;
    const ligne = (st, r) => out.push({ k: 'l', st, id: b.id, p: [lerp(aG, aD, r), lerp(zD, zG, r)] });
    const e = 2 * b.h;
    const S = b.sec;
    if (S?.f === 'profil') {
      const r = Math.min(0.2, (0.045 * S.h) / e); // épaisseur d'aile ~ 4,5 % de la hauteur
      ligne('detail', r);
      ligne('detail', 1 - r);
    } else if (S?.f === 'tube') {
      const r = Math.min(0.3, (S.e || e / 12) / e);
      ligne('detail-cache', r);
      ligne('detail-cache', 1 - r);
    }
    if (e > 0.05 && b.st !== 'diagonale-vol' && b.st !== 'cable-vol') ligne('axe', 0.5);
  }
  return out;
}

// Décalage en profondeur des deux moitiés d'une moise : elle serre les pièces qu'elle touche.
function decalerMoises(liste) {
  const larg = new Map(); // nœud → plus large barre non moisée qui y arrive
  for (const { b } of liste) {
    if (b.moise) continue;
    const w = sectionDe(b).b || 0.1;
    for (const n of [b.a, b.b]) larg.set(n, Math.max(larg.get(n) || 0, w));
  }
  for (const { b, prims } of liste) {
    if (!b.moise) continue;
    const w = Math.max(larg.get(b.a) || 0, larg.get(b.b) || 0, 0.1);
    const d = w / 2 + (sectionDe(b).b || 0.05) / 2;
    for (const pr of prims) if (pr.moise) pr.decal = d;
  }
}

// Toutes les barres d'une coupe à leur vraie largeur, jonctions faites : [{ b, prims }].
export function barresEnSections(f, K, N = carteNoeuds(f)) {
  const liste = [];
  const tout = [];
  for (const b of f.barres) {
    const na = N.get(b.a);
    const nb = N.get(b.b);
    if (!na || !nb) continue;
    const prims = [];
    primitivesBarre(b, [na.x, na.y], [nb.x, nb.y], { ...K, sections: true }, prims);
    for (const pr of prims) pr.bar = b;
    liste.push({ b, prims });
    tout.push(...prims);
  }
  raccorderBandes(tout, modesJonction(f));
  decalerMoises(liste);
  return liste;
}

// Pannes posées sur le dessus des poutres et des membrures, d'un portique à l'autre.
// Une panne suit la pente de sa poutre ; elle est refusée si elle entre dans une autre pièce.
export const PANNE = [0.08, 0.16];
export function pannesCoupe(f, liste = barresEnSections(f, { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 } })) {
  const bandes = [];
  const appuis = [];
  for (const { prims } of liste) {
    for (const pr of prims) {
      if (pr.k === 'p' && pr.ferme && RANG[pr.st]) bandes.push(pr);
      if (pr.ax0 && ['poutre-vol', 'membrure-vol'].includes(pr.st === 'troncon' ? pr.ex : pr.st)) appuis.push(pr);
    }
  }
  // Chaque bout d'axe de poutre ou de membrure, avec les barres qui y arrivent.
  const pts = new Map();
  for (const pr of appuis) {
    for (const P of pr.ax0) {
      if (P[1] <= 0.01) continue;
      const k = clePt(P);
      if (!pts.has(k)) pts.set(k, { P, liens: [] });
      pts.get(k).liens.push(pr);
    }
  }
  const [lp, hp] = PANNE;
  const out = [];
  for (const { P, liens } of pts.values()) {
    let up = [0, 0];
    let h = 0;
    for (const pr of liens) {
      const u = unite(sub(pr.ax0[1], pr.ax0[0]));
      let n = normale(u);
      if (n[1] < 0) n = mul(n, -1);
      up = add(up, n);
      h = Math.max(h, pr.h0 || pr.h || 0);
    }
    up = unite(up);
    if (up[1] < 0.2) continue; // pas de dessus sur une barre presque verticale
    const t = [up[1], -up[0]];
    const C = add(P, mul(up, h + hp / 2 + 0.002));
    const coin = (a, b) => add(add(C, mul(t, a * lp / 2)), mul(up, b * hp / 2));
    const p = [coin(-1, -1), coin(1, -1), coin(1, 1), coin(-1, 1)];
    // Points d'essai un peu en retrait : la panne ne doit entrer dans aucune pièce.
    const essai = [C, ...p.map((q) => lerp(C, q, 0.85))];
    const gene = bandes.some((pr) => essai.some((q) => dansPolygone(q, pr.p)) || pr.p.some((q) => dansPolygone(q, p)));
    if (gene) continue;
    out.push({ id: liens[0].id, c: C, p, ang: Math.atan2(t[1], t[0]) });
  }
  return out;
}

// ---------- Formes d'une barre ----------
// Forme = { k:'l'|'p'|'c'|'t', st: style, id: élément d'origine, ... }
// x (plan) : { coins } contour d'un mur déjà raccordé, { e } épaisseur du mur sous une ouverture.
export function primitivesBarre(b, A, B, K, out, x = null) {
  const id = b.id;
  const u = unite(sub(B, A));
  const bas = versLeBas(u);
  if (MURS.has(b.type)) {
    out.push({ k: 'p', st: b.type, id, p: x?.coins || bande(A, B, u, epaisseur(b)), ferme: true });
    return;
  }
  if (b.type === 'porte') {
    const L = dist(A, B);
    const o = b.porte || {};
    const n = mul(normale(u), o.sens === -1 ? -1 : 1); // côté où elle s'ouvre
    const C = o.charniere === 'b' ? B : A; // charnière
    const w = o.charniere === 'b' ? mul(u, -1) : u;
    const arc = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * (Math.PI / 2);
      arc.push(add(C, add(mul(w, L * Math.cos(t)), mul(n, L * Math.sin(t)))));
    }
    out.push({ k: 'p', st: 'zone', id, p: [C, ...arc], ferme: true });
    out.push({ k: 'p', st: 'porte-arc', id, p: arc, ferme: false });
    out.push({ k: 'l', st: 'porte', id, p: [C, arc[16]] });
    return;
  }
  if (b.type === 'fenetre') {
    out.push({ k: 'p', st: 'fenetre', id, p: bande(A, B, u, x?.e || EP_MUR.murp), ferme: true });
    out.push({ k: 'l', st: 'vitre', id, p: [A, B] });
    return;
  }
  if (b.type === 'escalier') {
    const L = dist(A, B);
    const s = b.escalier || {};
    const larg = Math.max(0.2, +s.w || 1.2);
    const g = Math.max(0.1, +s.giron || 0.28);
    const n = mul(normale(u), larg / 2);
    out.push({ k: 'p', st: 'escalier', id, p: bande(A, B, u, larg), ferme: true });
    for (let i = 1; i * g < L - 1e-6 && i < 400; i++) {
      const c = add(A, mul(u, i * g));
      out.push({ k: 'l', st: 'marche', id, p: [add(c, n), sub(c, n)] });
    }
    // Ligne de foulée : la flèche monte vers B (ou vers A si on l'a retourné).
    const [D, F] = s.sens === -1 ? [B, A] : [A, B];
    const v = mul(u, s.sens === -1 ? -1 : 1);
    const t = Math.min(0.45 * K.su, L / 3);
    const cote = mul(normale(v), t * 0.6);
    out.push({ k: 'l', st: 'foulee', id, p: [D, F] });
    out.push({ k: 'p', st: 'foulee', id, p: [add(sub(F, mul(v, t)), cote), F, sub(sub(F, mul(v, t)), cote)], ferme: false });
    return;
  }
  if (b.type === 'trame') {
    const r = 0.7 * K.su;
    const C = sub(A, mul(u, r)); // la bulle est juste avant le début de l'axe
    out.push({ k: 'l', st: 'trame', id, p: [A, B] });
    out.push({ k: 'c', st: 'trame-rond', id, c: C, r });
    const nom = String(b.trame?.nom ?? '').slice(0, 3);
    if (nom) out.push({ k: 't', st: 'trame-txt', id, c: [C[0], C[1] - 0.36 * K.cote], txt: nom, ang: 0, h: K.cote, ancre: 'middle' });
    return;
  }
  if (b.type === 'treillis') {
    const t = b.treillis || {};
    const n = Math.max(1, Math.round(t.n || 6));
    const sens = t.sens === -1 ? -1 : 1;
    const off = mul(bas, -(t.h ?? 1.5) * sens);
    const A2 = add(A, off);
    const B2 = add(B, off);
    const P = (i) => lerp(A, B, i / n);
    const Q = (i) => lerp(A2, B2, i / n);
    const em = hauteurVue(b);
    const L = (p, q) => lin(out, 'diagonale', id, p, q, K, em * 0.6);
    out.push({ k: 'p', st: 'zone', id, p: [A, B, B2, A2], ferme: true });
    lin(out, 'membrure', id, A, B, K, em, sectionDe(b));
    lin(out, 'membrure', id, A2, B2, K, em, sectionDe(b));
    const forme = t.forme || 'warren';
    if (forme === 'warren' || forme === 'warren_m') {
      for (let i = 0; i < n; i++) { if (i % 2 === 0) L(P(i), Q(i + 1)); else L(Q(i), P(i + 1)); }
      L(P(0), Q(0));
      L(P(n), Q(n));
      if (forme === 'warren_m') for (let i = 1; i < n; i++) L(P(i), Q(i));
    } else {
      for (let i = 0; i <= n; i++) L(P(i), Q(i));
      const Ht = sens === 1 ? Q : P; // membrure du haut
      const Bt = sens === 1 ? P : Q; // membrure du bas
      const pratt = forme === 'pratt';
      for (let i = 0; i < n; i++) {
        const gauche = (i + 0.5) < n / 2;
        if (gauche === pratt) L(Ht(i), Bt(i + 1)); else L(Ht(i + 1), Bt(i));
      }
    }
    return;
  }
  if (b.type === 'toit') {
    const t = b.toit || {};
    const L = dist(A, B);
    const sens = t.sens === -1 ? -1 : 1;
    const n = mul(bas, -sens); // vers le haut du toit (ou l'inverse si retourné)
    const forme = t.forme || '2pentes';
    const p = Math.max(0, +t.pente || 0) / 100; // pente en %
    const d = Math.max(0, +t.debord || 0);
    const x0 = -d;
    const x1 = L + d;
    const H = (x) => {
      if (forme === 'plat') return 0;
      if (forme === '1pente') return p * x;
      if (forme === 'courbe') return (+t.fleche || 0) * Math.sin((Math.PI * (x - x0)) / Math.max(1e-6, x1 - x0));
      return p * Math.min(x, L - x);
    };
    const pt = (x) => add(add(A, mul(u, x)), mul(n, H(x)));
    let pts;
    if (forme === 'courbe') { pts = []; for (let i = 0; i <= 24; i++) pts.push(pt(x0 + ((x1 - x0) * i) / 24)); }
    else if (forme === '2pentes') pts = [pt(x0), pt(L / 2), pt(x1)];
    else pts = [pt(x0), pt(x1)];
    out.push({ k: 'l', st: 'zone', id, p: [A, B] }); // la portée : invisible, mais on peut cliquer dessus
    if (K.sections) {
      // Épaisseur mesurée à la verticale (comme on dessine un rampant).
      const ev = hauteurVue(b) * (forme === 'courbe' || forme === 'plat' ? 1 : Math.sqrt(1 + p * p));
      const dessous = pts.slice().reverse().map((q) => sub(q, mul(n, ev)));
      out.push({ k: 'p', st: 'toit-vol', id, p: [...pts, ...dessous], ferme: true });
    } else out.push({ k: 'p', st: 'toit', id, p: pts, ferme: false });
    return;
  }
  if (b.type === 'toile') {
    const f = b.toile?.fleche ?? 0.8;
    const c = add(lerp(A, B, 0.5), mul(bas, 2 * f));
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(lerp(lerp(A, c, t), lerp(c, B, t), t)); }
    out.push({ k: 'p', st: 'toile', id, p: pts, ferme: false });
    return;
  }
  if (b.type === 'dalle') {
    const off = mul(bas, (b.dalle?.e ?? 0.3) * (b.dalle?.sens === -1 ? -1 : 1));
    out.push({ k: 'p', st: 'dalle', id, p: [A, B, add(B, off), add(A, off)], ferme: true });
    return;
  }
  if (b.type === 'sol') {
    out.push({ k: 'l', st: 'sol', id, p: [A, B] });
    hachures(A, B, mul(bas, b.sol?.sens === -1 ? -1 : 1), K.su, out, id);
    return;
  }
  if (BARRES_LIN.has(b.type)) { lin(out, b.type, id, A, B, K, hauteurVue(b), sectionDe(b)); return; }
  out.push({ k: 'l', st: b.type, id, p: [A, B] });
}

// ---------- Formes d'un nœud (appuis et liaisons) ----------
export function primitivesNoeud(nd, K, out, ecran) {
  const p = [nd.x, nd.y];
  const su = K.su;
  const id = nd.id;
  switch (nd.type) {
    case 'rotule': out.push({ k: 'c', st: 'rotule', id, c: p, r: 0.3 * su }); break;
    case 'rigide': out.push({ k: 'c', st: 'rigide', id, c: p, r: 0.2 * su }); break;
    case 'appui':
    case 'glissant': {
      const h = 0.8 * su;
      const db = 0.5 * su;
      out.push({ k: 'p', st: 'appui', id, p: [p, [p[0] - db, p[1] - h], [p[0] + db, p[1] - h]], ferme: true });
      let yb = p[1] - h;
      if (nd.type === 'glissant') {
        yb -= 0.22 * su;
        out.push({ k: 'c', st: 'rouleau', id, c: [p[0] - 0.25 * su, p[1] - h - 0.11 * su], r: 0.09 * su });
        out.push({ k: 'c', st: 'rouleau', id, c: [p[0] + 0.25 * su, p[1] - h - 0.11 * su], r: 0.09 * su });
      }
      const A = [p[0] - 0.8 * su, yb];
      const B = [p[0] + 0.8 * su, yb];
      out.push({ k: 'l', st: 'appui-base', id, p: [A, B] });
      hachures(A, B, [0, -1], su, out, id, 0.3, 0.3);
      break;
    }
    case 'encastrement': {
      const A = [p[0] - 0.8 * su, p[1]];
      const B = [p[0] + 0.8 * su, p[1]];
      out.push({ k: 'l', st: 'appui-base', id, p: [A, B] });
      hachures(A, B, [0, -1], su, out, id, 0.3, 0.3);
      break;
    }
    case 'poteau': { // poteau vu en plan : carré plein à sa vraie taille
      const h = Math.max(0.02, +nd.s || 0.3) / 2;
      out.push({ k: 'p', st: 'poteau-plan', id, p: [[p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]], ferme: true });
      break;
    }
    default:
      if (ecran) out.push({ k: 'c', st: 'noeud', id, c: p, r: 0.12 * su });
  }
}

// ---------- Formes d'une cote ----------
export function primitivesCote(c, A, B, K, out) {
  const L = dist(A, B);
  if (L < 1e-9) return;
  const su = K.su;
  const id = c.id;
  const u = unite(sub(B, A));
  const n = normale(u);
  const d = c.decalage ?? 1;
  const sg = Math.sign(d) || 1;
  const A2 = add(A, mul(n, d));
  const B2 = add(B, mul(n, d));
  out.push({ k: 'l', st: 'cote', id, p: [add(A, mul(n, sg * 0.15 * su)), add(A2, mul(n, sg * 0.3 * su))] });
  out.push({ k: 'l', st: 'cote', id, p: [add(B, mul(n, sg * 0.15 * su)), add(B2, mul(n, sg * 0.3 * su))] });
  out.push({ k: 'l', st: 'cote', id, p: [A2, B2] });
  const tk = mul(unite(add(u, n)), 0.175 * su);
  out.push({ k: 'l', st: 'cote-tick', id, p: [sub(A2, tk), add(A2, tk)] });
  out.push({ k: 'l', st: 'cote-tick', id, p: [sub(B2, tk), add(B2, tk)] });
  let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  else if (ang <= -90) ang += 180;
  const r = (ang * Math.PI) / 180;
  const haut = [-Math.sin(r), Math.cos(r)];
  out.push({
    k: 't', st: 'cote-txt', id, c: add(lerp(A2, B2, 0.5), mul(haut, 0.25 * su)),
    txt: c.texte || `${fr(L)} m`, ang, h: K.cote, ancre: 'middle',
  });
}

// ---------- Toute une feuille ----------
const ORDRE = {
  trame: -2, escalier: -1, sol: 0, mur: 0, cloison: 0.3, murp: 0.4, dalle: 1, toile: 2, cable: 3,
  entretoise: 4, treillis: 5, toit: 5.5, poutre: 6, bequille: 6, poteau: 7, fenetre: 8, porte: 8,
};

// Portiques répartis le long de la profondeur (même règle que la 3D et les exports).
export function portiquesZ(f) {
  const t = f.trois_d || {};
  const e = Math.max(0.5, +t.entraxe || 6);
  const nb = borne(Math.round(+t.nombre || 4), 1, 40);
  return Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * e);
}

// Reflet de la coupe liée, vu de dessus : x de la coupe = x du plan, profondeur z = y du plan.
// Poteaux à leur vraie section, poutres en bandes, pannes en tirets. Pas d'id : on ne les sélectionne pas.
export function refletCoupe(c, out) {
  const N = carteNoeuds(c);
  const zs = portiquesZ(c);
  const z0 = zs[0] - (zs.length > 1 ? 0 : 3);
  const z1 = zs[zs.length - 1] + (zs.length > 1 ? 0 : 3);
  const xs = new Set();
  for (const b of c.barres || []) {
    if (b.type === 'sol' || b.type === 'mur') continue;
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (!A || !B) continue;
    const S = sectionDe(b);
    const lb = Math.max(0.03, S.b || 0.1) / 2;
    const vertical = Math.abs(A.x - B.x) < 0.05;
    for (const z of zs) {
      if (vertical) {
        const lh = Math.max(0.03, S.h || 0.1) / 2;
        const x = A.x;
        out.push({ k: 'p', st: 'reflet-poteau', id: null, ferme: true, p: [[x - lh, z - lb], [x + lh, z - lb], [x + lh, z + lb], [x - lh, z + lb]] });
      } else {
        const xa = Math.min(A.x, B.x);
        const xb = Math.max(A.x, B.x);
        out.push({ k: 'p', st: 'reflet', id: null, ferme: true, p: [[xa, z - lb], [xb, z - lb], [xb, z + lb], [xa, z + lb]] });
      }
    }
    for (const n of [A, B]) if (n.y > 0.01) xs.add(Math.round(n.x * 1000) / 1000);
  }
  if (zs.length > 1) for (const x of xs) out.push({ k: 'l', st: 'reflet', id: null, p: [[x, z0], [x, z1]] });
}

// Charges ajoutées, à l'écran seulement : flèches vers le bas au-dessus de la barre ou du nœud.
const nbFr = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
function flecheCharge(x, y, h, su, id, out) {
  out.push({ k: 'l', st: 'charge', id, p: [[x, y + h], [x, y + 0.35 * su]] });
  out.push({ k: 'p', st: 'charge-pointe', id, ferme: true, p: [[x, y + 0.1 * su], [x - 0.32 * su, y + 0.75 * su], [x + 0.32 * su, y + 0.75 * su]] });
}
function primitivesCharges(f, N, K, out) {
  const su = K.su;
  const h = K.txt[1];
  for (const b of f.barres) {
    const liste = chargesBarre(b);
    if (!liste.length) continue;
    const na = N.get(b.a);
    const nb = N.get(b.b);
    if (!na || !nb) continue;
    const A = [na.x, na.y];
    const B = [nb.x, nb.y];
    // Réparties : une rangée de petites flèches reliées par un trait.
    const rep = liste.filter((c) => c.k !== 'ponctuelle');
    if (rep.length) {
      const H = 1.6 * su;
      const L = dist(A, B);
      const n = Math.max(2, Math.min(24, Math.round(L / (1.4 * su))));
      for (let i = 0; i <= n; i++) { const P = lerp(A, B, i / n); flecheCharge(P[0], P[1], H, su, b.id, out); }
      out.push({ k: 'l', st: 'charge', id: b.id, p: [[A[0], A[1] + H], [B[0], B[1] + H]] });
      const M = lerp(A, B, 0.5);
      const txt = rep.map((c) => nbFr(+c.v) + ' ' + UNITES[c.k]).join(' + ');
      out.push({ k: 't', st: 'charge-txt', id: b.id, c: [M[0], M[1] + H + 0.45 * su], txt, ang: 0, h, ancre: 'middle' });
    }
    // Objets : une grande flèche à leur place.
    const haut = rep.length ? 3.6 * su : 2.6 * su;
    for (const c of liste.filter((x) => x.k === 'ponctuelle')) {
      const P = lerp(A, B, position(c));
      flecheCharge(P[0], P[1], haut, su, b.id, out);
      out.push({ k: 't', st: 'charge-txt', id: b.id, c: [P[0], P[1] + haut + 0.45 * su], txt: (c.nom ? c.nom + ' · ' : '') + nbFr(+c.v) + ' kN', ang: 0, h, ancre: 'middle' });
    }
  }
  for (const nd of f.noeuds) {
    const liste = chargesNoeud(nd);
    if (!liste.length) continue;
    const v = liste.reduce((s, c) => s + +c.v, 0);
    flecheCharge(nd.x, nd.y, 2.6 * su, su, nd.id, out);
    const nom = liste.length === 1 && liste[0].nom ? liste[0].nom + ' · ' : '';
    out.push({ k: 't', st: 'charge-txt', id: nd.id, c: [nd.x, nd.y + 3.05 * su], txt: nom + nbFr(v) + ' kN', ang: 0, h, ancre: 'middle' });
  }
}

export function primitivesFeuille(f, K0, ecran, reflet = null) {
  const out = [];
  if (reflet && estPlan(f)) refletCoupe(reflet, out);
  // Mode « sections » : les barres sont dessinées à leur vraie largeur.
  // Allumé par défaut : on ne l'éteint que si la feuille dit sections: false.
  const K = sectionsVisibles(f) && !estPlan(f) ? { ...K0, sections: true } : K0;
  const N = carteNoeuds(f);
  const J = f.barres.some((b) => MURS.has(b.type)) ? analysePlan(f, N) : null;
  const barres = f.barres.slice().sort((a, b) => (ORDRE[a.type] ?? 5) - (ORDRE[b.type] ?? 5));
  for (const b of barres) {
    const na = N.get(b.a);
    const nb = N.get(b.b);
    if (!na || !nb) continue;
    const A = [na.x, na.y];
    const B = [nb.x, nb.y];
    let x = null;
    if (J && MURS.has(b.type)) {
      if (J.cache.has(b.id)) continue; // sous une porte ou une fenêtre
      x = { coins: bandeMur(b, A, B, J, N) };
    } else if (J && OUVERTURES.has(b.type)) x = { e: J.ep.get(b.id) };
    const i0 = out.length;
    primitivesBarre(b, A, B, K, out, x);
    for (let i = i0; i < out.length; i++) out[i].bar = b;
  }
  if (K.sections) {
    raccorderBandes(out, modesJonction(f));
    // Les détails juste après leur barre : une barre de devant les cache bien. Les moises passent devant tout.
    const tri = [];
    const devant = [];
    for (const pr of out) { const t = pr.moise ? devant : tri; t.push(pr); if (pr.ax) t.push(...detailsBandes([pr])); }
    out.splice(0, out.length, ...tri, ...devant);
  }
  for (const s of f.traits || []) if (s.pts.length > 1) out.push({ k: 'p', st: 'trait', id: s.id, p: s.pts, ferme: false });
  for (const nd of f.noeuds) primitivesNoeud(nd, K, out, ecran);
  if (ecran && !estPlan(f)) primitivesCharges(f, N, K, out);
  for (const c of f.cotes || []) primitivesCote(c, pointCote(c.a, N), pointCote(c.b, N), K, out);
  for (const t of f.textes || []) {
    out.push({ k: 't', st: 'texte', id: t.id, c: [t.x, t.y], txt: t.texte, ang: 0, h: K.txt[t.taille || 2], ancre: 'start' });
  }
  return out;
}

// ---------- Toucher un élément ----------
// Distance d'un point à une forme (0 dedans pour une forme fermée).
export function distForme(pr, p) {
  if (pr.k === 'l') return distSeg(p, pr.p[0], pr.p[1]).d;
  if (pr.k === 'c') return Math.max(0, dist(p, pr.c) - pr.r);
  if (pr.k === 'p') {
    let d = Infinity;
    const n = pr.p.length;
    for (let i = 0; i < n - 1; i++) d = Math.min(d, distSeg(p, pr.p[i], pr.p[i + 1]).d);
    if (pr.ferme && n > 2) {
      d = Math.min(d, distSeg(p, pr.p[n - 1], pr.p[0]).d);
      if (dansPolygone(p, pr.p)) return -1; // dedans
    }
    return d;
  }
  // texte : boîte tournée
  const r = ((pr.ang || 0) * Math.PI) / 180;
  const v = sub(p, pr.c);
  const lx = v[0] * Math.cos(r) + v[1] * Math.sin(r);
  const ly = -v[0] * Math.sin(r) + v[1] * Math.cos(r);
  const w = largeurTexte(pr);
  const x0 = pr.ancre === 'start' ? 0 : -w / 2;
  const dx = Math.max(x0 - lx, 0, lx - (x0 + w));
  const dy = Math.max(-0.25 * pr.h - ly, 0, ly - pr.h * 0.85);
  return Math.hypot(dx, dy);
}

// L'élément le plus proche sous le point (tolérance en mètres). Les nœuds gagnent, l'intérieur d'une zone perd.
export function chercher(prims, p, tol, garder = () => true) {
  let meilleur = null;
  let score = Infinity;
  for (let i = prims.length - 1; i >= 0; i--) {
    const pr = prims[i];
    if (!pr.id || !garder(pr)) continue;
    let d = distForme(pr, p);
    if (d < 0) d = tol * 0.6;
    if (d > tol) continue;
    if (pr.id[0] === 'n') d -= tol * 0.4;
    if (d < score - 1e-9) { score = d; meilleur = pr.id; }
  }
  return meilleur;
}
