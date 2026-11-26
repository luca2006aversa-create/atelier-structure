// Projet ouvert (sur le PC seulement) : http://127.0.0.1:8792/?projet=escalade
// Sans ?projet= : le projet par défaut (le gymnase). En ligne : un seul projet, rien ne change.
import { enLigne } from './mode.js';

const brut = new URLSearchParams(location.search).get('projet') || '';
export const projet = enLigne ? '' : (/^[a-z0-9-]{1,40}$/.test(brut) ? brut : '');

// Ajoute ?projet=… à une adresse du serveur local.
export const avecProjet = (url) => (projet ? url + (url.includes('?') ? '&' : '?') + 'projet=' + encodeURIComponent(projet) : url);

// Une copie du navigateur par projet, pour ne jamais mélanger deux projets.
export const cleLocale = (base) => (projet ? base + ':' + projet : base);
