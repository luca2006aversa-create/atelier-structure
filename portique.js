// Calcul de portique plan : chaque barre devient un élément de poutre (3 degrés de liberté par nœud).
// On en tire l'effort normal, le moment, la déformée et le taux de travail — de quoi dessiner le schéma structurel.
// Unités : mètres, kilonewtons. x vers la droite, y vers le haut.
import { carteNoeuds, dist } from './geometrie.js';
import { sectionDe, matiereDe, proprietes, poidsML, MATIERES } from './matieres.js';

// Barres qui portent vraiment. Le reste (toit, toile, murs, repères) n'est que de la peau.
export const PORTEUSES = new Set(['poteau', 'poutre', 'bequille', 'entretoise', 'diagonale', 'membrure', 'treillis', 'cable', 'dalle']);
// Au-delà, le calcul deviendrait lent dans le navigateur.
const MAX_NOEUDS = 400;
// Sous cette pente, une barre est considérée comme horizontale : c'est elle qui reçoit la charge de surface.
const PLAT = 0.6;

// Charges de surface par défaut, en kN/m² (valeurs d'ordre courant, réglables par feuille).
export const CHARGES = { toitG: 0.9, neige: 0.45, plancherG: 1.5, exploitation: 2.5 };
export const NOMS_CHARGES = [
  ['toitG', 'Toiture (permanent)', 'kN/m²'],
  ['neige', 'Neige', 'kN/m²'],
  ['plancherG', 'Plancher (permanent)', 'kN/m²'],
  ['exploitation', 'Exploitation', 'kN/m²'],
];
export const chargesDe = (f) => ({ ...CHARGES, ...(f.charges || {}) });

// ---------- Algèbre ----------
// Résolution par pivot partiel. Renvoie null si la structure est un mécanisme (pivot nul).
function resoudre(A, b, n) {
  // Seuil relatif : un pivot minuscule devant la plus grande raideur = mécanisme.
  let kmax = 0;
  for (let i = 0; i < n; i++) kmax = Math.max(kmax, Math.abs(A[i * n + i]));
  const seuil = Math.max(1e-9, kmax * 1e-10);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
    if (Math.abs(A[p * n + c]) < seuil) return null;
    if (p !== c) {
      for (let k = c; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; }
      const t = b[c]; b[c] = b[p]; b[p] = t;
    }
    const d = A[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const m = A[r * n + c] / d;
      if (!m) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= m * A[c * n + k];
      b[r] -= m * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    x[r] = s / A[r * n + r];
  }
  return x;
}

// ---------- Mise en équations ----------
// Les nœuds au niveau du sol tiennent le bâtiment : articulation (le pied tourne librement).
function appuis(noeuds, y0) {
  const bas = noeuds.filter((n) => n.y - y0 < 0.02);
  if (bas.length >= 2) return new Map(bas.map((n) => [n.id, 'rotule']));
  const tri = noeuds.slice().sort((a, b) => a.y - b.y);
  // Un seul point au sol : il faut l'encastrer, sinon tout bascule.
  return new Map(tri.slice(0, 1).map((n) => [n.id, 'encastrement']));
}

// Une barre horizontale « abritée » (une autre passe au-dessus d'elle) porte un plancher, pas une toiture.
function abritee(el, els) {
  const xm = (el.A[0] + el.B[0]) / 2;
  const ym = (el.A[1] + el.B[1]) / 2;
  for (const o of els) {
    if (o === el || !o.plat) continue;
    const x0 = Math.min(o.A[0], o.B[0]);
    const x1 = Math.max(o.A[0], o.B[0]);
    if (xm < x0 - 1e-6 || xm > x1 + 1e-6) continue;
    const t = x1 - x0 < 1e-9 ? 0 : (xm - x0) / (x1 - x0);
    const yo = (o.A[0] <= o.B[0] ? o.A[1] + (o.B[1] - o.A[1]) * t : o.B[1] + (o.A[1] - o.B[1]) * t);
    if (yo > ym + 0.3) return true;
  }
  return false;
}

