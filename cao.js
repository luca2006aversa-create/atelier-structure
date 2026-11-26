// Export vers les logiciels de dessin : ArchiCAD, Revit, Rhino, AutoCAD.
// Toute la 3D est ramenée à des prismes (un contour plat poussé sur une longueur), à leurs vraies dimensions.
// Le même jeu de prismes donne l'IFC (ArchiCAD, Revit), le DXF 3D (AutoCAD, Rhino) et l'OBJ (Rhino, ArchiCAD, Revit).
// Le DXF 2D reprend le dessin de la feuille, barres à leur vraie largeur.
// Repère des fichiers : mètres, Z vers le haut. Coupe : x = largeur, y = profondeur, z = hauteur. Plan : x, y du plan, z = hauteur.
import {
  primitivesBarre, barresEnSections, pannesCoupe, PANNE, primitivesFeuille, carteNoeuds, borne, boite, estPlan, analysePlan, bandeMur, epaisseur, MURS,
  H_PORTE, H_ALLEGE, H_LINTEAU, sub, add, mul, unite, normale, dist,
} from './geometrie.js';
import { sectionDe, matiereDe, cleMatiere, MATIERES } from './matieres.js';
import { echelle } from './rendu.js';

const VOL = new Set(['poteau-vol', 'poutre-vol', 'bequille-vol', 'entretoise-vol', 'cable-vol', 'membrure-vol', 'diagonale-vol']);
const NAPPES = new Set(['toit-vol', 'dalle']);
const CERCLE = 16; // côtés d'une section ronde

// Famille de chaque élément : nom du calque (DXF), classe IFC.
const FAMILLES = {
  poteau: ['POTEAU', 'IFCCOLUMN', 'COLUMN'],
  poutre: ['POUTRE', 'IFCBEAM', 'BEAM'],
  panne: ['PANNE', 'IFCBEAM', 'JOIST'],
  bequille: ['BEQUILLE', 'IFCMEMBER', 'STRUT'],
  entretoise: ['ENTRETOISE', 'IFCMEMBER', 'BRACE'],
  diagonale: ['DIAGONALE', 'IFCMEMBER', 'BRACE'],
  membrure: ['MEMBRURE', 'IFCMEMBER', 'CHORD'],
  cable: ['CABLE', 'IFCMEMBER', 'TIEBAR'],
  dalle: ['DALLE', 'IFCSLAB', 'FLOOR'],
  toit: ['TOIT', 'IFCSLAB', 'ROOF'],
  murp: ['MUR', 'IFCWALL', 'STANDARD'],
  cloison: ['CLOISON', 'IFCWALL', 'PARTITIONING'],
  fenetre: ['VITRAGE', 'IFCPLATE', 'CURTAIN_PANEL'],
  escalier: ['ESCALIER', 'IFCBUILDINGELEMENTPROXY', 'NOTDEFINED'],
  autre: ['AUTRE', 'IFCBUILDINGELEMENTPROXY', 'NOTDEFINED'],
};
const famille = (t) => FAMILLES[t] || FAMILLES.autre;

function portiques(f) {
  const t = f.trois_d || {};
  const e = Math.max(0.5, +t.entraxe || 6);
  const nb = borne(Math.round(+t.nombre || 4), 1, 40);
  const zs = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * e);
  return { e, nb, zs, z0: nb > 1 ? zs[0] : -e / 2, z1: nb > 1 ? zs[nb - 1] : e / 2 };
}

// ---------- Petits calculs 3D ----------
const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k] };
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unite3 = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const aire2 = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
const sens = (p) => (aire2(p) >= 0 ? p : p.slice().reverse()); // contour toujours dans le sens trigonométrique

