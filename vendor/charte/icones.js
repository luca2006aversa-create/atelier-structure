/* Icônes de la charte Ašru : traits fins, couleur du texte (currentColor), aucune couleur propre.
   Elles remplacent les emojis dans les fichiers (sites, applis) : sobres, nettes, cohérentes.

   Utilisation :
     <script src="vendor/charte/icones.js"></script>
     <i class="a-icone" data-i="cerveau"></i>          → remplacé au chargement
     el.innerHTML = Icones.svg("pilotage")              → dans un gabarit JS
     Icones.poser(element)                              → après un innerHTML qui contient des <i data-i>
   Taille = taille du texte (1em) ; couleur = color du parent (blanc, gris ou orange).
   Liste des noms : Icones.noms() · page de démonstration : exemple.html (bloc « Icônes »). */
(function () {
  const T = {
    // navigation
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    pilotage: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M5 8h2M11 8h2M11 12h2M17 8h2"/>',
    cerveau: '<path d="M12 5a3 3 0 0 0-5.6-1.4A3 3 0 0 0 4 8a3 3 0 0 0 0 5 3.5 3.5 0 0 0 4 5 3 3 0 0 0 4 1z"/><path d="M12 5a3 3 0 0 1 5.6-1.4A3 3 0 0 1 20 8a3 3 0 0 1 0 5 3.5 3.5 0 0 1-4 5 3 3 0 0 1-4 1z"/><path d="M12 5v14"/>',
    carte: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="12" cy="18" r="2.2"/><circle cx="12" cy="11" r="1.6"/><path d="M7.8 7l3 3M16.2 8l-3 2.2M12 12.6v3.2"/>',
    journal: '<path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M9.5 8h5M9.5 12h5M9.5 16h3"/>',
    regle: '<path d="M7 3h10v18l-5-3.5L7 21z"/>',
    memoire: '<rect x="4" y="5" width="13" height="15" rx="1.5"/><path d="M7 2h12a1 1 0 0 1 1 1v14"/><path d="M7.5 10h6M7.5 14h4"/>',
    projet: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>',
    fichier: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    service: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
    jetons: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.2"/>',
    lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    maison: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    // états
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alerte: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.1"/>',
    cadenas: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    sommeil: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
    horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    // actions
    lancer: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    lecture: '<path d="M4 5v14l8-7zM15 5v14M20 5v14"/>',
    precedent: '<path d="M18 5v14L9 12zM6 5v14"/>',
    suivant: '<path d="M6 5v14l9-7zM18 5v14"/>',
    musique: '<path d="M9 17V5l11-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="17.5" cy="15" r="2.5"/>',
    micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    voix: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    silence: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    onde: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
    envoyer: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
    menu: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
    reglages: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    chercher: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    ajouter: '<path d="M12 5v14M5 12h14"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    // domaines
    livre: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    drone: '<circle cx="5.5" cy="5.5" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M7.3 7.3l2.2 2.2M16.7 7.3l-2.2 2.2M7.3 16.7l2.2-2.2M16.7 16.7l-2.2-2.2"/>',
    commerce: '<path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6"/>',
    temple: '<path d="M3 20h18M5 20v-4h14v4M7 16v-4h10v4M9 12V8h6v4M11 8V5h2v3"/>',
    clavier: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7 14h10"/>',
    manette: '<path d="M7 8h10a4 4 0 0 1 4 4.5l-.5 3a2.5 2.5 0 0 1-4.3 1.3L14.5 15h-5l-1.7 1.8a2.5 2.5 0 0 1-4.3-1.3l-.5-3A4 4 0 0 1 7 8z"/><path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01"/>',
    feuille: '<path d="M5 19c0-9 5-14 15-15-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
    equerre: '<path d="M4 4v16h16z"/><path d="M8 11v5h5zM4 8h2M4 12h2M4 16h2"/>',
    ampoule: '<path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 0-3.5 10.9c.4.4.5.8.5 1.3V17h6v-1.8c0-.5.2-.9.5-1.3A6 6 0 0 0 12 3z"/>',
    utilisateur: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  };
  function svg(nom, titre) {
    const d = T[nom] || T.fichier;
    const t = titre ? `<title>${String(titre).replace(/[<&]/g, '')}</title>` : '';
    return `<svg class="a-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ` +
      `stroke-linecap="round" stroke-linejoin="round" ${titre ? 'role="img"' : 'aria-hidden="true"'}>${t}${d}</svg>`;
  }
  function poser(racine) {
    (racine || document).querySelectorAll('i[data-i]').forEach((i) => { i.outerHTML = svg(i.dataset.i, i.title); });
  }
  window.Icones = { svg, poser, noms: () => Object.keys(T) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => poser());
  else poser();
})();
