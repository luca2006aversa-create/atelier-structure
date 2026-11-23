// Géométrie de l'atelier : types, calculs de vecteurs, et formes à dessiner (écran, papier, 3D).
// Unités : mètres, y vers le haut, sol à 0.

export const TYPES_BARRE = [
  ['poteau', 'Poteau'], ['poutre', 'Poutre'], ['bequille', 'Béquille'], ['entretoise', 'Entretoise'],
  ['cable', 'Câble'], ['treillis', 'Treillis'], ['toile', 'Toile'], ['dalle', 'Dalle'],
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
export const FORMES_TREILLIS = [['warren', 'Warren'], ['warren_m', 'Warren +'], ['pratt', 'Pratt'], ['howe', 'Howe']];
// Barres qu'on ne coupe pas quand un nœud tombe dessus (leur dessin dépend de leurs deux bouts).
export const NON_COUPEES = new Set(['treillis', 'toile', 'porte', 'fenetre', 'escalier', 'trame']);

// Feuille en plan (vue de dessus). Sans type : une coupe.
export const estPlan = (f) => f?.type === 'plan';
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
    const L = (p, q) => out.push({ k: 'l', st: 'diagonale', id, p: [p, q] });
    out.push({ k: 'p', st: 'zone', id, p: [A, B, B2, A2], ferme: true });
    out.push({ k: 'l', st: 'membrure', id, p: [A, B] }, { k: 'l', st: 'membrure', id, p: [A2, B2] });
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
  entretoise: 4, treillis: 5, poutre: 6, bequille: 6, poteau: 7, fenetre: 8, porte: 8,
};

export function primitivesFeuille(f, K, ecran) {
  const out = [];
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
    primitivesBarre(b, A, B, K, out, x);
  }
  for (const s of f.traits || []) if (s.pts.length > 1) out.push({ k: 'p', st: 'trait', id: s.id, p: s.pts, ferme: false });
  for (const nd of f.noeuds) primitivesNoeud(nd, K, out, ecran);
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
