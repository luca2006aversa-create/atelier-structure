// Scène : calques SVG (grille, croquis, dessin, aperçu), dessin à l'écran, zoom, consignes, curseurs.
import { etat, feuille, versEcran, versMonde, cadrer, paireDe } from './etat.js';
import { primitivesFeuille, primitivesBarre, primitivesCote, NOM_BARRE, NOM_NOEUD, dist, dot, sub, unite, normale, borne, fr } from './geometrie.js';
import { echelle, svgEcran, svgGrille, DEFS, esc, ORANGE } from './rendu.js';
import { majCroquis } from './croquis.js';
import { NOM_ACCROCHE } from './accroche.js';
import { inverserCote, reglagesBarre } from './commandes.js';

let svg = null;
let cGrille;
let cFond;
let cDessin;
let cApercu;
let cleGrille = '';
let demande = 0;
let pointeur = () => {};
const SEL_APERCU = new Set(['apercu']);
const q = (v) => Math.round(v * 10) / 10;

export function initScene() {
  svg = document.getElementById('dessin');
  svg.innerHTML = DEFS + '<g class="c-grille"></g><g class="c-fond"></g><g class="c-dessin"></g><g class="c-apercu"></g>';
  [cGrille, cFond, cDessin, cApercu] = ['c-grille', 'c-fond', 'c-dessin', 'c-apercu'].map((c) => svg.querySelector('.' + c));
}

// outils.js recalcule l'accroche quand la vue bouge sous la souris.
export function brancherPointeur(fn) { pointeur = fn; }

export function demanderDessin() {
  if (demande) return;
  demande = requestAnimationFrame(() => { demande = 0; dessiner(); });
}

export function dessiner() {
  if (!svg) return;
  const { vue, W, H } = etat;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const cle = `${vue.cx}|${vue.cy}|${vue.z}|${W}|${H}|${etat.pas}`;
  if (cle !== cleGrille) { cleGrille = cle; cGrille.innerHTML = svgGrille(vue, W, H, etat.pas); }
  majCroquis(cFond);
  const f = feuille();
  etat.prims = f ? primitivesFeuille(f, echelle(vue.z), true, paireDe(f)) : [];
  cDessin.innerHTML = svgEcran(etat.prims, vue, W, H, etat.sel, etat.survol);
  cApercu.innerHTML = apercu() + repere();
  infos();
  consigne();
  curseur();
  const t = document.getElementById('terminer');
  if (t) t.hidden = !['trace', 'croquis', 'symetrie', 'colle', 'etalon'].includes(etat.action?.type);
}

// ---------- Vue ----------
export function zoomer(s, k) {
  const v = etat.vue;
  const z = borne(v.z * k, 2, 3000);
  if (Math.abs(z - v.z) < 1e-12) return;
  const m = versMonde(s[0], s[1]); // ce point reste sous le curseur
  v.z = z;
  v.cx = m[0] - (s[0] - etat.W / 2) / z;
  v.cy = m[1] + (s[1] - etat.H / 2) / z;
  pointeur();
  demanderDessin();
}

export const zoomerCentre = (k) => zoomer([etat.W / 2, etat.H / 2], k);

export function decaler(dx, dy) {
  etat.vue.cx -= dx / etat.vue.z;
  etat.vue.cy += dy / etat.vue.z;
  pointeur();
  demanderDessin();
}

export function cadrerVue() {
  cadrer();
  pointeur();
  demanderDessin();
}

// Décalage d'une cote (m), arrondi au pas de la grille : côté de la souris par rapport à A→B.
export function decalageCote(A, B, m) {
  const n = normale(unite(sub(B, A)));
  const pas = etat.pas || 0.25;
  return +(Math.round(dot(sub(m, A), n) / pas) * pas).toFixed(4);
}

// ---------- Aperçu du geste en cours ----------
function etiquette(A, B, txt) {
  const [x1, y1] = versEcran(A[0], A[1]);
  const [x2, y2] = versEcran(B[0], B[1]);
  let nx = -(y2 - y1);
  let ny = x2 - x1;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  if (ny > 0 || (Math.abs(ny) < 1e-9 && nx < 0)) { nx = -nx; ny = -ny; }
  const x = (x1 + x2) / 2 + nx * 20;
  const y = (y1 + y2) / 2 + ny * 20;
  return `<text x="${q(x)}" y="${q(y)}" font-size="13" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="middle">${esc(txt)}</text>`;
}

function croix(p) {
  const [x, y] = versEcran(p[0], p[1]).map(q);
  return `<path d="M${q(x - 7)} ${y}H${q(x + 7)}M${x} ${q(y - 7)}V${q(y + 7)}" stroke="${ORANGE}" stroke-width="1.5" fill="none"/>`;
}