// Un prisme : contour [u, v] dans un plan local (O, X, Y), poussé le long de Z = X × Y sur `long`.
function prisme(type, matiere, nom, profil, O, X, Y, long) {
  const p = sens(profil.filter((q, i) => i === 0 || dist(q, profil[i - 1]) > 1e-6));
  if (p.length < 3 || Math.abs(aire2(p)) < 1e-8 || !(long > 1e-5)) return null;
  return { type, matiere, nom, profil: p, O, X, Y, Z: croix(X, Y), long };
}
const global = (s, q, w) => v3.add(v3.add(v3.add(s.O, v3.mul(s.X, q[0])), v3.mul(s.Y, q[1])), v3.mul(s.Z, w));

// ---------- Les prismes d'une feuille ----------
// Coupe : la feuille (x, y) est verticale ; la profondeur 3D z devient -Y (repère direct, sans miroir).
function prismesCoupe(f) {
  const N = carteNoeuds(f);
  const { nb, zs, z0, z1 } = portiques(f);
  const K = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 }, sections: true };
  const X = [1, 0, 0];
  const Y = [0, 0, 1]; // v vers le haut ; Z = X × Y = (0, -1, 0)
  const out = [];
  const pousser = (s) => s && out.push(s);
  // Jonctions faites une fois pour toute la feuille : mêmes coupes qu'à l'écran.
  const liste = barresEnSections(f, K, N);
  for (const { b, prims } of liste) {
    const S = sectionDe(b);
    const mat = cleMatiere(b);
    for (const pr of prims) {
      if (VOL.has(pr.st) && pr.p.length === 4) {
        const piece = pr.st.replace('-vol', '');
        const d = Math.max(0.004, S.b * (pr.st === 'diagonale-vol' ? 0.6 : 1));
        const P = pr.ax ? pr.ax[0] : [(pr.p[0][0] + pr.p[3][0]) / 2, (pr.p[0][1] + pr.p[3][1]) / 2];
        const Q = pr.ax ? pr.ax[1] : [(pr.p[1][0] + pr.p[2][0]) / 2, (pr.p[1][1] + pr.p[2][1]) / 2];
        const cotes = pr.decal ? [-pr.decal, pr.decal] : [0]; // moise : une pièce de chaque côté
        zs.flatMap((z) => cotes.map((dz) => z + dz)).forEach((z, j) => {
          const i = Math.floor(j / cotes.length);
          const nom = `${piece} ${b.id} · portique ${i + 1}` + (cotes.length > 1 ? (j % 2 ? ' · avant' : ' · arrière') : '');
          if (S.f === 'rond' || S.f === 'tube') {
            // Section ronde : on pousse un cercle le long de l'axe de la barre.
            const a = [P[0], -z, P[1]];
            const Zb = unite3([Q[0] - P[0], 0, Q[1] - P[1]]);
            const Xb = [0, 1, 0];
            const Yb = croix(Zb, Xb);
            const c = Array.from({ length: CERCLE }, (_, k) => {
              const t = (2 * Math.PI * k) / CERCLE;
              return [(d / 2) * Math.cos(t), (d / 2) * Math.sin(t)];
            });
            pousser(prisme(piece, mat, nom, c, a, Xb, Yb, dist(P, Q)));
          } else {
            pousser(prisme(piece, mat, nom, pr.p, [0, -(z - d / 2), 0], X, Y, d));
          }
        });
      } else if (NAPPES.has(pr.st)) {
        const piece = pr.st === 'dalle' ? 'dalle' : 'toit';
        pousser(prisme(piece, mat, `${piece} ${b.id}`, pr.p, [0, -z0, 0], X, Y, z1 - z0));
      }
    }
  }
  // Pannes : elles relient les portiques, comme dans la vue 3D.
  if (nb > 1) {
    pannesCoupe(f, liste).forEach((pn, i) => pousser(prisme('panne', 'c24', `panne ${i + 1} (${pn.id})`, pn.p, [0, -z0, 0], X, Y, z1 - z0)));
  }
  return out;
}

