// Schéma structurel : dessiné tout seul à partir de la feuille et du calcul de portique.
// Cinq lectures : le schéma statique, l'effort normal, le moment, la déformée, le taux de travail.
import { calculer } from './portique.js';
import { texteSection } from './matieres.js';
import { esc } from './rendu.js';

export const MODES = [
  ['statique', 'Statique', 'Appuis, charges et portées'],
  ['normal', 'Effort normal', 'Ce qui est comprimé, ce qui est tiré'],
  ['moment', 'Moment', 'Là où ça plie'],
  ['deformee', 'Déformée', 'Comment ça bouge, en exagéré'],
  ['taux', 'Taux de travail', 'Part de la résistance utilisée'],
];

const BLANC = '#f2f2f2';
const GRIS = '#8c8c8c';
const FAIBLE = '#5a5a5a';
const ORANGE = '#ff5a1f';
const FOND = '#101010';

const r1 = (v) => Math.round(v * 10) / 10;
const nb = (v, d = 1) => (Math.abs(v) < 0.05 ? '0' : v.toFixed(d).replace('.', ','));
// Du gris au orange : plus une barre travaille, plus elle chauffe.
const chaleur = (t) => {
  const k = Math.max(0, Math.min(1, t));
  const a = [120, 120, 120];
  const b = [255, 90, 31];
  return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';
};

// ---------- Mise en page ----------
function cadre(R, W, H, marge, haut = marge) {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const el of R.els) for (const p of [el.A, el.B]) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  // « haut » : place gardée au-dessus pour les flèches des objets posés.
  const Hu = H - marge - haut;
  const s = Math.min((W - 2 * marge) / Math.max(0.5, x1 - x0), Hu / Math.max(0.5, y1 - y0));
  const cx = (x0 + x1) / 2;
  const dy = (Hu - (y1 - y0) * s) / 2;
  return { s, X: (x) => W / 2 + (x - cx) * s, Y: (y) => haut + dy + (y1 - y) * s, y0, y1, x0, x1 };
}

const ligne = (V, A, B, st) => `<line x1="${r1(V.X(A[0]))}" y1="${r1(V.Y(A[1]))}" x2="${r1(V.X(B[0]))}" y2="${r1(V.Y(B[1]))}" ${st}/>`;
const texte = (x, y, t, col = GRIS, px = 11, anc = 'middle') =>
  `<text x="${r1(x)}" y="${r1(y)}" fill="${col}" font-size="${px}" text-anchor="${anc}" font-family="'Inter Tight',sans-serif">${esc(t)}</text>`;

// Flèche droite, pointe sur (x2,y2).
function fleche(x1, y1, x2, y2, col, ep = 1.2, tete = 5) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (k) => `${r1(x2 - tete * Math.cos(a + k))},${r1(y2 - tete * Math.sin(a + k))}`;
  return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${col}" stroke-width="${ep}"/>`
    + `<polygon points="${r1(x2)},${r1(y2)} ${p(0.4)} ${p(-0.4)}" fill="${col}"/>`;
}

// Appui : triangle (articulation) ou socle hachuré (encastrement).
function appui(x, y, type) {
  const h = 13;
  const d = 9;
  let o = `<polygon points="${r1(x)},${r1(y)} ${r1(x - d)},${r1(y + h)} ${r1(x + d)},${r1(y + h)}" fill="none" stroke="${BLANC}" stroke-width="1.3"/>`;
  if (type === 'encastrement') o = `<line x1="${r1(x - d)}" y1="${r1(y)}" x2="${r1(x + d)}" y2="${r1(y)}" stroke="${BLANC}" stroke-width="1.6"/>`;
  const yb = type === 'encastrement' ? y : y + h;
  o += `<line x1="${r1(x - d - 3)}" y1="${r1(yb)}" x2="${r1(x + d + 3)}" y2="${r1(yb)}" stroke="${BLANC}" stroke-width="1.3"/>`;
  for (let i = -3; i <= 3; i++) {
    const px = x + i * 4;
    o += `<line x1="${r1(px)}" y1="${r1(yb)}" x2="${r1(px - 4)}" y2="${r1(yb + 5)}" stroke="${GRIS}" stroke-width="1"/>`;
  }
  return o;
}