// Copie (presse-papiers) transformée, dessinée en orange.
function primsCopie(copie, tr, miroir, K) {
  const noeuds = copie.noeuds.map((n) => { const p = tr([n.x, n.y]); return { ...n, x: p[0], y: p[1] }; });
  const N = new Map(noeuds.map((n) => [n.id, n]));
  const barres = copie.barres.map((b0) => {
    const b = structuredClone(b0);
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (miroir && A && B && Math.abs(A.x - B.x) < 1e-9) inverserCote(b);
    return b;
  });
  const cotes = copie.cotes.map((c0) => {
    const c = structuredClone(c0);
    for (const e of ['a', 'b']) { const p = tr([c0[e].x, c0[e].y]); c[e] = { ...c[e], x: p[0], y: p[1] }; }
    if (miroir) c.decalage = -(c.decalage ?? 1);
    return c;
  });
  const textes = copie.textes.map((t) => { const p = tr([t.x, t.y]); return { ...t, x: p[0], y: p[1] }; });
  const traits = copie.traits.map((s) => ({ ...s, pts: s.pts.map(tr) }));
  const prims = primitivesFeuille({ noeuds, barres, cotes, textes, traits }, K, false);
  for (const pr of prims) pr.id = 'apercu';
  return prims;
}

function apercu() {
  const a = etat.action;
  if (!a) return '';
  const K = echelle(etat.vue.z);
  const m = etat.acc?.p || etat.monde;
  const out = [];
  let extra = '';
  switch (a.type) {
    case 'trace': {
      if (!m) break;
      primitivesBarre({ id: 'apercu', a: '', b: '', type: a.barre, ...reglagesBarre(a.barre, a.A, m) }, a.A, m, K, out);
      const L = dist(a.A, m);
      if (L > 1e-9) {
        let ang = (Math.atan2(m[1] - a.A[1], m[0] - a.A[0]) * 180) / Math.PI;
        if (Math.abs(ang + 180) < 1e-9) ang = 180;
        extra += etiquette(a.A, m, `${fr(L)} m · ${fr(ang, 1)}°`);
      }
      break;
    }
    case 'cote': {
      if (!a.A || !m) break;
      const A = [a.A.x, a.A.y];
      if (!a.B) {
        primitivesCote({ id: 'apercu', a: a.A, b: { x: m[0], y: m[1] }, decalage: 0 }, A, m, K, out);
      } else {
        const B = [a.B.x, a.B.y];
        primitivesCote({ id: 'apercu', a: a.A, b: a.B, decalage: decalageCote(A, B, etat.monde || m) }, A, B, K, out);
      }
      break;
    }
    case 'crayon':
      if (a.pts.length > 1) out.push({ k: 'p', st: 'trait', id: 'apercu', p: a.pts });
      break;
    case 'cadre': {
      const x = Math.min(a.s0[0], a.s1[0]);
      const y = Math.min(a.s0[1], a.s1[1]);
      const w = Math.abs(a.s1[0] - a.s0[0]);
      const h = Math.abs(a.s1[1] - a.s0[1]);
      extra += `<rect x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}" fill="rgba(255,90,31,.08)" stroke="${ORANGE}" stroke-width="1" stroke-dasharray="5 4"/>`;
      break;
    }
    case 'etalon':
      if (!a.P1) break;
      if (m) {
        out.push({ k: 'l', st: 'cote', id: 'apercu', p: [a.P1, m] });
        extra += etiquette(a.P1, m, `${fr(dist(a.P1, m))} m sur le dessin`);
      }
      extra += croix(a.P1);
      break;
    case 'symetrie': {
      const X = q(versEcran(a.axe, 0)[0]);
      extra += `<line x1="${X}" y1="0" x2="${X}" y2="${etat.H}" stroke="${ORANGE}" stroke-width="1" stroke-dasharray="8 6"/>`;
      out.push(...primsCopie(a.copie, (p) => [2 * a.axe - p[0], p[1]], true, K));
      break;
    }
    case 'colle': {
      const dx = a.p[0] - a.copie.ref[0];
      const dy = a.p[1] - a.copie.ref[1];
      out.push(...primsCopie(a.copie, (p) => [p[0] + dx, p[1] + dy], false, K));
      break;
    }
    default:
      break;
  }
  return svgEcran(out, etat.vue, etat.W, etat.H, SEL_APERCU, null) + extra;
}

