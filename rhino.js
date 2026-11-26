// Passerelle vers Rhino et Grasshopper.
// On n'exporte pas des faces mais la structure elle-même : un axe, une section, une matière
// par barre. Rhino rebâtit les volumes ; Grasshopper peut repartir des axes et tout refaire.
import { barresEnSections, carteNoeuds, borne } from './geometrie.js';
import { sectionDe, matiereDe, cleMatiere, MATIERES } from './matieres.js';

export const VERSION = 1;

// Les mêmes familles que la vue 3D, pour que l'export et l'image à l'écran racontent la même chose.
const VOL = new Set(['poteau-vol', 'poutre-vol', 'bequille-vol', 'entretoise-vol', 'cable-vol', 'membrure-vol', 'diagonale-vol']);
const NAPPES = new Set(['toit-vol', 'dalle']);
const PANNE = [0.08, 0.16];

const r4 = (v) => Math.round(v * 10000) / 10000;
const pt2 = (p) => [r4(p[0]), r4(p[1])];

// Répartition des portiques le long de z (même règle que vue3d.js).
function portiques(f) {
  const t = f.trois_d || {};
  const e = Math.max(0.5, +t.entraxe || 6);
  const nb = borne(Math.round(+t.nombre || 4), 1, 40);
  const zs = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * e);
  return { e, nb, zs, z0: nb > 1 ? zs[0] : -e / 2, z1: nb > 1 ? zs[nb - 1] : e / 2 };
}

// Axe et hauteur d'une bande [A+n, B+n, B-n, A-n] rendue par geometrie.js.
function axeBande(p) {
  const a = [(p[0][0] + p[3][0]) / 2, (p[0][1] + p[3][1]) / 2];
  const c = [(p[1][0] + p[2][0]) / 2, (p[1][1] + p[2][1]) / 2];
  const h = Math.hypot(p[0][0] - p[3][0], p[0][1] - p[3][1]);
  return { a, c, h };
}

// ---------- Export ----------
// Renvoie un objet simple : tout est en mètres, x vers la droite, y vers le haut, z en profondeur.
export function versRhino(f) {
  if (!f) return { erreur: 'Aucune feuille.' };
  if (f.type === 'plan') return { erreur: 'L’export Rhino part d’une coupe : poteaux, poutres, toits.' };
  const N = carteNoeuds(f);
  const P = portiques(f);
  const K = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 }, sections: true };
  const barres = [];
  const nappes = [];
  const toiles = [];
  const porteurs = new Set();
  const utilisees = new Set();

  // Jonctions faites (onglets, arrêts contre les faces) : Rhino reçoit les longueurs réelles.
  for (const { b, prims: out } of barresEnSections({ ...f, barres: f.barres || [] }, K, N)) {
    if (b.type !== 'sol' && b.type !== 'mur') { porteurs.add(b.a); porteurs.add(b.b); }
    const S = sectionDe(b);
    const mat = cleMatiere(b);
    for (const pr of out) {
      if (pr.st === 'zone' || pr.st === 'hachure') continue;
      if (VOL.has(pr.st) && pr.p.length === 4) {
        const ab = axeBande(pr.p);
        const h = pr.h ? 2 * pr.h : ab.h;
        const [a, c] = pr.ax || [ab.a, ab.c];
        const k = pr.st === 'diagonale-vol' ? 0.6 : 1;
        utilisees.add(mat);
        barres.push({
          id: b.id,
          piece: pr.st.replace('-vol', ''),
          type: b.type,
          matiere: mat,
          forme: S.f,
          profil: S.nom || null,
          b: r4(Math.max(0.004, S.b * k)), // largeur, perpendiculaire au plan de la coupe
          h: r4(Math.max(0.004, h)), // hauteur, dans le plan de la coupe
          ep: S.e ? r4(S.e) : null, // épaisseur d'un tube
          a: pt2(a),
          c: pt2(c),
          longueur: r4(Math.hypot(c[0] - a[0], c[1] - a[1])),
        });
      } else if (NAPPES.has(pr.st)) {
        utilisees.add(mat);
        nappes.push({ id: b.id, type: b.type, matiere: mat, contour: pr.p.map(pt2) });
      } else if (pr.st === 'toile') {
        utilisees.add(mat);
        toiles.push({ id: b.id, matiere: mat, ligne: pr.p.map(pt2) });
      }
    }
  }

  // Pannes : elles relient les portiques, comme dans la vue 3D.
  const pannes = [];
  if (P.nb > 1) {
    for (const n of f.noeuds || []) {
      if (n.y <= 0.01 || !porteurs.has(n.id)) continue;
      pannes.push({ id: n.id, p: pt2([n.x, n.y]) });
    }
    if (pannes.length) utilisees.add('c24');
  }

  const matieres = {};
  for (const cle of utilisees) {
    const m = MATIERES[cle];
    if (!m) continue;
    matieres[cle] = { nom: m.nom, famille: m.fam, couleur: m.c, rho: m.rho, E: m.E };
  }

  return {
    format: 'atelier-structure',
    version: VERSION,
    unites: 'metre',
    repere: 'x = largeur, y = hauteur, z = profondeur (Rhino : x, z, y)',
    feuille: String(f.nom || 'structure'),
    date: new Date().toISOString().slice(0, 10),
    portiques: { entraxe: r4(P.e), nombre: P.nb, z: P.zs.map(r4), z0: r4(P.z0), z1: r4(P.z1) },
    panne: { b: PANNE[0], h: PANNE[1], matiere: 'c24', z0: r4(P.z0), z1: r4(P.z1) },
    matieres,
    barres,
    nappes,
    toiles,
    pannes,
  };
}

export function jsonRhino(f) {
  const d = versRhino(f);
  if (d.erreur) return d;
  return { texte: JSON.stringify(d, null, 1), donnees: d };
}

// Une phrase pour dire ce qui part, avant de l'enregistrer.
export function resumeRhino(d) {
  return [
    d.barres.length + ' barres',
    d.nappes.length ? d.nappes.length + ' nappes' : null,
    d.toiles.length ? d.toiles.length + ' toiles' : null,
    d.pannes.length ? d.pannes.length + ' pannes' : null,
    d.portiques.nombre + ' portiques tous les ' + d.portiques.entraxe + ' m',
  ].filter(Boolean).join(', ');
}