// Cote horizontale sous le dessin.
function cote(xa, xb, y, t) {
  const g = 4;
  return `<line x1="${r1(xa)}" y1="${r1(y)}" x2="${r1(xb)}" y2="${r1(y)}" stroke="${FAIBLE}" stroke-width="1"/>`
    + `<line x1="${r1(xa)}" y1="${r1(y - g)}" x2="${r1(xa)}" y2="${r1(y + g)}" stroke="${FAIBLE}" stroke-width="1"/>`
    + `<line x1="${r1(xb)}" y1="${r1(y - g)}" x2="${r1(xb)}" y2="${r1(y + g)}" stroke="${FAIBLE}" stroke-width="1"/>`
    + texte((xa + xb) / 2, y - 6, t, GRIS, 11);
}

// Épaisseur d'une pièce : les membrures d'un treillis sont plus fortes que ses diagonales.
const epaisseur = (el, base) => (el.secondaire ? base * 0.55 : base);
// Nœuds intérieurs d'un treillis : petits ronds, comme des articulations.
function noeudsTreillis(R, V, col = BLANC) {
  const vus = new Set();
  let o = '';
  for (const el of R.els) {
    if (el.b.type !== 'treillis') continue;
    for (const [id, p] of [[el.a, el.A], [el.c, el.B]]) {
      if (vus.has(id)) continue;
      vus.add(id);
      o += `<circle cx="${r1(V.X(p[0]))}" cy="${r1(V.Y(p[1]))}" r="2.6" fill="${FOND}" stroke="${col}" stroke-width="1.1"/>`;
    }
  }
  return o;
}
// Étiquettes qui s'écartent quand elles se touchent.
function etiqueteur() {
  const pris = [];
  return (x, y, nx, ny, larg) => {
    for (const dec of [0, 14, -14, 28, -28]) {
      const tx = x + nx * dec;
      const ty = y + ny * dec;
      if (!pris.some((p) => Math.abs(p[0] - tx) < (p[2] + larg) / 2 + 2 && Math.abs(p[1] - ty) < 15)) { pris.push([tx, ty, larg]); return [tx, ty]; }
    }
    return null;
  };
}

