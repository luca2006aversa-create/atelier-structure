// Panneau de droite : réglages précis de ce qui est choisi.
// Rien de choisi : l'outil en cours, la feuille, le croquis de fond et les gestes.
import { etat, feuille, modifie, rafraichir, toast, crochets, appliquerVue, paireDe } from './etat.js';
import { TYPES_BARRE, FORMES_TREILLIS, FORMES_TOIT, NOM_BARRE, NOM_NOEUD, BARRES_PLAN, BARRES_LIN, JONCTIONS, carteNoeuds, pointCote, estPlan } from './geometrie.js';
import { supprimerSelection, retourner, copier, symetrie, reglagesBarre } from './commandes.js';
import { apresDeplacement, synchroCotes, couperParNoeuds } from './topologie.js';
import { choisirFond, urlCroquis } from './croquis.js';
import { nomFichier } from './sauvegarde.js';
import { enLigne, telecharger } from './mode.js';
import { avecProjet } from './projet.js';
import { svgPapier } from './rendu.js';
import { picto, ico } from './pictos.js';
import { etalonnerCroquis, deplacerCroquis, nomOutil } from './outils.js';
import { demanderDessin } from './scene.js';
import { BIBLIO, NOMS_SORTES, UNITES, texteCharge, nouvelleCharge, position } from './charges.js';
import {
  MATIERES, ORDRE_MATIERES, FAMILLES, FORMES_SECTION, NOMS_PROFILS,
  matiereDe, cleMatiere, sectionDe, proprietes, poidsML, texteSection, predim, porteeCourante,
} from './matieres.js';

// ---------- Petits outils ----------
const LISTES = { n: 'noeuds', b: 'barres', c: 'cotes', t: 'textes', s: 'traits' };
const objet = (id, f) => (f?.[LISTES[id?.[0]]] || []).find((o) => o.id === id);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const arr = (v) => Math.round(v * 1e6) / 1e6;
const RAD = Math.PI / 180;
const APPUIS = new Set(['appui', 'encastrement', 'glissant']);
const RETOURNABLES = new Set(['treillis', 'toit', 'dalle', 'toile', 'sol', 'porte', 'escalier']);
const ORDRE_NOEUDS = ['appui', 'encastrement', 'rotule', 'rigide', 'glissant', 'libre'];
const ORDRE_NOEUDS_PLAN = ['poteau', 'libre'];
const REGLAGES = {
  't.h': ['treillis', 'h'], 't.n': ['treillis', 'n'], 'd.e': ['dalle', 'e'], 'o.fleche': ['toile', 'fleche'],
  'm.e': ['murp', 'e'], 'cl.e': ['cloison', 'e'], 'es.w': ['escalier', 'w'], 'es.giron': ['escalier', 'giron'],
  'r.pente': ['toit', 'pente'], 'r.debord': ['toit', 'debord'], 'r.fleche': ['toit', 'fleche'],
};
const BARRE = new Set(['b.longueur', 'b.angle', 'b.dx', 'b.dy']);
// Valeurs qui doivent rester plus grandes que zéro (longueur, épaisseurs, largeur, section, hauteur d'étage).
const POSITIFS = new Set(['b.longueur', 't.h', 'd.e', 'm.e', 'cl.e', 'es.w', 'p.s', 'f.etage', 's.b', 's.h', 's.e']);

// Nombre affiché : virgule, sans zéros inutiles, jamais « -0 ».
function nb(v, d = 3) {
  if (!Number.isFinite(+v)) return '';
  const r = +(+v).toFixed(d);
  return String(r === 0 ? 0 : r).replace('.', ',');
}

