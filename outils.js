// Outils : colonne des outils, gestes à la souris et au doigt, clavier, presse-papiers.
import { etat, feuille, trouver, retirer, uid, modifie, rafraichir, toast, versMonde, versEcran, annuler, retablir } from './etat.js';
import { NOM_BARRE, NOM_NOEUD, chercher, simplifier, carteNoeuds, pointCote, dist, add, sub, fr, estPlan } from './geometrie.js';
import { accrocher } from './accroche.js';
import { EPS, obtenirNoeud, couperParNoeuds, nettoyerBarres, noeudsRelies, synchroCotes, apresDeplacement } from './topologie.js';
import { brancherPointeur, demanderDessin, zoomer, zoomerCentre, decaler, cadrerVue, decalageCote } from './scene.js';
import {
  supprimerSelection, toutSelectionner, reglagesBarre, prisesDeplacement, instantane, appliquerDelta, deplacerSelection,
  aCopie, copier, coller, dupliquer, insererCopie, editeurOuvert, ouvrirEditeur, fermerEditeur,
} from './commandes.js';
import { etalonner, envoyerImage } from './croquis.js';
import { sauver } from './sauvegarde.js';
import { picto } from './pictos.js';

// [id, étiquette courte, touche] — une colonne pour les coupes, une pour les plans.
const COMMUNS = ['Outils', [['selection', 'Choisir', 'V'], ['gomme', 'Gomme', 'G'], ['cote', 'Cote', 'C'], ['texte', 'Texte', 'T'], ['crayon', 'Crayon', 'D']]];
const GROUPES = {
  coupe: [
    COMMUNS,
    ['Barres', [['poteau', 'Poteau', 'P'], ['poutre', 'Poutre', 'B'], ['bequille', 'Béquille', 'Q'], ['entretoise', 'Entretoise', 'E']]],
    ['Spécial', [['treillis', 'Treillis', 'R'], ['cable', 'Câble'], ['toile', 'Toile'], ['dalle', 'Dalle']]],
    ['Site', [['sol', 'Sol', 'S'], ['mur', 'Mur', 'M']]],
    ['Nœuds', [['n-appui', 'Appui'], ['n-encastrement', 'Encastré'], ['n-rotule', 'Rotule'], ['n-rigide', 'Rigide'], ['n-glissant', 'Glissant'], ['n-libre', 'Libre']]],
  ],
  plan: [
    COMMUNS,
    ['Plan', [['murp', 'Mur', 'M'], ['cloison', 'Cloison', 'L'], ['n-poteau', 'Poteau', 'P']]],
    ['Ouvertures', [['porte', 'Porte', 'O'], ['fenetre', 'Fenêtre', 'N']]],
    ['Repères', [['trame', 'Trame', 'A'], ['escalier', 'Escalier', 'E']]],
  ],
};
const OUTILS = new Map();
const TOUCHES = { coupe: {}, plan: {} };
const DU_MODE = { coupe: new Set(), plan: new Set() };
for (const mode of ['coupe', 'plan']) {
  for (const [, liste] of GROUPES[mode]) {
    for (const [id, nom, t] of liste) {
      if (!OUTILS.has(id)) OUTILS.set(id, { nom, touche: t });
      DU_MODE[mode].add(id);
      if (t) TOUCHES[mode][t.toLowerCase()] = id;
    }
  }
}
const modeFeuille = () => (estPlan(feuille()) ? 'plan' : 'coupe');
// Ces tracés s'arrêtent après un seul segment (une porte = un clic de départ, un clic d'arrivée).
const SANS_SUITE = new Set(['porte', 'fenetre', 'trame', 'escalier']);

const FLECHES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const CRAN = Math.PI / 12; // 15°
const RE_LONGUEUR = /^\s*(-?\d*\.?\d+)\s*(?:[;<\s]\s*(-?\d*\.?\d+))?\s*°?\s*$/;
const MARQUE = 'atelier-structure';
const arr = (v) => Math.round(v * 1e6) / 1e6;
const sansNoeud = (pr) => pr.id[0] !== 'n';
const tolerance = () => 8 / etat.vue.z;
const estSaisie = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

let svg = null;
let bas = null;        // appui en cours : clic ou glissé ?
let ignorer = false;   // après une pince : on attend que tous les doigts soient levés
let attente = 0;       // repli si le navigateur n'envoie pas copier / coller
const pointeurs = new Map();

export function nomOutil(id = etat.outil) {
  if (NOM_BARRE[id]) return NOM_BARRE[id];
  if (id === 'n-poteau') return 'Poteau';
  if (id.startsWith('n-')) return 'Nœud ' + String(NOM_NOEUD[id.slice(2)] || '').toLowerCase();
  return OUTILS.get(id)?.nom || id;
}