// ---------- Les cinq lectures ----------
function vueStatique(R, V, W, H) {
  let o = '';
  for (const el of R.els) o += ligne(V, el.A, el.B, `stroke="${BLANC}" stroke-width="${epaisseur(el, 1.6)}" stroke-linecap="round"`);
  o += noeudsTreillis(R, V);
  // Charges réparties : un trait et des flèches qui tombent sur la barre (une seule fois par barre, même découpée).
  const qmax = Math.max(1e-6, ...R.lignes.map((l) => l.q));
  for (const l of R.lignes) {
    if (l.q < qmax * 0.05) continue;
    const d = 10 + 16 * (l.q / qmax);
    const A = [V.X(l.A.x), V.Y(l.A.y)];
    const B = [V.X(l.B.x), V.Y(l.B.y)];
    const n = Math.max(2, Math.min(12, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 34)));
    o += `<line x1="${r1(A[0])}" y1="${r1(A[1] - d)}" x2="${r1(B[0])}" y2="${r1(B[1] - d)}" stroke="${ORANGE}" stroke-width="1.2"/>`;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = A[0] + (B[0] - A[0]) * t;
      const y = A[1] + (B[1] - A[1]) * t;
      o += fleche(x, y - d, x, y - 2, ORANGE, 1, 4);
    }
    o += texte((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - d - 6, nb(l.q) + ' kN/m', ORANGE, 11);
  }
  // Objets posés : une grosse flèche et leur poids.
  const parNoeud = new Map();
  for (const F of R.listeForces) {
    const v = parNoeud.get(F.id) || { x: F.x, y: F.y, v: 0, noms: [] };
    v.v += F.v;
    if (F.nom) v.noms.push(F.nom);
    parNoeud.set(F.id, v);
  }
  for (const F of parNoeud.values()) {
    const x = V.X(F.x);
    const y = V.Y(F.y);
    o += fleche(x, y - 46, x, y - 3, ORANGE, 2.4, 8);
    const nom = F.noms.length === 1 ? F.noms[0] : F.noms.length ? F.noms.length + ' objets' : '';
    o += texte(x, y - 64, nom, ORANGE, 11);
    o += texte(x, y - 51, nb(F.v) + ' kN', ORANGE, 11);
  }
  // Appuis et réactions.
  const ybas = V.Y(V.y0);
  for (const [id, t] of R.appuis) {
    const n = R.noeuds.find((q) => q.id === id);
    if (!n) continue;
    o += appui(V.X(n.x), V.Y(n.y), t);
    const re = R.reactions.get(id);
    if (re) o += texte(V.X(n.x), V.Y(n.y) + 34, nb(Math.abs(re[1])) + ' kN', BLANC, 11);
  }
  // Portées entre appuis.
  const xs = [...R.appuis.keys()].map((id) => R.noeuds.find((q) => q.id === id)).filter(Boolean).map((n) => n.x).sort((a, b) => a - b);
  const yc = Math.min(H - 14, ybas + 58);
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i + 1] - xs[i] < 0.2) continue;
    o += cote(V.X(xs[i]), V.X(xs[i + 1]), yc, nb(xs[i + 1] - xs[i], 2) + ' m');
  }
  return o;
}

function vueNormal(R, V) {
  let o = '';
  const m = Math.max(1e-6, R.Nmax);
  for (const el of R.els) {
    const t = Math.abs(el.N) / m;
    const col = el.N >= 0 ? ORANGE : BLANC;
    o += ligne(V, el.A, el.B, `stroke="${col}" stroke-width="${r1(1 + 6 * t)}" stroke-linecap="round" opacity="${r1(0.35 + 0.65 * t)}"`);
  }
  o += noeudsTreillis(R, V, GRIS);
  const place = etiqueteur();
  for (const el of R.els.slice().sort((a, b) => Math.abs(b.N) - Math.abs(a.N))) {
    if (Math.abs(el.N) < m * 0.12) continue;
    const ax = V.X(el.A[0]); const ay = V.Y(el.A[1]); const bx = V.X(el.B[0]); const by = V.Y(el.B[1]);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const p = place((ax + bx) / 2, (ay + by) / 2, -(by - ay) / L, (bx - ax) / L, 52);
    if (!p) continue;
    o += `<rect x="${r1(p[0] - 26)}" y="${r1(p[1] - 8)}" width="52" height="15" rx="3" fill="${FOND}" opacity=".8"/>`;
    o += texte(p[0], p[1] + 4, (el.N >= 0 ? '+' : '−') + nb(Math.abs(el.N)), el.N >= 0 ? ORANGE : BLANC, 11);
  }
  return o;
}

