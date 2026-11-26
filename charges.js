// Charges ajoutées à la main : un étage posé sur une poutre, un objet suspendu, un mur qui pèse sur une barre.
// Trois sortes :
//   surface    → kN/m², multipliée par l'entraxe des portiques (un étage, une dalle, un toit vert)
//   lineique   → kN/m le long de la barre (un mur, une cloison, une façade)
//   ponctuelle → kN en un point (un objet, une machine, une voiture)
// cat G = permanent (× 1,35 à l'ELU), cat Q = variable (× 1,5).

export const UNITES = { surface: 'kN/m²', lineique: 'kN/m', ponctuelle: 'kN' };
export const NOMS_SORTES = { surface: 'Étage / surface', lineique: 'Le long de la barre', ponctuelle: 'Objet (en un point)' };
export const KG_PAR_KN = 102; // 1 kN ≈ 102 kg sur Terre
export const ELU = { G: 1.35, Q: 1.5 };

// Bibliothèque : valeurs d'ordre courant (Eurocode 1 pour les usages), pour se faire une idée.
export const BIBLIO = [
  { id: 'logement', nom: 'Étage logement', k: 'surface', v: 1.5, cat: 'Q' },
  { id: 'bureaux', nom: 'Étage bureaux', k: 'surface', v: 2.5, cat: 'Q' },
  { id: 'public', nom: 'Salle publique, sport', k: 'surface', v: 5, cat: 'Q' },
  { id: 'stockage', nom: 'Stockage, livres', k: 'surface', v: 7.5, cat: 'Q' },
  { id: 'dalle-bois', nom: 'Plancher bois', k: 'surface', v: 1, cat: 'G' },
  { id: 'dalle-beton', nom: 'Dalle béton 20 cm', k: 'surface', v: 5, cat: 'G' },
  { id: 'toit-vert', nom: 'Toiture végétalisée', k: 'surface', v: 2.5, cat: 'G' },
  { id: 'cloison', nom: 'Cloison légère', k: 'lineique', v: 1, cat: 'G' },
  { id: 'facade', nom: 'Façade vitrée', k: 'lineique', v: 1.5, cat: 'G' },
  { id: 'mur', nom: 'Mur maçonné', k: 'lineique', v: 6, cat: 'G' },
  { id: 'personne', nom: 'Une personne', k: 'ponctuelle', v: 0.8, cat: 'Q' },
  { id: 'agres', nom: 'Agrès suspendus', k: 'ponctuelle', v: 3, cat: 'Q' },
  { id: 'panier', nom: 'Panier de basket', k: 'ponctuelle', v: 2.5, cat: 'G' },
  { id: 'piano', nom: 'Piano', k: 'ponctuelle', v: 3.5, cat: 'G' },
  { id: 'machine', nom: 'Machine (clim, ventil.)', k: 'ponctuelle', v: 5, cat: 'G' },
  { id: 'voiture', nom: 'Voiture', k: 'ponctuelle', v: 15, cat: 'Q' },
];

const valide = (c) => c && UNITES[c.k] && Number.isFinite(+c.v) && +c.v > 0;
// Les charges d'une barre (toutes sortes) et d'un nœud (objets seulement).
export const chargesBarre = (b) => (Array.isArray(b?.charges) ? b.charges.filter(valide) : []);
export const chargesNoeud = (n) => (Array.isArray(n?.charges) ? n.charges.filter((c) => valide(c) && c.k === 'ponctuelle') : []);
// Position d'un objet sur sa barre, de 0 (début) à 1 (fin).
export const position = (c) => Math.max(0, Math.min(1, Number.isFinite(+c.t) ? +c.t : 0.5));

// Nouvelle charge à partir d'un modèle de la bibliothèque.
export function nouvelleCharge(modele, id) {
  const c = { id, nom: modele.nom, k: modele.k, v: modele.v, cat: modele.cat };
  if (c.k === 'ponctuelle') c.t = 0.5;
  return c;
}

// « 3,5 kN · ≈ 357 kg » : le poids parle mieux que les kilonewtons.
export function texteCharge(c) {
  const v = String(Math.round(+c.v * 100) / 100).replace('.', ',');
  let t = v + ' ' + UNITES[c.k];
  if (c.k === 'ponctuelle') t += ' · ≈ ' + Math.round(+c.v * KG_PAR_KN) + ' kg';
  else if (c.k === 'surface') t += ' · ≈ ' + Math.round(+c.v * KG_PAR_KN) + ' kg/m²';
  return t;
}
