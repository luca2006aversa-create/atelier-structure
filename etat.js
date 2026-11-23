// État partagé de l'atelier : document, vue, outil, sélection, historique (annuler / rétablir).
import { boite, borne } from './geometrie.js';
import { canon, copie, fusion, sansVue, trier } from './fusion.js';

export const etat = {
  doc: null,            // { feuilles: [...] }
  fi: 0,                // numéro de la feuille ouverte
  outil: 'selection',
  sel: new Set(),       // ids sélectionnés
  survol: null,         // id sous la souris
  vue: { cx: 0, cy: 6, z: 30 }, // centre (m) et zoom (px par m)
  W: 800,
  H: 600,
  pas: 0.25,            // pas de la grille (m)
  aimant: true,
  action: null,         // geste en cours : trace, cote, cadre, glisser...
  souris: null,         // [x, y] écran
  monde: null,          // [x, y] en mètres
  acc: null,            // accroche { p, type, id? }
  touches: { shift: false, alt: false, espace: false },
  defauts: {
    treillis: { forme: 'warren', h: 1.5, n: 6, sens: 1 },
    dalle: { e: 0.3, sens: 1 },
    toile: { fleche: 0.8 },
    murp: { e: 0.2 },
    cloison: { e: 0.1 },
    escalier: { w: 1.2, giron: 0.28 },
  },
  croquis: [],          // noms des images du dossier croquis
  prims: [],            // formes à l'écran (pour la recherche à la souris)
};

let compteur = 0;
export const uid = (p) => p + Date.now().toString(36) + (++compteur).toString(36);

export const feuille = () => etat.doc?.feuilles[etat.fi];

const LISTES = { n: 'noeuds', b: 'barres', c: 'cotes', t: 'textes', s: 'traits' };
export const listeDe = (id) => LISTES[String(id)[0]];

export function trouver(id, f = feuille()) {
  const l = id && f ? LISTES[id[0]] : null;
  return l ? f[l].find((o) => o.id === id) || null : null;
}

export function retirer(id, f = feuille()) {
  const l = id && f ? LISTES[id[0]] : null;
  if (!l) return false;
  const i = f[l].findIndex((o) => o.id === id);
  if (i < 0) return false;
  f[l].splice(i, 1);
  return true;
}

// Écran (px) ↔ monde (m)
export const versMonde = (sx, sy) => [etat.vue.cx + (sx - etat.W / 2) / etat.vue.z, etat.vue.cy - (sy - etat.H / 2) / etat.vue.z];
export const versEcran = (x, y) => [etat.W / 2 + (x - etat.vue.cx) * etat.vue.z, etat.H / 2 - (y - etat.vue.cy) * etat.vue.z];

let minuteurToast = 0;
export function toast(msg, alerte = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('alerte', alerte);
  el.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { el.hidden = true; }, alerte ? 5000 : 2600);
}

// Crochets : remplis par les autres modules (évite les imports en boucle).
export const crochets = {
  dessiner() {}, panneau() {}, boutons() {}, sauver() {}, vue3d() {}, onglets() {}, finirAction() {},
};

function nettoyerSelection() {
  const f = feuille();
  for (const id of [...etat.sel]) if (!trouver(id, f)) etat.sel.delete(id);
  if (etat.survol && !trouver(etat.survol, f)) etat.survol = null;
}

// Tout remettre à jour à l'écran (sans toucher à l'historique).
export function rafraichir() {
  nettoyerSelection();
  crochets.onglets();
  crochets.dessiner();
  crochets.panneau();
  crochets.boutons();
  crochets.vue3d();
}

// Historique, feuille par feuille : chaque pas garde l'avant et l'après des feuilles touchées.
// Annuler = fusion à trois : on défait seulement ce que j'ai changé, pas le travail des autres.
let passe = [];
let futur = [];
let derniere = new Map(); // id → copie de la feuille (sans vue) après le dernier pas

function instantane() {
  const m = new Map();
  for (const f of etat.doc?.feuilles || []) m.set(f.id, { txt: canon(f), obj: sansVue(f) });
  return m;
}

export function initHistorique() {
  passe = [];
  futur = [];
  derniere = instantane();
  crochets.boutons();
}

// Les changements reçus des autres ne sont pas des pas d'historique.
export function adopterDistant() {
  derniere = instantane();
}