function vueMoment(R, V) {
  let o = '';
  let etiq = '';
  const m = Math.max(1e-6, R.Mmax);
  const ech = 46 / m; // px par kN·m
  for (const el of R.els) o += ligne(V, el.A, el.B, `stroke="${FAIBLE}" stroke-width="1.2"`);
  // On n'écrit que les quatre plus gros moments : sinon les chiffres se marchent dessus.
  const gros = new Set(R.els.slice().sort((a, b) => b.Mabs - a.Mabs).slice(0, 4).filter((e) => e.Mabs > m * 0.08));
  for (const el of R.els) {
    if (el.Mabs < m * 0.02) continue;
    const ax = V.X(el.A[0]);
    const ay = V.Y(el.A[1]);
    const bx = V.X(el.B[0]);
    const by = V.Y(el.B[1]);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    // Normale au côté tendu : un moment positif tend la fibre du bas.
    const nx = -(by - ay) / L;
    const ny = (bx - ax) / L;
    const pts = [];
    const n = 16;
    let ipic = 0;
    let Mpic = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const Mi = el.M[0] * (1 - t) + el.M[1] * t + 4 * (el.Mmi - (el.M[0] + el.M[1]) / 2) * t * (1 - t);
      if (Math.abs(Mi) > Math.abs(Mpic)) { Mpic = Mi; ipic = i; }
      const dd = -Mi * ech;
      pts.push([ax + (bx - ax) * t + nx * dd, ay + (by - ay) * t + ny * dd]);
    }
    const chemin = pts.map((p, i) => (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1])).join(' ');
    o += `<path d="${chemin} L${r1(bx)} ${r1(by)} L${r1(ax)} ${r1(ay)} Z" fill="${ORANGE}" opacity=".18"/>`;
    o += `<path d="${chemin}" fill="none" stroke="${ORANGE}" stroke-width="1.3"/>`;
    if (!gros.has(el)) continue;
    // L'étiquette va au sommet du diagramme, décalée vers l'extérieur.
    const p = pts[ipic];
    const sg = Mpic >= 0 ? 1 : -1;
    const tx = p[0] - nx * sg * 12;
    const ty = p[1] - ny * sg * 12 + 4;
    etiq += `<rect x="${r1(tx - 33)}" y="${r1(ty - 12)}" width="66" height="16" rx="3" fill="${FOND}" opacity=".85"/>`;
    etiq += texte(tx, ty, nb(Mpic) + ' kN·m', ORANGE, 11);
  }
  return o + etiq;
}
function vueDeformee(R, V) {
  let o = '';
  // Amplification : la plus grande flèche fait toujours la même taille à l'écran.
  const k = R.dmax > 1e-9 ? 42 / (R.dmax * V.s) : 0;
  for (const el of R.els) o += ligne(V, el.A, el.B, `stroke="${FAIBLE}" stroke-width="1" stroke-dasharray="3 3"`);
  for (const el of R.els) {
    const ua = R.depl.get(el.a) || [0, 0, 0];
    const ub = R.depl.get(el.c) || [0, 0, 0];
    const cth = (el.B[0] - el.A[0]) / el.L;
    const sth = (el.B[1] - el.A[1]) / el.L;
    // Déplacements au repère local, puis courbe d'Hermite : la barre plie, elle ne casse pas.
    const v1 = -sth * ua[0] + cth * ua[1];
    const v2 = -sth * ub[0] + cth * ub[1];
    const u1 = cth * ua[0] + sth * ua[1];
    const u2 = cth * ub[0] + sth * ub[1];
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const L = el.L;
      const h1 = 1 - 3 * t * t + 2 * t ** 3;
      const h2 = L * (t - 2 * t * t + t ** 3);
      const h3 = 3 * t * t - 2 * t ** 3;
      const h4 = L * (-t * t + t ** 3);
      const v = h1 * v1 + h2 * ua[2] + h3 * v2 + h4 * ub[2];
      const u = u1 + (u2 - u1) * t;
      const x = el.A[0] + (el.B[0] - el.A[0]) * t + (cth * u - sth * v) * k;
      const y = el.A[1] + (el.B[1] - el.A[1]) * t + (sth * u + cth * v) * k;
      pts.push([V.X(x), V.Y(y)]);
    }
    o += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1])).join(' ')}" fill="none" stroke="${ORANGE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return o;
}

