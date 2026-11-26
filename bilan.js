// Calcul en direct : lit la feuille ouverte et la montre en graphiques.
// Coupe → taux de travail par barre, flèches des poutres, charges.
// Plan  → surface, volume, longueurs de murs, ouvertures.
// Rien en dur : tout vient du dessin (portique.js pour les efforts).
import { calculer, chargesDe } from './portique.js';
import { carteNoeuds, dist, NOM_BARRE, MURS, OUVERTURES, estPlan } from './geometrie.js';
import { texteSection } from './matieres.js';
import { esc } from './rendu.js';
import { carte, jauge, n1, n2 } from './calcul.js';

const n0 = (v) => Math.round(v).toLocaleString('fr-FR');
const MAX_BARRES = 14;
const MAX_FLECHES = 6;

// ---------- Graphique en barres horizontales ----------
// lignes : [{ id, nom, detail, valeur, texte }] ; limite : trait orange (1,00 pour un taux).
function barres(lignes, { limite = null, echelle = null } = {}) {
  const W = 900;
  const H0 = 28;
  const m = { g: 230, d: 90, h: 10, b: 24 };
  const H = m.h + m.b + lignes.length * H0;
  const vmax = echelle || Math.max(limite ? limite * 1.2 : 0, ...lignes.map((l) => l.valeur)) || 1;
  const X = (v) => m.g + (Math.min(v, vmax) / vmax) * (W - m.g - m.d);
  const rangs = lignes.map((l, i) => {
    const y = m.h + i * H0;
    const mal = limite !== null && l.valeur > limite;
    return `<g class="b-rang"${l.id ? ` data-id="${esc(l.id)}"` : ''}>
      <rect x="0" y="${y}" width="${W}" height="${H0}" fill="transparent"/>
      <text class="c-ax b-nom" x="${m.g - 12}" y="${y + 13}" text-anchor="end">${esc(l.nom)}</text>
      ${l.detail ? `<text class="c-rep" x="${m.g - 12}" y="${y + 25}" text-anchor="end">${esc(l.detail)}</text>` : ''}
      <rect x="${m.g}" y="${y + 6}" width="${Math.max(2, X(l.valeur) - m.g).toFixed(1)}" height="${H0 - 12}" rx="3" fill="${mal ? 'var(--orange)' : 'var(--blanc)'}"/>
      <text class="c-ax${mal ? ' c-ax-orange' : ''}" x="${(X(l.valeur) + 8).toFixed(1)}" y="${y + 18}">${esc(l.texte)}</text>
    </g>`;
  }).join('');
  const lim = limite === null ? '' : `
    <line x1="${X(limite).toFixed(1)}" y1="${m.h - 4}" x2="${X(limite).toFixed(1)}" y2="${H - m.b + 4}" stroke="var(--orange)" stroke-dasharray="6 5"/>
    <text class="c-ax c-ax-orange" x="${X(limite).toFixed(1)}" y="${H - 4}" text-anchor="middle">limite ${n2(limite)}</text>`;
  return `<svg class="c-courbe b-barres" viewBox="0 0 ${W} ${H}" role="img">${rangs}${lim}</svg>`;
}

const nomBarre = (b, role) => (NOM_BARRE[b.type] || b.type) + ' ' + b.id + (role ? ' · ' + role : '');

