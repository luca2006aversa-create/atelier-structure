// Travail à plusieurs (version en ligne) : chaque feuille-version est une ligne de la base Supabase.
// Toutes les 2,5 s : on lit ce qui a changé chez les autres, on fusionne, puis on envoie nos changements.
import { canon, fusion, sansVue, trier, copie } from './fusion.js';

const URL_BASE = 'https://lqpqoxpzgecquglqhvlh.supabase.co/rest/v1/rpc/';
const CLE_PUBLIQUE = 'sb_publishable_D9gt2aaQtbuW52CIZ5k0hA_vbxdPD00'; // clé publique (faite pour être dans la page)
const CLE_CODE = 'atelier-code';
const CLE_PSEUDO = 'atelier-pseudo';
const PERIODE = 2500;

const lireLocal = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const ecrireLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* navigateur privé */ } };

export const session = {
  code: lireLocal(CLE_CODE),
  pseudo: lireLocal(CLE_PSEUDO),
  dernierAuteur: '',
};

async function rpc(nom, args = {}) {
  const r = await fetch(URL_BASE + nom, {
    method: 'POST',
    headers: { apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.message || j.hint)) || 'erreur ' + r.status);
  return j;
}

export async function verifierCode(code) {
  return !!(await rpc('atelier_code_ok', { p_code: code }));
}

export function retenirCode(code, pseudo) {
  session.code = code;
  session.pseudo = pseudo;
  ecrireLocal(CLE_CODE, code);
  ecrireLocal(CLE_PSEUDO, pseudo);
}

export const peutEcrire = () => !!session.code;

// Ce que le serveur a, feuille par feuille : id → { rev, txt, obj }.
const base = new Map();

const enregistrer = (id, rev, f) => base.set(id, { rev, txt: canon(f), obj: sansVue(f) });

// Premier chargement : toutes les feuilles du serveur.
export async function chargerTout(reparer) {
  const liste = await rpc('atelier_liste');
  const ids = liste.filter((r) => !r.supprime).map((r) => r.id);
  if (!ids.length) return null;
  const lignes = await rpc('atelier_lire', { p_ids: ids });
  const feuilles = [];
  for (const l of lignes) {
    const f = reparer(l.data);
    enregistrer(l.id, l.rev, f);
    feuilles.push(f);
  }
  return { feuilles: trier(feuilles) };
}

// Une feuille a-t-elle des changements pas encore envoyés ?
export function enAttente(doc) {
  if (!doc) return false;
  const ids = new Set(doc.feuilles.map((f) => f.id));
  if ([...base.keys()].some((id) => !ids.has(id))) return true;
  return doc.feuilles.some((f) => base.get(f.id)?.txt !== canon(f));
}

// 1) Lire chez les autres et fusionner dans doc. Renvoie { change, auteur }.
async function recevoir(doc, reparer, occupe) {
  const liste = await rpc('atelier_liste');
  const nouv = liste.filter((r) => !r.supprime && (!base.has(r.id) || base.get(r.id).rev < r.rev));
  const parties = liste.filter((r) => r.supprime && base.has(r.id) && base.get(r.id).rev < r.rev);
  if (!nouv.length && !parties.length) return { change: false };
  const lignes = nouv.length ? await rpc('atelier_lire', { p_ids: nouv.map((r) => r.id) }) : [];
  if (occupe()) return { change: false, saute: true }; // un geste a commencé pendant la lecture : au tour suivant
  let auteur = '';
  for (const l of lignes) {
    const leur = reparer(l.data);
    const i = doc.feuilles.findIndex((f) => f.id === l.id);
    const b = base.get(l.id);
    if (i < 0) doc.feuilles.push(leur);
    else {
      const mien = doc.feuilles[i];
      const r = !b || canon(mien) === b.txt ? copie(leur) : fusion(b.obj, mien, leur);
      if (mien.vue) r.vue = mien.vue;
      doc.feuilles[i] = reparer(r);
    }
    enregistrer(l.id, l.rev, leur);
    auteur = l.auteur || auteur;
  }
  for (const r of parties) {
    const i = doc.feuilles.findIndex((f) => f.id === r.id);
    if (i >= 0) doc.feuilles.splice(i, 1);
    base.delete(r.id);
    auteur = r.auteur || auteur;
  }
  if (!doc.feuilles.length) return { change: false }; // on ne vide jamais tout
  trier(doc.feuilles);
  return { change: true, auteur };
}

// 2) Envoyer mes changements.
async function envoyer(doc) {
  if (!peutEcrire()) return 0;
  let n = 0;
  for (const f of doc.feuilles) {
    const t = canon(f);
    if (base.get(f.id)?.txt === t) continue;
    const donnee = sansVue(f);
    const rev = await rpc('atelier_ecrire', { p_code: session.code, p_id: f.id, p_data: donnee, p_auteur: session.pseudo || 'anonyme' });
    base.set(f.id, { rev, txt: t, obj: donnee });
    n++;
  }
  const ids = new Set(doc.feuilles.map((f) => f.id));
  for (const id of [...base.keys()]) {
    if (ids.has(id)) continue;
    const rev = await rpc('atelier_supprimer', { p_code: session.code, p_id: id, p_auteur: session.pseudo || 'anonyme' });
    base.delete(id);
    n += rev ? 1 : 0;
  }
  return n;
}

// Un tour complet. occupe() : vrai pendant un geste ou une saisie → on attend le tour suivant.
let chaine = Promise.resolve();
export function synchro({ doc, reparer, occupe, apresReception }) {
  chaine = chaine.then(async () => {
    const d = doc();
    if (!d || occupe()) return { saute: true };
    const recu = await recevoir(d, reparer, occupe);
    if (recu.saute) return { saute: true };
    if (recu.change) apresReception(recu.auteur);
    const envoyes = await envoyer(d);
    return { recu: recu.change, envoyes, auteur: recu.auteur };
  });
  const p = chaine;
  chaine = chaine.catch(() => {});
  return p;
}

// Écoute régulière (arrêtée quand l'onglet est caché).
export function ecouter(tour) {
  let minuteur = 0;
  const boucle = async () => {
    clearTimeout(minuteur);
    if (document.visibilityState === 'visible') {
      try { await tour(); } catch { /* signalé par tour */ }
    }
    minuteur = setTimeout(boucle, PERIODE);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') boucle(); });
  minuteur = setTimeout(boucle, PERIODE);
}