// Construit le modèle de calcul à partir d'une feuille de coupe.
export function modele(f) {
  const N = carteNoeuds(f);
  const C = chargesDe(f);
  const entraxe = Math.max(0.5, +(f.trois_d || {}).entraxe || 6);
  const els = [];
  const utiles = new Set();
  for (const b of f.barres) {
    if (!PORTEUSES.has(b.type)) continue;
    const a = N.get(b.a);
    const c = N.get(b.b);
    if (!a || !c) continue;
    const A = [a.x, a.y];
    const B = [c.x, c.y];
    const L = dist(A, B);
    if (L < 0.02) continue;
    let P = proprietes(sectionDe(b));
    const M = matiereDe(b);
    // Un treillis travaille par ses deux membrures écartées : inertie = 2 · A · (h/2)².
    if (b.type === 'treillis') {
      const ht = Math.max(0.2, Math.abs(b.treillis?.h ?? 1.5));
      const At = 2 * P.A;
      const It = (P.A * ht * ht) / 2;
      P = { A: At, Iy: It, Wy: P.A * ht, iy: Math.sqrt(It / At), h: ht, b: P.b };
    }
    // Un câble ne plie pas : il ne fait que tirer. On annule sa raideur de flexion.
    if (b.type === 'cable') P = { ...P, Iy: P.Iy * 1e-6, Wy: P.Wy * 1e6 };
    const cle = Object.keys(MATIERES).find((k) => MATIERES[k] === M) || 'gl24h';
    const dy = Math.abs(B[1] - A[1]) / L;
    els.push({
      b, id: b.id, a: b.a, c: b.b, A, B, L, P, mat: M, cle,
      E: M.E * 1000, // MPa -> kN/m²
      plat: dy < PLAT,
      poids: poidsML(b) * (b.type === 'treillis' ? 2.5 : 1), // membrures + diagonales
    });
    utiles.add(b.a);
    utiles.add(b.b);
  }
  if (!els.length) return { erreur: 'Pas de barre porteuse : dessine des poteaux et des poutres.' };
  const noeuds = f.noeuds.filter((n) => utiles.has(n.id));
  if (noeuds.length > MAX_NOEUDS) return { erreur: 'Trop de nœuds (' + noeuds.length + ') : le calcul s\'arrête à ' + MAX_NOEUDS + '.' };
  const y0 = Math.min(...noeuds.map((n) => n.y));
  // Charge de surface : toiture au-dessus, plancher en dessous. ELU = 1,35 G + 1,5 Q.
  for (const el of els) {
    let q = 0;
    if (el.plat && el.b.type !== 'diagonale' && el.b.type !== 'cable') {
      const sous = abritee(el, els);
      const g = (sous ? C.plancherG : C.toitG) * entraxe;
      const v = (sous ? C.exploitation : C.neige) * entraxe;
      q = 1.35 * g + 1.5 * v;
      el.qels = g + v + el.poids; // service (ELS) : charges sans majoration, pour la flèche
    } else el.qels = el.poids;
    el.q = q + 1.35 * el.poids; // kN/m, vers le bas
  }
  return { els, noeuds, appuis: appuis(noeuds, y0), y0, entraxe };
}

