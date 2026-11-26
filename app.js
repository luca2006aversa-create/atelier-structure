// Atelier structure : démarrage, liens entre les modules, boutons du haut et de la 3D.
import {
  etat, feuille, crochets, rafraichir, initHistorique, modifie, peutAnnuler, peutRetablir,
  annuler, retablir, appliquerVue, allerFeuille, toast, uid, memoriserVue, paireDe,
} from './etat.js';
import { estPlan } from './geometrie.js';
import { initScene, demanderDessin, zoomerCentre, cadrerVue } from './scene.js';
import { initOutils, finirAction, majModeOutils } from './outils.js';
import { initPanneau, dessinerPanneau } from './panneau.js';
import { poserPictos } from './pictos.js';
import { chargerListe, envoyerImage } from './croquis.js';
import { charger, planifier, sauver, feuilleVide, tourPartage, etatSauvegarde } from './sauvegarde.js';
import { brancherFinir } from './commandes.js';
import { Vue3D } from './vue3d.js';
import { dessinerCalcul } from './calcul.js';
import { dessinerBilan } from './bilan.js';
import { enLigne, telecharger } from './mode.js';
import { projet, avecProjet } from './projet.js';
import { schema, MODES } from './schema.js';
import { jsonRhino, resumeRhino } from './rhino.js';
import { FORMATS } from './cao.js';
import { ecouter, verifierCode, retenirCode, session, peutEcrire } from './partage.js';
import { trier, copie } from './fusion.js';

const $ = (id) => document.getElementById(id);
const CLE_REGLAGES = 'atelier-structure-reglages';
let vue3d = null;

// ---------- Onglets des feuilles et versions du projet (V1, V2, V3…) ----------
// Une version = tout le projet : ses coupes et ses plans. Chaque feuille garde son « groupe » d'une version
// à l'autre ; « v » dit à quelle version elle appartient. Les onglets montrent la version ouverte.
const vOuverte = () => feuille()?.v || 1;
const dansVersion = (v = vOuverte()) => etat.doc.feuilles.filter((f) => f.v === v);
const numerosVersions = () => [...new Set(etat.doc.feuilles.map((f) => f.v))].sort((a, b) => a - b);

function groupes() {
  const g = new Map();
  for (const f of dansVersion()) if (!g.has(f.groupe)) g.set(f.groupe, f);
  return g;
}