// ---------- Colonne des outils ----------
function construireBarre() {
  const nav = document.getElementById('outils');
  if (!nav) return;
  const mode = modeFeuille();
  nav.innerHTML = '';
  nav.dataset.mode = mode;
  for (const [titre, liste] of GROUPES[mode]) {
    const g = document.createElement('div');
    g.className = 'groupe-outils';
    const t = document.createElement('div');
    t.className = 'groupe-titre';
    t.textContent = titre;
    g.appendChild(t);
    for (const [id, nom, touche] of liste) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'outil';
      b.dataset.outil = id;
      b.title = nomOutil(id) + (touche ? ` (${touche})` : '');
      b.setAttribute('aria-label', nomOutil(id));
      b.innerHTML = picto(id) + '<span></span>';
      b.lastChild.textContent = nom;
      b.addEventListener('click', () => { choisirOutil(id); b.blur(); });
      g.appendChild(b);
    }
    nav.appendChild(g);
  }
  majBoutons();
}

function majBoutons() {
  document.querySelectorAll('#outils .outil').forEach((b) => b.classList.toggle('on', b.dataset.outil === etat.outil));
}

// Coupe ↔ plan : on change la colonne d'outils. Appelé à chaque rafraîchissement (ne fait rien si rien n'a changé).
export function majModeOutils() {
  const nav = document.getElementById('outils');
  const mode = modeFeuille();
  if (!nav || nav.dataset.mode === mode) return;
  if (!DU_MODE[mode].has(etat.outil)) {
    arreter();
    etat.outil = 'selection';
    majPointeur();
  }
  construireBarre();
}

export function choisirOutil(id) {
  if (!OUTILS.has(id) || !DU_MODE[modeFeuille()].has(id)) return;
  arreter();
  etat.outil = id;
  if (id !== 'selection') etat.sel.clear();
  majBoutons();
  majPointeur();
  rafraichir();
}

// ---------- Fin d'un geste ----------
// Les glissés reviennent en place ; la gomme et le croquis gardent leur effet.
function defaire(a) {
  const f = feuille();
  if (!a || !f) return;
  switch (a.type) {
    case 'glisser': appliquerDelta(a.snap, 0, 0, f); break;
    case 'glisser-noeud': {
      const n = trouver(a.id, f);
      if (n) { n.x = a.x0; n.y = a.y0; synchroCotes(f); }
      break;
    }
    case 'cote-decalage': {
      const c = trouver(a.id, f);
      if (c) c.decalage = a.d0;
      break;
    }
    case 'gomme': if (a.n) { a.n = 0; nettoyerBarres(f, a.relies); modifie(); } break;
    case 'croquis': if (a.drag) { a.drag = null; modifie(); } break;
    default: break;
  }
}

function arreter() {
  let a = etat.action;
  if (a?.type === 'vue' || a?.type === 'pince') a = a.avant || null;
  etat.action = null;
  bas = null;
  fermerEditeur();
  if (a) defaire(a);
  return a;
}

export function finirAction() {
  const a = arreter();
  majPointeur();
  rafraichir();
  return !!a;
}

// ---------- Croquis de fond (lancés depuis le panneau) ----------
export function etalonnerCroquis() {
  if (!feuille()?.croquis) { toast('Choisis d’abord un croquis'); return; }
  arreter();
  etat.sel.clear();
  etat.action = { type: 'etalon', P1: null };
  majPointeur();
  rafraichir();
}

export function deplacerCroquis() {
  if (!feuille()?.croquis) { toast('Choisis d’abord un croquis'); return; }
  arreter();
  etat.sel.clear();
  etat.action = { type: 'croquis', drag: null };
  majPointeur();
  rafraichir();
}

// ---------- Pointeur ----------
function posEcran(ev) {
  const r = svg.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
}

function calculerAccroche(m) {
  const a = etat.action;
  if (a) {
    switch (a.type) {
      case 'trace': return accrocher(m, { depart: a.A });
      case 'cote': return a.B ? null : accrocher(m, { depart: [a.A.x, a.A.y] });
      case 'colle':
      case 'symetrie': return accrocher(m);
      case 'etalon': return { p: (a.P2 || m).slice(), type: 'libre' };
      case 'glisser-noeud': return accrocher(m, { exclure: [a.id] });
      case 'glisser': return accrocher(add(a.ref, sub(m, a.m0)), { exclure: a.prises.noeuds });
      default: return null;
    }
  }
  const o = etat.outil;
  if (NOM_BARRE[o] || o.startsWith('n-') || o === 'cote' || o === 'texte') return accrocher(m);
  return null;
}

