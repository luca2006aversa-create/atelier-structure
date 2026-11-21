// Atelier structure : démarrage, liens entre les modules, boutons du haut et de la 3D.
import {
  etat, feuille, crochets, rafraichir, initHistorique, modifie, peutAnnuler, peutRetablir,
  annuler, retablir, appliquerVue, allerFeuille, toast, uid, memoriserVue,
} from './etat.js';
import { initScene, demanderDessin, zoomerCentre, cadrerVue } from './scene.js';
import { initOutils, finirAction } from './outils.js';
import { initPanneau, dessinerPanneau } from './panneau.js';
import { poserPictos } from './pictos.js';
import { chargerListe, envoyerImage } from './croquis.js';
import { charger, planifier, feuilleVide, tourPartage, etatSauvegarde } from './sauvegarde.js';
import { brancherFinir } from './commandes.js';
import { Vue3D } from './vue3d.js';
import { enLigne } from './mode.js';
import { ecouter, verifierCode, retenirCode, session, peutEcrire } from './partage.js';
import { trier, copie } from './fusion.js';

const $ = (id) => document.getElementById(id);
const CLE_REGLAGES = 'atelier-structure-reglages';
let vue3d = null;

// ---------- Onglets des feuilles et versions (V1, V2, V3…) ----------
// Une feuille peut avoir plusieurs versions : même « groupe », numéro « v ». Un onglet par groupe.
const choixGroupe = new Map(); // groupe → id de la version ouverte la dernière fois

function groupes() {
  const g = new Map();
  for (const f of etat.doc.feuilles) {
    if (!g.has(f.groupe)) g.set(f.groupe, []);
    g.get(f.groupe).push(f);
  }
  return g;
}

function onglets() {
  const box = $('feuilles');
  const vbox = $('versions');
  if (!box || !etat.doc) return;
  const ouverte = feuille();
  if (ouverte) choixGroupe.set(ouverte.groupe, ouverte.id);
  const cle = etat.doc.feuilles.map((f) => [f.id, f.nom, f.groupe, f.v].join('|')).join('/') + '#' + ouverte?.id;
  if (box.dataset.cle === cle) return;
  box.dataset.cle = cle;
  box.textContent = '';
  const g = groupes();
  for (const [nom, vs] of g) {
    const voulue = ouverte?.groupe === nom ? ouverte.id : choixGroupe.get(nom);
    const f = vs.find((x) => x.id === voulue) || vs[vs.length - 1];
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = f.id;
    b.textContent = f.nom + (vs.length > 1 ? ' · V' + f.v : '');
    b.title = f.nom + ' (double-clic : renommer)';
    if (ouverte?.groupe === nom) b.className = 'on';
    box.appendChild(b);
  }
  // Versions de la feuille ouverte
  vbox.textContent = '';
  for (const f of g.get(ouverte?.groupe) || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = f.id;
    b.textContent = 'V' + f.v;
    b.title = 'Version ' + f.v;
    if (f.id === ouverte.id) b.className = 'on';
    vbox.appendChild(b);
  }
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'plus';
  plus.dataset.act = 'version';
  plus.title = 'Nouvelle version (copie de V' + (ouverte?.v || 1) + ')';
  plus.textContent = '+ V';
  vbox.appendChild(plus);
}

const allerId = (id) => {
  const i = etat.doc.feuilles.findIndex((f) => f.id === id);
  if (i >= 0 && i !== etat.fi) allerFeuille(i);
};

function nouvelleVersion() {
  const f = feuille();
  if (!f) return;
  memoriserVue();
  const vs = etat.doc.feuilles.filter((x) => x.groupe === f.groupe);
  const n = copie(f);
  n.id = uid('f');
  n.v = Math.max(...vs.map((x) => x.v || 1)) + 1;
  etat.doc.feuilles.push(n);
  trier(etat.doc.feuilles);
  allerId(n.id);
  modifie();
  toast('Version V' + n.v + ' créée (copie de V' + (f.v || 1) + ')');
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
    else allerId(b.dataset.id);
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
  $('b-feuille').addEventListener('click', () => {
    if (!etat.doc) return;
    const noms = new Set(etat.doc.feuilles.map((f) => f.nom));
    let n = groupes().size + 1;
    while (noms.has('Feuille ' + n)) n++;
    const ordre = Math.max(0, ...etat.doc.feuilles.map((f) => f.ordre ?? 0)) + 1;
    const f = feuilleVide('Feuille ' + n, ordre);
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
  vue3d = new Vue3D($('canvas3d'), () => ({ feuille: feuille(), sel: etat.sel }));
  new ResizeObserver(() => { if (!carte().hidden) vue3d.demander(); }).observe($('canvas3d'));
  $('b-3d').addEventListener('click', () => basculer3D());
  $('b-3d-fermer').addEventListener('click', () => basculer3D(false));
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

// ---------- Croquis : dossier, fichier, glisser-déposer ----------
const aDesFichiers = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');

function brancherCroquis() {
  if (enLigne) $('b-dossier').style.display = 'none'; // pas de dossier du PC en ligne
  $('b-dossier').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/ouvrir?quoi=croquis', { method: 'POST', headers: { 'X-Atelier': '1' } });
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
    vue3d: maj3D,
    onglets,
    finirAction,
  });
  brancherFinir(finirAction);
  brancherOnglets();
  brancherReglages();
  brancher3D();
  brancherCroquis();
  brancherPartage();
  mesurer();
  new ResizeObserver(() => { if (mesurer()) demanderDessin(); }).observe($('scene'));

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
