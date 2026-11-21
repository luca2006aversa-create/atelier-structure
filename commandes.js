// Commandes sur la sélection : supprimer, déplacer, copier / coller, symétrie, retourner. Champ flottant.
import { etat, feuille, trouver, retirer, uid, modifie, rafraichir, toast } from './etat.js';
import { carteNoeuds, borne } from './geometrie.js';
import { obtenirNoeud, couperParNoeuds, nettoyerBarres, noeudsRelies, synchroCotes, apresDeplacement } from './topologie.js';

const arr = (v) => Math.round(v * 1e6) / 1e6;

// ---------- Supprimer / tout sélectionner ----------
export function supprimerSelection() {
  const f = feuille();
  if (!f || !etat.sel.size) return false;
  const reliesAvant = noeudsRelies(f);
  for (const id of etat.sel) {
    if (id[0] === 'n') f.barres = f.barres.filter((b) => b.a !== id && b.b !== id);
    retirer(id, f);
  }
  nettoyerBarres(f, reliesAvant); // un appui dont on a effacé les barres part avec elles
  etat.sel.clear();
  modifie();
  return true;
}

export function toutSelectionner() {
  const f = feuille();
  if (!f) return;
  const relies = noeudsRelies(f);
  etat.sel.clear();
  for (const o of [...f.barres, ...f.cotes, ...f.textes, ...f.traits]) etat.sel.add(o.id);
  for (const n of f.noeuds) if (!relies.has(n.id)) etat.sel.add(n.id);
  rafraichir();
}

// ---------- Retourner (côté du treillis, de la dalle, du sol ; creux de la toile) ----------
export function retourner(ids = [...etat.sel]) {
  const f = feuille();
  let n = 0;
  for (const id of ids) {
    const b = id[0] === 'b' ? trouver(id, f) : null;
    if (b && inverserCote(b)) n++;
  }
  if (n) modifie();
  else toast('Rien à retourner : choisis un treillis, une dalle, une toile ou un sol');
  return n;
}

// Réglages par défaut d'une nouvelle barre (treillis, dalle, toile, sol).
export function reglagesBarre(type) {
  const D = etat.defauts;
  if (type === 'treillis') return { treillis: { ...D.treillis } };
  if (type === 'dalle') return { dalle: { ...D.dalle } };
  if (type === 'toile') return { toile: { ...D.toile } };
  if (type === 'sol') return { sol: { sens: 1 } };
  return {};
}

export function inverserCote(b) {
  const D = etat.defauts;
  if (b.type === 'treillis') { b.treillis = { ...D.treillis, ...b.treillis }; b.treillis.sens = b.treillis.sens === -1 ? 1 : -1; return true; }
  if (b.type === 'dalle') { b.dalle = { ...D.dalle, ...b.dalle }; b.dalle.sens = b.dalle.sens === -1 ? 1 : -1; return true; }
  if (b.type === 'sol') { b.sol = { sens: 1, ...b.sol }; b.sol.sens = b.sol.sens === -1 ? 1 : -1; return true; }
  if (b.type === 'toile') { b.toile = { ...D.toile, ...b.toile }; b.toile.fleche = -(b.toile.fleche ?? 0.8); return true; }
  return false;
}

// ---------- Déplacement ----------
// Ce qui bouge quand on déplace la sélection.
export function prisesDeplacement(f = feuille(), sel = etat.sel) {
  const noeuds = new Set();
  const cotes = [];
  const textes = [];
  const traits = [];
  for (const id of sel) {
    const o = trouver(id, f);
    if (!o) continue;
    if (id[0] === 'n') noeuds.add(id);
    else if (id[0] === 'b') { noeuds.add(o.a); noeuds.add(o.b); }
    else if (id[0] === 'c') cotes.push(id);
    else if (id[0] === 't') textes.push(id);
    else if (id[0] === 's') traits.push(id);
  }
  return { noeuds: [...noeuds], cotes, textes, traits };
}

// Positions de départ (pour glisser sans accumuler d'erreurs).
export function instantane(prises, f = feuille()) {
  const N = carteNoeuds(f);
  const ok = (v) => v;
  return {
    noeuds: prises.noeuds.map((id) => N.get(id)).filter(ok).map((n) => ({ n, x: n.x, y: n.y })),
    cotes: prises.cotes.map((id) => trouver(id, f)).filter(ok).map((c) => ({ c, a: [c.a.x, c.a.y], b: [c.b.x, c.b.y] })),
    textes: prises.textes.map((id) => trouver(id, f)).filter(ok).map((t) => ({ t, x: t.x, y: t.y })),
    traits: prises.traits.map((id) => trouver(id, f)).filter(ok).map((s) => ({ s, pts: s.pts.map((p) => p.slice()) })),
  };
}