// Appelé à chaque mouvement, et par la scène quand la vue bouge.
function majPointeur(s = etat.souris) {
  if (s) {
    etat.souris = s;
    etat.monde = versMonde(s[0], s[1]);
  }
  const m = etat.monde;
  const a = etat.action;
  etat.acc = s && m ? calculerAccroche(m) : null;
  if (s && m && !a && etat.outil === 'selection') etat.survol = chercher(etat.prims, m, tolerance());
  else if (s && m && etat.outil === 'gomme' && (!a || a.type === 'gomme')) etat.survol = chercher(etat.prims, m, tolerance(), sansNoeud);
  else etat.survol = null;
  if (m && a?.type === 'colle') a.p = (etat.acc?.p || m).slice();
  if (m && a?.type === 'symetrie') a.axe = (etat.acc?.p || m)[0];
  demanderDessin();
}

function surBas(ev) {
  etat.touches.shift = ev.shiftKey;
  etat.touches.alt = ev.altKey;
  if (editeurOuvert()) {
    // Un clic ailleurs ferme le champ (il se valide ou s'annule tout seul), sans rien d'autre.
    ev.preventDefault();
    const el = document.activeElement;
    if (el && el.closest && el.closest('.flottant')) el.blur();
    else fermerEditeur();
    return;
  }
  if (!feuille()) return;
  if (ev.button === 2) { ev.preventDefault(); finirAction(); return; }
  if (ev.button !== 0 && ev.button !== 1) return;
  const s = posEcran(ev);
  try { svg.setPointerCapture(ev.pointerId); } catch { /* rien */ }
  pointeurs.set(ev.pointerId, s);
  if (pointeurs.size === 2 && ev.pointerType === 'touch') { commencerPince(); return; }
  if (pointeurs.size > 1 || ignorer) return;
  if (ev.button === 1 || etat.touches.espace) {
    ev.preventDefault();
    etat.action = { type: 'vue', s, avant: etat.action };
    bas = null;
    demanderDessin();
    return;
  }
  majPointeur(s);
  const m = etat.monde;
  const a = etat.action;
  if (a) {
    switch (a.type) {
      case 'trace': cliquerTrace(); return;
      case 'cote': cliquerCote(); return;
      case 'etalon': cliquerEtalon(s); return;
      case 'colle': poserCopie(); return;
      case 'symetrie': poserSymetrie(); return;
      case 'croquis': commencerFond(m, s); return;
      default: return;
    }
  }
  const o = etat.outil;
  if (NOM_BARRE[o]) {
    etat.action = { type: 'trace', barre: o, A: (etat.acc?.p || m).slice() };
    bas = { type: 'trace', s, parti: false };
    majPointeur(s);
    return;
  }
  if (o.startsWith('n-')) { poserNoeud(o.slice(2)); return; }
  if (o === 'cote') { cliquerCote(); return; }
  if (o === 'texte') { poserTexte(s); return; }
  if (o === 'crayon') {
    etat.action = { type: 'crayon', pts: [m.slice()] };
    bas = { type: 'crayon', s };
    demanderDessin();
    return;
  }
  if (o === 'gomme') {
    etat.action = { type: 'gomme', relies: noeudsRelies(feuille()), n: 0, faits: new Set() };
    bas = { type: 'gomme', s };
    gommer(m);
    return;
  }
  bas = { type: 'choisir', s, m: m.slice(), cible: chercher(etat.prims, m, tolerance()), shift: ev.shiftKey, parti: false };
}

function surMouvement(ev) {
  const s = posEcran(ev);
  etat.touches.shift = ev.shiftKey;
  etat.touches.alt = ev.altKey;
  if (pointeurs.has(ev.pointerId)) pointeurs.set(ev.pointerId, s);
  if (ignorer) return;
  const a = etat.action;
  if (a?.type === 'pince') { if (pointeurs.size >= 2) majPince(); return; }
  if (pointeurs.size > 1) return;
  if (a?.type === 'vue') {
    etat.souris = s;
    decaler(s[0] - a.s[0], s[1] - a.s[1]);
    a.s = s;
    return;
  }
  majPointeur(s);
  if (!bas) return;
  const m = etat.monde;
  const loin = Math.hypot(s[0] - bas.s[0], s[1] - bas.s[1]);
  switch (bas.type) {
    case 'trace': if (loin > 8) bas.parti = true; break;
    case 'crayon': {
      const pts = etat.action?.pts;
      if (!pts) break;
      const der = pts[pts.length - 1];
      const e = versEcran(der[0], der[1]);
      if (Math.hypot(s[0] - e[0], s[1] - e[1]) > 2) { pts.push(m.slice()); demanderDessin(); }
      break;
    }
    case 'gomme': gommer(m); break;
    case 'croquis': deplacerFond(m); break;
    case 'choisir':
      if (!bas.parti && loin > 4) {
        bas.parti = true;
        commencerGlisse(bas);
        majPointeur(s);
      }
      if (bas.parti) suivreGlisse(s, m);
      break;
    default: break;
  }
}