// ---------- Coupe ----------
function bilanCoupe(f) {
  const r = calculer(f);
  const C = chargesDe(f);
  const entraxe = Math.max(0.5, +(f.trois_d || {}).entraxe || 6);
  const tete = `<div class="c-tete">
      <h2 class="a-titre">Calcul en direct · ${esc(f.nom || 'Coupe')}</h2>
      <span class="a-discret">Portique plan · entraxe ${n1(entraxe)} m · ELU 1,35 G + 1,5 Q · calcul simplifié, à faire vérifier</span>
    </div>`;
  if (r.erreur) {
    return tete + carte('Pas encore calculable', 'alerte', `<p class="b-erreur">${esc(r.erreur)}</p>`,
      'Le calcul se lance tout seul dès que la coupe tient debout : poteaux posés au sol, poutres reliées.');
  }
  const els = r.els;
  // Une barre coupée en morceaux (treillis, objet posé) : on garde son morceau le plus chargé.
  const pires = new Map();
  for (const e of els) { const k = e.id + '|' + (e.role || ''); const v = pires.get(k); if (!v || e.taux > v.taux) pires.set(k, e); }
  const pire = els.reduce((a, e) => (e.taux > a.taux ? e : a), els[0]);
  // Flèches : seulement les barres à plat qui portent (pas les câbles ni les diagonales).
  const poutres = [...pires.values()].filter((e) => e.plat && !e.secondaire && e.b.type !== 'cable' && e.b.type !== 'diagonale' && e.L > 0.5)
    .map((e) => ({ e, lim: e.L / 300, ratio: e.fleche / (e.L / 300) }))
    .sort((a, b) => b.ratio - a.ratio);
  const pf = poutres[0];
  const verdicts = `<div class="c-verdicts">
      <div class="a-carte creuse c-verdict${r.tauxMax > 1 ? ' c-rate' : ''}">
        <span class="a-etiquette">Résistance</span>
        <strong class="c-gros">${n2(r.tauxMax)}</strong>
        <span class="a-discret">${esc(nomBarre(pire.b, pire.role))}, limite 1,00 — ${r.tauxMax > 1 ? 'ça ne tient pas' : 'ça tient'}</span>
      </div>
      <div class="a-carte creuse c-verdict${pf && pf.ratio > 1 ? ' c-rate' : ''}">
        <span class="a-etiquette">Flèche</span>
        <strong class="c-gros">${pf ? n2(pf.ratio) : '—'}</strong>
        <span class="a-discret">${pf ? esc(nomBarre(pf.e.b, pf.e.role)) + ', ' + n0(pf.e.fleche * 1000) + ' mm pour ' + n0(pf.lim * 1000) + ' mm permis (L/300)' : 'aucune poutre à plat'}</span>
      </div>
    </div>`;
  const tri = [...pires.values()].sort((a, b) => b.taux - a.taux);
  const montres = tri.slice(0, MAX_BARRES);
  const graphe = barres(montres.map((e) => ({
    id: e.id, nom: nomBarre(e.b, e.role), detail: texteSection(e.b) + ' · ' + n1(e.L) + ' m', valeur: e.taux, texte: n2(e.taux),
  })), { limite: 1 });
  const carteTaux = carte('Taux de travail par barre', 'pilotage',
    graphe + `<div class="c-legende"><span><i class="c-puce c-trac"></i>tient (≤ 1,00)</span><span><i class="c-puce c-comp"></i>trop chargée</span><span>clic sur une barre = la voir dans le dessin</span></div>`,
    tri.length > MAX_BARRES ? `Les ${MAX_BARRES} barres les plus chargées sur ${tri.length}.` : 'Flexion + effort normal, Eurocode simplifié (sans flambement ni assemblages).');
  const carteFleche = poutres.length ? carte('Flèche des poutres', 'regle',
    poutres.slice(0, MAX_FLECHES).map((p) => jauge(esc(nomBarre(p.e.b, p.e.role)), p.ratio, n0(p.e.fleche * 1000) + ' / ' + n0(p.lim * 1000) + ' mm', p.ratio > 1)).join(''),
    'Flèche à mi-portée, depuis la ligne entre les deux bouts, sous charges de service G + Q (sans majoration). Limite L/300, tout de suite (sans fluage).') : '';
  let Rv = 0;
  for (const v of r.reactions.values()) Rv += v[1];
  const carteCharges = carte('Charges et efforts', 'equerre',
    `<div class="c-chiffres">
       <div><span class="a-etiquette">Toiture</span><b>${n2(C.toitG)} kN/m²</b></div>
       <div><span class="a-etiquette">Neige</span><b>${n2(C.neige)} kN/m²</b></div>
       <div><span class="a-etiquette">Plancher</span><b>${n2(C.plancherG)} kN/m²</b></div>
       <div><span class="a-etiquette">Exploitation</span><b>${n2(C.exploitation)} kN/m²</b></div>
     </div>
     <div class="c-chiffres">
       <div><span class="a-etiquette">Effort normal max</span><b>${n1(r.Nmax)} kN</b></div>
       <div><span class="a-etiquette">Moment max</span><b>${n1(r.Mmax)} kNm</b></div>
       <div><span class="a-etiquette">Descend au sol</span><b>${n1(Rv)} kN</b></div>
       <div><span class="a-etiquette">Nœud qui bouge le plus</span><b>${n1(r.dmax * 1000)} mm</b></div>
     </div>`,
    'Charges réglables dans le panneau de la feuille. Descend au sol = somme des appuis, pour un portique (une travée d’entraxe).');
  const reserves = carte('Ce qui n’est pas calculé', 'alerte',
    `<ul class="c-liste">
      <li>Le vent et le séisme.</li>
      <li>Le flambement des poteaux et des barres comprimées.</li>
      <li>Les assemblages, et le contreventement hors du plan de la coupe.</li>
      <li>Les prises d’escalade et les chutes (efforts ponctuels sur les murs) : à ajouter quand le mur sera dessiné.</li>
    </ul>`);
  return tete + verdicts + carteTaux + carteFleche + carteCharges + reserves;
}