function onglets() {
  const box = $('feuilles');
  const vbox = $('versions');
  if (!box || !etat.doc) return;
  const ouverte = feuille();
  const cle = etat.doc.feuilles.map((f) => [f.id, f.nom, f.groupe, f.v, f.type].join('|')).join('/') + '#' + ouverte?.id;
  if (box.dataset.cle === cle) return;
  box.dataset.cle = cle;
  box.textContent = '';
  for (const f of dansVersion()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = f.id;
    b.textContent = f.nom;
    b.title = f.nom + ' (double-clic : renommer)';
    if (f.id === ouverte?.id) b.className = 'on';
    box.appendChild(b);
  }
  // L'onglet ouvert reste visible, même au bout d'une longue rangée.
  box.querySelector('button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // Versions du projet
  vbox.textContent = '';
  for (const v of numerosVersions()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = v;
    b.textContent = 'V' + v;
    b.title = 'Version ' + v + ' du projet : ' + dansVersion(v).length + ' feuilles';
    if (v === vOuverte()) b.className = 'on';
    vbox.appendChild(b);
  }
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'plus';
  plus.dataset.act = 'version';
  plus.title = 'Nouvelle version du projet (copie de toutes les feuilles de V' + vOuverte() + ')';
  plus.textContent = '+ V';
  vbox.appendChild(plus);
}

const allerId = (id) => {
  const i = etat.doc.feuilles.findIndex((f) => f.id === id);
  if (i >= 0 && i !== etat.fi) allerFeuille(i);
};

// Changer de version : on reste sur la même feuille (même groupe) si elle existe dans l'autre version.
function allerVersion(v) {
  const f = feuille();
  if (!f || f.v === v) return;
  memoriserVue();
  etat.sel.clear();
  const cible = etat.doc.feuilles.find((x) => x.v === v && x.groupe === f.groupe) || dansVersion(v)[0];
  if (cible) allerId(cible.id);
}

// « + V » : copie de toute la version ouverte (coupes et plans), liens coupe ↔ plan refaits entre les copies.
function nouvelleVersion() {
  const f = feuille();
  if (!f) return;
  memoriserVue();
  const v0 = f.v;
  const v1 = Math.max(...numerosVersions()) + 1;
  const neuves = new Map(); // ancien id → copie
  for (const x of dansVersion(v0)) {
    const n = copie(x);
    n.id = uid('f');
    n.v = v1;
    n.vp = 1;
    neuves.set(x.id, n);
  }
  for (const n of neuves.values()) {
    if (n.paire) { const p = neuves.get(n.paire); if (p) n.paire = p.id; else delete n.paire; }
    etat.doc.feuilles.push(n);
  }
  trier(etat.doc.feuilles);
  allerId(neuves.get(f.id).id);
  modifie();
  toast('Version V' + v1 + ' créée : copie des ' + neuves.size + ' feuilles de V' + v0);
}

// Coupe ↔ plan : deux vues séparées d'un même bâtiment. On saute vers la feuille liée,
// ou on la crée (vide, liée des deux côtés). Une feuille encore vide change juste de type.
function basculerVue(plan) {
  const f = feuille();
  if (!f || estPlan(f) === plan) return;
  etat.sel.clear();
  const p = paireDe(f);
  if (p && estPlan(p) === plan) { memoriserVue(); allerId(p.id); return; }
  if (!f.noeuds.length && !f.barres.length && !p) {
    f.type = plan ? 'plan' : 'coupe';
    if (plan && !(f.etage > 0)) f.etage = 2.7;
    modifie();
    toast(plan ? 'Feuille en plan : vue de dessus' : 'Feuille en coupe');
    return;
  }
  memoriserVue();
  const base = f.nom.replace(/\s*·\s*(plan|coupe)$/i, '');
  const n = feuilleVide(base + (plan ? ' · plan' : ' · coupe'), (f.ordre ?? 0) + 0.5, plan ? 'plan' : 'coupe');
  n.v = f.v;
  n.paire = f.id;
  f.paire = n.id;
  n.trois_d = { ...(f.trois_d || {}) }; // même entraxe : le plan et la coupe parlent des mêmes portiques
  etat.doc.feuilles.push(n);
  trier(etat.doc.feuilles);
  allerId(n.id);
  modifie();
  toast(plan ? 'Plan créé, lié à la coupe : sa structure s’affiche en gris' : 'Coupe créée, liée au plan');
}

function brancherOnglets() {
  const box = $('feuilles');
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-id]');
    if (b) allerId(b.dataset.id);
  });
  $('versions').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'version') nouvelleVersion();
    else if (b.dataset.v) allerVersion(+b.dataset.v);
  });
  // Double-clic sur un onglet : on vide la sélection et on donne la main au champ « Nom » du panneau.
  box.addEventListener('dblclick', (ev) => {
    if (!ev.target.closest('button[data-id]')) return;
    etat.sel.clear();
    rafraichir();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.querySelector('#panneau [data-champ="f.nom"]');
      if (c) { c.focus(); c.select(); }
    }));
  });
  // « + » : petit menu pour choisir une coupe (portique) ou un plan (vue de dessus).
  const menu = $('menu-feuille');
  const fermerMenu = () => { menu.hidden = true; $('b-feuille').setAttribute('aria-expanded', 'false'); };
  $('b-feuille').addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!etat.doc) return;
    if (!menu.hidden) { fermerMenu(); return; }
    const r = $('b-feuille').getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - 230)) + 'px';
    menu.style.top = r.bottom + 6 + 'px';
    menu.hidden = false;
    $('b-feuille').setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!menu.hidden && !menu.contains(ev.target) && !$('b-feuille').contains(ev.target)) fermerMenu();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !menu.hidden) fermerMenu(); });
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-type]');
    if (!b) return;
    fermerMenu();
    const type = b.dataset.type;
    const base = type === 'plan' ? 'Plan ' : 'Feuille ';
    const noms = new Set(etat.doc.feuilles.map((f) => f.nom));
    let n = type === 'plan' ? 1 : groupes().size + 1;
    while (noms.has(base + n)) n++;
    const ordre = Math.max(0, ...etat.doc.feuilles.map((f) => f.ordre ?? 0)) + 1;
    const f = feuilleVide(base + n, ordre, type);
    f.v = vOuverte();
    etat.doc.feuilles.push(f);
    trier(etat.doc.feuilles);
    allerId(f.id);
    modifie();
  });
}