// Plan : la feuille (x, y) est le sol ; tout monte en Z.
function prismesPlan(f) {
  const N = carteNoeuds(f);
  const J = analysePlan(f, N);
  const H = Math.max(0.5, +f.etage || 2.7);
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const out = [];
  const boite3 = (type, mat, nom, pied, h0, h1) => { const s = prisme(type, mat, nom, pied, [0, 0, h0], X, Y, h1 - h0); if (s) out.push(s); };
  const pied = (A, B, e) => { const n = mul(normale(unite(sub(B, A))), e / 2); return [add(A, n), add(B, n), sub(B, n), sub(A, n)]; };
  const pt = (id) => { const n = N.get(id); return n ? [n.x, n.y] : null; };
  for (const b of f.barres) {
    const A = pt(b.a);
    const B = pt(b.b);
    if (!A || !B || dist(A, B) < 1e-6) continue;
    const mat = cleMatiere(b);
    const nom = `${b.type} ${b.id}`;
    if (MURS.has(b.type)) {
      const o = J.cache.get(b.id);
      if (!o) { boite3(b.type, mat, nom, bandeMur(b, A, B, J, N), 0, H); continue; }
      // Morceau de mur sous une ouverture : il reste le linteau (et l'allège pour une fenêtre).
      const p = pied(A, B, epaisseur(b));
      if (o.type === 'porte' && H > H_PORTE) boite3(b.type, mat, nom + ' (linteau)', p, H_PORTE, H);
      if (o.type === 'fenetre') {
        boite3(b.type, mat, nom + ' (allège)', p, 0, Math.min(H_ALLEGE, H));
        if (H > H_LINTEAU) boite3(b.type, mat, nom + ' (linteau)', p, H_LINTEAU, H);
      }
    } else if (b.type === 'fenetre') {
      boite3('fenetre', 'verre', nom, pied(A, B, 0.024), Math.min(H_ALLEGE, H), Math.min(H_LINTEAU, H));
    } else if (b.type === 'escalier') {
      // Une marche = un bloc du sol à son nez de marche.
      const s = b.escalier || {};
      const [D, F] = s.sens === -1 ? [B, A] : [A, B];
      const L = dist(D, F);
      const u = unite(sub(F, D));
      const w = Math.max(0.2, +s.w || 1.2);
      const nbm = Math.max(1, Math.min(400, Math.round(L / Math.max(0.1, +s.giron || 0.28))));
      const g = L / nbm;
      for (let i = 0; i < nbm; i++) {
        boite3('escalier', mat, `${nom} · marche ${i + 1}`, pied(add(D, mul(u, i * g)), add(D, mul(u, (i + 1) * g)), w), 0, ((i + 1) * H) / nbm);
      }
    }
  }
  for (const n of f.noeuds) {
    if (n.type !== 'poteau') continue;
    const h = Math.max(0.05, +n.s || 0.3) / 2;
    boite3('poteau', 'ba30', `poteau ${n.id}`, [[n.x - h, n.y - h], [n.x + h, n.y - h], [n.x + h, n.y + h], [n.x - h, n.y + h]], 0, H);
  }
  return out;
}

export const prismes = (f) => (estPlan(f) ? prismesPlan(f) : prismesCoupe(f));

// ---------- Maillage (pour le DXF 3D et l'OBJ) ----------
// Triangulation d'un contour (oreilles) : suffit pour les contours simples de l'atelier.
function trianguler(p) {
  const idx = p.map((_, i) => i);
  const tris = [];
  const dedans = (q, a, b, c) => {
    const s = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    return s(a, b, q) >= 0 && s(b, c, q) >= 0 && s(c, a, q) >= 0;
  };
  let garde = 0;
  while (idx.length > 3 && garde++ < 10000) {
    let coupe = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const [a, b, c] = [p[ia], p[ib], p[ic]];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-12) continue; // angle rentrant
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && dedans(p[j], a, b, c))) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      coupe = true;
      break;
    }
    if (!coupe) break;
  }
  if (idx.length === 3) tris.push(idx.slice());
  else for (let i = 1; i < idx.length - 1; i++) tris.push([idx[0], idx[i], idx[i + 1]]); // repli : éventail
  return tris;
}

