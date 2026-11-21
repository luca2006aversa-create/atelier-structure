// Croquis de fond : une image du dossier croquis posée sous le dessin, à l'échelle.
import { etat, feuille, modifie, toast, versEcran } from './etat.js';
import { enLigne, garderImage, lireImages } from './mode.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const cache = new Map();

// En ligne : images livrees avec la page (dossier croquis/) + images ajoutees (gardees dans le navigateur).
const ajoutees = new Map(); // nom -> adresse blob:
export const urlCroquis = (nom) => ajoutees.get(nom) || (enLigne ? 'croquis/' : '/croquis/') + encodeURIComponent(nom);

// Taille naturelle d'une image (mise en cache).
export function image(nom) {
  if (!cache.has(nom)) {
    cache.set(nom, new Promise((ok, ko) => {
      const im = new Image();
      im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => { cache.delete(nom); ko(new Error('Image illisible')); };
      im.src = urlCroquis(nom);
    }));
  }
  return cache.get(nom);
}

export async function chargerListe() {
  if (enLigne) {
    let noms = [];
    try { const j = await (await fetch('croquis/liste.json')).json(); noms = Array.isArray(j.noms) ? j.noms : []; } catch { /* aucune */ }
    for (const [nom, blob] of await lireImages()) {
      if (!ajoutees.has(nom)) ajoutees.set(nom, URL.createObjectURL(blob));
    }
    etat.croquis = [...noms, ...[...ajoutees.keys()].filter((n) => !noms.includes(n))];
    return etat.croquis;
  }
  try {
    const r = await fetch('/api/croquis');
    const j = await r.json();
    etat.croquis = Array.isArray(j.noms) ? j.noms : [];
  } catch {
    etat.croquis = [];
  }
  return etat.croquis;
}

// Pose l'image en fond de la feuille ouverte, centrée sur la vue, à 80 % de l'écran.
export async function choisirFond(nom) {
  const f = feuille();
  if (!f || !nom) return;
  let t;
  try {
    t = await image(nom);
  } catch {
    toast('Image illisible : ' + nom, true);
    return;
  }
  if (!t.w || !t.h) return;
  const k = Math.min((0.8 * etat.W) / t.w, (0.8 * etat.H) / t.h);
  f.croquis = {
    nom, w: t.w, h: t.h, cx: +etat.vue.cx.toFixed(3), cy: +etat.vue.cy.toFixed(3),
    echelle: k / etat.vue.z, rot: 0, opacite: 0.5, inverse: true, masque: false,
  };
  modifie();
}

// Met à jour l'image de fond dans le calque (un seul élément gardé : pas de clignotement).
let el = null;
export function majCroquis(calque) {
  const c = feuille()?.croquis;
  if (!c || c.masque || !c.w || !c.h) {
    if (el) { el.remove(); el = null; }
    return;
  }
  if (!el) {
    el = document.createElementNS(SVGNS, 'image');
    el.setAttribute('preserveAspectRatio', 'none');
  }
  if (el.parentNode !== calque) calque.appendChild(el);
  const a = {
    href: urlCroquis(c.nom),
    x: String(-c.w / 2),
    y: String(-c.h / 2),
    width: String(c.w),
    height: String(c.h),
    opacity: String(c.opacite ?? 0.5),
  };
  const [X, Y] = versEcran(c.cx, c.cy);
  a.transform = `translate(${X.toFixed(2)} ${Y.toFixed(2)}) rotate(${+(c.rot || 0)}) scale(${c.echelle * etat.vue.z})`;
  for (const [k, v] of Object.entries(a)) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  if (c.inverse) { if (el.getAttribute('filter') !== 'url(#inverser)') el.setAttribute('filter', 'url(#inverser)'); }
  else if (el.hasAttribute('filter')) el.removeAttribute('filter');
}

// Deux points P1, P2 (m) dont la vraie distance est D : on met l'image à l'échelle autour de P1.
export function etalonner(P1, P2, D) {
  const c = feuille()?.croquis;
  const d = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
  if (!c || !(d > 1e-6) || !(D > 0)) return false;
  const s = D / d;
  c.echelle *= s;
  c.cx = +(P1[0] + (c.cx - P1[0]) * s).toFixed(4);
  c.cy = +(P1[1] + (c.cy - P1[1]) * s).toFixed(4);
  modifie();
  return true;
}

const horodatage = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

// Envoie une image (fichier choisi, déposé ou collé) dans le dossier croquis, puis la pose en fond.
export async function envoyerImage(fichier) {
  if (!fichier || !/^image\//.test(fichier.type || '')) {
    toast('Ce n’est pas une image', true);
    return;
  }
  const nom = fichier.name && fichier.name !== 'image.png' ? fichier.name : `colle-${horodatage()}.png`;
  if (enLigne) {
    try {
      await garderImage(nom, fichier);
      const ancienne = ajoutees.get(nom);
      if (ancienne) URL.revokeObjectURL(ancienne);
      ajoutees.set(nom, URL.createObjectURL(fichier));
      cache.delete(nom);
      await chargerListe();
      await choisirFond(nom);
      toast('Croquis ajouté : ' + nom);
    } catch (e) {
      toast('Image pas gardée : ' + (e?.message || e), true);
    }
    return;
  }
  try {
    const r = await fetch('/api/croquis', {
      method: 'POST',
      headers: { 'X-Atelier': '1', 'X-Nom': encodeURIComponent(nom), 'Content-Type': fichier.type },
      body: fichier,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erreur || 'erreur ' + r.status);
    await chargerListe();
    await choisirFond(j.nom);
    toast('Croquis ajouté : ' + j.nom);
  } catch (e) {
    toast('Image pas envoyée : ' + e.message, true);
  }
}
