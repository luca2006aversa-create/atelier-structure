// Rendu SVG : à l'écran (pixels, fond noir) et sur papier (mètres, fond blanc, pour les planches).
import { primitivesFeuille, boitePrims, boite, borne, fr } from './geometrie.js';

export const TXT_PX = { 1: 15, 2: 20, 3: 28 };
export const ORANGE = '#ff5a1f';
const ORANGE_SURVOL = 'rgba(255,90,31,.55)';

// Tailles des symboles et des textes pour un zoom z (pixels par mètre).
export function echelle(z) {
  return { su: 18 / z, cote: 13 / z, txt: { 1: TXT_PX[1] / z, 2: TXT_PX[2] / z, 3: TXT_PX[3] / z } };
}

// Styles : s = trait, w = épaisseur (px à l'écran), d = tirets, f = remplissage,
// creux = âme noire (aspect tube), g = graisse du texte.
const ECRAN = {
  poteau: { s: '#fff', w: 4 },
  poutre: { s: '#fff', w: 3.5 },
  bequille: { s: '#fff', w: 5, creux: 1.6 },
  entretoise: { s: '#fff', w: 2 },
  membrure: { s: '#fff', w: 2.5 },
  diagonale: { s: '#fff', w: 1.25 },
  cable: { s: '#fff', w: 1.5, d: [7, 5] },
  toile: { s: '#fff', w: 1.5 },
  dalle: { s: '#fff', w: 1, f: '#5a5a5a' },
  sol: { s: '#8c8c8c', w: 2 },
  hachure: { s: '#5a5a5a', w: 1 },
  mur: { s: '#8c8c8c', w: 1.5, d: [10, 6] },
  noeud: { f: '#8c8c8c' },
  rotule: { s: '#fff', w: 1.75, f: '#000' },
  rouleau: { s: '#fff', w: 1.5, f: '#000' },
  rigide: { f: '#fff' },
  appui: { s: '#fff', w: 1.5, f: '#000' },
  'appui-base': { s: '#fff', w: 2 },
  cote: { s: '#8c8c8c', w: 1 },
  'cote-tick': { s: '#fff', w: 1.5 },
  'cote-txt': { f: '#fff' },
  texte: { f: '#fff' },
  trait: { s: '#8c8c8c', w: 1.75 },
};

const PAPIER = {
  poteau: { s: '#000', w: 4 },
  poutre: { s: '#000', w: 3.5 },
  bequille: { s: '#e8743b', w: 4.5 },
  entretoise: { s: '#000', w: 2 },
  membrure: { s: '#000', w: 2.5 },
  diagonale: { s: '#000', w: 1.1 },
  cable: { s: '#000', w: 1.2, d: [7, 5] },
  toile: { s: '#000', w: 1.5 },
  dalle: { s: '#000', w: 1, f: '#000' },
  sol: { s: '#000', w: 2 },
  hachure: { s: '#000', w: 0.8 },
  mur: { s: '#555', w: 1.3, d: [10, 6] },
  rotule: { s: '#000', w: 1.5, f: '#fff' },
  rouleau: { s: '#000', w: 1.3, f: '#fff' },
  rigide: { f: '#000' },
  appui: { s: '#000', w: 1.5, f: '#fff' },
  'appui-base': { s: '#000', w: 2 },
  cote: { s: '#888', w: 0.8 },
  'cote-tick': { s: '#000', w: 1.3 },
  'cote-txt': { f: '#000', g: 600 },
  texte: { f: '#000' },
  trait: { s: '#888', w: 1.3 },
};

export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Une forme en SVG. T = { X, Y (monde → sortie), L (unités par mètre), k (échelle des épaisseurs), q (arrondi) }.
// etat : 0 normal, 1 survolé, 2 sélectionné.
function forme(pr, sty, etat, T) {
  if (!sty) return '';
  const { X, Y, L, k, q } = T;
  let s = sty.s;
  let f = sty.f;
  if (etat) {
    const c = etat === 2 ? ORANGE : ORANGE_SURVOL;
    if (pr.k === 't' || !s) f = c;
    else {
      s = c;
      if (f && pr.k === 'p') f = etat === 2 ? 'rgba(255,90,31,.3)' : 'rgba(255,90,31,.15)';
    }
  }
  if (pr.k === 't') {
    const x = q(X(pr.c[0]));
    const y = q(Y(pr.c[1]));
    const rot = pr.ang ? ` transform="rotate(${q(-pr.ang)} ${x} ${y})"` : '';
    const g = sty.g ? ` font-weight="${sty.g}"` : '';
    return `<text x="${x}" y="${y}" font-size="${q(pr.h * L)}" text-anchor="${pr.ancre || 'start'}" fill="${f}"${g}${rot}>${esc(pr.txt)}</text>`;
  }
  let a = ` fill="${f || 'none'}"`;
  if (s) {
    a += ` stroke="${s}" stroke-width="${q(sty.w * k)}"`;
    if (sty.d) a += ` stroke-dasharray="${sty.d.map((v) => q(v * k)).join(' ')}"`;
  }
  if (pr.k === 'l') {
    const c = `x1="${q(X(pr.p[0][0]))}" y1="${q(Y(pr.p[0][1]))}" x2="${q(X(pr.p[1][0]))}" y2="${q(Y(pr.p[1][1]))}"`;
    let out = `<line ${c}${a}/>`;
    if (sty.creux) out += `<line ${c} stroke="#000" stroke-width="${q(sty.creux * k)}"/>`;
    return out;
  }
  if (pr.k === 'p') {
    const pts = pr.p.map((p) => `${q(X(p[0]))},${q(Y(p[1]))}`).join(' ');
    return `<${pr.ferme ? 'polygon' : 'polyline'} points="${pts}"${a}/>`;
  }
  if (pr.k === 'c') return `<circle cx="${q(X(pr.c[0]))}" cy="${q(Y(pr.c[1]))}" r="${q(pr.r * L)}"${a}/>`;
  return '';
}