function surHaut(ev) {
  const s = posEcran(ev);
  pointeurs.delete(ev.pointerId);
  try { svg.releasePointerCapture(ev.pointerId); } catch { /* rien */ }
  if (ignorer) { if (!pointeurs.size) ignorer = false; return; }
  const a = etat.action;
  if (a?.type === 'pince') {
    etat.action = a.avant || null;
    if (pointeurs.size) ignorer = true;
    majPointeur();
    return;
  }
  if (a?.type === 'vue') { etat.action = a.avant || null; majPointeur(s); return; }
  const b = bas;
  bas = null;
  if (!b) return;
  switch (b.type) {
    case 'trace':
      // Glisser de A à B : une seule barre.
      if (b.parti && etat.action?.type === 'trace') { cliquerTrace(); finirAction(); }
      break;
    case 'crayon': finirCrayon(); break;
    case 'gomme': finirGomme(); break;
    case 'croquis': finirFond(); break;
    case 'choisir': if (b.parti) finirGlisse(); else cliquerChoisir(b); break;
    default: break;
  }
}

function surAnnule(ev) {
  pointeurs.delete(ev.pointerId);
  const a = etat.action;
  if (a?.type === 'pince' || a?.type === 'vue') {
    etat.action = a.avant || null;
    if (pointeurs.size) ignorer = true;
  } else if (bas) {
    etat.action = annulerGeste();
  }
  if (!pointeurs.size) ignorer = false;
  majPointeur();
}

function surSortie() {
  if (pointeurs.size) return;
  etat.souris = null;
  etat.acc = null;
  etat.survol = null;
  demanderDessin();
}

function surDouble(ev) {
  const a = etat.action;
  if (a?.type === 'trace') { finirAction(); return; }
  if (a || etat.outil !== 'selection') return;
  const s = posEcran(ev);
  const id = chercher(etat.prims, versMonde(s[0], s[1]), tolerance(), (pr) => pr.id[0] === 't' || pr.id[0] === 'c');
  if (id) modifierTexte(id, s);
}

function surMolette(ev) {
  ev.preventDefault();
  if (etat.action?.type === 'pince') return;
  const s = posEcran(ev);
  etat.souris = s;
  const mul = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 800 : 1;
  if (ev.ctrlKey) { zoomer(s, Math.exp(-ev.deltaY * mul * 0.01)); return; }
  if (ev.shiftKey) { decaler(-(ev.deltaY || ev.deltaX) * mul, 0); return; }
  zoomer(s, Math.exp(-ev.deltaY * mul * 0.0015));
}

// ---------- Pince à deux doigts ----------
// Un 2e doigt arrive : le geste du 1er doigt est annulé (sauf un tracé déjà commencé avant).
function annulerGeste() {
  const b = bas;
  bas = null;
  let a = etat.action;
  if (a?.type === 'vue' || a?.type === 'pince') a = a.avant || null;
  if (!b) return a;
  switch (b.type) {
    case 'choisir': if (b.parti) defaire(a); return null;
    case 'crayon': return null;
    case 'gomme': defaire(a); return null;
    case 'trace': return null;
    case 'croquis': defaire(a); return a;
    default: return a;
  }
}

function commencerPince() {
  const avant = annulerGeste();
  const [p1, p2] = [...pointeurs.values()];
  etat.action = {
    type: 'pince', avant,
    c: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2],
    d: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
  };
  etat.acc = null;
  etat.survol = null;
  demanderDessin();
}

function majPince() {
  const a = etat.action;
  const [p1, p2] = [...pointeurs.values()];
  const c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  decaler(c[0] - a.c[0], c[1] - a.c[1]);
  if (a.d > 1 && d > 1) zoomer(c, d / a.d);
  a.c = c;
  a.d = d;
}

// ---------- Barres ----------
function ajouterBarre(p, q, type) {
  const f = feuille();
  if (!f || dist(p, q) < EPS) return null;
  const na = obtenirNoeud(p, f);
  const nb = obtenirNoeud(q, f);
  if (na === nb) return null;
  const b = { id: uid('b'), a: na.id, b: nb.id, type, ...reglagesBarre(type, p, q) };
  f.barres.push(b);
  couperParNoeuds(b, f);
  nettoyerBarres(f);
  modifie();
  return b;
}

// Clic pendant un tracé : une barre jusqu'au point, et on continue depuis là.
function cliquerTrace() {
  const a = etat.action;
  const p = etat.acc?.p || etat.monde;
  if (a?.type !== 'trace' || !p || dist(a.A, p) < EPS) return;
  ajouterBarre(a.A, p, a.barre);
  if (SANS_SUITE.has(a.barre)) { finirAction(); return; }
  if (etat.action === a) a.A = p.slice();
  majPointeur();
}