// Nombre tapé : « 3,5 », « 3.5 m », « 30° »… NaN sinon.
function lireNombre(s) {
  const t = String(s ?? '').trim().replace(/,/g, '.').replace(/[\s°m%]/g, '');
  if (!t) return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

// Angle ramené dans ]-180 ; 180].
function angle180(a) {
  const r = ((((a + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

function valide(cle, v) {
  if (!Number.isFinite(v)) return false;
  if (POSITIFS.has(cle)) return v > 1e-6;
  if (cle === 'es.giron') return v >= 0.1;
  if (cle === 't.n') return v >= 1 && v <= 200;
  if (cle === 'r.pente') return v >= 0 && v <= 500;
  if (cle === 'r.debord') return v >= 0 && v <= 5;
  if (cle === 'r.fleche') return v >= 0 && v <= 50;
  return true;
}

// Flèches haut / bas : on reste dans les bornes.
function borner(cle, v) {
  if (cle === 't.n') return Math.min(200, Math.max(1, Math.round(v)));
  if (cle === 't.h') return Math.max(0.05, v);
  if (cle === 'es.giron') return Math.max(0.1, v);
  if (POSITIFS.has(cle)) return Math.max(0.01, v);
  if (cle === 'b.angle' || cle === 'k.rot') return angle180(v);
  return v;
}

// Bout qui reste en place quand on règle une barre : l'appui, puis le bout au sol, sinon le début.
const poids = (n) => (APPUIS.has(n.type) ? 2 : 0) + (Math.abs(n.y) < 1e-6 ? 1 : 0);
let boutFixe = null; // { id, bout } quand on a demandé l'autre bout

const choisis = (f) => [...etat.sel].filter((id) => objet(id, f));

// ---------- Morceaux de HTML ----------
const titre = (svg, texte) => `<div class="bloc-titre">${svg}<span class="a-etiquette">${esc(texte)}</span></div>`;
const bloc = (h) => `<section class="bloc">${h}</section>`;
const discret = (t) => `<div class="a-discret">${esc(t)}</div>`;
const rangee = (...b) => `<div class="rangee-boutons">${b.join('')}</div>`;

function champ(libelle, cle, valeur, { id = '', unite = '', pas = '', extra = '' } = {}) {
  const attrs = `data-champ="${cle}"` + (id ? ` data-id="${id}"` : '') + (pas !== '' ? ` data-pas="${pas}"` : '') + extra;
  return `<label class="ligne-champ"><span>${esc(libelle)}</span><div class="avec-unite">`
    + `<input class="a-champ" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" ${attrs} value="${esc(valeur)}">`
    + (unite ? `<span>${esc(unite)}</span>` : '') + '</div></label>';
}

function champTexte(libelle, cle, valeur, { id = '', aide = '', max = 0 } = {}) {
  return `<label class="ligne-champ"><span>${esc(libelle)}</span>`
    + `<input class="a-champ" type="text" autocomplete="off" spellcheck="true" lang="fr" data-champ="${cle}"${id ? ` data-id="${id}"` : ''}`
    + `${aide ? ` placeholder="${esc(aide)}"` : ''}${max ? ` maxlength="${max}"` : ''} value="${esc(valeur)}"></label>`;
}

function bouton(act, nom, texte, classe = 'fantome', v = '', id = '') {
  return `<button type="button" class="a-bouton ${classe}" data-act="${act}"${v !== '' ? ` data-v="${esc(v)}"` : ''}${id ? ` data-id="${id}"` : ''}>`
    + `${picto(nom)}<span>${esc(texte)}</span></button>`;
}

function interrupteur(cle, nom, texte, on) {
  return `<label class="interrupteur-ligne"><span>${picto(nom)}${esc(texte)}</span>`
    + `<input type="checkbox" class="a-interrupteur" data-champ="${cle}"${on ? ' checked' : ''}></label>`;
}

// Types proposés : ceux de la coupe, ou ceux du plan.
function grilleTypesBarre(actif, plan = false) {
  return `<div class="grille-types${plan ? ' trois' : ''}">` + TYPES_BARRE.filter(([id]) => BARRES_PLAN.has(id) === plan).map(([id, nom]) =>
    `<button type="button" class="type${id === actif ? ' on' : ''}" data-act="type-barre" data-v="${id}" title="${esc(nom)}">${picto(id)}<span>${esc(nom)}</span></button>`,
  ).join('') + '</div>';
}

function grilleTypesNoeud(actif, plan = false) {
  return `<div class="grille-types ${plan ? 'deux-col' : 'trois'}">` + (plan ? ORDRE_NOEUDS_PLAN : ORDRE_NOEUDS).map((id) =>
    `<button type="button" class="type${id === actif ? ' on' : ''}" data-act="type-noeud" data-v="${id}" title="${esc(NOM_NOEUD[id])}">${picto('n-' + id)}<span>${esc(NOM_NOEUD[id])}</span></button>`,
  ).join('') + '</div>';
}

const APERCUS = {
  warren: 'M2 4H98M2 22H98M2 4V22M98 4V22M2 22L26 4L50 22L74 4L98 22',
  warren_m: 'M2 4H98M2 22H98M2 4V22M98 4V22M2 22L26 4L50 22L74 4L98 22M26 4V22M50 4V22M74 4V22',
  pratt: 'M2 4H98M2 22H98M2 4V22M26 4V22M50 4V22M74 4V22M98 4V22M2 4L26 22M26 4L50 22M74 4L50 22M98 4L74 22',
  howe: 'M2 4H98M2 22H98M2 4V22M26 4V22M50 4V22M74 4V22M98 4V22M26 4L2 22M50 4L26 22M50 4L74 22M74 4L98 22',
};

const APERCUS_TOIT = {
  '2pentes': 'M4 21L50 6L96 21',
  '1pente': 'M4 21L96 6',
  plat: 'M4 13H96',
  courbe: 'M4 21Q50 -3 96 21',
};

function grilleFormesToit(actif, id = '') {
  return '<div class="grille-types deux-col">' + FORMES_TOIT.map(([f, nom]) =>
    `<button type="button" class="type${f === actif ? ' on' : ''}" data-act="forme-toit" data-v="${f}"${id ? ` data-id="${id}"` : ''}>`
    + `<svg class="apercu" viewBox="0 0 100 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${APERCUS_TOIT[f] || APERCUS_TOIT['2pentes']}"/></svg>`
    + `<span>${esc(nom)}</span></button>`,
  ).join('') + '</div>';
}

function grilleFormes(actif, id = '') {
  return '<div class="grille-types deux-col">' + FORMES_TREILLIS.map(([f, nom]) =>
    `<button type="button" class="type${f === actif ? ' on' : ''}" data-act="forme" data-v="${f}"${id ? ` data-id="${id}"` : ''}>`
    + `<svg class="apercu" viewBox="0 0 100 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="${APERCUS[f] || APERCUS.warren}"/></svg>`
    + `<span>${esc(nom)}</span></button>`,
  ).join('') + '</div>';
}

// Croisement des barres à un nœud : qui passe, qui s'arrête.
const APERCUS_JONCTION = {
  auto: 'M45 1V25M55 1V25M45 1H55M45 25H55M2 9H45M2 17H45M55 9H98M55 17H98M2 9V17M98 9V17',
  vertical: 'M45 1V25M55 1V25M45 1H55M45 25H55M2 9H45M2 17H45M55 9H98M55 17H98M2 9V17M98 9V17',
  horizontal: 'M2 9H98M2 17H98M2 9V17M98 9V17M45 1V9M55 1V9M45 1H55M45 17V25M55 17V25M45 25H55',
  onglet: 'M45 25V9H98M55 25V17H98M45 9L55 17M45 25H55M98 9V17',
  coupe: 'M45 1V7M55 1V7M45 1H55M45 7H55M45 19V25M55 19V25M45 19H55M45 25H55M2 9H42M2 17H42M42 9V17M2 9V17M58 9H98M58 17H98M58 9V17M98 9V17',
};
function grilleJonctions(actif) {
  return '<div class="grille-types deux-col">' + JONCTIONS.map(([j, nom]) =>
    `<button type="button" class="type${j === actif ? ' on' : ''}" data-act="jonction" data-v="${j}">`
    + `<svg class="apercu" viewBox="0 0 100 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${j === 'auto' ? ' stroke-dasharray="3 3"' : ''}><path d="${APERCUS_JONCTION[j]}"/></svg>`
    + `<span>${esc(nom)}</span></button>`,
  ).join('') + '</div>';
}

// Réglages d'un treillis, d'une dalle ou d'une toile (sans barre : ceux du prochain tracé).
function reglagesType(type, b = null) {
  const id = b ? b.id : '';
  const nom = (NOM_BARRE[type] || type) + (b ? '' : ' : prochain tracé');
  if (type === 'treillis') {
    const t = { ...etat.defauts.treillis, ...(b?.treillis || {}) };
    return bloc(titre(picto('treillis'), nom) + grilleFormes(t.forme, id)
      + champ('Hauteur', 't.h', nb(t.h), { id, unite: 'm', pas: 0.1 })
      + champ('Panneaux', 't.n', nb(t.n, 0), { id, pas: 1 }));
  }
  if (type === 'toit') {
    const t = { ...etat.defauts.toit, ...(b?.toit || {}) };
    const courbe = t.forme === 'courbe';
    const plat = t.forme === 'plat';
    return bloc(titre(picto('toit'), nom) + grilleFormesToit(t.forme, id)
      + (courbe ? champ('Flèche', 'r.fleche', nb(t.fleche), { id, unite: 'm', pas: 0.1 })
        : plat ? '' : champ('Pente', 'r.pente', nb(t.pente, 1), { id, unite: '%', pas: 5 }))
      + champ('Débord', 'r.debord', nb(t.debord), { id, unite: 'm', pas: 0.1 })
      + discret(plat ? 'Le tracé donne la portée. Retourner : l’épaisseur passe de l’autre côté.'
        : 'Pente en % (35 % ≈ 19°, 100 % = 45°). Retourner : le toit se renverse.'));
  }
  if (type === 'dalle') {
    const d = { ...etat.defauts.dalle, ...(b?.dalle || {}) };
    return bloc(titre(picto('dalle'), nom) + champ('Épaisseur', 'd.e', nb(d.e), { id, unite: 'm', pas: 0.05 }));
  }
  if (type === 'toile') {
    const o = { ...etat.defauts.toile, ...(b?.toile || {}) };
    return bloc(titre(picto('toile'), nom) + champ('Flèche', 'o.fleche', nb(o.fleche), { id, unite: 'm', pas: 0.1 })
      + discret('Creux de la toile au milieu. Retourner : bombée de l’autre côté.'));
  }
  // Plan
  if (type === 'murp' || type === 'cloison') {
    const m = { e: type === 'murp' ? 0.2 : 0.1, ...(etat.defauts[type] || {}), ...(b?.[type] || {}) };
    return bloc(titre(picto(type), nom)
      + champ('Épaisseur', type === 'murp' ? 'm.e' : 'cl.e', nb(m.e), { id, unite: 'm', pas: type === 'murp' ? 0.05 : 0.01 }));
  }
  if (type === 'porte' && b) {
    return bloc(titre(picto('porte'), nom) + rangee(bouton('porte-charniere', 'porte', 'Changer la charnière'))
      + discret('Retourner : elle s’ouvre de l’autre côté. Charnière : elle tourne sur l’autre bout.'));
  }
  if (type === 'fenetre' && b) return bloc(titre(picto('fenetre'), nom) + discret('La fenêtre prend l’épaisseur du mur.'));
  if (type === 'escalier') {
    const s = { w: 1.2, giron: 0.28, ...(etat.defauts.escalier || {}), ...(b?.escalier || {}) };
    return bloc(titre(picto('escalier'), nom)
      + champ('Largeur', 'es.w', nb(s.w), { id, unite: 'm', pas: 0.1 })
      + champ('Giron', 'es.giron', nb(s.giron), { id, unite: 'm', pas: 0.01 })
      + discret(b ? 'Giron : profondeur d’une marche. La flèche monte ; Retourner : elle descend.' : 'Giron : profondeur d’une marche.'));
  }
  if (type === 'trame' && b) {
    return bloc(titre(picto('trame'), nom) + champTexte('Nom', 'tr.nom', b.trame?.nom || '', { id, max: 3 })
      + discret('Lettre ou chiffre de la bulle (3 signes au plus).'));
  }
  return '';
}

const boutonsFin = (avecRetourner, avecSymetrie = true) => bloc(rangee(
  avecRetourner ? bouton('retourner', 'echanger', 'Retourner') : '',
  bouton('copier', 'dupliquer', 'Copier'),
  avecSymetrie ? bouton('symetrie', 'miroir', 'Symétrie') : '',
  bouton('effacer', 'supprimer', 'Effacer', 'danger'),
));

// ---------- Section et matière ----------
// Barres qui ont une vraie section à régler (largeur × hauteur). Les autres n'ont qu'une matière.
const SECTION_PLEINE = new Set(['poteau', 'poutre', 'poutrep', 'bequille', 'entretoise', 'cable', 'treillis', 'toit']);
const MATIERE_SEULE = new Set(['dalle', 'toile', 'sol', 'mur', 'murp', 'cloison']);
const aSection = (t) => SECTION_PLEINE.has(t) || MATIERE_SEULE.has(t);
const cm = (m) => nb(m * 100, 2);

function choixMatiere(actif, id = '') {
  const parFam = {};
  for (const k of ORDRE_MATIERES) (parFam[MATIERES[k].fam] ||= []).push(k);
  const options = (actif ? '' : '<option value="" selected>Plusieurs matières</option>')
    + Object.keys(FAMILLES).filter((fa) => parFam[fa]).map((fa) =>
      `<optgroup label="${esc(FAMILLES[fa])}">` + parFam[fa].map((k) =>
        `<option value="${k}"${k === actif ? ' selected' : ''}>${esc(MATIERES[k].nom)}</option>`).join('') + '</optgroup>').join('');
  return `<label class="ligne-champ"><span>Matière</span><div class="avec-pastille">`
    + `<i class="pastille" style="background:${esc(MATIERES[actif]?.c || 'transparent')}"></i>`
    + `<select class="a-champ" data-champ="s.mat"${id ? ` data-id="${esc(id)}"` : ''}>${options}</select></div></label>`;
}

function choixForme(b) {
  const s = sectionDe(b);
  return `<div class="ligne-champ"><span>Forme</span><div class="a-bascule bascule-pleine">`
    + FORMES_SECTION.map(([v, nom]) =>
      `<button type="button" class="${s.f === v ? 'on' : ''}" data-act="forme-sec" data-v="${v}" data-id="${esc(b.id)}">${esc(nom)}</button>`).join('')
    + '</div></div>';
}

function champsSection(b) {
  const s = sectionDe(b);
  const o = { id: b.id, unite: 'cm', pas: 1 };
  if (s.f === 'profil') {
    return `<label class="ligne-champ"><span>Profil</span><select class="a-champ" data-champ="s.nom" data-id="${esc(b.id)}">`
      + NOMS_PROFILS.map((n) => `<option value="${esc(n)}"${n === s.nom ? ' selected' : ''}>${esc(n)}</option>`).join('')
      + '</select></label>';
  }
  if (s.f === 'rond') return champ('Diamètre', 's.b', cm(s.b), o);
  if (s.f === 'tube') return champ('Diamètre', 's.b', cm(s.b), o) + champ('Paroi', 's.e', cm(s.e), { ...o, pas: 0.1 });
  return champ('Largeur', 's.b', cm(s.b), o) + champ('Hauteur', 's.h', cm(s.h), o);
}

// Jauge : où tombe la portée réelle dans la fourchette courante de cette section.
function jaugePortee(L, min, max) {
  const haut = Math.max(max * 1.35, L * 1.15, 0.5);
  const pc = (v) => Math.max(0, Math.min(100, (v / haut) * 100));
  return `<div class="jauge-portee"><i class="zone" style="left:${pc(min).toFixed(1)}%;width:${(pc(max) - pc(min)).toFixed(1)}%"></i>`
    + `<i class="marque" style="left:${pc(L).toFixed(1)}%"></i></div>`;
}

// Bloc « Section et matière » : la section d'une barre, et l'aller-retour portée ↔ section.
function blocSection(b, f) {
  if (!aSection(b.type)) return '';
  const mat = matiereDe(b);
  const A = objet(b.a, f);
  const B = objet(b.b, f);
  const L = A && B ? Math.hypot(B.x - A.x, B.y - A.y) : 0;
  let h = titre(picto('section'), 'Section et matière') + choixMatiere(cleMatiere(b), b.id);
  if (!SECTION_PLEINE.has(b.type)) {
    return bloc(h + discret(`${esc(mat.nom)} · ${nb(mat.rho, 2)} kN/m³. L’épaisseur se règle plus haut.`));
  }
  h += `<div class="gros">${esc(texteSection(b))}</div>` + choixForme(b) + champsSection(b);
  const P = proprietes(sectionDe(b));
  h += discret(`Poids propre : ${nb(poidsML(b), 3)} kN/m · aire ${nb(P.A * 1e4, 0)} cm²`);
  if (L > 1e-6) {
    const { min, max, mot } = porteeCourante(b.type, cleMatiere(b), sectionDe(b));
    const verdict = L < min * 0.85 ? 'Section généreuse : on peut l’affiner.'
      : L > max * 1.15 ? 'Section faible pour cette ' + mot + '.'
        : 'Section courante pour cette ' + mot + '.';
    h += jaugePortee(L, min, max)
      + discret(`${nb(L, 2)} m de ${mot} · courant de ${nb(min, 2)} à ${nb(max, 2)} m. ${verdict}`);
  }
  h += rangee(bouton('predim', 'section', 'Section conseillée', 'principal', '', b.id));
  if (L > 1e-6) {
    const p = predim(b.type, cleMatiere(b), L);
    h += discret(p.note + ' → ' + texteSection({ type: b.type, mat: b.mat, sec: p.sec }));
  }
  return bloc(h);
}

// Même bloc pour plusieurs barres d'un coup.
function blocSectionPlusieurs(barres) {
  const avec = barres.filter((b) => b && aSection(b.type));
  if (!avec.length) return '';
  const mats = new Set(avec.map((b) => cleMatiere(b)));
  const pleines = avec.filter((b) => SECTION_PLEINE.has(b.type));
  return bloc(titre(picto('section'), 'Section et matière')
    + choixMatiere(mats.size === 1 ? [...mats][0] : '')
    + (pleines.length ? rangee(bouton('predim', 'section', `Section conseillée (${pleines.length})`, 'principal')) : '')
    + discret(`${avec.length} éléments · la matière s’applique à tous.`));
}

// ---------- Contenu selon la sélection ----------
function blocNoeud(n, f) {
  const plan = estPlan(f);
  const relies = f.barres.filter((b) => b.a === n.id || b.b === n.id).length;
  const pas = etat.pas || 0.1;
  return bloc(titre(picto('n-' + n.type), 'Nœud')
      + `<div class="gros">${esc(NOM_NOEUD[n.type] || n.type)}</div>`
      + champ('X', 'n.x', nb(n.x), { id: n.id, unite: 'm', pas })
      + champ('Y', 'n.y', nb(n.y), { id: n.id, unite: 'm', pas })
      + (n.type === 'poteau' ? champ('Section', 'p.s', nb(n.s || 0.3), { id: n.id, unite: 'm', pas: 0.05 }) : '')
      + (plan ? '' : discret('Y = 0 : le sol.')))
    + bloc(titre(picto(plan ? 'n-poteau' : 'n-appui'), plan ? 'Type' : 'Liaison') + grilleTypesNoeud(n.type, plan)
      + discret((plan ? 'Éléments reliés : ' : 'Barres reliées : ') + relies))
    + (plan || relies < 2 ? '' : bloc(titre(picto('treillis'), 'Croisement') + grilleJonctions(n.jonction || 'auto')
      + discret('Automatique : deux barres alignées de même section deviennent une seule pièce.')))
    + (plan ? '' : blocCharges(n, 0))
    + bloc(rangee(bouton('effacer', 'supprimer', 'Effacer', 'danger')));
}

// ---------- Charges ajoutées (étage, mur, objet) ----------
const GROUPES_CHARGE = [['surface', 'etage', 'Étage, plancher'], ['lineique', 'mur', 'Le long de la barre'], ['ponctuelle', 'objet', 'Objet en un point']];
const PICTO_CHARGE = { surface: 'etage', lineique: 'mur', ponctuelle: 'objet' };
const PORTE_CHARGE = new Set(['poteau', 'poutre', 'bequille', 'entretoise', 'treillis', 'dalle', 'membrure']);

function blocCharges(o, L) {
  const noeud = o.id[0] === 'n';
  const liste = Array.isArray(o.charges) ? o.charges : [];
  const attr = (c) => ` data-id="${o.id}" data-ch="${esc(c.id)}"`;
  const lignes = liste.map((c) => {
    const k = UNITES[c.k] ? c.k : 'ponctuelle';
    const cat = [['G', 'Permanente'], ['Q', 'Variable']].map(([g, nom]) =>
      `<button type="button" class="${c.cat === g ? 'on' : ''}" data-act="charge-cat" data-v="${g}"${attr(c)}>${nom}</button>`).join('');
    return '<div class="charge">'
      + `<div class="charge-tete">${picto(PICTO_CHARGE[k])}<span>${esc(c.nom || NOMS_SORTES[k])}</span>`
      + `<button type="button" class="charge-effacer" data-act="charge-effacer"${attr(c)} title="Retirer">${picto('supprimer')}</button></div>`
      + champ('Valeur', 'ch.v', nb(+c.v, 2), { id: o.id, unite: UNITES[k], pas: k === 'ponctuelle' ? 0.5 : 0.25, extra: ` data-ch="${esc(c.id)}"` })
      + (k === 'ponctuelle' && !noeud && L > 0
        ? champ('Depuis le début', 'ch.d', nb(position(c) * L, 2), { id: o.id, unite: 'm', pas: etat.pas || 0.1, extra: ` data-ch="${esc(c.id)}" data-l="${L}"` }) : '')
      + `<div class="ligne-champ"><span>Durée</span><div class="a-bascule bascule-pleine">${cat}</div></div>`
      + discret(texteCharge(c)) + '</div>';
  }).join('');
  const groupes = GROUPES_CHARGE.filter((g) => !noeud || g[0] === 'ponctuelle').map(([k, ic, nom]) =>
    `<div class="charge-groupe">${picto(ic)}<span class="a-etiquette">${esc(nom)}</span></div><div class="charge-biblio">`
    + BIBLIO.filter((m) => m.k === k).map((m) =>
      `<button type="button" data-act="charge-ajouter" data-v="${m.id}" data-id="${o.id}">${esc(m.nom)}<small>${nb(m.v, 2)} ${UNITES[k]}</small></button>`).join('')
    + `<button type="button" data-act="charge-ajouter" data-v="libre-${k}" data-id="${o.id}">Autre<small>à régler</small></button></div>`).join('');
  return bloc(titre(picto('charge'), noeud ? 'Poids accroché' : 'Charges en plus') + lignes
    + (liste.length ? '' : discret(noeud ? 'Un objet suspendu à ce nœud : lustre, agrès, machine…' : 'Un étage posé dessus, un mur, un objet…'))
    + groupes
    + (noeud ? '' : discret('Étage : la charge par m² est multipliée par l’entraxe des portiques.'))
    + discret('Permanente : toujours là (× 1,35). Variable : gens, meubles, neige (× 1,5).'));
}

function blocBarre(b, f) {
  const A = objet(b.a, f);
  const B = objet(b.b, f);
  if (!A || !B) return '';
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L = Math.hypot(dx, dy);
  const ang = L > 1e-9 ? angle180(Math.atan2(dy, dx) / RAD) : 0;
  const fixe = boutFixe?.id === b.id ? boutFixe.bout : (poids(B) > poids(A) ? 'b' : 'a');
  const F = fixe === 'a' ? A : B;
  const pas = etat.pas || 0.1;
  const o = { id: b.id, extra: ` data-fixe="${fixe}"` };
  const plan = estPlan(f);
  return bloc(titre(picto(b.type), plan ? 'Élément' : 'Barre')
      + `<div class="gros">${esc(NOM_BARRE[b.type] || b.type)}</div>`
      + discret(`De (${nb(A.x, 2)} ; ${nb(A.y, 2)}) à (${nb(B.x, 2)} ; ${nb(B.y, 2)})`)
      + champ('Longueur', 'b.longueur', nb(L), { ...o, unite: 'm', pas })
      + champ('Angle', 'b.angle', nb(ang, 2), { ...o, unite: '°', pas: 1 })
      + champ(plan ? 'Largeur (X)' : 'Largeur', 'b.dx', nb(dx), { ...o, unite: 'm', pas })
      + champ(plan ? 'Profondeur (Y)' : 'Hauteur', 'b.dy', nb(dy), { ...o, unite: 'm', pas })
      + `<div class="interrupteur-ligne"><span>${picto('n-appui')}Fixe : (${nb(F.x, 2)} ; ${nb(F.y, 2)})</span>`
      + `<button type="button" class="a-bouton fantome" data-act="bout-fixe" data-id="${b.id}" data-v="${fixe === 'a' ? 'b' : 'a'}">Changer</button></div>`
      + discret('Ce bout reste en place, l’autre bouge.'))
    + bloc(titre(picto('grille'), 'Type') + grilleTypesBarre(b.type, plan))
    + reglagesType(b.type, b)
    + blocSection(b, f)
    + (plan || !BARRES_LIN.has(b.type) || b.type === 'toit' ? '' : bloc(interrupteur('b.moise', 'section', 'Moisée (doublée de chaque côté)', !!b.moise)
      + discret('Deux pièces serrent les barres qu’elle croise. Elle passe devant, rien ne la coupe.')))
    + (plan || !PORTE_CHARGE.has(b.type) ? '' : blocCharges(b, L))
    + boutonsFin(RETOURNABLES.has(b.type));
}

function blocCote(c, f) {
  const N = carteNoeuds(f);
  const a = pointCote(c.a, N);
  const b = pointCote(c.b, N);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return bloc(titre(picto('cote'), 'Cote')
      + `<div class="gros">${esc(c.texte || nb(L, 2) + ' m')}</div>`
      + champ('Décalage', 'c.decalage', nb(c.decalage ?? 1), { id: c.id, unite: 'm', pas: etat.pas || 0.1 })
      + champTexte('Texte', 'c.texte', c.texte || '', { id: c.id, aide: nb(L, 2) })
      + discret(`Mesure : ${nb(L, 3)} m. Texte vide : la mesure s’affiche.`))
    + bloc(rangee(bouton('cote-inverser', 'miroir', 'Changer de côté'), bouton('effacer', 'supprimer', 'Effacer', 'danger')));
}

function blocTexte(t) {
  const tailles = [[1, 'Petit'], [2, 'Moyen'], [3, 'Grand']].map(([v, nom]) =>
    `<button type="button" class="${t.taille === v ? 'on' : ''}" data-act="taille" data-v="${v}">${nom}</button>`).join('');
  return bloc(titre(picto('texte'), 'Texte')
      + champTexte('Texte', 'x.texte', t.texte, { id: t.id })
      + `<div class="ligne-champ"><span>Taille</span><div class="a-bascule bascule-pleine">${tailles}</div></div>`)
    + boutonsFin(false, false);
}

function blocTrait(s) {
  return bloc(titre(picto('crayon'), 'Trait à main levée') + discret(s.pts.length + ' points')) + boutonsFin(false);
}

function blocPlusieurs(ids, f) {
  const NOMS = { b: ['barre', 'barres'], n: ['nœud', 'nœuds'], c: ['cote', 'cotes'], t: ['texte', 'textes'], s: ['trait', 'traits'] };
  const compte = {};
  for (const id of ids) compte[id[0]] = (compte[id[0]] || 0) + 1;
  const detail = Object.keys(NOMS).filter((p) => compte[p]).map((p) => compte[p] + ' ' + NOMS[p][compte[p] > 1 ? 1 : 0]).join(' · ');
  const barres = ids.filter((id) => id[0] === 'b').map((id) => objet(id, f));
  const noeuds = ids.filter((id) => id[0] === 'n').map((id) => objet(id, f));
  const memeB = barres.length && barres.every((b) => b.type === barres[0].type) ? barres[0].type : '';
  const memeN = noeuds.length && noeuds.every((n) => n.type === noeuds[0].type) ? noeuds[0].type : '';
  const plan = estPlan(f);
  return bloc(titre(picto('selection'), 'Sélection') + `<div class="gros">${ids.length} éléments</div>` + discret(detail))
    + (barres.length ? bloc(titre(picto('grille'), plan ? 'Type des éléments' : 'Type des barres') + grilleTypesBarre(memeB, plan)) : '')
    + (noeuds.length ? bloc(titre(picto(plan ? 'n-poteau' : 'n-appui'), plan ? 'Type des nœuds' : 'Liaison des nœuds') + grilleTypesNoeud(memeN, plan)) : '')
    + blocSectionPlusieurs(barres)
    + boutonsFin(barres.some((b) => RETOURNABLES.has(b.type)));
}

const AIDES_PLAN = {
  murp: 'Clique le début du mur, puis la suite. Les coins se raccordent tout seuls. Double-clic ou Entrée pour finir.',
  cloison: 'Clique le début de la cloison, puis la suite. Les coins se raccordent tout seuls. Double-clic ou Entrée pour finir.',
  poutrep: 'Clique le début de la poutre, puis la fin. Elle se dessine en tirets ; en 3D elle passe sous le haut des murs.',
  porte: 'Clique les deux bouts de la porte, sur un mur. Le mur s’ouvre tout seul.',
  fenetre: 'Clique les deux bouts de la fenêtre, sur un mur.',
  trame: 'Clique le début de l’axe, puis la fin. La bulle se met au début.',
  escalier: 'Clique le bas, puis le haut. La flèche montre la montée.',
  'n-poteau': 'Clique pour poser un poteau (grille, nœud ou mur).',
};

function aideOutil(id) {
  if (AIDES_PLAN[id]) return AIDES_PLAN[id];
  if (NOM_BARRE[id]) {
    if (id === 'treillis') return 'Clique le début, puis la fin : le treillis se dessine entre les deux.';
    if (id === 'sol') return 'Clique le début du sol, puis la fin. Les hachures vont dessous.';
    return 'Clique le début, puis la fin. Chaque clic continue la ligne. Double-clic ou Entrée pour finir. Pendant le tracé, tape 3.5 ; 30 puis Entrée : 3,5 m à 30°.';
  }
  if (id.startsWith('n-')) return 'Clique un nœud pour lui donner cette liaison.';
  return {
    selection: 'Clique un élément pour le régler ici, au millimètre.',
    cote: 'Clique un premier point, puis le second. La cote suit les nœuds quand ils bougent.',
    texte: 'Clique où poser le texte, écris, puis Entrée.',
    crayon: 'Appuie et glisse pour dessiner à main levée.',
    gomme: 'Clique sur ce que tu veux effacer.',
  }[id] || '';
}

function blocOutil() {
  const id = etat.outil || 'selection';
  const aide = aideOutil(id);
  return bloc(titre(picto(id), 'Outil') + `<div class="gros">${esc(nomOutil(id))}</div>` + (aide ? discret(aide) : ''))
    + reglagesType(id);
}

function blocFeuille(f) {
  const n = etat.doc.feuilles.length;
  const plan = estPlan(f);
  const types = [['coupe', 'Coupe'], ['plan', 'Plan']].map(([v, nom]) =>
    `<button type="button" class="${(v === 'plan') === plan ? 'on' : ''}" data-act="feuille-type" data-v="${v}">${nom}</button>`).join('');
  return bloc(titre(ico('fichier'), 'Feuille')
    + champTexte('Nom', 'f.nom', f.nom)
    + `<div class="ligne-champ"><span>Type</span><div class="a-bascule bascule-pleine">${types}</div></div>`
    + (plan ? champ('Hauteur des murs', 'f.etage', nb(f.etage ?? 2.7), { unite: 'm', pas: 0.1 })
      + champ('Niveau du plancher', 'f.niveau', nb(f.niveau || 0), { unite: 'm', pas: 0.1 })
      + discret('Niveau : hauteur où ce plan est posé dans la 3D de tout le bâtiment (0 = rez-de-chaussée).')
      : interrupteur('f.sections', 'section', 'Barres à leur vraie épaisseur', f.sections !== false)
      + blocPlace(f))
    + discret(`${f.barres.length} ${plan ? 'éléments' : 'barres'} · ${f.noeuds.length} nœuds · ${f.cotes.length} cotes · ${f.textes.length} textes`)
    + rangee(
      enLigne ? bouton('feuille-svg', 'oeil', 'Télécharger le SVG')
        : `<a class="a-bouton fantome" href="${avecProjet('/planches/' + encodeURIComponent(nomFichier(f, etat.fi)))}" target="_blank" rel="noopener">${picto('oeil')}<span>Ouvrir le SVG</span></a>`,
      n > 1 ? bouton('feuille-suppr', 'supprimer', etat.doc.feuilles.some((x) => x.groupe === f.groupe && x !== f) ? `Supprimer la V${f.v}` : 'Supprimer la feuille', 'danger') : '',
    ));
}

// Place de la coupe dans le plan (vue de dessus) : sert à la 3D de tout le bâtiment.
function blocPlace(f) {
  const t = f.trois_d || {};
  const sens = [[0, 'Le long de x'], [90, 'Le long de y']].map(([v, nom]) =>
    `<button type="button" class="${(+t.angle === 90) === (v === 90) ? 'on' : ''}" data-act="feuille-angle" data-v="${v}">${nom}</button>`).join('');
  return champ('Place x', 'f.x0', nb(+t.x0 || 0, 2), { unite: 'm', pas: 0.5 })
    + champ('Place y', 'f.y0', nb(+t.y0 || 0, 2), { unite: 'm', pas: 0.5 })
    + `<div class="ligne-champ"><span>Sens</span><div class="a-bascule bascule-pleine">${sens}</div></div>`
    + discret('Où la coupe passe dans le plan. La 3D « Tout » la pose là, avec les plans.');
}

function blocCroquis(f) {
  const k = f.croquis;
  const noms = etat.croquis || [];
  const vignettes = noms.map((nom) =>
    `<button type="button" class="vignette${k?.nom === nom ? ' on' : ''}" data-act="croquis" data-v="${esc(nom)}" title="${esc(nom)}">`
    + `<img src="${urlCroquis(nom)}" alt="${esc(nom)}" loading="lazy" draggable="false"></button>`,
  ).join('') + `<button type="button" class="vignette ajouter" data-act="croquis-ajouter" title="Ajouter une image">${ico('ajouter')}</button>`;
  let h = titre(picto('image'), 'Croquis de fond') + `<div class="vignettes">${vignettes}</div>`;
  if (!noms.length) h += discret('Aucune image pour l’instant. Glisse une image sur le dessin, ou colle-la (Ctrl+V).');
  if (k) {
    h += `<label class="ligne-champ"><span>Opacité</span><input type="range" min="0.1" max="1" step="0.05" data-champ="k.opacite" value="${+(k.opacite ?? 0.5)}"></label>`
      + champ('Rotation', 'k.rot', nb(k.rot || 0, 2), { unite: '°', pas: 1 })
      + rangee(bouton('croquis-tourner', 'tourner-g', '−90°', 'fantome', '-90'), bouton('croquis-tourner', 'tourner-d', '+90°', 'fantome', '90'))
      + interrupteur('k.inverse', 'inverser', 'Inverser les couleurs', k.inverse)
      + interrupteur('k.masque', 'oeil', 'Masquer', k.masque)
      + rangee(
        bouton('croquis-etalonner', 'etalonner', 'Étalonner', 'principal'),
        bouton('croquis-deplacer', 'deplacer', 'Déplacer'),
        bouton('croquis-retirer', 'supprimer', 'Retirer'),
      )
      + discret('Étalonner : clique 2 points du croquis dont tu connais la distance, puis tape-la.');
  }
  return bloc(h);
}

function blocGestes() {
  const g = [
    [['Clic'], 'Poser un point · choisir'],
    [['Double-clic', 'Entrée'], 'Finir le tracé'],
    [['Échap'], 'Arrêter · tout déchoisir'],
    [['Espace', 'glisser'], 'Se déplacer (ou bouton du milieu)'],
    [['Molette'], 'Zoomer'],
    [['Maj'], 'Angles tous les 15°'],
    [['Alt'], 'Sans aimant'],
    [['3.5 ; 30'], 'Pendant un tracé : longueur ; angle'],
    [['Flèches'], 'Déplacer ce qui est choisi (Maj : ×10)'],
    [['Ctrl+Z', 'Ctrl+Y'], 'Annuler · rétablir'],
    [['Ctrl+C', 'V', 'D'], 'Copier · coller · dupliquer'],
    [['Suppr'], 'Effacer'],
    [['F'], 'Tout voir'],
    [['Lettres'], 'Outils (bulle sur chaque bouton)'],
  ];
  return bloc(titre(picto('aide'), 'Gestes') + '<div class="gestes">'
    + g.map(([k, d]) => `<span>${k.map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</span><span>${esc(d)}</span>`).join('')
    + '</div>');
}

function contenu() {
  const f = feuille();
  if (!f || !etat.doc) return '';
  const ids = choisis(f);
  if (ids.length === 1) {
    const o = objet(ids[0], f);
    switch (ids[0][0]) {
      case 'n': return blocNoeud(o, f);
      case 'b': return blocBarre(o, f);
      case 'c': return blocCote(o, f);
      case 't': return blocTexte(o);
      case 's': return blocTrait(o);
      default:
    }
  }
  if (ids.length > 1) return blocPlusieurs(ids, f);
  return blocOutil() + blocFeuille(f) + blocCroquis(f) + blocGestes();
}

// ---------- Reconstruction (différée : pas de clic perdu, Tab passe au champ suivant) ----------
let panneau = null;
let prevu = false;
let appui = false;
let reconstruction = false;
let photo = null; // positions des nœuds au début d'une saisie (pour Échap)

export function dessinerPanneau() {
  if (prevu) return;
  prevu = true;
  requestAnimationFrame(() => { if (!appui && prevu) construire(); });
}

function construire() {
  prevu = false;
  if (!panneau) return;
  const a = document.activeElement;
  const garde = a && panneau.contains(a) && a.dataset?.champ ? {
    champ: a.dataset.champ, id: a.dataset.id || '', type: a.type, valeur: a.value,
    debut: a.selectionStart, fin: a.selectionEnd, sale: a.dataset.sale, avant: a.dataset.avant,
  } : null;
  const haut = panneau.scrollTop;
  reconstruction = true;
  try {
    panneau.innerHTML = contenu();
    panneau.scrollTop = haut;
    if (!garde) return;
    const q = `[data-champ="${garde.champ}"]` + (garde.id ? `[data-id="${CSS.escape(garde.id)}"]` : ':not([data-id])');
    const el = panneau.querySelector(q);
    if (!el) return;
    if (garde.sale && garde.type !== 'checkbox') el.value = garde.valeur;
    el.focus({ preventScroll: true });
    // Tout était choisi, ou la valeur a changé ailleurs : on choisit tout (la frappe remplace).
    const tout = garde.debut === 0 && garde.fin === String(garde.valeur).length;
    try {
      if (garde.debut == null) { /* champ sans curseur */ } else if (tout || (!garde.sale && el.value !== garde.valeur)) el.select();
      else el.setSelectionRange(Math.min(garde.debut, el.value.length), Math.min(garde.fin, el.value.length));
    } catch { /* champ sans curseur */ }
    if (garde.sale) el.dataset.sale = garde.sale;
    el.dataset.avant = garde.sale ? (garde.avant ?? el.value) : el.value;
    if (photo && photo.el === a) photo.el = el;
  } finally {
    reconstruction = false;
  }
}

// ---------- Saisie dans les champs ----------
const estChamp = (el) => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)
  && !!el.dataset.champ && !!panneau && panneau.contains(el);

function prendrePhoto(el) {
  const f = feuille();
  const o = el.dataset.id ? objet(el.dataset.id, f) : null;
  if (!o) return null;
  const ids = o.id[0] === 'n' ? [o.id] : o.id[0] === 'b' ? [o.a, o.b] : [];
  const noeuds = ids.map((id) => objet(id, f)).filter(Boolean).map((n) => [n, n.x, n.y]);
  return noeuds.length ? { el, noeuds } : null;
}

function remettrePhoto(el) {
  if (!photo || photo.el !== el) return false;
  for (const [n, x, y] of photo.noeuds) { n.x = x; n.y = y; }
  synchroCotes(feuille());
  return true;
}

// Saisie impossible : retour à la valeur d'avant.
function revenir(el) {
  if (remettrePhoto(el)) {
    el.value = el.dataset.avant ?? el.value;
    return true;
  }
  if (el.dataset.avant !== undefined && el.value !== el.dataset.avant) {
    el.value = el.dataset.avant;
    return appliquer(el, true);
  }
  return false;
}

// Met le modèle à jour depuis un champ. final = validation (Entrée, Tab, clic ailleurs).
function appliquer(el, final) {
  const f = feuille();
  if (!f) return false;
  const cle = el.dataset.champ;
  const o = el.dataset.id ? objet(el.dataset.id, f) : null;
  if (el.dataset.id && !o) return false;
  const refus = () => (final ? revenir(el) : false);

  if (cle === 'f.nom') {
    f.nom = final ? el.value.trim() || 'Feuille ' + (etat.fi + 1) : el.value;
    if (final) el.value = f.nom;
    crochets.onglets?.();
    return true;
  }
  if (cle === 'c.texte') {
    const t = el.value.trim();
    if (t) o.texte = t;
    else delete o.texte;
    return true;
  }
  if (cle === 'x.texte') {
    if (final && !el.value.trim()) {
      const i = f.textes.indexOf(o);
      if (i >= 0) f.textes.splice(i, 1);
      etat.sel.delete(o.id);
      toast('Texte vide : effacé');
      return true;
    }
    o.texte = el.value;
    return true;
  }
  if (cle === 's.mat') {
    if (!MATIERES[el.value]) return false;
    const cibles = o ? [o] : choisis(f).filter((id) => id[0] === 'b').map((id) => objet(id, f));
    for (const x of cibles) if (x && aSection(x.type)) x.mat = el.value;
    return true;
  }
  if (cle === 's.nom') {
    if (!o || o.id[0] !== 'b') return false;
    o.sec = { f: 'profil', nom: el.value };
    return true;
  }
  if (cle === 'tr.nom') {
    const t = el.value.trim().slice(0, 3);
    if (t && o) o.trame = { ...(o.trame || {}), nom: t };
    if (final) el.value = o?.trame?.nom || ''; // vide : on garde l'ancien nom
    return true;
  }

  let v = lireNombre(el.value);
  if (cle === 't.n') v = Math.round(v);
  if (!valide(cle, v)) return refus();

  if (cle === 'n.x' || cle === 'n.y') {
    o[cle === 'n.x' ? 'x' : 'y'] = arr(v);
    synchroCotes(f);
    if (final) apresDeplacement([o.id], f);
    return true;
  }
  if (BARRE.has(cle)) {
    const A = objet(o.a, f);
    const B = objet(o.b, f);
    if (!A || !B) return false;
    const auDebut = el.dataset.fixe !== 'b';
    const F = auDebut ? A : B; // reste en place
    const M = auDebut ? B : A; // bouge
    const s = auDebut ? 1 : -1;
    let dx = B.x - A.x;
    let dy = B.y - A.y;
    if (cle === 'b.longueur' || cle === 'b.angle') {
      let L = Math.hypot(dx, dy);
      let th = L > 1e-9 ? Math.atan2(dy, dx) : 0;
      if (cle === 'b.longueur') L = v;
      else th = angle180(v) * RAD;
      if (!(L > 1e-9)) return refus();
      dx = L * Math.cos(th);
      dy = L * Math.sin(th);
    } else if (cle === 'b.dx') dx = v;
    else dy = v;
    if (Math.hypot(dx, dy) < 1e-6) return refus();
    M.x = arr(F.x + s * dx);
    M.y = arr(F.y + s * dy);
    synchroCotes(f);
    if (final) apresDeplacement([M.id], f);
    return true;
  }
  // Section d'une barre : les champs sont en centimètres, le modèle en mètres.
  if (cle === 's.b' || cle === 's.h' || cle === 's.e') {
    if (!o || o.id[0] !== 'b') return false;
    const s = sectionDe(o);
    const n = s.f === 'rond' ? { f: 'rond', b: s.b }
      : s.f === 'tube' ? { f: 'tube', b: s.b, e: s.e }
        : { f: 'rect', b: s.b, h: s.h };
    n[cle.slice(2)] = arr(v / 100);
    if (n.f === 'tube') n.e = Math.min(n.e, n.b / 2.5);
    o.sec = n;
    return true;
  }
  if (REGLAGES[cle]) {
    const [type, k] = REGLAGES[cle];
    const d = (etat.defauts[type] ||= {});
    d[k] = k === 'fleche' ? Math.abs(v) : v;
    if (o && o.type === type) o[type] = { ...d, ...(o[type] || {}), [k]: v };
    return true;
  }
  if (cle === 'p.s') {
    if (!o || o.id[0] !== 'n') return false;
    o.s = arr(v);
    return true;
  }
  if (cle === 'f.etage') {
    f.etage = arr(v);
    return true;
  }
  if (cle === 'f.niveau') {
    f.niveau = arr(v);
    return true;
  }
  if (cle === 'f.x0' || cle === 'f.y0') {
    f.trois_d = { entraxe: 6, nombre: 4, ...f.trois_d, [cle.slice(2)]: arr(v) };
    return true;
  }
  if (cle === 'c.decalage') {
    o.decalage = arr(v);
    return true;
  }
  if (cle === 'k.opacite' || cle === 'k.rot') {
    const k = f.croquis;
    if (!k) return false;
    if (cle === 'k.opacite') k.opacite = Math.min(1, Math.max(0.05, v));
    else k.rot = arr(angle180(v));
    return true;
  }
  if (cle === 'ch.v' || cle === 'ch.d') {
    const c = (o?.charges || []).find((x) => x.id === el.dataset.ch);
    if (!c) return false;
    const v = lireNombre(el.value);
    if (cle === 'ch.v') {
      if (!Number.isFinite(v) || v <= 0 || v > 10000) return refus();
      c.v = Math.round(v * 1000) / 1000;
      return true;
    }
    const L = +el.dataset.l || 1;
    if (!Number.isFinite(v)) return refus();
    c.t = Math.round(Math.max(0, Math.min(1, v / L)) * 10000) / 10000;
    if (final) el.value = nb(c.t * L, 2);
    return true;
  }
  return false;
}

function valider(el) {
  delete el.dataset.sale;
  appliquer(el, true);
  el.dataset.avant = el.value;
  if (document.activeElement === el) photo = prendrePhoto(el);
  modifie();
}

function surFocusIn(ev) {
  const el = ev.target;
  if (reconstruction || !estChamp(el) || el.type === 'checkbox') return;
  el.dataset.avant = el.value;
  photo = prendrePhoto(el);
}

function surInput(ev) {
  const el = ev.target;
  if (!estChamp(el) || el.type === 'checkbox') return;
  el.dataset.sale = '1';
  if (appliquer(el, false)) demanderDessin();
}

function surChange(ev) {
  const el = ev.target;
  if (!estChamp(el) || el.dataset.annule) return;
  if (el.type === 'checkbox') {
    if (el.dataset.champ === 'f.sections') {
      const g = feuille();
      if (g) { g.sections = el.checked; modifie(); }
      return;
    }
    if (el.dataset.champ === 'b.moise') {
      const g = feuille();
      if (!g) return;
      for (const id of choisis(g)) {
        const o = id[0] === 'b' ? objet(id, g) : null;
        if (!o) continue;
        if (el.checked) o.moise = true; else delete o.moise;
      }
      modifie();
      return;
    }
    const k = feuille()?.croquis;
    if (!k) return;
    if (el.dataset.champ === 'k.inverse') k.inverse = el.checked;
    if (el.dataset.champ === 'k.masque') k.masque = el.checked;
    modifie();
    return;
  }
  valider(el);
}

function surFocusOut(ev) {
  const el = ev.target;
  if (reconstruction || !(el instanceof HTMLInputElement) || !el.dataset.champ) return;
  if (el.dataset.annule) { delete el.dataset.annule; return; }
  if (el.dataset.sale) valider(el);
}

function surTouche(ev) {
  const el = ev.target;
  if (!estChamp(el) || el.type === 'checkbox') return;
  if (ev.key === 'Enter') {
    ev.preventDefault();
    el.blur();
    return;
  }
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    if (el.dataset.sale) {
      el.value = el.dataset.avant ?? el.value;
      if (!remettrePhoto(el)) appliquer(el, false);
      delete el.dataset.sale;
    }
    el.dataset.annule = '1';
    el.blur();
    rafraichir();
    return;
  }
  if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && el.dataset.pas) {
    ev.preventDefault();
    const cle = el.dataset.champ;
    let v = lireNombre(el.value);
    if (!Number.isFinite(v)) v = lireNombre(el.dataset.avant);
    if (!Number.isFinite(v)) v = 0;
    const p = +el.dataset.pas * (ev.shiftKey ? 10 : 1);
    v = borner(cle, Math.round((v + (ev.key === 'ArrowUp' ? p : -p)) / p) * p);
    el.value = nb(v, cle === 't.n' ? 0 : 4);
    el.dataset.sale = '1';
    if (appliquer(el, false)) demanderDessin();
  }
}

// ---------- Boutons ----------
async function agir(act, v, el) {
  const f = feuille();
  if (!f) return;
  const ids = choisis(f);
  const de = (p) => ids.filter((id) => id[0] === p).map((id) => objet(id, f));
  switch (act) {
    case 'charge-ajouter': {
      const o = objet(el.dataset.id, f);
      if (!o) return;
      const libre = v.startsWith('libre-') ? v.slice(6) : '';
      const m = libre ? { nom: NOMS_SORTES[libre], k: libre, v: libre === 'ponctuelle' ? 1 : 1, cat: 'G' } : BIBLIO.find((x) => x.id === v);
      if (!m || (o.id[0] === 'n' && m.k !== 'ponctuelle')) return;
      if (!Array.isArray(o.charges)) o.charges = [];
      const pris = new Set(o.charges.map((c) => c.id));
      let i = o.charges.length + 1;
      while (pris.has('c' + i)) i++;
      o.charges.push(nouvelleCharge(m, 'c' + i));
      modifie();
      toast(m.nom + ' ajouté');
      return;
    }
    case 'charge-effacer':
    case 'charge-cat': {
      const o = objet(el.dataset.id, f);
      const liste = o?.charges || [];
      const i = liste.findIndex((c) => c.id === el.dataset.ch);
      if (i < 0) return;
      if (act === 'charge-cat') { if (liste[i].cat === v) return; liste[i].cat = v; }
      else liste.splice(i, 1);
      if (!liste.length) delete o.charges;
      modifie();
      return;
    }
    case 'jonction': {
      let n = 0;
      for (const o of de('n')) if ((o.jonction || 'auto') !== v) { if (v === 'auto') delete o.jonction; else o.jonction = v; n++; }
      if (n) modifie();
      return;
    }
    case 'type-noeud': {
      let n = 0;
      for (const o of de('n')) if (o.type !== v) { o.type = v; n++; }
      if (n) modifie();
      return;
    }
    case 'type-barre': {
      let n = 0;
      for (const b of de('b')) {
        if (b.type === v) continue;
        for (const [t] of TYPES_BARRE) delete b[t]; // on oublie les réglages de l'ancien type
        const A = objet(b.a, f);
        const B = objet(b.b, f);
        Object.assign(b, reglagesBarre(v, A && [A.x, A.y], B && [B.x, B.y]));
        b.type = v;
        couperParNoeuds(b, f);
        n++;
      }
      if (n) modifie();
      return;
    }
    case 'porte-charniere': {
      let n = 0;
      for (const b of de('b')) {
        if (b.type !== 'porte') continue;
        b.porte = { sens: 1, ...(b.porte || {}), charniere: b.porte?.charniere === 'b' ? 'a' : 'b' };
        n++;
      }
      if (n) modifie();
      return;
    }
    case 'feuille-angle': {
      const t = { entraxe: 6, nombre: 4, ...f.trois_d };
      if ((+t.angle === 90) === (v === '90')) return;
      if (v === '90') t.angle = 90; else delete t.angle;
      f.trois_d = t;
      modifie();
      return;
    }
    case 'feuille-type': {
      const plan = v === 'plan';
      if (estPlan(f) === plan) return;
      crochets.finirAction?.();
      crochets.basculerVue(plan);
      return;
    }
    case 'forme': {
      etat.defauts.treillis = { ...etat.defauts.treillis, forme: v };
      const b = el.dataset.id ? objet(el.dataset.id, f) : null;
      if (b?.type === 'treillis') {
        b.treillis = { ...etat.defauts.treillis, ...b.treillis, forme: v };
        modifie();
      } else rafraichir();
      return;
    }
    case 'forme-toit': {
      etat.defauts.toit = { ...etat.defauts.toit, forme: v };
      const b = el.dataset.id ? objet(el.dataset.id, f) : null;
      if (b?.type === 'toit') {
        b.toit = { ...etat.defauts.toit, ...b.toit, forme: v };
        modifie();
      } else rafraichir();
      return;
    }
    case 'forme-sec': {
      const b = el.dataset.id ? objet(el.dataset.id, f) : null;
      if (!b) return;
      const s = sectionDe(b);
      if (s.f === v) return;
      const d = Math.min(s.b, s.h);
      b.sec = v === 'profil' ? { f: 'profil', nom: s.nom || 'IPE 200' }
        : v === 'rond' ? { f: 'rond', b: d }
          : v === 'tube' ? { f: 'tube', b: d, e: Math.max(0.003, d / 12) }
            : { f: 'rect', b: s.b, h: s.h };
      modifie();
      return;
    }
    case 'predim': {
      const cibles = el.dataset.id ? [objet(el.dataset.id, f)] : de('b');
      let n = 0;
      for (const b of cibles) {
        if (!b || !SECTION_PLEINE.has(b.type)) continue;
        const A = objet(b.a, f);
        const B = objet(b.b, f);
        const L = A && B ? Math.hypot(B.x - A.x, B.y - A.y) : 0;
        if (!(L > 1e-6)) continue;
        const p = predim(b.type, cleMatiere(b), L);
        b.sec = p.sec;
        if (b.type === 'treillis' && p.hauteur) {
          b.treillis = { ...etat.defauts.treillis, ...(b.treillis || {}), h: Math.round(p.hauteur * 20) / 20 };
        }
        n++;
      }
      if (!n) { toast('Rien à dimensionner ici', true); return; }
      modifie();
      toast(n === 1 ? 'Section conseillée : ' + texteSection(cibles[0]) : n + ' sections conseillées');
      return;
    }
    case 'bout-fixe':
      boutFixe = { id: el.dataset.id, bout: v };
      rafraichir();
      return;
    case 'retourner': retourner(ids.filter((id) => id[0] === 'b')); return;
    case 'copier': copier(); return;
    case 'symetrie': symetrie(); return;
    case 'effacer': supprimerSelection(); return;
    case 'taille': {
      const [t] = de('t');
      if (t && ids.length === 1) { t.taille = +v; modifie(); }
      return;
    }
    case 'cote-inverser': {
      const [c] = de('c');
      if (c) { c.decalage = -(c.decalage ?? 1); modifie(); }
      return;
    }
    case 'feuille-suppr': {
      if (etat.doc.feuilles.length < 2) return;
      if (!confirm(`Supprimer la feuille « ${f.nom} » de la version V${f.v || 1} ?\nCtrl+Z la fait revenir.`)) return;
      crochets.finirAction?.();
      for (const x of etat.doc.feuilles) if (x.paire === f.id) delete x.paire;
      const memeV = etat.doc.feuilles.filter((x) => x.v === f.v && x !== f);
      const soeurs = memeV.length ? memeV : etat.doc.feuilles.filter((x) => x !== f);
      etat.doc.feuilles.splice(etat.fi, 1);
      const voisine = soeurs.length ? etat.doc.feuilles.indexOf(soeurs[soeurs.length - 1]) : -1;
      etat.fi = voisine >= 0 ? voisine : Math.min(etat.fi, etat.doc.feuilles.length - 1);
      etat.sel.clear();
      appliquerVue();
      modifie();
      return;
    }
    case 'croquis':
      if (f.croquis?.nom !== v) await choisirFond(v); // même image : on garde l'étalonnage
      return;
    case 'feuille-svg': telecharger(nomFichier(f, etat.fi), svgPapier(f, paireDe(f))); return;
    case 'croquis-ajouter': document.getElementById('fichier-image')?.click(); return;
    case 'croquis-tourner':
      if (f.croquis) { f.croquis.rot = angle180((+f.croquis.rot || 0) + (+v || 0)); modifie(); }
      return;
    case 'croquis-etalonner': etalonnerCroquis(); return;
    case 'croquis-deplacer': deplacerCroquis(); return;
    case 'croquis-retirer':
      if (f.croquis) { delete f.croquis; modifie(); }
      return;
    default:
  }
}

function surClic(ev) {
  const b = ev.target.closest?.('[data-act]');
  if (!b || !panneau.contains(b) || b.disabled) return;
  ev.preventDefault();
  b.blur();
  Promise.resolve(agir(b.dataset.act, b.dataset.v ?? '', b)).catch((e) => {
    console.error(e);
    toast('Erreur : ' + e.message, true);
  });
}

// ---------- Démarrage ----------
export function initPanneau() {
  panneau = document.getElementById('panneau');
  if (!panneau) return;
  panneau.addEventListener('click', surClic);
  panneau.addEventListener('input', surInput);
  panneau.addEventListener('change', surChange);
  panneau.addEventListener('keydown', surTouche);
  panneau.addEventListener('focusin', surFocusIn);
  panneau.addEventListener('focusout', surFocusOut);
  // Bouton enfoncé dans le panneau : on attend qu'il soit relâché pour reconstruire.
  panneau.addEventListener('pointerdown', () => { appui = true; }, true);
  const relache = () => {
    if (!appui) return;
    appui = false;
    setTimeout(() => { if (prevu) construire(); }, 0);
  };
  document.addEventListener('pointerup', relache, true);
  document.addEventListener('pointercancel', relache, true);
  window.addEventListener('blur', relache);
  // Clic sur le dessin pendant une saisie : le champ est validé avant que le dessin reçoive le clic.
  document.addEventListener('pointerdown', (ev) => {
    const a = document.activeElement;
    if (a && panneau.contains(a) && a.dataset?.champ && !panneau.contains(ev.target)) a.blur();
  }, true);
}
