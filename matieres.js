// Matières et sections des barres : catalogue, calculs (aire, inertie, poids), pré-dimensionnement.
// Unités : mètres, kN, MPa. Une barre porte { mat: 'gl24h', sec: { f: 'rect', b: 0.2, h: 0.4 } }.
// Les valeurs sont des ordres de grandeur d'avant-projet (Eurocodes), pas une note de calcul signée.

// ---------- Matières ----------
// rho : poids propre en kN/m3 · E : module en MPa · fm/fc/ft : résistances caractéristiques en MPa
// c : couleur de la matière en 3D · c2 : la même, plus sombre (faces à l'ombre)
export const MATIERES = {
  c24: { nom: 'Bois massif C24', fam: 'bois', rho: 4.2, E: 11000, fm: 24, fc: 21, ft: 14, c: '#c89a5b', c2: '#8d6a3a' },
  gl24h: { nom: 'Lamellé-collé GL24h', fam: 'bois', rho: 3.85, E: 11500, fm: 24, fc: 24, ft: 19.2, c: '#d8ad6e', c2: '#9b7845' },
  gl28h: { nom: 'Lamellé-collé GL28h', fam: 'bois', rho: 4.1, E: 12600, fm: 28, fc: 28, ft: 22.3, c: '#e0b878', c2: '#a0804c' },
  lvl: { nom: 'LVL (bois microlamellé)', fam: 'bois', rho: 5.1, E: 13800, fm: 44, fc: 35, ft: 35, c: '#c7a977', c2: '#8b7650' },
  clt: { nom: 'CLT (lamellé croisé)', fam: 'bois', rho: 4.7, E: 11000, fm: 24, fc: 21, ft: 14, c: '#cfae7d', c2: '#917953' },
  s235: { nom: 'Acier S235', fam: 'acier', rho: 78.5, E: 210000, fm: 235, fc: 235, ft: 235, c: '#9aa4ad', c2: '#666e76' },
  s355: { nom: 'Acier S355', fam: 'acier', rho: 78.5, E: 210000, fm: 355, fc: 355, ft: 355, c: '#8c979f', c2: '#5d666c' },
  cable: { nom: 'Câble acier', fam: 'acier', rho: 78.5, E: 160000, fm: 0, fc: 0, ft: 1570, c: '#b9c0c6', c2: '#7a8086' },
  c25: { nom: 'Béton C25/30', fam: 'beton', rho: 25, E: 31000, fm: 2.6, fc: 25, ft: 1.8, c: '#b6b2ab', c2: '#7b7872' },
  ba30: { nom: 'Béton armé C30/37', fam: 'beton', rho: 25, E: 33000, fm: 14, fc: 30, ft: 14, c: '#a8a49d', c2: '#706d68' },
  brique: { nom: 'Brique', fam: 'maconnerie', rho: 18, E: 6000, fm: 2, fc: 8, ft: 0.3, c: '#a55b45', c2: '#6f3d2e' },
  pierre: { nom: 'Pierre', fam: 'maconnerie', rho: 22, E: 15000, fm: 3, fc: 15, ft: 0.5, c: '#a8a08f', c2: '#716b5e' },
  bloc: { nom: 'Bloc béton', fam: 'maconnerie', rho: 14, E: 8000, fm: 2, fc: 6, ft: 0.3, c: '#9b9b96', c2: '#676764' },
  verre: { nom: 'Verre', fam: 'verre', rho: 25, E: 70000, fm: 45, fc: 45, ft: 45, c: '#7fa8b8', c2: '#53707c' },
  alu: { nom: 'Aluminium', fam: 'acier', rho: 27, E: 70000, fm: 160, fc: 160, ft: 160, c: '#aeb6bb', c2: '#73797d' },
  toile: { nom: 'Toile / membrane', fam: 'toile', rho: 0.02, E: 600, fm: 0, fc: 0, ft: 40, c: '#e3e0d8', c2: '#9b998f' },
};
export const ORDRE_MATIERES = ['gl24h', 'gl28h', 'c24', 'lvl', 'clt', 's235', 's355', 'cable', 'alu', 'c25', 'ba30', 'brique', 'pierre', 'bloc', 'verre', 'toile'];
export const FAMILLES = { bois: 'Bois', acier: 'Acier', beton: 'Béton', maconnerie: 'Maçonnerie', verre: 'Verre', toile: 'Toile' };