// Faces d'un prisme : dessous, dessus (triangles), côtés (quadrilatères). Normales vers l'extérieur.
function faces(s) {
  const n = s.profil.length;
  const bas = s.profil.map((q) => global(s, q, 0));
  const haut = s.profil.map((q) => global(s, q, s.long));
  const out = [];
  for (const [a, b, c] of trianguler(s.profil)) { out.push([bas[a], bas[c], bas[b]]); out.push([haut[a], haut[b], haut[c]]); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push([bas[i], bas[j], haut[j], haut[i]]); }
  return out;
}

// ---------- Textes et noms de fichiers ----------
const q6 = (v) => (Math.abs(v) < 5e-7 ? '0' : String(Math.round(v * 1e6) / 1e6));
const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
const calque = (s, pre = 'S-') => pre + ascii(s).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');

// Couleur AutoCAD (ACI) la plus proche d'une couleur de matière, parmi quelques teintes sobres.
const ACI = [[7, [255, 255, 255]], [8, [128, 128, 128]], [9, [192, 192, 192]], [30, [255, 127, 0]], [32, [165, 82, 0]], [42, [255, 191, 127]], [252, [130, 130, 130]], [254, [190, 190, 190]], [150, [0, 127, 255]]];
function aci(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 7;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  let best = 7;
  let dmin = Infinity;
  for (const [n, r] of ACI) { const d = (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2; if (d < dmin) { dmin = d; best = n; } }
  return best;
}

// ---------- DXF (version R12 : la plus lue, par AutoCAD, Rhino, Revit, ArchiCAD) ----------
function dxf(calques, entites) {
  const L = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(calques.size + 1),
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS'];
  for (const [nom, c] of calques) L.push('0', 'LAYER', '2', nom, '70', '0', '62', String(c), '6', 'CONTINUOUS');
  L.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  return L.join('\r\n') + '\r\n' + entites.join('\r\n') + (entites.length ? '\r\n' : '') + '0\r\nENDSEC\r\n0\r\nEOF\r\n';
}

export function dxf3D(f) {
  const S = prismes(f);
  if (!S.length) return { erreur: 'Rien à exporter en volume : dessine d’abord des barres ou des murs.' };
  const calques = new Map();
  const E = [];
  for (const s of S) {
    const nom = calque(famille(s.type)[0] + (s.matiere ? '-' + s.matiere : ''));
    if (!calques.has(nom)) calques.set(nom, aci(MATIERES[s.matiere]?.c));
    for (const fc of faces(s)) {
      const p = fc.length === 3 ? [...fc, fc[2]] : fc; // 3DFACE : 4 coins, le 4e répète le 3e pour un triangle
      E.push('0', '3DFACE', '8', nom);
      p.forEach((q, i) => E.push(String(10 + i), q6(q[0]), String(20 + i), q6(q[1]), String(30 + i), q6(q[2])));
    }
  }
  return { texte: dxf(calques, E), n: S.length };
}

export function dxf2D(f) {
  const b0 = boite(f);
  if (!b0) return { erreur: 'La feuille est vide.' };
  const taille = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, 2);
  const su = borne(taille / 45, 0.02, 3);
  // Coupe : barres toujours à leur vraie largeur. Plan : murs déjà à leur épaisseur.
  const prims = primitivesFeuille(estPlan(f) ? f : { ...f, sections: true }, echelle(18 / su), false);
  const calques = new Map();
  const E = [];
  const lieu = (st) => { const nom = calque(st || 'trait', 'A-'); if (!calques.has(nom)) calques.set(nom, /cote|txt|texte|trame/.test(st) ? 8 : 7); return nom; };
  const poly = (nom, pts, ferme) => {
    E.push('0', 'POLYLINE', '8', nom, '66', '1', '10', '0', '20', '0', '30', '0', '70', ferme ? '1' : '0');
    for (const q of pts) E.push('0', 'VERTEX', '8', nom, '10', q6(q[0]), '20', q6(q[1]), '30', '0');
    E.push('0', 'SEQEND', '8', nom);
  };
  for (const pr of prims) {
    if (pr.st === 'troncon') continue; // pièce absorbée par une barre continue : déjà dessinée
    const nom = lieu(pr.st);
    if (pr.k === 'l' && pr.p?.length === 2) E.push('0', 'LINE', '8', nom, '10', q6(pr.p[0][0]), '20', q6(pr.p[0][1]), '30', '0', '11', q6(pr.p[1][0]), '21', q6(pr.p[1][1]), '31', '0');
    else if ((pr.k === 'l' || pr.k === 'p') && pr.p?.length > 1) poly(nom, pr.p, pr.ferme === true);
    else if (pr.k === 'c') E.push('0', 'CIRCLE', '8', nom, '10', q6(pr.c[0]), '20', q6(pr.c[1]), '30', '0', '40', q6(pr.r));
    else if (pr.k === 't' && String(pr.txt ?? '').trim()) {
      const h = Math.max(0.01, +pr.h || 0.2);
      const centre = pr.ancre === 'middle';
      E.push('0', 'TEXT', '8', nom, '10', q6(pr.c[0]), '20', q6(pr.c[1]), '30', '0', '40', q6(h), '1', ascii(pr.txt), '50', q6(-(pr.ang || 0)));
      if (centre) E.push('72', '1', '11', q6(pr.c[0]), '21', q6(pr.c[1]), '31', '0');
    }
  }
  return { texte: dxf(calques, E), n: prims.length };
}