// Chiffres tapés pendant un tracé : « 3.5 » ou « 3.5 ; 30 » (longueur en m ; angle en °).
function saisieLongueur(premier) {
  const a = etat.action;
  if (a?.type !== 'trace') return;
  ouvrirEditeur({
    s: etat.souris || versEcran(a.A[0], a.A[1]),
    valeur: premier,
    garderTexte: true,
    placeholder: '3.5 ; 30',
    aide: 'Longueur en m ; angle en ° (sans angle : vers la souris)',
    surBlur: 'annuler',
    valider: (v) => {
      if (etat.action !== a) return;
      const r = v.replace(/,/g, '.').match(RE_LONGUEUR);
      if (!r) { toast('Pas compris : écris par exemple 3.5 ou 3.5 ; 30', true); return; }
      const L = +r[1];
      if (!(Math.abs(L) > 1e-6)) return;
      let ang;
      if (r[2] !== undefined) ang = (+r[2] * Math.PI) / 180;
      else {
        const m = etat.acc?.p || etat.monde;
        const dir = m && dist(m, a.A) > 1e-9 ? Math.atan2(m[1] - a.A[1], m[0] - a.A[0]) : 0;
        ang = Math.round(dir / CRAN) * CRAN;
      }
      const B = [arr(a.A[0] + L * Math.cos(ang)), arr(a.A[1] + L * Math.sin(ang))];
      ajouterBarre(a.A, B, a.barre);
      if (SANS_SUITE.has(a.barre)) { finirAction(); return; }
      if (etat.action === a) a.A = B;
      majPointeur();
    },
  });
}

// ---------- Nœuds ----------
function poserNoeud(type) {
  const f = feuille();
  const acc = etat.acc;
  if (!f || !acc) return;
  if (acc.type === 'noeud') {
    const n = trouver(acc.id, f);
    if (n && n.type !== type) { n.type = type; modifie(); }
    return;
  }
  const surBarre = acc.type === 'barre' || acc.type === 'milieu' || acc.type === 'point';
  if (type === 'libre' && !surBarre) { toast('Un nœud libre se pose sur une barre : clic sur la barre'); return; }
  const n = obtenirNoeud(acc.p, f, type);
  n.type = type;
  modifie();
}

// ---------- Cotes, textes ----------
function cliquerCote() {
  const f = feuille();
  const m = etat.monde;
  if (!f || !m) return;
  const acc = etat.acc;
  const point = () => {
    const p = acc?.p || m;
    const o = { x: p[0], y: p[1] };
    if (acc?.type === 'noeud') o.n = acc.id;
    return o;
  };
  const a = etat.action;
  if (a?.type !== 'cote') {
    etat.action = { type: 'cote', A: point() };
    majPointeur();
    return;
  }
  if (!a.B) {
    const B = point();
    if (Math.hypot(B.x - a.A.x, B.y - a.A.y) < 1e-6) return;
    a.B = B;
    majPointeur();
    return;
  }
  f.cotes.push({ id: uid('c'), a: a.A, b: a.B, decalage: decalageCote([a.A.x, a.A.y], [a.B.x, a.B.y], m) });
  etat.action = null;
  modifie();
  majPointeur();
}

function poserTexte(s) {
  const p = (etat.acc?.p || etat.monde).slice();
  ouvrirEditeur({
    s,
    placeholder: 'Texte',
    aide: 'Entrée : poser · Échap : annuler',
    surBlur: 'valider',
    valider: (v) => {
      const t = v.trim();
      const f = feuille();
      if (!t || !f) return;
      f.textes.push({ id: uid('t'), x: p[0], y: p[1], texte: t, taille: 2 });
      modifie();
    },
  });
}

function modifierTexte(id, s) {
  const f = feuille();
  const o = trouver(id, f);
  if (!o) return;
  if (id[0] === 't') {
    ouvrirEditeur({
      s, valeur: o.texte, garderTexte: true, aide: 'Entrée : valider · vide : effacer le texte', surBlur: 'valider',
      valider: (v) => {
        const t = v.trim();
        if (t) o.texte = t;
        else { retirer(id, f); etat.sel.delete(id); }
        modifie();
      },
    });
    return;
  }
  const N = carteNoeuds(f);
  const L = dist(pointCote(o.a, N), pointCote(o.b, N));
  ouvrirEditeur({
    s, valeur: o.texte || '', garderTexte: true, placeholder: fr(L), aide: 'Texte de la cote · vide : la longueur mesurée', surBlur: 'valider',
    valider: (v) => {
      const t = v.trim();
      if (t) o.texte = t;
      else delete o.texte;
      modifie();
    },
  });
}