// Repère d'accroche sous le pointeur.
function repere() {
  const acc = etat.acc;
  if (!acc || !etat.souris) return '';
  const [x, y] = versEcran(acc.p[0], acc.p[1]).map(q);
  const st = `fill="none" stroke="${ORANGE}" stroke-width="1.5"`;
  switch (acc.type) {
    case 'noeud': return `<rect x="${q(x - 6)}" y="${q(y - 6)}" width="12" height="12" ${st}/>`;
    case 'point': return `<circle cx="${x}" cy="${y}" r="6" ${st}/>`;
    case 'milieu': return `<path d="M${x} ${q(y - 7)}L${q(x + 6.5)} ${q(y + 5)}H${q(x - 6.5)}Z" ${st}/>`;
    case 'barre': return `<path d="M${q(x - 5)} ${q(y - 5)}L${q(x + 5)} ${q(y + 5)}M${q(x + 5)} ${q(y - 5)}L${q(x - 5)} ${q(y + 5)}" ${st}/>`;
    case 'libre': return `<circle cx="${x}" cy="${y}" r="2" fill="${ORANGE}"/>`;
    default: return `<path d="M${q(x - 5)} ${y}H${q(x + 5)}M${x} ${q(y - 5)}V${q(y + 5)}" ${st}/>`;
  }
}

// ---------- Pied, consigne, curseur ----------
function infos() {
  const p = etat.acc?.p || etat.monde;
  const c = document.getElementById('coords');
  if (c) c.textContent = p ? `x ${fr(p[0])} · y ${fr(p[1])}` : '';
  const a = document.getElementById('accroche');
  if (a) a.textContent = etat.acc && etat.souris ? NOM_ACCROCHE[etat.acc.type] || '' : '';
  const z = document.getElementById('zoom');
  if (z) z.textContent = '1:' + Number((3779.5 / etat.vue.z).toPrecision(2)).toLocaleString('fr-FR');
}

const UN_SEGMENT = new Set(['porte', 'fenetre', 'trame', 'escalier']); // tracés d'un seul segment

function texteConsigne() {
  const a = etat.action;
  const o = etat.outil;
  if (a) {
    switch (a.type) {
      case 'trace':
        if (UN_SEGMENT.has(a.barre)) return `${NOM_BARRE[a.barre]} : clic à l’autre bout · ou tape la longueur · Échap pour annuler`;
        return `${NOM_BARRE[a.barre]} : clic au point suivant · tape un chiffre pour la longueur · Échap pour finir`;
      case 'cote': return a.B ? 'Cote : clic pour placer la ligne de cote' : 'Cote : clic au 2e point';
      case 'etalon': return a.P1 ? 'Étalonner : clic sur le 2e point, puis tape la vraie distance' : 'Étalonner : clic sur un point connu du croquis';
      case 'croquis': return 'Croquis : glisse pour le déplacer · Échap pour finir';
      case 'symetrie': return 'Symétrie : clic sur l’axe vertical · Échap pour annuler';
      case 'colle': return 'Coller : clic pour poser la copie · Échap pour annuler';
      case 'cadre': return 'Relâche : tout ce qui est dans le cadre est choisi';
      case 'gomme': return 'Gomme : glisse sur ce qu’il faut effacer';
      case 'crayon': return '';
      default: break;
    }
  }
  if (o === 'selection') return '';
  if (NOM_BARRE[o]) return `${NOM_BARRE[o]} : clic au point de départ`;
  if (o === 'n-poteau') return 'Poteau : clic où le poser (grille, nœud ou mur)';
  if (o.startsWith('n-')) return `${NOM_NOEUD[o.slice(2)]} : clic sur un nœud ou une barre`;
  if (o === 'gomme') return 'Gomme : clic ou glisse sur ce qu’il faut effacer';
  if (o === 'cote') return 'Cote : clic au 1er point';
  if (o === 'texte') return 'Texte : clic où écrire';
  if (o === 'crayon') return 'Crayon : glisse pour dessiner à main levée';
  return '';
}

function consigne() {
  const el = document.getElementById('consigne');
  if (!el) return;
  const t = texteConsigne();
  if (el.textContent !== t) el.textContent = t;
}

function curseur() {
  const sc = document.getElementById('scene');
  if (!sc) return;
  const a = etat.action;
  let c = '';
  if (a?.type === 'vue' || a?.type === 'pince') c = 'c-glisse';
  else if (etat.touches.espace) c = 'c-main';
  else if (a?.type === 'glisser' || a?.type === 'glisser-noeud' || a?.type === 'cote-decalage') c = 'c-deplacer';
  else if (a?.type === 'croquis') c = a.drag ? 'c-glisse' : 'c-main';
  else if (a?.type === 'colle' || a?.type === 'symetrie' || a?.type === 'etalon') c = '';
  else if (etat.outil === 'selection') c = etat.survol ? 'c-deplacer' : 'c-fleche';
  for (const k of ['c-fleche', 'c-main', 'c-glisse', 'c-deplacer']) sc.classList.toggle(k, k === c);
}