// À appeler après chaque changement du document.
export function modifie() {
  const now = instantane();
  const pas = [];
  for (const [id, v] of now) {
    const av = derniere.get(id);
    if (!av || av.txt !== v.txt) pas.push({ id, avant: av?.obj ?? null, apres: v.obj });
  }
  for (const [id, av] of derniere) if (!now.has(id)) pas.push({ id, avant: av.obj, apres: null });
  if (pas.length) {
    passe.push(pas);
    if (passe.length > 100) passe.shift();
    futur = [];
    derniere = now;
    crochets.sauver();
  }
  rafraichir();
}

// Rejoue un pas dans un sens (de → vers) sur le document actuel.
function rejouer(pas, sens) {
  const idOuverte = feuille()?.id;
  for (const c of pas) {
    const de = sens ? c.avant : c.apres;
    const vers = sens ? c.apres : c.avant;
    const i = etat.doc.feuilles.findIndex((f) => f.id === c.id);
    const actuelle = i >= 0 ? etat.doc.feuilles[i] : null;
    if (!vers) { if (i >= 0) etat.doc.feuilles.splice(i, 1); continue; }
    const r = actuelle && de ? fusion(de, vers, actuelle) : copie(vers);
    if (actuelle?.vue) r.vue = actuelle.vue;
    if (i >= 0) etat.doc.feuilles[i] = r;
    else etat.doc.feuilles.push(r);
  }
  trier(etat.doc.feuilles);
  derniere = instantane();
  const i = etat.doc.feuilles.findIndex((f) => f.id === idOuverte);
  if (i >= 0) etat.fi = i;
  else {
    etat.fi = borne(etat.fi, 0, etat.doc.feuilles.length - 1);
    appliquerVue();
  }
  crochets.sauver();
  rafraichir();
}

export const peutAnnuler = () => passe.length > 0;
export const peutRetablir = () => futur.length > 0;

export function annuler() {
  crochets.finirAction();
  if (!passe.length) return false;
  const pas = passe.pop();
  futur.push(pas);
  rejouer(pas, false);
  return true;
}

export function retablir() {
  crochets.finirAction();
  if (!futur.length) return false;
  const pas = futur.pop();
  passe.push(pas);
  rejouer(pas, true);
  return true;
}

// Vue de chaque feuille : gardée dans la feuille, hors historique.
export function memoriserVue() {
  const f = feuille();
  if (f) f.vue = { cx: +etat.vue.cx.toFixed(3), cy: +etat.vue.cy.toFixed(3), z: +etat.vue.z.toFixed(3) };
}

function boiteCroquis(c) {
  const a = ((c.rot || 0) * Math.PI) / 180;
  const co = Math.abs(Math.cos(a));
  const si = Math.abs(Math.sin(a));
  const ex = (c.echelle * (c.w * co + c.h * si)) / 2;
  const ey = (c.echelle * (c.w * si + c.h * co)) / 2;
  return { x0: c.cx - ex, x1: c.cx + ex, y0: c.cy - ey, y1: c.cy + ey };
}

// Cadrer la vue sur tout le dessin (et le croquis de fond).
export function cadrer(f = feuille()) {
  let b = f ? boite(f) : null;
  if (f?.croquis && !f.croquis.masque && f.croquis.w) {
    const k = boiteCroquis(f.croquis);
    b = b ? { x0: Math.min(b.x0, k.x0), y0: Math.min(b.y0, k.y0), x1: Math.max(b.x1, k.x1), y1: Math.max(b.y1, k.y1) } : k;
  }
  if (!b) {
    etat.vue = { cx: 0, cy: 6, z: borne(Math.min(etat.W, etat.H) / 24, 2, 3000) };
    return;
  }
  const w = Math.max(b.x1 - b.x0, 2);
  const h = Math.max(b.y1 - b.y0, 2);
  const z = borne(Math.min((etat.W - 96) / w, (etat.H - 128) / h), 2, 3000);
  etat.vue = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z };
}

export function appliquerVue() {
  const v = feuille()?.vue;
  if (v && v.z > 0) etat.vue = { cx: v.cx, cy: v.cy, z: v.z };
  else cadrer();
}

export function allerFeuille(i) {
  if (!etat.doc) return;
  crochets.finirAction();
  memoriserVue();
  etat.fi = borne(i, 0, etat.doc.feuilles.length - 1);
  etat.sel.clear();
  etat.survol = null;
  appliquerVue();
  rafraichir();
}