// ---------- Travail à plusieurs : code d'équipe ----------
function ouvrirCode() {
  const d = $('d-code');
  if (d.open) return;
  $('code-equipe').value = session.code || '';
  $('code-pseudo').value = session.pseudo || '';
  $('code-erreur').textContent = '';
  d.showModal();
  setTimeout(() => $(session.code ? 'code-pseudo' : 'code-equipe').focus(), 30);
}

function brancherPartage() {
  if (!enLigne) return;
  const d = $('d-code');
  const etatEl = $('etat');
  etatEl.classList.add('cliquable');
  etatEl.title = 'Travail à plusieurs : clique pour entrer le code d’équipe';
  etatEl.addEventListener('click', ouvrirCode);
  $('code-annuler').addEventListener('click', () => d.close());
  $('f-code').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const code = $('code-equipe').value.trim().toUpperCase();
    const pseudo = $('code-pseudo').value.trim().slice(0, 40);
    if (!pseudo) { $('code-erreur').textContent = 'Écris ton prénom (les autres le voient).'; return; }
    try {
      if (!(await verifierCode(code))) { $('code-erreur').textContent = 'Code faux.'; return; }
    } catch (e) {
      $('code-erreur').textContent = 'Base pas jointe : ' + e.message;
      return;
    }
    retenirCode(code, pseudo);
    d.close();
    toast('Bienvenue ' + pseudo + ' : tes changements sont partagés');
    etatSauvegarde('attente', 'Envoi…');
    await tourPartage();
  });
}

// ---------- Annuler / rétablir ----------
function boutons() {
  const a = $('b-annuler');
  const r = $('b-retablir');
  if (a) a.disabled = !peutAnnuler();
  if (r) r.disabled = !peutRetablir();
  majModeOutils(); // coupe ou plan : la barre d'outils suit la feuille
}

// ---------- Taille de la scène ----------
function mesurer() {
  const r = $('scene').getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width));
  const H = Math.max(1, Math.round(r.height));
  if (W === etat.W && H === etat.H) return false;
  etat.W = W; // le centre de la vue reste au même endroit du dessin
  etat.H = H;
  return true;
}

// ---------- Réglages du bas : pas de la grille, aimant, zoom ----------
function lireReglages() {
  try { return JSON.parse(localStorage.getItem(CLE_REGLAGES) || '{}') || {}; } catch { return {}; }
}
function garderReglages() {
  try { localStorage.setItem(CLE_REGLAGES, JSON.stringify({ pas: etat.pas, aimant: etat.aimant })); } catch { /* navigateur privé */ }
}

function brancherReglages() {
  const r = lireReglages();
  const pas = $('pas');
  const aimant = $('aimant');
  if ([...pas.options].some((o) => +o.value === r.pas)) etat.pas = r.pas;
  if (typeof r.aimant === 'boolean') etat.aimant = r.aimant;
  pas.value = String(etat.pas);
  aimant.checked = etat.aimant;
  pas.addEventListener('change', () => {
    etat.pas = +pas.value || 0.25;
    garderReglages();
    pas.blur(); // les raccourcis clavier reprennent tout de suite
    demanderDessin();
    dessinerPanneau();
  });
  aimant.addEventListener('change', () => {
    etat.aimant = aimant.checked;
    garderReglages();
    aimant.blur();
  });
  $('b-zoom-moins').addEventListener('click', () => zoomerCentre(1 / 1.25));
  $('b-zoom-plus').addEventListener('click', () => zoomerCentre(1.25));
  $('b-cadrer').addEventListener('click', () => cadrerVue());
  $('b-annuler').addEventListener('click', () => annuler());
  $('b-retablir').addEventListener('click', () => retablir());
}

// ---------- Vue 3D ----------
const carte = () => $('carte3d');

