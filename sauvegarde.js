// Sauvegarde : dans le dossier du projet (serveur) + copie dans le navigateur. Chargement et réparation.
import { etat, uid, memoriserVue, toast, feuille, adopterDistant, appliquerVue, rafraichir } from './etat.js';
import { TYPES_BARRE, TYPES_NOEUD, FORMES_TREILLIS } from './geometrie.js';
import { svgPapier } from './rendu.js';
import { ico } from './pictos.js';
import { enLigne } from './mode.js';
import { projet, avecProjet, cleLocale } from './projet.js';
import { chargerTout, synchro, enAttente, peutEcrire, session } from './partage.js';
import { borne } from './geometrie.js';

const CLE = cleLocale('atelier-structure');
let version = 0;
let versionSauvee = 0;
let minuteur = 0;
let chaine = Promise.resolve();

// Nom de la planche SVG : « 01-coupe-gymnase.svg ».
export function nomFichier(f, i) {
  const slug = String(f.nom || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  return String(i + 1).padStart(2, '0') + '-' + (slug || 'feuille') + ((f.v || 1) > 1 ? '-v' + f.v : '') + '.svg';
}

let dernierEtat = '';
export function etatSauvegarde(kind, texte) {
  dernierEtat = kind;
  const el = document.getElementById('etat');
  if (!el) return;
  const nom = kind === 'ok' ? 'ok' : kind === 'erreur' ? 'alerte' : 'horloge';
  el.innerHTML = ico(nom) + '<span></span>';
  el.lastChild.textContent = texte;
  el.classList.toggle('erreur', kind === 'erreur');
}

function copieNavigateur() {
  try { localStorage.setItem(CLE, JSON.stringify(etat.doc)); } catch { /* plein ou interdit */ }
}

// Appelé à chaque changement : copie tout de suite dans le navigateur, envoi au dossier 1 s plus tard.
export function planifier() {
  version++;
  copieNavigateur();
  etatSauvegarde('attente', 'Modifié…');
  clearTimeout(minuteur);
  minuteur = setTimeout(sauver, enLigne ? 600 : 1000);
}

// Une seule sauvegarde à la fois.
export function sauver() {
  clearTimeout(minuteur);
  const v = version;
  chaine = chaine.then(() => envoyer(v)).catch(() => {});
  return chaine;
}

async function envoyer(v) {
  if (!etat.doc) return;
  memoriserVue();
  if (enLigne) { // en ligne : la base partagée
    copieNavigateur();
    await tourPartage();
    if (!enAttente(etat.doc)) versionSauvee = Math.max(versionSauvee, v);
    return;
  }
  const svgs = {};
  etat.doc.feuilles.forEach((f, i) => {
    try { svgs[nomFichier(f, i)] = svgPapier(f); } catch (e) { console.error('Planche', f.nom, e); }
  });
  etatSauvegarde('attente', 'Enregistrement…');
  try {
    const r = await fetch(avecProjet('/api/sauver'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Atelier': '1' },
      body: JSON.stringify({ doc: etat.doc, svgs }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.erreur || 'erreur ' + r.status);
    versionSauvee = Math.max(versionSauvee, v);
    if (version === v) etatSauvegarde('ok', 'Enregistré');
  } catch (e) {
    etatSauvegarde('erreur', 'Pas enregistré');
    toast('Pas enregistré : ' + e.message + ' (copie gardée dans le navigateur)', true);
  }
}

// Fermeture de l'onglet avec des changements pas encore envoyés.
window.addEventListener('beforeunload', (ev) => {
  if (!etat.doc || versionSauvee >= version) return;
  memoriserVue();
  copieNavigateur();
  if (enLigne) { if (!peutEcrire()) return; ev.preventDefault(); ev.returnValue = ''; return; }
  const corps = JSON.stringify({ doc: etat.doc, svgs: {} });
  if (new TextEncoder().encode(corps).length < 60000) {
    try {
      fetch(avecProjet('/api/sauver'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Atelier': '1' }, body: corps });
    } catch { /* tant pis */ }
  }
  ev.preventDefault();
  ev.returnValue = '';
});

// ---------- Chargement ----------
export async function charger() {
  let doc = null;
  let duServeur = true;
  if (enLigne) {
    etat.fi = 0;
    try {
      doc = await chargerTout(reparerFeuille);
      if (!doc) { // base vide : le dessin livré avec la page
        try { doc = (await (await fetch('depart.json', { cache: 'no-store' })).json()).doc || null; } catch { doc = null; }
        etat.doc = doc && Array.isArray(doc.feuilles) && doc.feuilles.length ? reparer(doc) : docDepart();
        if (peutEcrire()) await tourPartage();
      } else etat.doc = doc;
      etatSauvegarde('ok', peutEcrire() ? 'Partagé' : 'Lecture seule');
    } catch (e) {
      try { doc = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { doc = null; }
      etat.doc = doc && Array.isArray(doc.feuilles) && doc.feuilles.length ? reparer(doc) : docDepart();
      etatSauvegarde('erreur', 'Hors ligne');
      toast('Base partagée pas jointe (' + e.message + ') : copie de ce navigateur ouverte', true);
    }
    return;
  }
  try {
    const r = await fetch(avecProjet('/api/charger'), { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erreur || 'erreur ' + r.status);
    doc = j.doc;
  } catch (e) {
    duServeur = false;
    try { doc = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { doc = null; }
    toast('Fichier du projet pas lu (' + e.message + ') : copie du navigateur ouverte', true);
  }
  etat.fi = 0;
  if (doc && Array.isArray(doc.feuilles) && doc.feuilles.length) {
    etat.doc = reparer(doc);
    if (duServeur) etatSauvegarde('ok', 'Enregistré');
    else etatSauvegarde('erreur', 'Pas enregistré');
    return;
  }
  etat.doc = docDepart();
  if (duServeur) sauver();
  else etatSauvegarde('erreur', 'Pas enregistré');
}

// ---------- Travail à plusieurs ----------
const occupe = () => !!etat.action
  || (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !!document.activeElement.closest('#panneau'));

export async function tourPartage() {
  if (!etat.doc) return;
  const idOuverte = feuille()?.id;
  try {
    const r = await synchro({
      doc: () => etat.doc,
      reparer: reparerFeuille,
      occupe,
      apresReception: () => {
        const i = etat.doc.feuilles.findIndex((f) => f.id === idOuverte);
        if (i >= 0) etat.fi = i;
        else { etat.fi = borne(etat.fi, 0, etat.doc.feuilles.length - 1); appliquerVue(); }
        adopterDistant();
        copieNavigateur();
        rafraichir();
      },
    });
    if (r.saute) return;
    const attente = enAttente(etat.doc);
    if (!peutEcrire()) etatSauvegarde(attente ? 'erreur' : 'ok', attente ? 'Pas envoyé : code ?' : 'Lecture seule');
    else if (attente) etatSauvegarde('attente', 'Envoi…');
    else if (r.recu && r.auteur && r.auteur !== session.pseudo) etatSauvegarde('ok', 'À jour · ' + r.auteur);
    else if (r.envoyes || r.recu || version > versionSauvee || dernierEtat !== 'ok') etatSauvegarde('ok', 'Partagé');
    if (!attente) versionSauvee = version;
  } catch (e) {
    etatSauvegarde('erreur', /code faux/.test(e.message) ? 'Code faux' : 'Hors ligne');
  }
}

export const reparerFeuille = (f) => reparer({ feuilles: [f] }).feuilles[0];

// ---------- Réparation d'un document lu ----------
const IDS_BARRE = new Set(TYPES_BARRE.map(([id]) => id));
const IDS_NOEUD = new Set(TYPES_NOEUD.map(([id]) => id));
const IDS_FORME = new Set(FORMES_TREILLIS.map(([id]) => id));
const fini = (v) => v !== null && v !== '' && Number.isFinite(+v);
const num = (v, d) => (fini(v) ? +v : d);
const liste = (l, p) => (Array.isArray(l) ? l.filter((o) => o && typeof o.id === 'string' && o.id[0] === p) : []);
const bout = (e) => e && fini(e.x) && fini(e.y);

const positif = (v, d) => (fini(v) && +v > 0 ? +v : d);

// type : 'coupe' (vue de côté) ou 'plan' (vue de dessus, avec la hauteur des murs pour la 3D).
export function feuilleVide(nom, ordre = 0, type = 'coupe') {
  const id = uid('f');
  const f = { id, groupe: id, v: 1, ordre, nom, noeuds: [], barres: [], cotes: [], textes: [], traits: [], trois_d: { entraxe: 6, nombre: 4 } };
  if (type === 'plan') { f.type = 'plan'; f.etage = 2.7; }
  return f;
}

function reparer(doc) {
  const out = { feuilles: [] };
  for (const f0 of doc.feuilles) {
    if (!f0 || typeof f0 !== 'object') continue;
    const f = { ...f0 };
    if (typeof f.id !== 'string' || f.id[0] !== 'f') f.id = uid('f');
    f.nom = String(f.nom || 'Feuille');
    if (f.type !== 'plan' && f.type !== 'coupe') delete f.type;
    if (f.type === 'plan' || f.etage !== undefined) f.etage = positif(f.etage, 2.7);
    f.noeuds = liste(f.noeuds, 'n').filter((n) => fini(n.x) && fini(n.y))
      .map((n) => {
        const r = { ...n, x: +n.x, y: +n.y, type: IDS_NOEUD.has(n.type) ? n.type : 'libre' };
        if (r.type === 'poteau') r.s = positif(n.s, 0.3);
        return r;
      });
    const ids = new Set(f.noeuds.map((n) => n.id));
    f.barres = liste(f.barres, 'b').filter((b) => ids.has(b.a) && ids.has(b.b)).map((b) => {
      const r = { ...b, type: IDS_BARRE.has(b.type) ? b.type : 'poutre' };
      if (r.type === 'treillis') {
        r.treillis = { ...etat.defauts.treillis, ...(b.treillis || {}) };
        if (!IDS_FORME.has(r.treillis.forme)) r.treillis.forme = 'warren';
        r.treillis.h = num(r.treillis.h, 1.5);
        r.treillis.n = Math.max(1, Math.round(num(r.treillis.n, 6)));
      }
      if (r.type === 'dalle') r.dalle = { ...etat.defauts.dalle, ...(b.dalle || {}) };
      if (r.type === 'toile') r.toile = { ...etat.defauts.toile, ...(b.toile || {}) };
      if (r.type === 'sol') r.sol = { sens: 1, ...(b.sol || {}) };
      if (r.type === 'murp' || r.type === 'cloison') r[r.type] = { ...(b[r.type] || {}), e: positif(b[r.type]?.e, r.type === 'murp' ? 0.2 : 0.1) };
      if (r.type === 'porte') r.porte = { sens: b.porte?.sens === -1 ? -1 : 1, charniere: b.porte?.charniere === 'b' ? 'b' : 'a' };
      if (r.type === 'escalier') {
        const s = b.escalier || {};
        r.escalier = { ...s, w: positif(s.w, 1.2), giron: Math.max(0.1, positif(s.giron, 0.28)), sens: s.sens === -1 ? -1 : 1 };
      }
      if (r.type === 'trame') r.trame = { nom: String(b.trame?.nom ?? '').slice(0, 3) };
      return r;
    });
    f.cotes = liste(f.cotes, 'c').filter((c) => bout(c.a) && bout(c.b))
      .map((c) => ({ ...c, a: { ...c.a, x: +c.a.x, y: +c.a.y }, b: { ...c.b, x: +c.b.x, y: +c.b.y }, decalage: num(c.decalage, 1) }));
    f.textes = liste(f.textes, 't').filter((t) => fini(t.x) && fini(t.y))
      .map((t) => ({ ...t, x: +t.x, y: +t.y, texte: String(t.texte ?? ''), taille: [1, 2, 3].includes(t.taille) ? t.taille : 2 }));
    f.traits = liste(f.traits, 's').filter((s) => Array.isArray(s.pts) && s.pts.length > 1 && s.pts.every((p) => Array.isArray(p) && fini(p[0]) && fini(p[1])));
    const k = f.croquis;
    if (k && !(k.nom && k.w > 0 && k.h > 0 && k.echelle > 0 && fini(k.cx) && fini(k.cy))) delete f.croquis;
    f.trois_d = { entraxe: num(f.trois_d?.entraxe, 6), nombre: num(f.trois_d?.nombre, 4) };
    if (typeof f.groupe !== 'string' || !f.groupe) f.groupe = f.id; // les versions d'une même feuille ont le même groupe
    f.v = Math.max(1, Math.round(num(f.v, 1)));
    f.ordre = num(f.ordre, out.feuilles.length);
    out.feuilles.push(f);
  }
  if (!out.feuilles.length) out.feuilles.push(feuilleVide('Feuille 1'));
  return out;
}

// ---------- Document de départ : ma lecture des croquis, à corriger ----------
function docDepart() {
  // Autre projet que le gymnase : un plan et une coupe vides, à dessiner.
  if (projet) return { feuilles: [feuilleVide('Plan', 0, 'plan'), feuilleVide('Coupe', 1)] };
  const f = feuilleVide('Lecture Claude');
  const N = (id, x, y, type = 'libre') => ({ id, x, y, type });
  f.noeuds = [
    N('n1', 0, 0, 'appui'), N('n2', 0, 7), N('n3', 0, 11), N('n4', 0, 13, 'rotule'), N('n5', 0, 17),
    N('n6', -5, 13, 'rotule'), N('n7', -2.6923, 7), N('n8', 12, 11), N('n9', -9, 0), N('n10', 16, 0),
  ];
  const B = (id, a, b, type, extra = {}) => ({ id, a, b, type, ...extra });
  f.barres = [
    B('b1', 'n1', 'n2', 'poteau'), B('b2', 'n2', 'n3', 'poteau'), B('b3', 'n3', 'n4', 'poteau'), B('b4', 'n4', 'n5', 'poteau'),
    B('b5', 'n3', 'n8', 'treillis', { treillis: { forme: 'warren', h: 2, n: 8, sens: 1 } }),
    B('b6', 'n4', 'n6', 'poutre'),
    B('b7', 'n1', 'n7', 'bequille'), B('b8', 'n7', 'n6', 'bequille'),
    B('b9', 'n7', 'n2', 'entretoise'),
    B('b10', 'n9', 'n1', 'sol', { sol: { sens: 1 } }), B('b11', 'n1', 'n10', 'sol', { sol: { sens: 1 } }),
  ];
  f.cotes = [{ id: 'c1', a: { n: 'n6', x: -5, y: 13 }, b: { n: 'n4', x: 0, y: 13 }, decalage: 1.5 }];
  f.textes = [{ id: 't1', x: -9, y: 20, texte: 'Ma lecture des croquis : à corriger', taille: 2 }];
  return {
    feuilles: [f, feuilleVide('Coupe gymnase', 1), feuilleVide('Coupe fitness', 2), feuilleVide('Élévation', 3), feuilleVide('Détail nœud', 4)],
  };
}
