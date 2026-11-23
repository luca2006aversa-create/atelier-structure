// Feuille « Descente de charges » : lit calculs.js (écrit par 07_structure/vers_site.py)
// et dessine la note de calcul — cascade des charges, efforts dans le treillis,
// flèches, courbe de la hauteur de ferme. Aucune valeur en dur ici.
import { CALC, BALAYAGE, BARRES, DATE_CALCUL } from './calculs.js';

const ico = (nom) => (window.Icones ? window.Icones.svg(nom) : '');
const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1 });
const n2 = (v) => (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const pc = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));

// ---------- Cartes ----------
function carte(titre, icone, corps, note = '') {
  return `<section class="a-carte c-carte">
    <div class="a-carte-tete"><span class="c-ico">${ico(icone)}</span><h3 class="a-titre">${titre}</h3></div>
    ${corps}
    ${note ? `<p class="a-discret c-note">${note}</p>` : ''}
  </section>`;
}

function jauge(nom, valeur, texte, alerte) {
  return `<div class="c-jauge">
    <span class="c-jauge-nom">${nom}</span>
    <div class="a-jauge${alerte ? ' alerte' : ''}" style="--v:${pc(valeur)}"><i></i></div>
    <span class="c-num c-jauge-val${alerte ? ' c-mal' : ''}">${texte}</span>
  </div>`;
}

const tableau = (contenu) => `<div class="c-defile">${contenu}</div>`;

// ---------- 1. Verdict ----------
function verdict() {
  const v = CALC.verdict;
  const f = CALC.fleches_mm;
  return `<div class="c-verdicts">
    <div class="a-carte creuse c-verdict">
      <span class="a-etiquette">Résistance du bois</span>
      <strong class="c-gros">${n2(v.taux_resistance_max)}</strong>
      <span class="a-discret">barre la plus chargée, limite 1,00 — ${v.resistance_ok ? 'ça tient' : 'ça ne tient pas'}</span>
    </div>
    <div class="a-carte creuse c-verdict${f.taux_instantanee > 1 ? ' c-rate' : ''}">
      <span class="a-etiquette">Flèche de la ferme</span>
      <strong class="c-gros">${n2(f.taux_instantanee)}</strong>
      <span class="a-discret">limite 1,00 — ${f.taux_instantanee > 1 ? 'dépasse de ' + Math.round((f.taux_instantanee - 1) * 100) + ' %' : 'ça tient'}</span>
    </div>
  </div>`;
}

// ---------- 2. Cascade des charges ----------
function cascade() {
  const c = CALC.charges_kN_m2;
  const d = CALC.descente;
  const t = CALC.totaux;
  const etages = [
    ['Toiture', n2(c['ELU 1,35G+1,5S']) + ' kN/m²', 'bac + isolant + étanchéité + neige ' + n2(c['Neige S']) + ' kN/m²'],
    ['Solives', n1(CALC.solives.moment_ELU_kNm) + ' kNm', 'portée ' + n1(CALC.solives.portee_m) + ' m · taux ' + n2(CALC.solives.taux)],
    ['Ferme', n1(CALC.ferme.charge_totale_ELU_kN) + ' kN', 'portée ' + n1(CALC.ferme.portee_m) + ' m · ' + n2(CALC.ferme.volume_bois_m3) + ' m³ de bois'],
    ['Poteau incliné', n1(d.N_poteau_ELU_kN) + ' kN', 'taux ' + n2(d.taux_poteau) + ' · très large'],
    ['Fondation', n1(d.N_fondation_ELS_kN) + ' kN', 'semelle ' + n2(d.semelle_cote_m) + ' x ' + n2(d.semelle_cote_m) + ' m à ' + Math.round(d.hypothese_sol_kPa) + ' kPa'],
  ];
  const lignes = etages.map(([nom, val, det], i) => `
    <div class="c-etage">
      <span class="c-etage-nom">${nom}</span>
      <span class="c-etage-val">${val}</span>
      <span class="a-discret c-etage-det">${det}</span>
      ${i < etages.length - 1 ? '<svg class="c-fleche" viewBox="0 0 12 24" aria-hidden="true"><path d="M6 1v18M1.5 15 6 21l4.5-6"/></svg>' : ''}
    </div>`).join('');
  return carte('Descente de charges', 'pilotage',
    `<div class="c-cascade">${lignes}</div>
     <div class="c-chiffres">
       <div><span class="a-etiquette">Toiture</span><b>${n1(t.surface_toiture_m2)} m²</b></div>
       <div><span class="a-etiquette">Poids propre</span><b>${n1(t.G_total_kN)} kN</b></div>
       <div><span class="a-etiquette">Neige</span><b>${n1(t.neige_totale_kN)} kN</b></div>
       <div><span class="a-etiquette">Bois des fermes</span><b>${n1(t.volume_bois_fermes_m3)} m³</b></div>
     </div>`,
    'Poussée horizontale en pied : ' + n1(d.poussee_horizontale_kN) + ' kN — c’est une hypothèse de calcul (un appui fixe, un appui glissant), pas une mesure.');
}