function champs3D() {
  const plan = feuille()?.type === 'plan';
  // Sur un plan, la 3D monte les murs à la hauteur de la feuille : pas d'entraxe ni de nombre.
  for (const id of ['entraxe', 'nombre']) $(id).closest('label').hidden = plan;
  $('hauteur3d').hidden = !plan;
  if (plan) $('hauteur3d').textContent = 'Murs : ' + String(feuille().etage || 2.7).replace('.', ',') + ' m de haut';
  const t = feuille()?.trois_d || { entraxe: 6, nombre: 4 };
  for (const [id, v] of [['entraxe', t.entraxe], ['nombre', t.nombre]]) {
    const el = $(id);
    if (el && document.activeElement !== el) el.value = String(v);
  }
}

function maj3D() {
  if (!vue3d || carte().hidden) return;
  champs3D();
  vue3d.demander();
}

function basculer3D(ouvrir = carte().hidden) {
  carte().hidden = !ouvrir;
  const b = $('b-3d');
  b.classList.toggle('principal', ouvrir);
  b.setAttribute('aria-pressed', String(ouvrir));
  if (ouvrir) maj3D();
}

// Valeur lue dans un champ de la 3D : null si elle n'est pas valable.
function valeur3D(id, el) {
  const v = parseFloat(String(el.value).replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  if (id === 'entraxe') return v >= 0.5 ? Math.min(Math.round(v * 100) / 100, 100) : null;
  const n = Math.round(v);
  return n >= 1 ? Math.min(n, 40) : null;
}

function brancher3D() {
  vue3d = new Vue3D($('canvas3d'), () => ({ feuille: feuille(), sel: etat.sel, feuilles: dansVersion(), tout: vue3d.tout }));
  vue3d.tout = true;
  // Clic dans la 3D : sélectionne la barre ou le mur visé (clic dans le vide : rien).
  // Dans « Tout », un clic sur une autre feuille l'ouvre d'abord.
  vue3d.choisir = (id, fid) => {
    if (id && fid && fid !== feuille()?.id) allerId(fid);
    if (!id && !etat.sel.size) return;
    etat.sel.clear();
    if (id) etat.sel.add(id);
    rafraichir();
  };
  const bTout = $('b-3d-tout');
  bTout.addEventListener('click', () => {
    vue3d.tout = !vue3d.tout;
    bTout.classList.toggle('on', vue3d.tout);
    bTout.setAttribute('aria-pressed', String(vue3d.tout));
    bTout.title = vue3d.tout ? 'Tout le bâtiment (toutes les feuilles de la version)' : 'Cette feuille seulement';
    vue3d.demander();
  });
  new ResizeObserver(() => { if (!carte().hidden) vue3d.demander(); }).observe($('canvas3d'));
  $('b-3d').addEventListener('click', () => basculer3D());
  brancherExport();
  $('b-3d-png').addEventListener('click', exporterImage3D);
  $('b-3d-fermer').addEventListener('click', () => basculer3D(false));
  const bVol = $('b-3d-volumes');
  bVol.addEventListener('click', () => {
    vue3d.volumes = !vue3d.volumes;
    bVol.classList.toggle('on', vue3d.volumes);
    bVol.title = vue3d.volumes ? 'Volumes / traits' : 'Traits / volumes';
    vue3d.demander();
  });
  $('b-3d-grand').addEventListener('click', () => {
    carte().classList.toggle('grand');
    vue3d.demander();
  });
  for (const id of ['entraxe', 'nombre']) {
    const el = $(id);
    // Pendant la frappe : la 3D suit, sans toucher à l'historique.
    el.addEventListener('input', () => {
      const f = feuille();
      const v = valeur3D(id, el);
      if (!f || v === null) return;
      f.trois_d = { entraxe: 6, nombre: 4, ...f.trois_d, [id]: v };
      vue3d.demander();
    });
    // À la validation : on garde (annulable), ou on remet la dernière bonne valeur.
    el.addEventListener('change', () => {
      const f = feuille();
      const v = valeur3D(id, el);
      if (!f) return;
      if (v === null) {
        toast(id === 'entraxe' ? 'Entraxe : au moins 0,5 m' : 'Nombre : de 1 à 40', true);
        el.value = String(f.trois_d?.[id] ?? (id === 'entraxe' ? 6 : 4));
        return;
      }
      f.trois_d = { entraxe: 6, nombre: 4, ...f.trois_d, [id]: v };
      el.value = String(v);
      modifie();
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === 'Escape') el.blur();
    });
  }
}