// Coefficients de sécurité très simplifiés : résistance de calcul = f * kmod / gammaM.
const SECU = { bois: 0.8 / 1.25, acier: 1, beton: 1 / 1.5, maconnerie: 1 / 2, verre: 1 / 2.5, toile: 1 / 3 };
export const fcalcul = (mat, f) => (MATIERES[mat]?.[f] || 0) * (SECU[MATIERES[mat]?.fam] ?? 0.6);

// ---------- Profils du commerce : [A cm2, Iy cm4, Wy cm3, h mm, b mm] ----------
export const PROFILS = {
  'IPE 100': [10.3, 171, 34.2, 100, 55], 'IPE 120': [13.2, 318, 53, 120, 64], 'IPE 140': [16.4, 541, 77.3, 140, 73],
  'IPE 160': [20.1, 869, 109, 160, 82], 'IPE 180': [23.9, 1317, 146, 180, 91], 'IPE 200': [28.5, 1943, 194, 200, 100],
  'IPE 220': [33.4, 2772, 252, 220, 110], 'IPE 240': [39.1, 3892, 324, 240, 120], 'IPE 270': [45.9, 5790, 429, 270, 135],
  'IPE 300': [53.8, 8356, 557, 300, 150], 'IPE 330': [62.6, 11770, 713, 330, 160], 'IPE 360': [72.7, 16270, 904, 360, 170],
  'IPE 400': [84.5, 23130, 1156, 400, 180], 'IPE 450': [98.8, 33740, 1500, 450, 190], 'IPE 500': [116, 48200, 1928, 500, 200],
  'IPE 550': [134, 67120, 2441, 550, 210], 'IPE 600': [156, 92080, 3069, 600, 220],
  'HEA 100': [21.2, 349, 72.8, 96, 100], 'HEA 120': [25.3, 606, 106, 114, 120], 'HEA 140': [31.4, 1033, 155, 133, 140],
  'HEA 160': [38.8, 1673, 220, 152, 160], 'HEA 180': [45.3, 2510, 294, 171, 180], 'HEA 200': [53.8, 3692, 389, 190, 200],
  'HEA 220': [64.3, 5410, 515, 210, 220], 'HEA 240': [76.8, 7763, 675, 230, 240], 'HEA 260': [86.8, 10450, 836, 250, 260],
  'HEA 280': [97.3, 13670, 1013, 270, 280], 'HEA 300': [112.5, 18260, 1260, 290, 300],
  'HEB 100': [26, 450, 89.9, 100, 100], 'HEB 120': [34, 864, 144, 120, 120], 'HEB 140': [43, 1509, 216, 140, 140],
  'HEB 160': [54.3, 2492, 311, 160, 160], 'HEB 180': [65.3, 3831, 426, 180, 180], 'HEB 200': [78.1, 5696, 570, 200, 200],
  'HEB 220': [91, 8091, 736, 220, 220], 'HEB 240': [106, 11260, 938, 240, 240], 'HEB 260': [118.4, 14920, 1148, 260, 260],
  'HEB 280': [131.4, 19270, 1376, 280, 280], 'HEB 300': [149.1, 25170, 1678, 300, 300],
};
export const NOMS_PROFILS = Object.keys(PROFILS);
export const FORMES_SECTION = [['rect', 'Rectangle'], ['rond', 'Rond'], ['tube', 'Tube'], ['profil', 'Profil acier']];

// ---------- Section par défaut selon le type de barre : [matière, forme, b (m), h (m)] ----------
const DEFAUTS = {
  poteau: ['gl24h', 'rect', 0.2, 0.2],
  poutre: ['gl24h', 'rect', 0.12, 0.4],
  poutrep: ['gl24h', 'rect', 0.12, 0.4],
  bequille: ['gl24h', 'rect', 0.16, 0.16],
  entretoise: ['c24', 'rect', 0.08, 0.16],
  membrure: ['gl24h', 'rect', 0.16, 0.3],
  diagonale: ['c24', 'rect', 0.1, 0.16],
  treillis: ['gl24h', 'rect', 0.16, 0.3],
  cable: ['cable', 'rond', 0.016, 0.016],
  toile: ['toile', 'rect', 1, 0.002],
  dalle: ['ba30', 'rect', 1, 0.3],
  toit: ['c24', 'rect', 0.08, 0.22],
  murp: ['bloc', 'rect', 1, 0.2],
  cloison: ['bloc', 'rect', 1, 0.1],
  mur: ['bloc', 'rect', 1, 0.2],
  sol: ['pierre', 'rect', 1, 0.3],
};

export const matiereDe = (b) => MATIERES[b?.mat] || MATIERES[DEFAUTS[b?.type]?.[0]] || MATIERES.gl24h;
export const cleMatiere = (b) => (MATIERES[b?.mat] ? b.mat : DEFAUTS[b?.type]?.[0] || 'gl24h');