function vueTaux(R, V) {
  let o = '';
  for (const el of R.els) {
    const col = chaleur(el.taux);
    o += ligne(V, el.A, el.B, `stroke="${col}" stroke-width="${el.taux > 1 ? 5 : 3}" stroke-linecap="round"${el.taux > 1 ? ' stroke-dasharray="7 3"' : ''}`);
  }
  // Les chiffres se posent au milieu, decales sur le cote ; on ecarte ceux qui se touchent.
  const pris = [];
  const libre = (x, y) => !pris.some((p) => Math.abs(p[0] - x) < 44 && Math.abs(p[1] - y) < 15);
  let etiq = '';
  for (const el of R.els.slice().sort((a, b) => b.taux - a.taux)) {
    const ax = V.X(el.A[0]);
    const ay = V.Y(el.A[1]);
    const bx = V.X(el.B[0]);
    const by = V.Y(el.B[1]);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / L;
    const ny = (bx - ax) / L;
    let x = (ax + bx) / 2;
    let y = (ay + by) / 2;
    let ok = false;
    for (const dec of [0, 14, -14, 28, -28, 42, -42]) {
      const tx = x + nx * dec;
      const ty = y + ny * dec;
      if (libre(tx, ty)) { x = tx; y = ty; ok = true; break; }
    }
    if (!ok) continue; // trop serre : on n'ecrit pas plutot que d'empiler
    pris.push([x, y]);
    etiq += `<rect x="${r1(x - 21)}" y="${r1(y - 8)}" width="42" height="15" rx="3" fill="${FOND}" opacity=".85"/>`;
    etiq += texte(x, y + 4, Math.round(el.taux * 100) + ' %', el.taux > 1 ? ORANGE : BLANC, 11);
  }
  return o + etiq;
}
const VUES = { statique: vueStatique, normal: vueNormal, moment: vueMoment, deformee: vueDeformee, taux: vueTaux };

// ---------- Entrée publique ----------
// Renvoie { svg, resume } ou { erreur }.
export function schema(f, mode = 'statique', W = 760, H = 480) {
  const R = calculer(f);
  if (R.erreur) return { erreur: R.erreur };
  const marge = Math.max(30, Math.min(72, W * 0.09));
  const V = cadre(R, W, H - 36, marge, R.listeForces.length && mode === 'statique' ? Math.max(marge, 84) : marge);
  const corps = (VUES[mode] || vueStatique)(R, V, W, H - 36);
  const titre = (MODES.find((m) => m[0] === mode) || MODES[0])[1];
  let bas = '';
  const RE = Math.max(0, ...[...R.reactions.values()].map((v) => Math.abs(v[1])));
  const info = [
    'Entraxe ' + nb(R.entraxe, 1) + ' m',
    'Flèche max ' + nb(R.dmax * 1000, 1) + ' mm',
    'Taux max ' + Math.round(R.tauxMax * 100) + ' %',
    'Réaction max ' + nb(RE, 0) + ' kN',
  ].join('   ·   ');
  bas += texte(14, 20, titre, BLANC, 12, 'start');
  bas += texte(14, H - 11, info, GRIS, 11, 'start');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">`
    + `<rect width="${W}" height="${H}" fill="${FOND}"/>${corps}${bas}</svg>`;
  return { svg, R, resume: info };
}

// Tableau des barres : une ligne par type, pour la note qui accompagne le schéma.
export function tableauBarres(R) {
  const par = new Map();
  for (const el of R.els) {
    const k = el.b.type + '|' + (el.role || '') + '|' + el.cle + '|' + texteSection(el.b);
    const v = par.get(k) || { type: el.b.type, role: el.role || '', mat: el.mat.nom, sec: texteSection(el.b), n: 0, L: 0, N: 0, taux: 0 };
    v.n++;
    v.L += el.L;
    v.N = Math.abs(el.N) > Math.abs(v.N) ? el.N : v.N;
    v.taux = Math.max(v.taux, el.taux);
    par.set(k, v);
  }
  return [...par.values()].sort((a, b) => b.taux - a.taux);
}