// ---------- Passerelle Rhino / Grasshopper ----------
// On enregistre la structure (axes, sections, matières) ; les scripts du dossier rhino/
// la rebâtissent en volumes dans Rhino, ou la rendent pilotable dans Grasshopper.
function exporterRhino() {
  const f = feuille();
  const r = f ? jsonRhino(f) : { erreur: 'Aucune feuille.' };
  if (r.erreur) { toast(r.erreur, true); return; }
  const nom = String(f.nom || 'structure').replace(/[^\w .-]+/g, '-');
  telecharger(nom + '.structure.json', r.texte, 'application/json');
  toast('Rhino : ' + resumeRhino(r.donnees));
}

// ---------- Export vers ArchiCAD, Revit, Rhino, AutoCAD ----------
// Un petit menu sous le bouton : chaque format dit quels logiciels l'ouvrent.
function brancherExport() {
  const bouton = $('b-3d-export');
  const menu = $('menu-export');
  const fermer = () => { menu.hidden = true; bouton.setAttribute('aria-expanded', 'false'); };
  bouton.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!menu.hidden) { fermer(); return; }
    const r = bouton.getBoundingClientRect();
    const w = 270;
    menu.style.left = Math.max(8, Math.min(r.right - w, document.documentElement.clientWidth - w - 8)) + 'px';
    menu.style.top = r.bottom + 6 + 'px';
    menu.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('pointerdown', (ev) => { if (!menu.hidden && !menu.contains(ev.target) && !bouton.contains(ev.target)) fermer(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !menu.hidden) fermer(); });
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-format]');
    if (!b) return;
    fermer();
    exporterCAO(b.dataset.format);
  });
}

function exporterCAO(format) {
  if (format === 'rhino') { exporterRhino(); return; }
  const f = feuille();
  const F = FORMATS[format];
  if (!f || !F) return;
  let r;
  try { r = F.faire(f); } catch (err) { console.error(err); r = { erreur: 'Export impossible : ' + err.message }; }
  if (r.erreur) { toast(r.erreur, true); return; }
  const nom = String(f.nom || 'structure').replace(/[^\w .-]+/g, '-');
  telecharger(nom + F.ext, r.texte, F.type);
  toast(format === 'dxf2d' ? 'Dessin 2D enregistré (mètres)' : r.n + ' éléments enregistrés (mètres)');
}

// Image de la vue 3D telle qu'elle est à l'écran (PNG, à la résolution de l'écran)
function exporterImage3D() {
  const f = feuille();
  if (!f || !vue3d) return;
  vue3d.dessiner();
  const nom = String(f.nom || 'structure').replace(/[^\w .-]+/g, '-');
  $('canvas3d').toBlob((blob) => {
    if (!blob) { toast('Image impossible à créer.', true); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom + ' - 3D.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Image 3D enregistrée');
  }, 'image/png');
}

// ---------- Schéma structurel ----------
// Une seule lecture à la fois : statique, effort normal, moment, déformée, taux.
let modeSchema = 'statique';
const carteSch = () => $('carte-schema');

function majSchema() {
  const box = carteSch();
  if (box.hidden) return;
  const f = feuille();
  const vue = $('sch-vue');
  const pied = $('sch-pied');
  const dire = (t) => { vue.textContent = ''; const p = document.createElement('p'); p.className = 'sch-vide'; p.textContent = t; vue.appendChild(p); pied.textContent = ''; };
  if (!f || f.type === 'plan') return dire('Le schéma se calcule sur une coupe : poteaux, poutres, treillis.');
  const r = schema(f, modeSchema, Math.max(320, vue.clientWidth), Math.max(240, vue.clientHeight));
  if (r.erreur) return dire(r.erreur);
  vue.innerHTML = r.svg;
  pied.textContent = (MODES.find((m) => m[0] === modeSchema) || MODES[0])[2];
  return undefined;
}