// Section d'une barre, toujours complète : { f, b, h } en mètres (ou { f:'profil', nom }).
export function sectionDe(b) {
  const d = DEFAUTS[b?.type] || DEFAUTS.poutre;
  const s = b?.sec || {};
  if (s.f === 'profil' && PROFILS[s.nom]) {
    const p = PROFILS[s.nom];
    return { f: 'profil', nom: s.nom, b: p[4] / 1000, h: p[3] / 1000 };
  }
  const f = s.f === 'rond' || s.f === 'tube' ? s.f : 'rect';
  const bb = +s.b > 0 ? +s.b : d[2];
  const hh = +s.h > 0 ? +s.h : d[3];
  if (f === 'rond') return { f, b: bb, h: bb, d: bb };
  if (f === 'tube') return { f, b: bb, h: bb, d: bb, e: +s.e > 0 ? +s.e : Math.max(0.002, bb / 12) };
  return { f, b: bb, h: hh };
}

// Section et matière à poser sur une barre neuve de ce type.
export const sectionDefaut = (type) => {
  const d = DEFAUTS[type];
  if (!d) return null;
  return { mat: d[0], sec: d[1] === 'rond' ? { f: 'rond', b: d[2] } : { f: d[1], b: d[2], h: d[3] } };
};

// Aire (m2), inertie forte Iy (m4), module Wy (m3), rayon de giration iy (m).
export function proprietes(sec) {
  if (sec.f === 'profil') {
    const p = PROFILS[sec.nom] || PROFILS['IPE 200'];
    const A = p[0] * 1e-4;
    const I = p[1] * 1e-8;
    return { A, Iy: I, Wy: p[2] * 1e-6, iy: Math.sqrt(I / A), h: p[3] / 1000, b: p[4] / 1000 };
  }
  if (sec.f === 'rond') {
    const d = sec.d || sec.b;
    const A = (Math.PI * d * d) / 4;
    const I = (Math.PI * d ** 4) / 64;
    return { A, Iy: I, Wy: I / (d / 2), iy: d / 4, h: d, b: d };
  }
  if (sec.f === 'tube') {
    const d = sec.d || sec.b;
    const di = Math.max(1e-4, d - 2 * (sec.e || d / 12));
    const A = (Math.PI * (d * d - di * di)) / 4;
    const I = (Math.PI * (d ** 4 - di ** 4)) / 64;
    return { A, Iy: I, Wy: I / (d / 2), iy: Math.sqrt(I / A), h: d, b: d };
  }
  const A = sec.b * sec.h;
  const I = (sec.b * sec.h ** 3) / 12;
  return { A, Iy: I, Wy: I / (sec.h / 2), iy: sec.h / Math.sqrt(12), h: sec.h, b: sec.b };
}

// Poids propre d'une barre, en kN par mètre linéaire.
export const poidsML = (b) => proprietes(sectionDe(b)).A * matiereDe(b).rho;

// Texte court de la section : « 12 × 40 cm », « ø 16 mm », « IPE 300 ».
const cm = (m) => {
  const v = m * 100;
  return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace('.', ',');
};
export function texteSection(b) {
  const s = sectionDe(b);
  if (s.f === 'profil') return s.nom;
  if (s.f === 'rond') return 'ø ' + (s.b < 0.05 ? Math.round(s.b * 1000) + ' mm' : cm(s.b) + ' cm');
  if (s.f === 'tube') return 'tube ø ' + cm(s.b) + ' cm';
  return cm(s.b) + ' × ' + cm(s.h) + ' cm';
}

// ---------- Pré-dimensionnement ----------
// Élancement courant d'une poutre : hauteur ~ portée / k, selon le type et la matière.
const ELANCEMENT = {
  poutre: { bois: [15, 18], acier: [20, 25], beton: [12, 16], maconnerie: [10, 12], verre: [20, 25], toile: [30, 30] },
  membrure: { bois: [15, 18], acier: [20, 25], beton: [12, 16], maconnerie: [10, 12], verre: [20, 25], toile: [30, 30] },
  dalle: { bois: [22, 28], acier: [28, 35], beton: [25, 30], maconnerie: [18, 22], verre: [30, 30], toile: [40, 40] },
  treillis: { bois: [8, 12], acier: [10, 15], beton: [8, 12], maconnerie: [8, 10], verre: [12, 12], toile: [12, 12] },
  toit: { bois: [18, 24], acier: [25, 30], beton: [20, 25], maconnerie: [15, 18], verre: [25, 25], toile: [40, 40] },
};
// Élancement de flambement admis pour un poteau : lambda = longueur / rayon de giration.
const LAMBDA = { bois: 90, acier: 120, beton: 70, maconnerie: 50, verre: 60, toile: 200 };