// ---------- Plan ----------
// Surface : si les murs extérieurs ferment une boucle simple, aire du polygone ; sinon rectangle englobant.
function aireBoucle(f, N) {
  const murs = f.barres.filter((b) => b.type === 'murp' && N.get(b.a) && N.get(b.b));
  if (murs.length < 3) return null;
  const voisins = new Map();
  for (const b of murs) {
    for (const [x, y] of [[b.a, b.b], [b.b, b.a]]) {
      if (!voisins.has(x)) voisins.set(x, []);
      voisins.get(x).push(y);
    }
  }
  if ([...voisins.values()].some((v) => v.length !== 2)) return null;
  const depart = murs[0].a;
  const tour = [depart];
  let avant = null;
  let ici = depart;
  for (let k = 0; k < murs.length + 1; k++) {
    const v = voisins.get(ici);
    const suite = v[0] !== avant ? v[0] : v[1];
    avant = ici;
    ici = suite;
    if (ici === depart) break;
    tour.push(ici);
  }
  if (tour.length !== murs.length) return null;
  let a = 0;
  for (let i = 0; i < tour.length; i++) {
    const p = N.get(tour[i]);
    const q = N.get(tour[(i + 1) % tour.length]);
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function bilanPlan(f) {
  const N = carteNoeuds(f);
  const h = Math.max(0, +f.etage || 0);
  const longueurs = new Map();
  let nbOuv = 0;
  const pts = [];
  for (const b of f.barres) {
    const a = N.get(b.a);
    const c = N.get(b.b);
    if (!a || !c) continue;
    const L = dist([a.x, a.y], [c.x, c.y]);
    longueurs.set(b.type, (longueurs.get(b.type) || 0) + L);
    if (OUVERTURES.has(b.type)) nbOuv++;
    if (MURS.has(b.type)) pts.push(a, c);
  }
  const tete = `<div class="c-tete">
      <h2 class="a-titre">Calcul en direct · ${esc(f.nom || 'Plan')}</h2>
      <span class="a-discret">Plan · hauteur ${n2(h)} m · chiffres tirés du dessin, mesurés à l’axe des murs</span>
    </div>`;
  if (!pts.length) return tete + carte('Rien à mesurer', 'regle', '<p class="b-erreur">Dessine des murs pour voir surfaces et volumes.</p>');
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const lx = Math.max(...xs) - Math.min(...xs);
  const ly = Math.max(...ys) - Math.min(...ys);
  const boucle = aireBoucle(f, N);
  const S = boucle ?? lx * ly;
  const Lmurs = longueurs.get('murp') || 0;
  const chiffres = `<div class="c-verdicts">
      <div class="a-carte creuse c-verdict">
        <span class="a-etiquette">${boucle !== null ? 'Surface au sol' : 'Emprise (rectangle englobant)'}</span>
        <strong class="c-gros">${n0(S)} m²</strong>
        <span class="a-discret">${n1(lx)} × ${n1(ly)} m</span>
      </div>
      <div class="a-carte creuse c-verdict">
        <span class="a-etiquette">Volume</span>
        <strong class="c-gros">${n0(S * h)} m³</strong>
        <span class="a-discret">surface × ${n2(h)} m de haut</span>
      </div>
    </div>`;
  const ordre = ['murp', 'cloison', 'porte', 'fenetre', 'escalier', 'trame'];
  const lignes = [...longueurs.entries()]
    .sort((a, b) => (ordre.indexOf(a[0]) + 99) % 99 - (ordre.indexOf(b[0]) + 99) % 99)
    .map(([t, L]) => ({ nom: NOM_BARRE[t] || t, valeur: L, texte: n1(L) + ' m' }));
  const carteLong = carte('Longueurs dessinées', 'regle', barres(lignes),
    nbOuv ? nbOuv + ' ouverture' + (nbOuv > 1 ? 's' : '') + ' (portes et fenêtres).' : 'Aucune porte ni fenêtre pour l’instant.');
  const carteMurs = carte('Murs', 'equerre',
    `<div class="c-chiffres">
       <div><span class="a-etiquette">Murs extérieurs</span><b>${n1(Lmurs)} m</b></div>
       <div><span class="a-etiquette">Surface de murs</span><b>${n0(Lmurs * h)} m²</b></div>
       <div><span class="a-etiquette">Hauteur</span><b>${n2(h)} m</b></div>
       <div><span class="a-etiquette">Cloisons</span><b>${n1(longueurs.get('cloison') || 0)} m</b></div>
     </div>`,
    'Surface de murs = longueur × hauteur, ouvertures comprises : c’est la surface de paroi disponible (pour une salle d’escalade, la surface grimpable maximale).');
  const lien = carte('Et la structure ?', 'pilotage',
    '<p class="b-erreur">Les efforts se calculent sur une coupe : ouvre une feuille « Coupe », dessine poteaux et poutres, le calcul suit tout seul.</p>');
  return tete + chiffres + carteLong + carteMurs + lien;
}

// ---------- Montage ----------
export function dessinerBilan(hote, f) {
  hote.innerHTML = !f ? '<p class="a-discret">Aucune feuille ouverte.</p>' : estPlan(f) ? bilanPlan(f) : bilanCoupe(f);
  if (window.Icones) window.Icones.poser(hote);
}