const q1 = (v) => Math.round(v * 10) / 10;
const q3 = (v) => Math.round(v * 1000) / 1000;

export function transformEcran(vue, W, H) {
  const z = vue.z;
  return { X: (x) => W / 2 + (x - vue.cx) * z, Y: (y) => H / 2 - (y - vue.cy) * z, L: z, k: 1, q: q1 };
}

// Formes à l'écran : sel = Set des ids sélectionnés, survol = id survolé.
export function svgEcran(prims, vue, W, H, sel, survol) {
  const T = transformEcran(vue, W, H);
  let s = '';
  for (const pr of prims) s += forme(pr, ECRAN[pr.st], sel.has(pr.id) ? 2 : pr.id === survol ? 1 : 0, T);
  return s;
}

// Planche SVG d'une feuille : fond blanc, unités en mètres, y vers le haut (svgY = -y).
export function svgPapier(f) {
  const b0 = boite(f) || { x0: -5, y0: 0, x1: 5, y1: 5 };
  const taille = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, 2);
  const su = borne(taille / 45, 0.02, 3);
  const prims = primitivesFeuille(f, echelle(18 / su), false);
  if (!f.barres.some((b) => b.type === 'sol') && f.noeuds.some((n) => Math.abs(n.y) < 1e-3)) {
    prims.unshift({ k: 'l', st: 'sol', id: 'sol0', p: [[b0.x0 - 2 * su, 0], [b0.x1 + 2 * su, 0]] });
  }
  const bb = boitePrims(prims) || { x0: -5, y0: 0, x1: 5, y1: 5 };
  const m = 2 * su;
  const gauche = bb.x0 - m;
  const haut = -bb.y1 - m - 3 * su;
  const larg = bb.x1 - bb.x0 + 2 * m;
  const hauteur = bb.y1 - bb.y0 + 2 * m + 3 * su;
  const T = { X: (x) => x, Y: (y) => -y, L: 1, k: su / 18, q: q3 };
  let corps = '';
  for (const pr of prims) corps += forme(pr, PAPIER[pr.st], 0, T);
  const ppm = 1600 / Math.max(larg, hauteur);
  const date = new Date().toLocaleDateString('fr-FR');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${q3(gauche)} ${q3(haut)} ${q3(larg)} ${q3(hauteur)}" width="${Math.round(larg * ppm)}" height="${Math.round(hauteur * ppm)}" font-family="Inter Tight, Arial, sans-serif">
<rect x="${q3(gauche)}" y="${q3(haut)}" width="${q3(larg)}" height="${q3(hauteur)}" fill="#fff"/>
<text x="${q3(gauche + m)}" y="${q3(haut + 2.2 * su)}" font-size="${q3(1.2 * su)}" font-weight="700" fill="#000">${esc(f.nom)}</text>
<text x="${q3(gauche + m)}" y="${q3(haut + 3.15 * su)}" font-size="${q3(0.6 * su)}" fill="#666">Atelier structure · 1 unité = 1 m · ${date}</text>
<g stroke-linecap="round" stroke-linejoin="round">
${corps}
</g>
</svg>
`;
}

// Grille : pas fin (au moins 9 px), gros pas (au moins 60 px, multiple du fin), axes et chiffres.
const PAS_FINS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const PAS_GROS = [1, 5, 10, 50, 100, 500, 1000];

export function svgGrille(vue, W, H, pas) {
  const z = vue.z;
  const fin = PAS_FINS.find((p) => p >= pas - 1e-9 && p * z >= 9) ?? 500;
  const gros = PAS_GROS.find((p) => p > fin + 1e-9 && p * z >= 60 && Math.abs(p / fin - Math.round(p / fin)) < 1e-6) ?? 1000;
  const x0 = vue.cx - W / 2 / z;
  const x1 = vue.cx + W / 2 / z;
  const y0 = vue.cy - H / 2 / z;
  const y1 = vue.cy + H / 2 / z;
  const X = (x) => (W / 2 + (x - vue.cx) * z).toFixed(1);
  const Y = (y) => (H / 2 - (y - vue.cy) * z).toFixed(1);
  const chemin = (p) => {
    let d = '';
    for (let i = Math.ceil(x0 / p); i <= Math.floor(x1 / p); i++) d += `M${X(i * p)} 0V${H}`;
    for (let j = Math.ceil(y0 / p); j <= Math.floor(y1 / p); j++) d += `M0 ${Y(j * p)}H${W}`;
    return d;
  };
  let s = `<path d="${chemin(fin)}" stroke="#151515" stroke-width="1" fill="none"/>`;
  s += `<path d="${chemin(gros)}" stroke="#262626" stroke-width="1" fill="none"/>`;
  s += `<path d="M${X(0)} 0V${H}M0 ${Y(0)}H${W}" stroke="#5a5a5a" stroke-width="1" fill="none"/>`;
  let t = '';
  for (let i = Math.ceil(x0 / gros); i <= Math.floor(x1 / gros); i++) t += `<text x="${(+X(i * gros) + 4).toFixed(1)}" y="16">${fr(i * gros)}</text>`;
  for (let j = Math.ceil(y0 / gros); j <= Math.floor(y1 / gros); j++) t += `<text x="6" y="${(+Y(j * gros) - 4).toFixed(1)}">${fr(j * gros)}</text>`;
  return s + `<g fill="#8c8c8c" font-size="11">${t}</g>`;
}

// Filtre qui inverse les couleurs d'un croquis (papier blanc → fond noir).
export const DEFS = '<defs><filter id="inverser" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter></defs>';