export function appliquerDelta(snap, dx, dy, f = feuille()) {
  for (const o of snap.noeuds) { o.n.x = arr(o.x + dx); o.n.y = arr(o.y + dy); }
  for (const o of snap.cotes) {
    if (!o.c.a.n) { o.c.a.x = arr(o.a[0] + dx); o.c.a.y = arr(o.a[1] + dy); }
    if (!o.c.b.n) { o.c.b.x = arr(o.b[0] + dx); o.c.b.y = arr(o.b[1] + dy); }
  }
  for (const o of snap.textes) { o.t.x = arr(o.x + dx); o.t.y = arr(o.y + dy); }
  for (const o of snap.traits) o.s.pts = o.pts.map((p) => [arr(p[0] + dx), arr(p[1] + dy)]);
  synchroCotes(f);
}

// Flèches du clavier.
export function deplacerSelection(dx, dy) {
  const f = feuille();
  if (!f || !etat.sel.size) return;
  const prises = prisesDeplacement(f);
  appliquerDelta(instantane(prises, f), dx, dy, f);
  apresDeplacement(prises.noeuds, f);
  modifie();
}

// ---------- Copier / coller / symétrie ----------
let presse = null;
export const aCopie = () => !!presse;

// Sous-document de la sélection, avec un point de référence (nœud le plus bas puis le plus à gauche).
export function copieDe(ids = [...etat.sel], f = feuille()) {
  if (!f || !ids.length) return null;
  const N = carteNoeuds(f);
  const nIds = new Set();
  const c = { noeuds: [], barres: [], cotes: [], textes: [], traits: [], ref: [0, 0] };
  for (const id of ids) {
    const o = trouver(id, f);
    if (!o) continue;
    if (id[0] === 'n') nIds.add(id);
    else if (id[0] === 'b') { c.barres.push(structuredClone(o)); nIds.add(o.a); nIds.add(o.b); }
    else if (id[0] === 'c') c.cotes.push(structuredClone(o));
    else if (id[0] === 't') c.textes.push(structuredClone(o));
    else if (id[0] === 's') c.traits.push(structuredClone(o));
  }
  c.noeuds = [...nIds].map((id) => N.get(id)).filter(Boolean).map((n) => structuredClone(n));
  for (const k of c.cotes) for (const e of ['a', 'b']) if (k[e].n && !nIds.has(k[e].n)) delete k[e].n;
  const total = c.noeuds.length + c.cotes.length + c.textes.length + c.traits.length;
  if (!total) return null;
  if (c.noeuds.length) {
    const n = c.noeuds.reduce((m, q) => (q.y < m.y - 1e-9 || (Math.abs(q.y - m.y) <= 1e-9 && q.x < m.x) ? q : m));
    c.ref = [n.x, n.y];
  } else {
    const pts = [...c.cotes.flatMap((k) => [[k.a.x, k.a.y], [k.b.x, k.b.y]]), ...c.textes.map((t) => [t.x, t.y]), ...c.traits.flatMap((s) => s.pts)];
    c.ref = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
  }
  return c;
}

export function copier() {
  const c = copieDe();
  if (!c) { toast('Rien à copier : choisis d’abord des éléments'); return false; }
  presse = c;
  const n = c.barres.length + c.cotes.length + c.textes.length + c.traits.length + (c.barres.length ? 0 : c.noeuds.length);
  toast(`Copié : ${n} élément${n > 1 ? 's' : ''}`);
  return true;
}

// Mode « coller » : la copie suit la souris, un clic la pose (géré par outils.js).
export function coller() {
  if (!presse) { toast('Rien dans le presse-papiers : Ctrl+C d’abord'); return false; }
  crochetFinir();
  etat.action = { type: 'colle', copie: presse, p: etat.monde ? etat.monde.slice() : [presse.ref[0] + 1, presse.ref[1]] };
  rafraichir();
  return true;
}

export function dupliquer() {
  return copier() && coller();
}

// Mode « symétrie » : copie miroir de la sélection autour d'un axe vertical choisi au clic.
export function symetrie() {
  const c = copieDe();
  if (!c) { toast('Choisis d’abord ce qu’il faut copier en miroir'); return false; }
  crochetFinir();
  etat.action = { type: 'symetrie', copie: c, axe: etat.monde ? etat.monde[0] : c.ref[0] };
  rafraichir();
  return true;
}

let crochetFinir = () => {};
export function brancherFinir(fn) { crochetFinir = fn; }

const estVerticale = (A, B) => Math.abs(B[0] - A[0]) < 1e-9;

