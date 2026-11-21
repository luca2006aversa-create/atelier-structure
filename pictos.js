// Pictos au trait de l'atelier : même dessin que les icônes de la charte (trait 1,75, couleur du texte).
const P = (d, extra = '') => d.split('|').map((x) => `<path d="${x}"/>`).join('') + extra;
const C = (cx, cy, r, plein) => `<circle cx="${cx}" cy="${cy}" r="${r}"${plein ? ' fill="currentColor"' : ''}/>`;
const R = (x, y, w, h, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
const TIRETS = (d, tirets, extra = '') => `<path d="${d}" stroke-dasharray="${tirets}"/>${extra}`;

const T = {
  selection: P('M5 4l14 6-6 2-2 6z'),
  poteau: P('M12 4v14|M7 20h10'),
  poutre: P('M3 9h18|M6 9l-2.5 4h5z|M18 9l-2.5 4h5z'),
  bequille: P('M4 20h16|M7 20L17 4'),
  entretoise: P('M6 3v18M18 3v18|M6 12h12'),
  treillis: P('M2 7h20M2 17h20|M2 17L7 7l5 10 5-10 5 10'),
  cable: TIRETS('M4 20L20 4', '2.5 2.5', C(4, 20, 1.5) + C(20, 4, 1.5)),
  toile: P('M3 5v15M21 5v15|M3 5q9 9 18 0'),
  dalle: R(2.5, 9, 19, 5, 0.5) + P('M6 14v6M18 14v6'),
  sol: P('M3 9h18|M6 9l-3 4M10 9l-3 4M14 9l-3 4M18 9l-3 4M21 9l-3 4'),
  mur: TIRETS('M4 20V9l8-5 8 5v11z', '3 2'),
  cote: P('M4 8v8M20 8v8M4 12h16|M2.5 13.5l3-3M18.5 13.5l3-3'),
  texte: P('M5 6V4h14v2|M12 4v16|M9 20h6'),
  crayon: P('M4 20l1-4L16 5l3 3L8 19z|M14 7l3 3'),
  gomme: P('M8 20h12|M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z|M9 11l5 5'),
  annuler: P('M9 14L4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  retablir: P('M15 14l5-5-5-5|M20 9H9.5a5.5 5.5 0 0 0 0 11H13'),
  image: R(3, 4, 18, 16, 2) + C(9, 9.5, 1.8) + P('M21 16l-5-5L5 20'),
  etalonner: P('M3 17L17 3l4 4L7 21z|M7 13l2 2M10 10l2 2M13 7l2 2'),
  cube: P('M12 3l8 4.5v9L12 21l-8-4.5v-9z|M12 12l8-4.5M12 12v9M12 12L4 7.5'),
  aimant: P('M6 4h4v7a2 2 0 0 0 4 0V4h4v7a6 6 0 0 1-12 0z|M6 8h4M14 8h4'),
  grille: R(3, 3, 18, 18, 1) + P('M3 9h18M3 15h18M9 3v18M15 3v18'),
  cadrer: P('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'),
  'zoom-plus': C(11, 11, 6.5) + P('M20 20l-4.4-4.4M11 8v6M8 11h6'),
  'zoom-moins': C(11, 11, 6.5) + P('M20 20l-4.4-4.4M8 11h6'),
  miroir: TIRETS('M12 3v18', '2 2', P('M9 7L3 17h6z|M15 7l6 10h-6z')),
  dupliquer: R(8, 8, 12, 12, 2) + P('M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'),
  supprimer: P('M4 7h16|M10 11v6M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3'),
  dossier: P('M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z'),
  deplacer: P('M12 3v18M3 12h18|M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3'),
  'tourner-g': P('M3 4v5h5|M3.6 9a8.5 8.5 0 1 1 2 8.5'),
  'tourner-d': P('M21 4v5h-5|M20.4 9a8.5 8.5 0 1 0-2 8.5'),
  oeil: P('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z') + C(12, 12, 3),
  inverser: C(12, 12, 9) + '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  echanger: P('M4 8h14l-3-3M20 16H6l3 3'),
  aide: C(12, 12, 9) + P('M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5|M12 17.5v.01'),
  'n-libre': P('M4 19l8-11 8 11') + C(12, 8, 1.2, true),
  'n-rotule': P('M4 19l6.5-9M20 19l-6.5-9') + C(12, 8, 2.6),
  'n-rigide': P('M4 19l8-11 8 11') + '<path d="M9.6 11.3L12 8l2.4 3.3z" fill="currentColor"/>',
  'n-appui': P('M12 3v9|M12 12l-4.5 6h9z|M5 21h14'),
  'n-encastrement': P('M12 3v12|M5 15h14|M8 15l-2 4M12 15l-2 4M16 15l-2 4M20 15l-2 4'),
  'n-glissant': P('M12 3v9|M12 12l-4.5 5h9z|M6 20h12'),
};

export function picto(nom, classe = '') {
  const t = T[nom];
  if (!t) return '';
  return `<svg class="a-icone${classe ? ' ' + classe : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`;
}

// Picto de l'atelier, sinon icône du kit de la charte (ajouter, fermer, ok, alerte, horloge, fichier...).
export function ico(nom) {
  if (T[nom]) return picto(nom);
  return window.Icones ? window.Icones.svg(nom) : '';
}

// Remplace les <span data-p="nom"> par leur picto.
export function poserPictos(racine = document) {
  racine.querySelectorAll('[data-p]').forEach((el) => { el.outerHTML = picto(el.dataset.p); });
}