// ---------- OBJ ----------
export function obj(f) {
  const S = prismes(f);
  if (!S.length) return { erreur: 'Rien à exporter en volume : dessine d’abord des barres ou des murs.' };
  const L = ['# Atelier structure · ' + ascii(f.nom || 'structure'), '# metres, Z vers le haut', ''];
  let nv = 0;
  for (const s of S) {
    L.push('o ' + ascii(s.nom).replace(/\s+/g, '_'), 'g ' + calque(famille(s.type)[0], ''), 'usemtl ' + (s.matiere || 'defaut'));
    for (const fc of faces(s)) {
      for (const q of fc) L.push(`v ${q6(q[0])} ${q6(q[1])} ${q6(q[2])}`);
      L.push('f ' + fc.map((_, i) => nv + i + 1).join(' '));
      nv += fc.length;
    }
  }
  return { texte: L.join('\n') + '\n', n: S.length };
}

// ---------- IFC 4 (ArchiCAD, Revit) ----------
// Chaque prisme devient un vrai élément (poteau, poutre, dalle, mur…) : un contour extrudé, avec sa matière.
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const guid = () => B64[Math.floor(Math.random() * 4)] + Array.from({ length: 21 }, () => B64[Math.floor(Math.random() * 64)]).join('');
// Texte STEP : apostrophes doublées, accents en \X2\....\X0\.
const txt = (s) => "'" + [...String(s)].map((c) => {
  if (c === "'") return "''";
  if (c === '\\') return '\\\\';
  const k = c.codePointAt(0);
  return k >= 32 && k < 127 ? c : '\\X2\\' + k.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
}).join('') + "'";
const reel = (v) => { const s = q6(v); return s.includes('.') || s.includes('e') ? s : s + '.'; };