// Pose une copie dans la feuille. tr : point → point. miroir : symétrie (inverse les côtés).
export function insererCopie(copie, tr, miroir = false) {
  const f = feuille();
  if (!f || !copie) return;
  const carte = new Map();
  for (const n of copie.noeuds) {
    const nn = obtenirNoeud(tr([n.x, n.y]), f, n.type);
    if (nn.type === 'libre' && n.type !== 'libre') nn.type = n.type;
    carte.set(n.id, nn);
  }
  const nouveaux = new Set();
  const utilises = new Set();
  for (const b0 of copie.barres) {
    const A = carte.get(b0.a);
    const B = carte.get(b0.b);
    if (!A || !B || A === B) continue;
    utilises.add(b0.a);
    utilises.add(b0.b);
    const b = structuredClone(b0);
    b.id = uid('b');
    b.a = A.id;
    b.b = B.id;
    if (miroir && estVerticale([A.x, A.y], [B.x, B.y])) inverserCote(b);
    f.barres.push(b);
    for (const m of couperParNoeuds(b, f)) nouveaux.add(m.id);
  }
  for (const n of copie.noeuds) if (!utilises.has(n.id)) nouveaux.add(carte.get(n.id).id);
  for (const c0 of copie.cotes) {
    const c = structuredClone(c0);
    c.id = uid('c');
    for (const e of ['a', 'b']) {
      const p = tr([c0[e].x, c0[e].y]);
      c[e] = { x: arr(p[0]), y: arr(p[1]) };
      const n = c0[e].n && carte.get(c0[e].n);
      if (n) c[e].n = n.id;
    }
    if (miroir) c.decalage = -(c.decalage ?? 1);
    f.cotes.push(c);
    nouveaux.add(c.id);
  }
  for (const t0 of copie.textes) {
    const t = structuredClone(t0);
    t.id = uid('t');
    const p = tr([t0.x, t0.y]);
    t.x = arr(p[0]);
    t.y = arr(p[1]);
    f.textes.push(t);
    nouveaux.add(t.id);
  }
  for (const s0 of copie.traits) {
    const s = structuredClone(s0);
    s.id = uid('s');
    s.pts = s0.pts.map((q) => { const p = tr(q); return [arr(p[0]), arr(p[1])]; });
    f.traits.push(s);
    nouveaux.add(s.id);
  }
  nettoyerBarres(f);
  etat.sel.clear();
  for (const id of nouveaux) if (trouver(id, f)) etat.sel.add(id);
  modifie();
}

// ---------- Champ flottant (longueur au clavier, texte, cote) ----------
let editeur = null;
export const editeurOuvert = () => !!editeur;

// s : position à l'écran dans la scène. surBlur : 'valider' ou 'annuler' quand on clique ailleurs.
export function ouvrirEditeur({ s, valeur = '', aide = '', placeholder = '', garderTexte = false, surBlur = 'valider', valider, annuler }) {
  fermerEditeur();
  const scene = document.getElementById('scene');
  const box = document.createElement('div');
  box.className = 'flottant';
  box.innerHTML = '<input class="a-champ" type="text" autocomplete="off" spellcheck="false"><small></small>';
  const input = box.firstChild;
  const petit = box.lastChild;
  input.value = valeur;
  input.placeholder = placeholder;
  petit.textContent = aide;
  petit.hidden = !aide;
  const [x, y] = s || [etat.W / 2, etat.H / 2];
  box.style.left = Math.round(borne(x + 14, 8, Math.max(8, etat.W - 240))) + 'px';
  box.style.top = Math.round(borne(y + 14, 8, Math.max(8, etat.H - 90))) + 'px';
  scene.appendChild(box);
  const ed = { box, ferme: false };
  const fin = (ok) => {
    if (ed.ferme) return;
    ed.ferme = true;
    const v = input.value;
    if (editeur === ed) editeur = null;
    box.remove();
    if (ok) valider?.(v);
    else annuler?.();
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { ev.preventDefault(); fin(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); fin(false); }
  });
  input.addEventListener('keyup', (ev) => ev.stopPropagation());
  box.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  setTimeout(() => {
    if (ed.ferme) return;
    input.focus();
    const l = input.value.length;
    if (garderTexte) input.setSelectionRange(l, l);
    else input.select();
    input.addEventListener('blur', () => fin(surBlur === 'valider'));
  }, 0);
  editeur = ed;
  return input;
}

// Ferme sans valider ni annuler.
export function fermerEditeur() {
  if (!editeur) return;
  const ed = editeur;
  editeur = null;
  ed.ferme = true;
  ed.box.remove();
}