// ---------- Résolution ----------
export function calculer(f) {
  const mo = modele(f);
  if (mo.erreur) return mo;
  const { els, noeuds, appuis: AP } = mo;
  const idx = new Map(noeuds.map((n, i) => [n.id, i]));
  const nd = noeuds.length;
  const bloque = new Uint8Array(nd * 3);
  for (const [id, t] of AP) {
    const i = idx.get(id);
    if (i === undefined) continue;
    bloque[i * 3] = 1;
    bloque[i * 3 + 1] = 1;
    if (t === 'encastrement') bloque[i * 3 + 2] = 1;
  }
  // Numérotation des degrés de liberté restés libres.
  const num = new Int32Array(nd * 3).fill(-1);
  let n = 0;
  for (let i = 0; i < nd * 3; i++) if (!bloque[i]) num[i] = n++;
  if (!n) return { erreur: 'Tout est bloqué : rien à calculer.' };
  const K = new Float64Array(n * n);
  const P = new Float64Array(n);
  for (const el of els) {
    const i = idx.get(el.a);
    const j = idx.get(el.c);
    const L = el.L;
    const cth = (el.B[0] - el.A[0]) / L;
    const sth = (el.B[1] - el.A[1]) / L;
    const EA = el.E * el.P.A;
    const EI = el.E * el.P.Iy;
    const k = [EA / L, (12 * EI) / L ** 3, (6 * EI) / L ** 2, (4 * EI) / L, (2 * EI) / L];
    // Rigidité locale (6×6), symétrique.
    const kl = [
      [k[0], 0, 0, -k[0], 0, 0],
      [0, k[1], k[2], 0, -k[1], k[2]],
      [0, k[2], k[3], 0, -k[2], k[4]],
      [-k[0], 0, 0, k[0], 0, 0],
      [0, -k[1], -k[2], 0, k[1], -k[2]],
      [0, k[2], k[4], 0, -k[2], k[3]],
    ];
    // Rotation repère local -> global.
    const T = [
      [cth, sth, 0, 0, 0, 0],
      [-sth, cth, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, cth, sth, 0],
      [0, 0, 0, -sth, cth, 0],
      [0, 0, 0, 0, 0, 1],
    ];
    const kg = [];
    for (let r = 0; r < 6; r++) {
      kg.push(new Array(6).fill(0));
      for (let c = 0; c < 6; c++) {
        let s = 0;
        for (let u = 0; u < 6; u++) for (let v = 0; v < 6; v++) s += T[u][r] * kl[u][v] * T[v][c];
        kg[r][c] = s;
      }
    }
    el.kl = kl;
    el.T = T;
    el.kg = kg;
    // Charge répartie verticale (0, -q) ramenée au repère local, puis aux nœuds.
    const wx = -el.q * sth;
    const wy = -el.q * cth;
    const fl = [(wx * L) / 2, (wy * L) / 2, (wy * L * L) / 12, (wx * L) / 2, (wy * L) / 2, (-wy * L * L) / 12];
    el.fl = fl;
    el.wy = wy;
    el.EI = EI;
    const fg = new Array(6).fill(0);
    for (let r = 0; r < 6; r++) { let s = 0; for (let u = 0; u < 6; u++) s += T[u][r] * fl[u]; fg[r] = s; }
    const dd = [i * 3, i * 3 + 1, i * 3 + 2, j * 3, j * 3 + 1, j * 3 + 2];
    el.dd = dd;
    for (let r = 0; r < 6; r++) {
      const gr = num[dd[r]];
      if (gr < 0) continue;
      P[gr] += fg[r];
      for (let c = 0; c < 6; c++) {
        const gc = num[dd[c]];
        if (gc < 0) continue;
        K[gr * n + gc] += kg[r][c];
      }
    }
  }
  const U = resoudre(K, P, n);
  if (!U) return { erreur: 'Structure instable (il manque un contreventement ou un appui).' };
  const u = new Float64Array(nd * 3);
  for (let i = 0; i < nd * 3; i++) if (num[i] >= 0) u[i] = U[num[i]];
  // Efforts par élément : f = k·u − charges d'encastrement, exprimés dans le repère local.
  let Nmax = 0;
  let Mmax = 0;
  for (const el of els) {
    const ug = el.dd.map((d) => u[d]);
    const ul = el.T.map((r) => r.reduce((s, v, i2) => s + v * ug[i2], 0));
    const fl = el.kl.map((r) => r.reduce((s, v, i2) => s + v * ul[i2], 0)).map((v, i2) => v - el.fl[i2]);
    el.N = -fl[0]; // > 0 = traction
    el.V = [fl[1], -fl[4]];
    el.M = [-fl[2], fl[5]];
    // Moment maximal en travée pour une charge uniforme : parabole entre les deux bouts.
    // Moment en travee : la parabole de la charge s'ajoute a la corde des moments d'appui.
    const qm = el.q * Math.abs((el.B[0] - el.A[0]) / el.L);
    el.Mmi = (el.M[0] + el.M[1]) / 2 + (qm * el.L * el.L) / 8;
    el.Mabs = Math.max(Math.abs(el.M[0]), Math.abs(el.M[1]), Math.abs(el.Mmi));
    // Flèche à mi-portée, mesurée depuis la corde entre les deux bouts (poutre d'Euler-Bernoulli).
    el.fleche = Math.abs((el.L * (ul[2] - ul[5])) / 8 + (el.wy * el.L ** 4) / (384 * el.EI));
    Nmax = Math.max(Nmax, Math.abs(el.N));
    Mmax = Math.max(Mmax, el.Mabs);
    // Taux de travail (flexion composée simplifiée, Eurocode 5 pour le bois).
    const pr = el.P;
    const kmod = 0.8;
    const fam = el.mat.fam;
    const kf = fam === 'bois' ? kmod / 1.3 : fam === 'acier' ? 1 / 1.0 : 1 / 1.5;
    const sM = pr.Wy > 0 ? el.Mabs / pr.Wy / 1000 : 0; // MPa
    const sN = pr.A > 0 ? Math.abs(el.N) / pr.A / 1000 : 0; // MPa
    const fmd = (el.mat.fm || 24) * kf;
    const fnd = (el.N >= 0 ? el.mat.ft || 14 : el.mat.fc || 21) * kf;
    el.taux = (fmd > 0 ? sM / fmd : 0) + (fnd > 0 ? sN / fnd : 0);
  }
  // Réactions d'appui : somme des efforts d'extrémité ramenés au repère global.
  const reactions = new Map();
  for (const el of els) {
    const ug = el.dd.map((d) => u[d]);
    const ul = el.T.map((r) => r.reduce((s, v, i2) => s + v * ug[i2], 0));
    const fl = el.kl.map((r) => r.reduce((s, v, i2) => s + v * ul[i2], 0)).map((v, i2) => v - el.fl[i2]);
    const fg = new Array(6).fill(0);
    for (let r = 0; r < 6; r++) { let s = 0; for (let u2 = 0; u2 < 6; u2++) s += el.T[u2][r] * fl[u2]; fg[r] = s; }
    for (const [k2, nid] of [[0, el.a], [3, el.c]]) {
      if (!AP.has(nid)) continue;
      const v = reactions.get(nid) || [0, 0];
      v[0] += fg[k2];
      v[1] += fg[k2 + 1];
      reactions.set(nid, v);
    }
  }
  // Déplacements par nœud, pour la déformée.
  const depl = new Map();
  let dmax = 0;
  for (const nd2 of noeuds) {
    const i = idx.get(nd2.id);
    const v = [u[i * 3], u[i * 3 + 1], u[i * 3 + 2]];
    depl.set(nd2.id, v);
    dmax = Math.max(dmax, Math.hypot(v[0], v[1]));
  }
  // Garde-fou : un déplacement de plus d'un cinquième de la structure = mécanisme mal détecté.
  const xs = noeuds.map((q) => q.x), ys = noeuds.map((q) => q.y);
  const taille = Math.max(1, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
  if (!(dmax < taille * 0.2)) return { erreur: 'Structure instable ou bien trop souple (déplacement énorme) : ajoute un appui, un encastrement ou une diagonale.' };
  // Flèche en service (ELS) : le calcul est linéaire, on ramène la flèche ELU au rapport des charges totales.
  const qELU = els.reduce((s, e) => s + e.q * e.L, 0);
  const rELS = qELU > 0 ? els.reduce((s, e) => s + e.qels * e.L, 0) / qELU : 1;
  for (const e of els) { e.flecheELU = e.fleche; e.fleche *= rELS; }
  return { ...mo, els, depl, dmax, reactions, Nmax, Mmax, tauxMax: Math.max(0, ...els.map((e) => e.taux)) };
}
