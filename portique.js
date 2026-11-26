// Calcul de portique plan : chaque barre devient un élément de poutre (3 degrés de liberté par nœud).
// On en tire l'effort normal, le moment, la déformée et le taux de travail — de quoi dessiner le schéma structurel.
// Unités : mètres, kilonewtons. x vers la droite, y vers le haut.
import { carteNoeuds, dist, lerp, unite, sub, add, mul, versLeBas } from './geometrie.js';
import { chargesBarre, chargesNoeud, position, ELU } from './charges.js';
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
const APPUIS = new Set(['appui', 'encastrement', 'glissant']);
function appuis(noeuds, y0) {
  const choisis = noeuds.filter((n) => APPUIS.has(n.type));
  if (choisis.length) return new Map(choisis.map((n) => [n.id, n.type]));
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
// Un treillis est découpé en ses vraies pièces (membrures, diagonales, montants) ; un objet posé sur une barre
// la coupe en deux à cet endroit : le calcul voit alors une force en un nœud.
export function modele(f) {
  const N = carteNoeuds(f);
  const C = chargesDe(f);
  const entraxe = Math.max(0.5, +(f.trois_d || {}).entraxe || 6);
  // 1. Une ligne par barre porteuse : son axe dessiné.
  const pre = [];
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
    // Un câble ne plie pas : il ne fait que tirer. On annule sa raideur de flexion.
    if (b.type === 'cable') P = { ...P, Iy: P.Iy * 1e-6, Wy: P.Wy * 1e6 };
    const M = matiereDe(b);
    const cle = Object.keys(MATIERES).find((k) => MATIERES[k] === M) || 'gl24h';
    pre.push({ b, A, B, L, P, M, cle, E: M.E * 1000, plat: Math.abs(B[1] - A[1]) / L < PLAT, poids: poidsML(b) });
  }
  if (!pre.length) return { erreur: 'Pas de barre porteuse : dessine des poteaux et des poutres.' };
  // 2. Charges réparties par barre (kN/m, sans le poids propre) : toiture ou plancher, plus ce qu'on a ajouté.
  for (const p of pre) {
    let g = 0;
    let v = 0;
    if (p.plat && p.b.type !== 'diagonale' && p.b.type !== 'cable') {
      const sous = abritee(p, pre);
      g = (sous ? C.plancherG : C.toitG) * entraxe;
      v = (sous ? C.exploitation : C.neige) * entraxe;
    }
    for (const c of chargesBarre(p.b)) {
      if (c.k === 'ponctuelle') continue;
      const w = c.k === 'surface' ? +c.v * entraxe : +c.v;
      if (c.cat === 'G') g += w; else v += w;
    }
    p.qg = g;
    p.qv = v;
  }
  // 3. Nœuds : ceux de la feuille, plus ceux qu'on crée (nœuds du treillis, points où pèse un objet).
  const noeuds = [];
  const parId = new Map();
  let neuf = 0;
  const garder = (n) => { if (!parId.has(n.id)) { parId.set(n.id, n); noeuds.push(n); } return n.id; };
  const pointEn = (x, y) => {
    for (const n of f.noeuds) if (Math.abs(n.x - x) < 0.03 && Math.abs(n.y - y) < 0.03) return garder(n);
    for (const n of noeuds) if (Math.abs(n.x - x) < 0.03 && Math.abs(n.y - y) < 0.03) return n.id;
    return garder({ id: '·' + (++neuf), x, y, cree: true });
  };
  // Forces en un nœud (vers le bas, kN) : ELU et service.
  const forces = new Map();
  const listeForces = [];
  const pousserForce = (id, c) => {
    const n = parId.get(id);
    if (!n) return;
    const v = forces.get(id) || { elu: 0, els: 0 };
    v.elu += (ELU[c.cat] || 1.5) * +c.v;
    v.els += +c.v;
    forces.set(id, v);
    listeForces.push({ id, x: n.x, y: n.y, v: +c.v, nom: c.nom || '' });
  };
  // 4. Éléments.
  const els = [];
  const lignes = [];
  const element = (p, a, c, role, qSurf) => {
    const na = parId.get(a);
    const nc = parId.get(c);
    const A = [na.x, na.y];
    const B = [nc.x, nc.y];
    const L = dist(A, B);
    if (L < 0.02) return;
    els.push({
      b: p.b, id: p.b.id, role, a, c, A, B, L, P: p.P, mat: p.M, cle: p.cle, E: p.E,
      plat: Math.abs(B[1] - A[1]) / L < PLAT,
      secondaire: role === 'diagonale' || role === 'montant',
      poids: p.poids,
      q: qSurf.elu + 1.35 * p.poids, // kN/m, vers le bas
      qels: qSurf.els + p.poids, // service (ELS) : sans majoration, pour la flèche
    });
  };
  const AUCUNE = { elu: 0, els: 0 };
  for (const p of pre) {
    const b = p.b;
    const qs = { elu: 1.35 * p.qg + 1.5 * p.qv, els: p.qg + p.qv };
    const objets = chargesBarre(b).filter((c) => c.k === 'ponctuelle');
    if (b.type === 'treillis') {
      const t = b.treillis || {};
      const n = Math.max(1, Math.round(t.n || 6));
      const sens = t.sens === -1 ? -1 : 1;
      const off = mul(versLeBas(unite(sub(p.B, p.A))), -(t.h ?? 1.5) * sens);
      const A2 = add(p.A, off);
      const B2 = add(p.B, off);
      const Pi = [];
      const Qi = [];
      for (let i = 0; i <= n; i++) {
        Pi.push(i === 0 ? garder(N.get(b.a)) : i === n ? garder(N.get(b.b)) : pointEn(...lerp(p.A, p.B, i / n)));
        Qi.push(pointEn(...lerp(A2, B2, i / n)));
      }
      const hautQ = A2[1] + B2[1] > p.A[1] + p.B[1];
      const H = hautQ ? Qi : Pi;
      const Bs = hautQ ? Pi : Qi;
      for (let i = 0; i < n; i++) {
        element(p, H[i], H[i + 1], 'membrure haute', qs);
        element(p, Bs[i], Bs[i + 1], 'membrure basse', AUCUNE);
      }
      const D = (x, y) => element(p, x, y, 'diagonale', AUCUNE);
      const Mt = (i) => element(p, Pi[i], Qi[i], 'montant', AUCUNE);
      const forme = t.forme || 'warren';
      if (forme === 'warren' || forme === 'warren_m') {
        for (let i = 0; i < n; i++) { if (i % 2 === 0) D(Pi[i], Qi[i + 1]); else D(Qi[i], Pi[i + 1]); }
        Mt(0);
        Mt(n);
        if (forme === 'warren_m') for (let i = 1; i < n; i++) Mt(i);
      } else {
        for (let i = 0; i <= n; i++) Mt(i);
        const Ht = sens === 1 ? Qi : Pi;
        const Bt = sens === 1 ? Pi : Qi;
        const pratt = forme === 'pratt';
        for (let i = 0; i < n; i++) {
          const gauche = (i + 0.5) < n / 2;
          if (gauche === pratt) D(Ht[i], Bt[i + 1]); else D(Ht[i + 1], Bt[i]);
        }
      }
      // Un objet sur un treillis pèse sur le nœud de la membrure haute le plus proche.
      for (const c of objets) pousserForce(H[Math.round(position(c) * n)], c);
      if (qs.elu > 0) lignes.push({ A: parId.get(H[0]), B: parId.get(H[n]), q: qs.elu });
      continue;
    }
    // Barre simple : coupée aux objets qu'elle porte.
    const ts = [...new Set(objets.map(position))].sort((x, y) => x - y);
    const ids = [garder(N.get(b.a))];
    const idDe = new Map();
    for (const t of ts) {
      if (t <= 0.001) { idDe.set(t, ids[0]); continue; }
      if (t >= 0.999) continue;
      const id = pointEn(...lerp(p.A, p.B, t));
      if (id !== ids[ids.length - 1]) ids.push(id);
      idDe.set(t, id);
    }
    const fin = garder(N.get(b.b));
    if (fin !== ids[ids.length - 1]) ids.push(fin);
    for (const t of ts) if (t >= 0.999) idDe.set(t, fin);
    for (let i = 0; i < ids.length - 1; i++) element(p, ids[i], ids[i + 1], null, qs);
    for (const c of objets) pousserForce(idDe.get(position(c)), c);
    if (qs.elu > 0) lignes.push({ A: { x: p.A[0], y: p.A[1] }, B: { x: p.B[0], y: p.B[1] }, q: qs.elu });
  }
  // Objets accrochés directement à un nœud.
  for (const nd of f.noeuds) for (const c of chargesNoeud(nd)) if (parId.has(nd.id)) pousserForce(nd.id, c);
  if (noeuds.length > MAX_NOEUDS) return { erreur: 'Trop de nœuds (' + noeuds.length + ') : le calcul s\'arrête à ' + MAX_NOEUDS + '.' };
  const y0 = Math.min(...noeuds.map((n) => n.y));
  return { els, noeuds, appuis: appuis(noeuds.filter((n) => !n.cree), y0), y0, entraxe, forces, listeForces, lignes };
}