function basculerSchema(ouvrir = carteSch().hidden) {
  carteSch().hidden = !ouvrir;
  const b = $('b-schema');
  b.classList.toggle('principal', ouvrir);
  b.setAttribute('aria-pressed', String(ouvrir));
  if (ouvrir) majSchema();
}

function brancherSchema() {
  const tetes = $('sch-modes');
  for (const [cle, nom] of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = nom;
    b.dataset.mode = cle;
    b.classList.toggle('on', cle === modeSchema);
    b.addEventListener('click', () => {
      modeSchema = cle;
      for (const o of tetes.children) o.classList.toggle('on', o.dataset.mode === cle);
      majSchema();
    });
    tetes.appendChild(b);
  }
  $('b-schema').addEventListener('click', () => basculerSchema());
  $('b-sch-fermer').addEventListener('click', () => basculerSchema(false));
  $('b-sch-grand').addEventListener('click', () => {
    carteSch().classList.toggle('grand');
    majSchema();
  });
  $('b-sch-svg').addEventListener('click', () => {
    const f = feuille();
    const r = f ? schema(f, modeSchema, 1100, 700) : { erreur: 'Aucune feuille.' };
    if (r.erreur) { toast(r.erreur, true); return; }
    const nom = String(f.nom || 'schema').replace(/[^\w .-]+/g, '-');
    telecharger(nom + ' - ' + modeSchema + '.svg', r.svg);
  });
}

// ---------- Note de calcul ----------
// En haut : le calcul en direct de la feuille ouverte (bilan.js), recalculé à chaque changement.
// En dessous, pour le gymnase seulement : la note détaillée produite par Python (calcul.js).
let calculFait = false;
let minuteBilan = 0;
const avecNoteGymnase = () => projet === '' || projet === 'gymnase';

function majBilan() {
  if ($('calcul').hidden) return;
  clearTimeout(minuteBilan);
  minuteBilan = setTimeout(() => dessinerBilan($('bilan'), feuille()), 120);
}

function basculerCalcul(ouvrir = $('calcul').hidden) {
  const box = $('calcul');
  if (ouvrir && !calculFait) {
    box.innerHTML = '<div class="bilan" id="bilan"></div>' + (avecNoteGymnase() ? '<div class="bilan-fixe" id="calcul-fixe"></div>' : '');
    if (avecNoteGymnase()) {
      dessinerCalcul($('calcul-fixe'));
      $('calcul-fixe').insertAdjacentHTML('afterbegin', '<h2 class="a-titre bilan-sep">Note détaillée du gymnase</h2>');
    }
    // Clic sur une barre du graphique : on la sélectionne et on retourne au dessin.
    $('bilan').addEventListener('click', (ev) => {
      const id = ev.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      etat.sel.clear();
      etat.sel.add(id);
      basculerCalcul(false);
      rafraichir();
    });
    calculFait = true;
  }
  if (ouvrir) dessinerBilan($('bilan'), feuille());
  box.hidden = !ouvrir;
  $('b-calcul-fermer').hidden = !ouvrir;
  $('b-calcul').classList.toggle('principal', ouvrir);
  $('b-calcul').setAttribute('aria-pressed', String(ouvrir));
  if (ouvrir) box.scrollTop = 0;
}

function brancherCalcul() {
  $('b-calcul').addEventListener('click', () => basculerCalcul());
  $('b-calcul-fermer').addEventListener('click', () => basculerCalcul(false));
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('calcul').hidden) { ev.stopPropagation(); basculerCalcul(false); }
  }, true);
}

// ---------- Croquis : dossier, fichier, glisser-déposer ----------
const aDesFichiers = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');