export function ifc(f) {
  const S = prismes(f);
  if (!S.length) return { erreur: 'Rien à exporter en volume : dessine d’abord des barres ou des murs.' };
  const L = [];
  let n = 0;
  const e = (s) => { L.push(`#${++n}=${s};`); return `#${n}`; };
  const point = (p) => e(`IFCCARTESIANPOINT((${p.map(reel).join(',')}))`);
  const dir = (d) => e(`IFCDIRECTION((${d.map(reel).join(',')}))`);

  const origine = point([0, 0, 0]);
  const repere = e(`IFCAXIS2PLACEMENT3D(${origine},$,$)`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${repere},$)`);
  const corps = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const unites = [
    e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
    e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
  ];
  const ua = e(`IFCUNITASSIGNMENT((${unites.join(',')}))`);
  const projet = e(`IFCPROJECT('${guid()}',$,${txt(f.nom || 'Atelier structure')},${txt('Atelier structure')},$,$,$,(${ctx}),${ua})`);
  const lpSite = e(`IFCLOCALPLACEMENT($,${repere})`);
  const site = e(`IFCSITE('${guid()}',$,'Site',$,$,${lpSite},$,$,.ELEMENT.,$,$,$,$,$)`);
  const lpBat = e(`IFCLOCALPLACEMENT(${lpSite},${repere})`);
  const bat = e(`IFCBUILDING('${guid()}',$,${txt(f.nom || 'Bâtiment')},$,$,${lpBat},$,$,.ELEMENT.,$,$,$)`);
  const lpNiv = e(`IFCLOCALPLACEMENT(${lpBat},${repere})`);
  const niv = e(`IFCBUILDINGSTOREY('${guid()}',$,'Niveau 0',$,$,${lpNiv},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${projet},(${site}))`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${site},(${bat}))`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${bat},(${niv}))`);
  const lpEl = e(`IFCLOCALPLACEMENT(${lpNiv},${repere})`);
  const dz = dir([0, 0, 1]);

  const styles = new Map(); // matière → style de surface
  const matieres = new Map(); // matière → [IfcMaterial, éléments]
  const elements = [];
  for (const s of S) {
    const pts = s.profil.map((q) => point([q[0], q[1]]));
    const ligne = e(`IFCPOLYLINE((${pts.join(',')},${pts[0]}))`);
    const profil = e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${ligne})`);
    const pos = e(`IFCAXIS2PLACEMENT3D(${point(s.O)},${dir(s.Z)},${dir(s.X)})`);
    const solide = e(`IFCEXTRUDEDAREASOLID(${profil},${pos},${dz},${reel(s.long)})`);
    const m = MATIERES[s.matiere];
    if (m && !styles.has(s.matiere)) {
      const c = [1, 3, 5].map((i) => parseInt(m.c.slice(i, i + 2), 16) / 255);
      const coul = e(`IFCCOLOURRGB($,${c.map(reel).join(',')})`);
      const ombre = e(`IFCSURFACESTYLESHADING(${coul},${s.matiere === 'verre' ? '0.6' : '0.'})`);
      styles.set(s.matiere, e(`IFCSURFACESTYLE(${txt(m.nom)},.BOTH.,(${ombre}))`));
    }
    if (styles.has(s.matiere)) e(`IFCSTYLEDITEM(${solide},(${styles.get(s.matiere)}),$)`);
    const rep = e(`IFCSHAPEREPRESENTATION(${corps},'Body','SweptSolid',(${solide}))`);
    const forme = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
    const [, classe, type] = famille(s.type);
    const el = e(`${classe}('${guid()}',$,${txt(s.nom)},$,${txt(s.type)},${lpEl},${forme},$,.${type}.)`);
    elements.push(el);
    if (m) {
      if (!matieres.has(s.matiere)) matieres.set(s.matiere, [e(`IFCMATERIAL(${txt(m.nom)},$,${txt(m.fam || '')})`), []]);
      matieres.get(s.matiere)[1].push(el);
    }
  }
  e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${elements.join(',')}),${niv})`);
  for (const [mat, els] of matieres.values()) e(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${els.join(',')}),${mat})`);

  const nomF = ascii(f.nom || 'structure').replace(/'/g, '');
  const date = new Date().toISOString().slice(0, 19);
  const texte = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME('${nomF}.ifc','${date}',(''),(''),'Atelier structure','Atelier structure','');`,
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;', ...L, 'ENDSEC;', 'END-ISO-10303-21;'].join('\n') + '\n';
  return { texte, n: S.length };
}

// Les formats proposés dans le menu, avec les logiciels qui les ouvrent.
export const FORMATS = {
  ifc: { ext: '.ifc', type: 'application/x-step', faire: ifc },
  dxf3d: { ext: ' - 3D.dxf', type: 'application/dxf', faire: dxf3D },
  obj: { ext: '.obj', type: 'text/plain', faire: obj },
  dxf2d: { ext: ' - 2D.dxf', type: 'application/dxf', faire: dxf2D },
};