const nb2 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

// Rotules : quels bouts de barre ne transmettent pas le moment ? Clé 'idNœud|indexÉlément'.
// À une rotule, on garde rigide la barre « passante » (deux barres alignées : poteau passant par défaut,
// ou ce que dit la jonction du nœud) ; toutes les autres y sont articulées.
function liberations(els, noeuds) {
  const out = new Set();
  for (const n of noeuds) {
    if (n.type !== 'rotule') continue;
    const ici = [];
    els.forEach((el, i) => {
      if (el.a !== n.id && el.c !== n.id) return;
      const autre = el.a === n.id ? el.B : el.A;
      const d = [autre[0] - n.x, autre[1] - n.y];
      const L = Math.hypot(d[0], d[1]) || 1;
      ici.push({ i, el, u: [d[0] / L, d[1] / L] });
    });
    if (ici.length < 2) continue;
    // Meilleure paire alignée (sens opposés).
    let garde = [ici[0]];
    let meilleur = -Infinity;
    for (let a = 0; a < ici.length; a++) for (let b = a + 1; b < ici.length; b++) {
      const A = ici[a], B = ici[b];
      const cos = A.u[0] * B.u[0] + A.u[1] * B.u[1];
      if (cos > -0.98) continue;
      const vertical = Math.abs(A.u[1]) > 0.7;
      const voulu = n.jonction === 'horizontal' ? !vertical : n.jonction === 'vertical' ? vertical : vertical;
      const score = (voulu ? 4 : 0) + (A.el.b.type === B.el.b.type ? 2 : 0) + (A.el.secondaire || B.el.secondaire ? -3 : 0);
      if (score > meilleur) { meilleur = score; garde = [A, B]; }
    }
    const gardes = new Set(garde.map((g) => g.i));
    for (const g of ici) if (!gardes.has(g.i)) out.add(n.id + '|' + g.i);
  }
  return out;
}