function brancherCroquis() {
  if (enLigne) $('b-dossier').style.display = 'none'; // pas de dossier du PC en ligne
  $('b-dossier').addEventListener('click', async () => {
    try {
      const r = await fetch(avecProjet('/api/ouvrir?quoi=croquis'), { method: 'POST', headers: { 'X-Atelier': '1' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.erreur || 'erreur ' + r.status);
      toast('Dossier des croquis ouvert');
    } catch (e) {
      toast('Dossier pas ouvert : ' + e.message, true);
    }
  });

  $('fichier-image').addEventListener('change', async (ev) => {
    const fichier = ev.target.files?.[0];
    ev.target.value = ''; // pour pouvoir renvoyer la même image
    if (fichier) await envoyerImage(fichier);
  });

  const scene = $('scene');
  let profondeur = 0;
  scene.addEventListener('dragenter', (ev) => {
    if (!aDesFichiers(ev)) return;
    ev.preventDefault();
    profondeur++;
    scene.classList.add('depot');
  });
  scene.addEventListener('dragover', (ev) => {
    if (!aDesFichiers(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  });
  scene.addEventListener('dragleave', (ev) => {
    if (!aDesFichiers(ev)) return;
    profondeur = Math.max(0, profondeur - 1);
    if (!profondeur) scene.classList.remove('depot');
  });
  scene.addEventListener('drop', async (ev) => {
    if (!aDesFichiers(ev)) return;
    ev.preventDefault();
    profondeur = 0;
    scene.classList.remove('depot');
    const img = [...ev.dataTransfer.files].find((x) => /^image\//.test(x.type));
    if (!img) { toast('Dépose une image (jpg, png…)', true); return; }
    await envoyerImage(img);
  });
  // Une image lâchée à côté de la scène ne doit pas remplacer la page.
  window.addEventListener('dragover', (ev) => { if (aDesFichiers(ev)) ev.preventDefault(); });
  window.addEventListener('drop', (ev) => { if (aDesFichiers(ev)) ev.preventDefault(); });

  // Retour sur la page (après l'explorateur) : la liste des croquis se met à jour.
  window.addEventListener('focus', async () => {
    const avant = etat.croquis.join('|');
    await chargerListe();
    if (etat.croquis.join('|') !== avant) dessinerPanneau();
  });
}

// ---------- Erreurs visibles ----------
let dejaSignale = false;
function signaler(e) {
  console.error(e);
  if (dejaSignale) return;
  dejaSignale = true;
  toast('Erreur : ' + (e?.message || e) + ' (détail dans la console)', true);
  setTimeout(() => { dejaSignale = false; }, 6000);
}
window.addEventListener('error', (ev) => signaler(ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => signaler(ev.reason));

// ---------- Projets (sur le PC) : gymnase, salle d'escalade… liste dans projets.json ----------
async function brancherProjets() {
  const choix = $('projet');
  if (enLigne) return;
  let liste;
  try {
    liste = await (await fetch('/api/projets', { cache: 'no-store' })).json();
  } catch { return; }
  if (!Array.isArray(liste.projets) || liste.projets.length < 2) return;
  const ouvert = projet || liste.defaut;
  choix.innerHTML = liste.projets.map((p) => `<option value="${p.id}"${p.id === ouvert ? ' selected' : ''}>${p.nom.replace(/[<&"]/g, '')}</option>`).join('');
  choix.hidden = false;
  document.title = 'Atelier structure · ' + (liste.projets.find((p) => p.id === ouvert)?.nom || '');
  choix.addEventListener('change', async () => {
    await sauver(); // rien de perdu en changeant de projet
    location.href = choix.value === liste.defaut ? location.pathname : '?projet=' + encodeURIComponent(choix.value);
  });
}

// ---------- Démarrage ----------
async function demarrer() {
  initScene();
  poserPictos();
  initOutils();
  initPanneau();
  Object.assign(crochets, {
    dessiner: demanderDessin,
    panneau: dessinerPanneau,
    boutons,
    sauver: planifier,
    vue3d: () => { maj3D(); majSchema(); majBilan(); },
    onglets,
    finirAction,
    basculerVue,
  });
  brancherFinir(finirAction);
  brancherOnglets();
  brancherReglages();
  brancher3D();
  brancherSchema();
  brancherCalcul();
  brancherCroquis();
  brancherPartage();
  mesurer();
  new ResizeObserver(() => { if (mesurer()) demanderDessin(); }).observe($('scene'));

  await brancherProjets();
  await chargerListe();
  await charger();
  initHistorique();
  appliquerVue();
  rafraichir();
  if (enLigne) {
    ecouter(tourPartage);
    if (!peutEcrire()) ouvrirCode();
  }
}

demarrer().catch(signaler);