// ---------- 3. Élévation du treillis colorée par effort ----------
function treillis() {
  if (!BARRES.length) return '';
  const ys = BARRES.flatMap((b) => [b.y1, b.y2]);
  const zs = BARRES.flatMap((b) => [b.z1, b.z2]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const [z0, z1] = [Math.min(...zs), Math.max(...zs)];
  const W = 900;
  const marge = 14;
  const ech = (W - 2 * marge) / (y1 - y0);
  const H = (z1 - z0) * ech + 2 * marge;
  const X = (y) => marge + (y - y0) * ech;
  const Y = (z) => H - marge - (z - z0) * ech;
  const tmax = Math.max(...BARRES.map((b) => b.taux)) || 1;
  const traits = BARRES.map((b) => {
    const comp = b.N_kN < 0;
    const e = 1.2 + 4.8 * (b.taux / tmax);
    return `<line x1="${X(b.y1).toFixed(1)}" y1="${Y(b.z1).toFixed(1)}" x2="${X(b.y2).toFixed(1)}" y2="${Y(b.z2).toFixed(1)}"
      stroke="${comp ? 'var(--orange)' : 'var(--blanc)'}" stroke-width="${e.toFixed(2)}" stroke-linecap="round"
      opacity="${(0.35 + 0.65 * (b.taux / tmax)).toFixed(2)}"><title>${b.famille} · ${n1(b.N_kN)} kN · taux ${n2(b.taux)}</title></line>`;
  }).join('');
  const rangs = Object.entries(CALC.barres).map(([nom, v]) => {
    const comp = v.mode_dimensionnant === 'compression';
    const N = comp ? v.compression_max_kN : v.traction_max_kN;
    return `<tr>
      <td><span class="c-puce ${comp ? 'c-comp' : 'c-trac'}"></span>${nom}</td>
      <td class="c-num">${n1(N)} kN</td>
      <td class="a-discret">${comp ? 'comprimée' : 'tendue'}</td>
      <td class="c-num">${n2(v.sigma_MPa)}</td>
      <td class="c-num">${n2(v.kc)}</td>
      <td><div class="a-jauge fine" style="--v:${pc(v.taux_max)}"><i></i></div></td>
      <td class="c-num">${n2(v.taux_max)}</td>
    </tr>`;
  }).join('');
  const r = CALC.resistances_MPa;
  return carte('Efforts dans la ferme', 'treillis',
    `<svg class="c-elev" viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="Élévation de la ferme, barres colorées selon l’effort">${traits}</svg>
     <div class="c-legende">
       <span><span class="c-puce c-trac"></span>tendue (elle s’allonge)</span>
       <span><span class="c-puce c-comp"></span>comprimée (elle s’écrase)</span>
       <span class="a-discret">épaisseur du trait = taux de travail</span>
     </div>
     ${tableau(`<table class="c-table">
       <thead><tr><th>Barre</th><th>Effort max</th><th></th><th>σ MPa</th><th>kc</th><th>Taux</th><th></th></tr></thead>
       <tbody>${rangs}</tbody>
     </table>`)}`,
    `Lamellé-collé GL24h · ft,0,d ${n2(r.ft_0_d)} MPa · fc,0,d ${n2(r.fc_0_d)} MPa · kmod ${n2(r.kmod)} · γM ${n2(r.gamma_M)} (Eurocode 5). Le flambement des barres comprimées est pris en compte dans le plan de la ferme.`);
}

// ---------- 4. Flèches ----------
function fleches() {
  const f = CALC.fleches_mm;
  return carte('Flèche de la ferme', 'regle',
    `${jauge('Tout de suite', f.taux_instantanee, n1(f.instantanee) + ' mm', f.taux_instantanee > 1)}
     ${jauge('Dans le temps (fluage)', f.taux_finale, n1(f.finale_avec_fluage) + ' mm', f.taux_finale > 1)}
     <div class="c-chiffres">
       <div><span class="a-etiquette">Limite L/300</span><b>${n1(f.limite_instantanee_L_300)} mm</b></div>
       <div><span class="a-etiquette">Limite L/200</span><b>${n1(f.limite_finale_L_200)} mm</b></div>
       <div><span class="a-etiquette">Élancement</span><b>1/${n1(CALC.ferme.elancement)}</b></div>
       <div><span class="a-etiquette">Hauteur de ferme</span><b>${n2(CALC.ferme.hauteur_m)} m</b></div>
     </div>`,
    'Une ferme de 35 m de portée pour 1,50 m de hauteur, c’est 1/23 : trop plat. Un treillis bois se tient entre 1/10 et 1/15.');
}

// ---------- 5. Courbe : hauteur de ferme -> flèche ----------
function courbe() {
  const W = 900;
  const H = 300;
  const m = { g: 48, d: 16, h: 30, b: 40 };
  const hs = BALAYAGE.map((p) => p.h_ferme_m);
  const [x0, x1] = [Math.min(...hs), Math.max(...hs)];
  const ymax = Math.max(1.3, ...BALAYAGE.map((p) => p.taux_fleche_inst)) * 1.05;
  const X = (h) => m.g + ((h - x0) / (x1 - x0)) * (W - m.g - m.d);
  const Y = (t) => H - m.b - (t / ymax) * (H - m.h - m.b);
  const ligne = (cle) => BALAYAGE.map((p, i) => (i ? 'L' : 'M') + X(p.h_ferme_m).toFixed(1) + ' ' + Y(p[cle]).toFixed(1)).join(' ');
  const mini = BALAYAGE.find((p) => p.ok);
  const maxi = BALAYAGE.filter((p) => p.libre_m <= 9.0 + 1e-6 && p.haut_toiture_m <= 12.0 + 1e-6).pop() || BALAYAGE[BALAYAGE.length - 1];
  const reperes = [[mini, 'minimum qui passe'], [maxi, 'maximum possible']].filter(([p]) => p).map(([p, txt]) => `
    <line x1="${X(p.h_ferme_m).toFixed(1)}" y1="${m.h}" x2="${X(p.h_ferme_m).toFixed(1)}" y2="${H - m.b}" stroke="var(--ligne)" stroke-dasharray="3 4"/>
    <text class="c-rep" x="${X(p.h_ferme_m).toFixed(1)}" y="${m.h - 8}" text-anchor="middle">${n2(p.h_ferme_m)} m · ${txt}</text>`).join('');
  const grads = BALAYAGE.filter((p, i) => i % 4 === 0).map((p) => `<text class="c-ax" x="${X(p.h_ferme_m).toFixed(1)}" y="${H - m.b + 18}" text-anchor="middle">${n1(p.h_ferme_m)}</text>`).join('');
  const grady = [0, 0.5, 1, 1.5].filter((t) => t <= ymax).map((t) => `
    <line x1="${m.g}" y1="${Y(t).toFixed(1)}" x2="${W - m.d}" y2="${Y(t).toFixed(1)}" stroke="var(--ligne)"/>
    <text class="c-ax" x="${m.g - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${n1(t)}</text>`).join('');
  // Lignes du tableau : tous les 20 cm, plus le minimum qui passe et le maximum possible.
  const montrees = BALAYAGE.filter((p, i) => i === 0 || p === mini || p === maxi || Math.round(p.h_ferme_m * 10) % 2 === 0);
  return carte('Quelle hauteur de ferme ?', 'equerre',
    `<svg class="c-courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Taux de flèche selon la hauteur de la ferme">
      ${grady}
      <line x1="${m.g}" y1="${Y(1).toFixed(1)}" x2="${W - m.d}" y2="${Y(1).toFixed(1)}" stroke="var(--orange)" stroke-dasharray="6 5"/>
      <text class="c-ax c-ax-orange" x="${W - m.d}" y="${(Y(1) - 8).toFixed(1)}" text-anchor="end">limite 1,00</text>
      ${reperes}
      <path d="${ligne('taux_fleche_inst')}" fill="none" stroke="var(--blanc)" stroke-width="2.5"/>
      <path d="${ligne('taux_resistance')}" fill="none" stroke="var(--gris2)" stroke-width="2" stroke-dasharray="5 4"/>
      ${grads}
      <text class="c-ax" x="${W - m.d}" y="${H - 6}" text-anchor="end">hauteur de la ferme (m)</text>
    </svg>
    <div class="c-legende">
      <span><i class="c-trait c-trait-blanc"></i>taux de flèche</span>
      <span><i class="c-trait c-trait-gris"></i>taux de résistance</span>
    </div>
    ${tableau(`<table class="c-table">
      <thead><tr><th>Hauteur</th><th>Élancement</th><th>Sous-face</th><th>Haut du toit</th><th>Flèche finale</th><th>Bois / ferme</th><th>Verdict</th></tr></thead>
      <tbody>${montrees.map((p) => `
        <tr${p === maxi ? ' class="c-retenu"' : ''}>
          <td class="c-num">${n2(p.h_ferme_m)} m</td>
          <td class="c-num">1/${n1(p.elancement)}</td>
          <td class="c-num">${n2(p.libre_m)} m</td>
          <td class="c-num">${n2(p.haut_toiture_m)} m</td>
          <td class="c-num">${n1(p.fleche_fin_mm)} mm</td>
          <td class="c-num">${n2(p.bois_m3_par_ferme)} m³</td>
          <td>${p.ok ? 'ça passe' : '<span class="c-mal">ça ne passe pas</span>'}</td>
        </tr>`).join('')}</tbody>
    </table>`)}`,
    `En descendant la sous-face jusqu’à 9,00 m et en remontant le toit jusqu’à 12,00 m, la ferme peut monter à ${n2(maxi.h_ferme_m)} m : les deux contraintes du programme (9 m libres, 12 m au total) sont alors tenues pile. Le bois ne coûte que ${Math.round((maxi.bois_m3_par_ferme / BALAYAGE[0].bois_m3_par_ferme - 1) * 100)} % de plus qu’à ${n2(BALAYAGE[0].h_ferme_m)} m.`);
}

// ---------- 6. Réserves ----------
function reserves() {
  return carte('Ce qui n’est pas calculé', 'alerte',
    `<ul class="c-liste">
      <li>Le vent : rien pour l’instant (les murs en pente seront vitrés — simulation à faire).</li>
      <li>Les assemblages : non vérifiés. Les flèches sont majorées de 15 % pour la souplesse des boulons, c’est une estimation.</li>
      <li>La poussée horizontale : le modèle prend un appui fixe et un appui glissant. En vrai il faut soit un appui qui glisse, soit des poteaux inclinés qui reprennent la poussée.</li>
      <li>Le contreventement du plan de toiture : non vérifié.</li>
    </ul>`);
}

// ---------- Montage ----------
export function dessinerCalcul(hote) {
  hote.innerHTML = `
    <div class="c-tete">
      <h2 class="a-titre">Note de calcul — gymnase 45 x 35 m</h2>
      <span class="a-discret">Eurocode 5 · lamellé-collé GL24h · neige zone A1 (Rouen) · calcul du ${DATE_CALCUL.split('-').reverse().join('/')}</span>
    </div>
    ${verdict()}
    ${cascade()}
    ${treillis()}
    ${fleches()}
    ${courbe()}
    ${reserves()}
    <p class="a-discret c-source">Chiffres produits par D:/Archi/S5/07_structure/descente_de_charges.py · recopiés ici par vers_site.py</p>`;
  if (window.Icones) window.Icones.poser(hote);
}