// ---------- Crayon, gomme ----------
function finirCrayon() {
  const a = etat.action;
  etat.action = null;
  const f = feuille();
  if (a?.type !== 'crayon' || !f || a.pts.length < 2) { demanderDessin(); return; }
  const mm = (v) => Math.round(v * 1000) / 1000;
  const brut = simplifier(a.pts, 1.2 / etat.vue.z).map((p) => [mm(p[0]), mm(p[1])]);
  const pts = brut.filter((p, i) => i === 0 || p[0] !== brut[i - 1][0] || p[1] !== brut[i - 1][1]);
  if (pts.length < 2) { demanderDessin(); return; }
  f.traits.push({ id: uid('s'), pts });
  modifie();
}

function gommer(m) {
  const a = etat.action;
  const f = feuille();
  if (a?.type !== 'gomme' || !f || !m) return;
  const id = chercher(etat.prims, m, tolerance(), (pr) => sansNoeud(pr) && !a.faits.has(pr.id));
  if (!id || !retirer(id, f)) return;
  a.faits.add(id);
  a.n++;
  etat.sel.delete(id);
  demanderDessin();
}

function finirGomme() {
  const a = etat.action;
  etat.action = null;
  if (a?.type === 'gomme' && a.n) { nettoyerBarres(feuille(), a.relies); modifie(); }
  majPointeur();
}

// ---------- Choisir, déplacer ----------
function cliquerChoisir(b) {
  const id = b.cible && trouver(b.cible, feuille()) ? b.cible : null;
  if (id) {
    if (b.shift) { if (etat.sel.has(id)) etat.sel.delete(id); else etat.sel.add(id); }
    else { etat.sel.clear(); etat.sel.add(id); }
  } else if (!b.shift) {
    etat.sel.clear();
  }
  rafraichir();
}

// Point de la sélection qui s'accroche pendant le glissé : le nœud le plus proche du clic.
function refDeplacement(prises, m0, f) {
  const N = carteNoeuds(f);
  let best = null;
  let bd = Infinity;
  for (const id of prises.noeuds) {
    const n = N.get(id);
    if (!n) continue;
    const d = Math.hypot(n.x - m0[0], n.y - m0[1]);
    if (d < bd) { bd = d; best = [n.x, n.y]; }
  }
  if (best) return best;
  for (const id of prises.textes) {
    const t = trouver(id, f);
    if (t) return [t.x, t.y];
  }
  const pas = etat.pas || 0.25;
  return [Math.round(m0[0] / pas) * pas, Math.round(m0[1] / pas) * pas];
}

function commencerGlisse(b) {
  const f = feuille();
  const id = b.cible;
  if (!id || !trouver(id, f)) {
    etat.action = { type: 'cadre', s0: b.s, s1: b.s, shift: b.shift };
    return;
  }
  if (!etat.sel.has(id)) {
    if (!b.shift) etat.sel.clear();
    etat.sel.add(id);
  }
  const seul = etat.sel.size === 1;
  if (seul && id[0] === 'n') {
    const n = trouver(id, f);
    etat.action = { type: 'glisser-noeud', id, x0: n.x, y0: n.y };
  } else if (seul && id[0] === 'c') {
    const c = trouver(id, f);
    etat.action = { type: 'cote-decalage', id, d0: c.decalage ?? 1 };
  } else {
    const prises = prisesDeplacement(f);
    etat.action = { type: 'glisser', prises, snap: instantane(prises, f), ref: refDeplacement(prises, b.m, f), m0: b.m };
  }
  rafraichir();
}

function suivreGlisse(s, m) {
  const a = etat.action;
  const f = feuille();
  if (!a || !f) return;
  switch (a.type) {
    case 'cadre': a.s1 = s; break;
    case 'glisser-noeud': {
      const n = trouver(a.id, f);
      const p = etat.acc?.p || m;
      if (n) { n.x = p[0]; n.y = p[1]; synchroCotes(f); }
      break;
    }
    case 'cote-decalage': {
      const c = trouver(a.id, f);
      if (c) {
        const N = carteNoeuds(f);
        c.decalage = decalageCote(pointCote(c.a, N), pointCote(c.b, N), m);
      }
      break;
    }
    case 'glisser': {
      const p = etat.acc?.p || add(a.ref, sub(m, a.m0));
      appliquerDelta(a.snap, p[0] - a.ref[0], p[1] - a.ref[1], f);
      break;
    }
    default: break;
  }
  demanderDessin();
}

function finirGlisse() {
  const a = etat.action;
  const f = feuille();
  etat.action = null;
  if (!a || !f) return;
  switch (a.type) {
    case 'cadre': choisirCadre(a); break;
    case 'glisser-noeud': apresDeplacement([a.id], f); modifie(); break;
    case 'glisser': apresDeplacement(a.prises.noeuds, f); modifie(); break;
    case 'cote-decalage': modifie(); break;
    default: break;
  }
  majPointeur();
}