const arrondi = (v, pas) => Math.max(pas, Math.round(v / pas) * pas);

// Section conseillée pour une barre de longueur L (m).
export function predim(type, mat, L) {
  const fam = MATIERES[mat]?.fam || 'bois';
  const t = type === 'bequille' || type === 'entretoise' ? 'poteau' : type;
  if (t === 'poteau') {
    const i = L / (LAMBDA[fam] || 90); // rayon de giration mini
    const c = arrondi(i * Math.sqrt(12), 0.02);
    return { sec: { f: 'rect', b: c, h: c }, note: 'Flambement : élancement au plus ' + (LAMBDA[fam] || 90), mini: c, maxi: c * 1.4 };
  }
  if (t === 'cable') {
    const d = arrondi(Math.max(0.008, L / 400), 0.002);
    return { sec: { f: 'rond', b: d }, note: 'Câble : diamètre ~ portée / 400', mini: d, maxi: d * 2 };
  }
  const e = (ELANCEMENT[t] || ELANCEMENT.poutre)[fam] || [15, 20];
  const hmax = L / e[0];
  const hmin = L / e[1];
  const h = arrondi((hmin + hmax) / 2, 0.02);
  const note = 'Hauteur ~ portée / ' + e[0] + ' à / ' + e[1];
  if (t === 'dalle' || t === 'toile') return { sec: { f: 'rect', b: 1, h }, note: 'Épaisseur ~ portée / ' + e[0] + ' à / ' + e[1], mini: hmin, maxi: hmax };
  if (t === 'treillis') {
    const c = arrondi(h / 6, 0.02);
    return { sec: { f: 'rect', b: c, h: c }, hauteur: h, note: 'Hauteur du treillis ~ portée / ' + e[0] + ' à / ' + e[1], mini: hmin, maxi: hmax };
  }
  const bb = arrondi(h / (fam === 'bois' ? 3 : 2.5), 0.02);
  return { sec: { f: 'rect', b: bb, h }, note, mini: hmin, maxi: hmax };
}

// Vice-versa : portée courante que tient cette section (m), sans calcul de charge.
export function porteeCourante(type, mat, sec) {
  const fam = MATIERES[mat]?.fam || 'bois';
  const t = type === 'bequille' || type === 'entretoise' ? 'poteau' : type;
  const P = proprietes(sec);
  if (t === 'poteau') return { min: P.iy * (LAMBDA[fam] || 90) * 0.8, max: P.iy * (LAMBDA[fam] || 90), mot: 'hauteur libre' };
  if (t === 'cable') return { min: P.h * 300, max: P.h * 500, mot: 'portée' };
  const e = (ELANCEMENT[t] || ELANCEMENT.poutre)[fam] || [15, 20];
  return { min: P.h * e[0], max: P.h * e[1], mot: 'portée' };
}

// ---------- Vérifications rapides ----------
// Poutre sur deux appuis : L (m), q (kN par mètre). Taux de 1 = à la limite.
export function verifierPoutre(b, L, q) {
  const mat = cleMatiere(b);
  const P = proprietes(sectionDe(b));
  const E = (MATIERES[mat]?.E || 11000) * 1000; // MPa -> kN/m2
  const M = (q * L * L) / 8; // kNm
  const sigma = P.Wy > 0 ? M / P.Wy / 1000 : 0; // MPa
  const fd = fcalcul(mat, 'fm') || 1;
  const fleche = (5 * q * L ** 4) / (384 * E * P.Iy); // m
  const lim = L / 300;
  return { M, sigma, fd, tauxN: sigma / fd, fleche: fleche * 1000, limite: lim * 1000, tauxF: fleche / lim, ok: sigma / fd <= 1 && fleche / lim <= 1 };
}

// Poteau en compression simple : L (m), N (kN).
export function verifierPoteau(b, L, N) {
  const mat = cleMatiere(b);
  const P = proprietes(sectionDe(b));
  const lambda = P.iy > 0 ? L / P.iy : 999;
  const fd = fcalcul(mat, 'fc') || 1;
  const kc = Math.min(1, 1 / (1 + (lambda / 80) ** 2)); // réduction de flambement simplifiée
  const sigma = P.A > 0 ? N / P.A / 1000 : 0;
  return { lambda, kc, sigma, fd, taux: sigma / (kc * fd), ok: sigma <= kc * fd };
}