// Rotations propres des bouts articulés : celles qui annulent le moment à ce bout (repère local).
function rotationsLibres(el, ul) {
  const ur = ul.slice();
  const L = el.lib || [];
  if (!L.length) return ur;
  const k = el.kl0;
  const f = el.fl0;
  const reste = (r) => f[r] - [0, 1, 2, 3, 4, 5].filter((c) => !L.includes(c)).reduce((s2, c) => s2 + k[r][c] * ul[c], 0);
  if (L.length === 1) {
    const r = L[0];
    if (k[r][r] > 0) ur[r] = reste(r) / k[r][r];
  } else {
    const [a, b] = L;
    const det = k[a][a] * k[b][b] - k[a][b] * k[b][a];
    if (Math.abs(det) > 1e-12) {
      const ra = reste(a), rb = reste(b);
      ur[a] = (ra * k[b][b] - k[a][b] * rb) / det;
      ur[b] = (k[a][a] * rb - k[b][a] * ra) / det;
    }
  }
  return ur;
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
    if (t !== 'glissant') bloque[i * 3] = 1;
    bloque[i * 3 + 1] = 1;
    if (t === 'encastrement') bloque[i * 3 + 2] = 1;
  }
  const nomsAP = [...AP.keys()].join(', ');
  const nBloques = bloque.reduce((s2, v) => s2 + v, 0);
  if (nBloques < 3 || ![...AP.values()].some((t) => t !== 'glissant')) {
    const seul = AP.size === 1;
    return { erreur: (seul ? '1 seul appui articulé (' + nomsAP + ')' : 'Pas assez d\'appuis (' + (nomsAP || 'aucun') + ')')
      + ' : la structure peut tourner ou glisser. Mets un nœud du pied en « Encastré », ou ajoute un 2e « Appui ».' };
  }
  const rel = liberations(els, noeuds);
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
    // Rotule : le moment ne passe pas à ce bout de barre (condensation statique).
    const lib = [rel.has(el.a + '|' + els.indexOf(el)) ? 2 : -1, rel.has(el.c + '|' + els.indexOf(el)) ? 5 : -1].filter((x) => x >= 0);
    const kl0 = kl.map((r) => r.slice());
    el.lib = lib;
    el.kl0 = kl0;
    for (const r of lib) {
      const d = kl[r][r];
      if (!(d > 0)) continue;
      const col = kl.map((row) => row[r]);
      const ligne = kl[r].slice();
      for (let a2 = 0; a2 < 6; a2++) for (let c2 = 0; c2 < 6; c2++) kl[a2][c2] -= (col[a2] * ligne[c2]) / d;
    }
    if (lib.length) {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        let s3 = 0;
        for (let u = 0; u < 6; u++) for (let v = 0; v < 6; v++) s3 += T[u][r] * kl[u][v] * T[v][c];
        kg[r][c] = s3;
      }
    }
    el.kl = kl;
    el.T = T;
    el.kg = kg;
    // Charge répartie verticale (0, -q) ramenée au repère local, puis aux nœuds.
    const wx = -el.q * sth;
    const wy = -el.q * cth;
    const fl = [(wx * L) / 2, (wy * L) / 2, (wy * L * L) / 12, (wx * L) / 2, (wy * L) / 2, (-wy * L * L) / 12];
    el.fl0 = fl.slice();
    {
      const kk = kl0.map((r) => r.slice());
      for (const r of lib) {
        const d = kk[r][r];
        if (!(d > 0)) continue;
        const col = kk.map((row) => row[r]);
        const fr = fl[r];
        for (let a2 = 0; a2 < 6; a2++) fl[a2] -= (col[a2] * fr) / d;
        const ligne = kk[r].slice();
        for (let a2 = 0; a2 < 6; a2++) for (let c2 = 0; c2 < 6; c2++) kk[a2][c2] -= (col[a2] * ligne[c2]) / d;
      }
    }
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
  // Objets posés : une force verticale vers le bas au nœud.
  for (const [id, F] of mo.forces) {
    const i = idx.get(id);
    const g = i === undefined ? -1 : num[i * 3 + 1];
    if (g >= 0) P[g] -= F.elu;
  }
  const U = resoudre(K, P, n);
  if (!U) return { erreur: 'Structure instable : une partie peut bouger librement (appuis : ' + nomsAP + '). Ajoute une diagonale, un appui, ou passe une rotule en « Rigide ».' };
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
    const ur = rotationsLibres(el, ul);
    el.fleche = Math.abs((el.L * (ur[2] - ur[5])) / 8 + (el.wy * el.L ** 4) / (384 * el.EI));
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
  // Un objet posé pile sur un appui descend directement au sol.
  for (const [id, F] of mo.forces) {
    if (!AP.has(id)) continue;
    const v = reactions.get(id) || [0, 0];
    v[1] += F.elu;
    reactions.set(id, v);
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
  if (!(dmax < taille * 5)) return { erreur: 'Structure instable (déplacement de ' + nb2(dmax) + ' m pour ' + nb2(taille) + ' m de structure) : ajoute un appui, un encastrement ou une diagonale.' };
  const alerte = dmax > taille * 0.02
    ? 'Bien trop souple : ça bouge de ' + nb2(dmax) + ' m. En vrai, ça casserait — encastre le pied, ajoute un appui ou une béquille, grossis les sections.'
    : '';
  // Flèche en service (ELS) : le calcul est linéaire, on ramène la flèche ELU au rapport des charges totales.
  let qELU = els.reduce((s, e) => s + e.q * e.L, 0);
  let qELS = els.reduce((s, e) => s + e.qels * e.L, 0);
  for (const F of mo.forces.values()) { qELU += F.elu; qELS += F.els; }
  const rELS = qELU > 0 ? qELS / qELU : 1;
  for (const e of els) { e.flecheELU = e.fleche; e.fleche *= rELS; }
  return { ...mo, els, depl, dmax, taille, alerte, reactions, Nmax, Mmax, tauxMax: Math.max(0, ...els.map((e) => e.taux)) };
}