// Cadre : barres, cotes, textes et traits entièrement dedans ; les nœuds seulement si rien d'autre.
function choisirCadre(a) {
  const f = feuille();
  if (!f) return;
  const [xa, ya] = versMonde(a.s0[0], a.s0[1]);
  const [xb, yb] = versMonde(a.s1[0], a.s1[1]);
  const x0 = Math.min(xa, xb);
  const x1 = Math.max(xa, xb);
  const y0 = Math.min(ya, yb);
  const y1 = Math.max(ya, yb);
  const dedans = (p) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const N = carteNoeuds(f);
  const pris = [];
  for (const b of f.barres) {
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (A && B && dedans([A.x, A.y]) && dedans([B.x, B.y])) pris.push(b.id);
  }
  for (const c of f.cotes) if (dedans(pointCote(c.a, N)) && dedans(pointCote(c.b, N))) pris.push(c.id);
  for (const t of f.textes) if (dedans([t.x, t.y])) pris.push(t.id);
  for (const s of f.traits) if (s.pts.every((p) => dedans(p))) pris.push(s.id);
  if (!pris.length) for (const n of f.noeuds) if (dedans([n.x, n.y])) pris.push(n.id);
  if (!a.shift) etat.sel.clear();
  for (const id of pris) etat.sel.add(id);
  rafraichir();
}

// ---------- Copier-coller, symétrie, croquis ----------
function poserCopie() {
  const a = etat.action;
  const dx = a.p[0] - a.copie.ref[0];
  const dy = a.p[1] - a.copie.ref[1];
  etat.action = null;
  insererCopie(a.copie, (p) => [p[0] + dx, p[1] + dy]);
  majPointeur();
}

function poserSymetrie() {
  const a = etat.action;
  const X = a.axe;
  etat.action = null;
  insererCopie(a.copie, (p) => [2 * X - p[0], p[1]], true);
  majPointeur();
}

function cliquerEtalon(s) {
  const a = etat.action;
  const m = etat.monde;
  if (!m) return;
  if (!a.P1) { a.P1 = m.slice(); majPointeur(); return; }
  if (a.P2) return;
  const P1 = a.P1;
  const P2 = m.slice();
  const mesure = dist(P1, P2);
  if (mesure < 1e-6) return;
  a.P2 = P2;
  majPointeur();
  ouvrirEditeur({
    s, placeholder: fr(mesure), aide: 'Vraie distance entre les 2 points, en m', surBlur: 'annuler',
    valider: (v) => {
      const D = parseFloat(String(v).replace(',', '.'));
      etat.action = null;
      if (etalonner(P1, P2, D)) toast(`Croquis à l’échelle : ${fr(mesure)} m sur le dessin = ${fr(D)} m`);
      else toast('Distance pas comprise : écris un nombre en m', true);
      majPointeur();
      rafraichir();
    },
    annuler: () => { etat.action = null; majPointeur(); rafraichir(); },
  });
}

function commencerFond(m, s) {
  const c = feuille()?.croquis;
  const a = etat.action;
  if (!c || !m) return;
  a.drag = { m0: m.slice(), c0: [c.cx, c.cy] };
  bas = { type: 'croquis', s };
  demanderDessin();
}

function deplacerFond(m) {
  const a = etat.action;
  const c = feuille()?.croquis;
  if (a?.type !== 'croquis' || !a.drag || !c || !m) return;
  c.cx = arr(a.drag.c0[0] + m[0] - a.drag.m0[0]);
  c.cy = arr(a.drag.c0[1] + m[1] - a.drag.m0[1]);
  demanderDessin();
}

function finirFond() {
  const a = etat.action;
  if (a?.type !== 'croquis' || !a.drag) return;
  a.drag = null;
  modifie();
}

// ---------- Presse-papiers ----------
function repli(fn) {
  clearTimeout(attente);
  attente = setTimeout(() => { attente = 0; fn(); }, 150);
}

// Ctrl+C / Ctrl+X : copie interne + une marque dans le presse-papiers (pour ne pas recoller une vieille image).
function surCopie(ev, couper) {
  if (estSaisie(ev.target)) return;
  clearTimeout(attente);
  attente = 0;
  ev.preventDefault();
  if (!copier()) return;
  try { ev.clipboardData?.setData('text/plain', MARQUE); } catch { /* rien */ }
  if (couper) supprimerSelection();
}

function surCollage(ev) {
  if (estSaisie(ev.target)) return;
  clearTimeout(attente);
  attente = 0;
  ev.preventDefault();
  const items = [...(ev.clipboardData?.items || [])];
  const img = items.find((i) => i.kind === 'file' && /^image\//.test(i.type));
  const fic = img?.getAsFile();
  if (fic) { envoyerImage(fic); return; }
  if (aCopie()) coller();
  else toast('Rien à coller : choisis des éléments puis Ctrl+C, ou copie une image');
}

// ---------- Clavier ----------
function surTouche(ev) {
  const k = ev.key;
  if (k === 'Shift' || k === 'Alt') {
    if (k === 'Shift') etat.touches.shift = true;
    if (k === 'Alt') { etat.touches.alt = true; ev.preventDefault(); }
    majPointeur();
    return;
  }
  if (estSaisie(ev.target) || editeurOuvert()) return;
  const l = k.length === 1 ? k.toLowerCase() : k;
  if (ev.ctrlKey || ev.metaKey) {
    if (l === 'z') { ev.preventDefault(); if (ev.shiftKey) retablir(); else annuler(); }
    else if (l === 'y') { ev.preventDefault(); retablir(); }
    else if (l === 'a') {
      ev.preventDefault();
      if (etat.outil !== 'selection') choisirOutil('selection');
      else arreter();
      toutSelectionner();
      rafraichir();
    }
    else if (l === 'c') repli(() => copier());
    else if (l === 'x') repli(() => { if (copier()) supprimerSelection(); });
    else if (l === 'v') repli(() => { if (aCopie()) coller(); });
    else if (l === 'd') { ev.preventDefault(); dupliquer(); }
    else if (l === 's') { ev.preventDefault(); sauver(); }
    return;
  }
  if (ev.altKey) return;
  if (k === ' ') {
    ev.preventDefault();
    if (!etat.touches.espace) { etat.touches.espace = true; demanderDessin(); }
    return;
  }
  if (k === 'Escape') {
    ev.preventDefault();
    if (etat.action) finirAction();
    else if (etat.sel.size) { etat.sel.clear(); rafraichir(); }
    else if (etat.outil !== 'selection') choisirOutil('selection');
    return;
  }
  if (k === 'Enter') {
    if (etat.action) { ev.preventDefault(); finirAction(); }
    return;
  }
  if (k === 'Delete' || k === 'Backspace') {
    if (!etat.action && etat.sel.size) { ev.preventDefault(); supprimerSelection(); }
    return;
  }
  if (etat.action?.type === 'trace' && /^[0-9.,-]$/.test(k)) {
    ev.preventDefault();
    saisieLongueur(k);
    return;
  }
  const fl = FLECHES[k];
  if (fl) {
    ev.preventDefault();
    if (etat.sel.size && !etat.action) {
      const d = (etat.pas || 0.25) * (ev.shiftKey ? 10 : 1);
      deplacerSelection(fl[0] * d, fl[1] * d);
    } else {
      decaler(-fl[0] * 80, fl[1] * 80);
    }
    return;
  }
  if (ev.repeat) return;
  if (k === '+' || k === '=') { zoomerCentre(1.25); return; }
  if (k === '-') { zoomerCentre(1 / 1.25); return; }
  if (l === 'f') { cadrerVue(); return; }
  const o = TOUCHES[modeFeuille()][l];
  if (o) { ev.preventDefault(); choisirOutil(o); }
}

function surRelache(ev) {
  const k = ev.key;
  if (k === ' ') {
    if (ev.target && ev.target.tagName === 'BUTTON') ev.preventDefault();
    etat.touches.espace = false;
    demanderDessin();
    return;
  }
  if (k === 'Shift' || k === 'Alt') {
    if (k === 'Shift') etat.touches.shift = false;
    if (k === 'Alt') { etat.touches.alt = false; ev.preventDefault(); }
    majPointeur();
  }
}

function remettreTouches() {
  etat.touches.shift = false;
  etat.touches.alt = false;
  etat.touches.espace = false;
  demanderDessin();
}

// ---------- Démarrage ----------
export function initOutils() {
  svg = document.getElementById('dessin');
  construireBarre();
  brancherPointeur(majPointeur);
  if (svg) {
    svg.addEventListener('pointerdown', surBas);
    svg.addEventListener('pointermove', surMouvement);
    svg.addEventListener('pointerup', surHaut);
    svg.addEventListener('pointercancel', surAnnule);
    svg.addEventListener('pointerleave', surSortie);
    svg.addEventListener('dblclick', surDouble);
    svg.addEventListener('contextmenu', (ev) => ev.preventDefault());
    svg.addEventListener('mousedown', (ev) => { if (ev.button === 1) ev.preventDefault(); });
    svg.addEventListener('wheel', surMolette, { passive: false });
  }
  window.addEventListener('keydown', surTouche);
  window.addEventListener('keyup', surRelache);
  window.addEventListener('blur', remettreTouches);
  document.addEventListener('copy', (ev) => surCopie(ev, false));
  document.addEventListener('cut', (ev) => surCopie(ev, true));
  document.addEventListener('paste', surCollage);
  document.getElementById('terminer')?.addEventListener('click', () => finirAction());
}
