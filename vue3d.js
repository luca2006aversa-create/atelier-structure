// Vue 3D : le portique de la feuille est répété le long de z (entraxe × nombre), vu en perspective.
// Deux modes : « volumes » (vraies sections, couleur de la matière, faces ombrées) et « traits » (fil de fer).
import {
  primitivesBarre, barresEnSections, pannesCoupe, PANNE, carteNoeuds, borne, estPlan, analysePlan, bandeMur, epaisseur, MURS,
  H_PORTE, H_ALLEGE, H_LINTEAU, sub, add, mul, unite, normale, dist, placeCoupe,
} from './geometrie.js';
import { sectionDe, matiereDe, MATIERES } from './matieres.js';

const PRINCIPAL = new Set(['poteau', 'poutre', 'bequille', 'membrure', 'dalle', 'toit']);
const SECONDAIRE = new Set(['diagonale', 'entretoise', 'cable', 'toile']);
const FACES = new Set(['dalle', 'sol', 'mur', 'toile', 'toit']);
const TRAIT = {
  principal: ['#fff', 1.6],
  secondaire: ['#8c8c8c', 1],
  site: ['#5a5a5a', 1],
  lisse: ['#8c8c8c', 0.8],
  grille: ['#222', 1],
};

// Répartition des portiques le long de z.
function portiques(f) {
  const t = f.trois_d || {};
  const e = Math.max(0.5, +t.entraxe || 6);
  const nb = borne(Math.round(+t.nombre || 4), 1, 40);
  const zs = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * e);
  return { e, nb, zs, z0: nb > 1 ? zs[0] : -e / 2, z1: nb > 1 ? zs[nb - 1] : e / 2 };
}

// ---------- Volumes ----------
// Barres linéaires dessinées à leur vraie largeur : chacune devient un prisme, un par portique.
const VOL = new Set(['poteau-vol', 'poutre-vol', 'bequille-vol', 'entretoise-vol', 'cable-vol', 'membrure-vol', 'diagonale-vol']);
// Nappes : elles filent d'un bout à l'autre du bâtiment.
const NAPPES = new Set(['toit-vol', 'dalle']);
const MAX_FACES = 24000;
const LUMIERE = (() => { const v = [-0.4, 0.82, 0.42]; const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
// Section des pannes qui relient les portiques (ordre de grandeur d'un chevron).

const aire2 = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s; };

// Extrude un contour fermé du plan de la feuille entre deux z : devant, derrière, puis les côtés.
function extruder(pts, za, zb, pousser) {
  const p = aire2(pts) >= 0 ? pts : pts.slice().reverse();
  const av = p.map((q) => [q[0], q[1], zb]);
  const ar = p.map((q) => [q[0], q[1], za]);
  pousser(av);
  pousser(ar.slice().reverse());
  for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; pousser([ar[i], ar[j], av[j], av[i]]); }
}

// Barre à section ronde le long de P→Q (plan de la feuille), centrée sur z.
function rond3D(P, Q, d, z, pousser, cotes = 10) {
  const u = unite(sub(Q, P));
  const n = normale(u);
  const r = d / 2;
  const A = [];
  const B = [];
  for (let i = 0; i < cotes; i++) {
    const a = (2 * Math.PI * i) / cotes;
    const dx = n[0] * r * Math.cos(a);
    const dy = n[1] * r * Math.cos(a);
    const dz = r * Math.sin(a);
    A.push([P[0] + dx, P[1] + dy, z + dz]);
    B.push([Q[0] + dx, Q[1] + dy, z + dz]);
  }
  pousser(A.slice().reverse());
  pousser(B);
  for (let i = 0; i < cotes; i++) { const j = (i + 1) % cotes; pousser([A[i], A[j], B[j], B[i]]); }
}

// Axe d'une bande renvoyée par geometrie.js : [A+n, B+n, B-n, A-n].
const axeBande = (p) => [
  [(p[0][0] + p[3][0]) / 2, (p[0][1] + p[3][1]) / 2],
  [(p[1][0] + p[2][0]) / 2, (p[1][1] + p[2][1]) / 2],
];

export function volumes3D(f) {
  const N = carteNoeuds(f);
  const { e, nb, zs, z0, z1 } = portiques(f);
  const faces = [];
  const segs = [];
  // sections: true → geometrie.js rend les barres en bandes à leur vraie largeur.
  const K = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 }, sections: true };
  // Jonctions faites une fois pour toute la feuille : mêmes coupes qu'à l'écran.
  const liste = barresEnSections(f, K, N);
  for (const { b, prims: out } of liste) {
    const S = sectionDe(b);
    const M = matiereDe(b);
    const pousser = (pts, att = 1, al = 1) => { if (faces.length < MAX_FACES) faces.push({ pts, id: b.id, c: M.c, att, al }); };
    for (const pr of out) {
      if (pr.st === 'zone' || pr.st === 'hachure') continue;
      if (VOL.has(pr.st) && pr.p.length === 4) {
        const k = pr.st === 'diagonale-vol' ? 0.6 : 1;
        const d = Math.max(0.004, S.b * k);
        const [P, Q] = pr.ax || axeBande(pr.p);
        // Une moise : deux pièces, une de chaque côté des barres qu'elle serre.
        const cotes = pr.decal ? [-pr.decal, pr.decal] : [0];
        for (const z0p of zs) for (const dz of cotes) {
          const z = z0p + dz;
          if (S.f === 'rond' || S.f === 'tube') rond3D(P, Q, d, z, pousser);
          else extruder(pr.p, z - d / 2, z + d / 2, pousser);
        }
      } else if (NAPPES.has(pr.st)) {
        extruder(pr.p, z0, z1, pousser);
      } else if (pr.st === 'toile') {
        // Membrane : une surface réglée, sans épaisseur.
        for (let i = 0; i < pr.p.length - 1; i++) {
          const a = pr.p[i];
          const q = pr.p[i + 1];
          pousser([[a[0], a[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [a[0], a[1], z1]], 1, 0.75);
        }
      } else if (pr.st === 'sol') {
        const a = pr.p[0];
        const q = pr.p[1];
        pousser([[a[0], a[1], z0 - e / 2], [q[0], q[1], z0 - e / 2], [q[0], q[1], z1 + e / 2], [a[0], a[1], z1 + e / 2]], 0.5);
      } else if (pr.k === 'l' && pr.p.length === 2) {
        const role = PRINCIPAL.has(pr.st) ? 'principal' : 'secondaire';
        for (const z of zs) segs.push({ a: [pr.p[0][0], pr.p[0][1], z], b: [pr.p[1][0], pr.p[1][1], z], role, id: b.id });
      }
    }
  }
  // Pannes : posées sur le dessus des poutres, elles filent d'un portique à l'autre.
  if (nb > 1) {
    const cp = MATIERES.c24.c;
    for (const pn of pannesCoupe(f, liste)) {
      extruder(pn.p, z0, z1, (pts) => { if (faces.length < MAX_FACES) faces.push({ pts, id: pn.id, c: cp, att: 1, al: 1 }); });
    }
  }
  return { segs, faces, z0, z1, e };
}

// ---------- Traits (fil de fer) ----------
export function modele3D(f) {
  const N = carteNoeuds(f);
  const { e, nb, zs, z0, z1 } = portiques(f);
  const segs = [];
  const faces = [];
  const K = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 } };
  for (const b of f.barres) {
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (!A || !B) continue;
    const out = [];
    primitivesBarre(b, [A.x, A.y], [B.x, B.y], K, out);
    for (const pr of out) {
      if (pr.st === 'hachure' || pr.st === 'zone') continue;
      const role = PRINCIPAL.has(pr.st) ? 'principal' : SECONDAIRE.has(pr.st) ? 'secondaire' : 'site';
      const pts = pr.k === 'l' ? pr.p : pr.p.concat(pr.ferme ? [pr.p[0]] : []);
      for (const z of zs) {
        for (let i = 0; i < pts.length - 1; i++) {
          segs.push({ a: [pts[i][0], pts[i][1], z], b: [pts[i + 1][0], pts[i + 1][1], z], role, id: b.id });
        }
      }
      if (FACES.has(pr.st)) {
        const m = pr.st === 'sol' ? e / 2 : 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i];
          const q = pts[i + 1];
          faces.push({ pts: [[p[0], p[1], z0 - m], [q[0], q[1], z0 - m], [q[0], q[1], z1 + m], [p[0], p[1], z1 + m]], id: b.id, st: pr.st });
        }
      }
    }
  }
  // Lisses : les nœuds hors sol reliés à une barre porteuse filent d'un portique à l'autre.
  if (nb > 1) for (const pn of pannesCoupe(f)) segs.push({ a: [pn.c[0], pn.c[1], z0], b: [pn.c[0], pn.c[1], z1], role: 'lisse', id: pn.id });
  return { segs, faces, z0, z1, e };
}

// ---------- Couleurs et lumière ----------
const CACHE = new Map();
function rvb(c) {
  let v = CACHE.get(c);
  if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; CACHE.set(c, v); }
  return v;
}
const teinte = (c, k) => {
  const v = rvb(c);
  return 'rgb(' + Math.round(borne(v[0] * k, 0, 255)) + ',' + Math.round(borne(v[1] * k, 0, 255)) + ',' + Math.round(borne(v[2] * k, 0, 255)) + ')';
};

// Éclairage d'une face : lambert double face, pour qu'une face à l'envers reste lisible.
function eclairage(p) {
  const a = p[0];
  const b = p[1];
  const c = p[2];
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz);
  if (!l) return 0.7;
  const d = Math.abs((nx * LUMIERE[0] + ny * LUMIERE[1] + nz * LUMIERE[2]) / l);
  return 0.45 + 0.6 * d;
}

export class Vue3D {
  constructor(canvas, fournir) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.fournir = fournir;
    this.attente = false;
    this.volumes = true;
    this.recentrer(false);
    let g = null;
    canvas.addEventListener('pointerdown', (ev) => {
      g = { x: ev.clientX, y: ev.clientY, yaw: this.yaw, pitch: this.pitch };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!g) return;
      this.yaw = g.yaw + (ev.clientX - g.x) * 0.008;
      this.pitch = borne(g.pitch + (ev.clientY - g.y) * 0.008, -1.45, 1.45);
      this.demander();
    });
    const fin = () => { g = null; };
    // Clic sans glisser (moins de 4 px) : choisit l'élément sous la souris
    canvas.addEventListener('pointerup', (ev) => {
      const clic = g && Math.hypot(ev.clientX - g.x, ev.clientY - g.y) < 4;
      fin();
      if (!clic || !this.choisir) return;
      const r = canvas.getBoundingClientRect();
      const v = this.viser(ev.clientX - r.left, ev.clientY - r.top);
      this.choisir(v ? v.id : null, v ? v.fid : null);
    });
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const d = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaY;
      this.zoom = borne(this.zoom * Math.exp(-d * 0.0015), 0.2, 8);
      this.demander();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.recentrer());
  }

  // Élément visé au point (x, y) du canevas : le trait le plus proche (7 px), sinon la face la plus en avant
  viser(x, y) {
    const pk = this.picks;
    if (!pk) return null;
    let seg = null;
    let dmin = 7;
    for (const s of pk.segs) {
      const vx = s.B[0] - s.A[0];
      const vy = s.B[1] - s.A[1];
      const l2 = vx * vx + vy * vy || 1;
      const t = borne(((x - s.A[0]) * vx + (y - s.A[1]) * vy) / l2, 0, 1);
      const d = Math.hypot(x - s.A[0] - t * vx, y - s.A[1] - t * vy);
      if (d < dmin) { dmin = d; seg = { id: s.id, fid: s.fid, prof: s.A[2] + t * (s.B[2] - s.A[2]) }; }
    }
    let face = null;
    for (const f of pk.faces) {
      let dedans = false;
      for (let i = 0, j = f.P.length - 1; i < f.P.length; j = i++) {
        const [xi, yi] = f.P[i];
        const [xj, yj] = f.P[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
      }
      if (dedans && (!face || f.d < face.prof)) face = { id: f.id, fid: f.fid, prof: f.d };
    }
    if (seg && (!face || !pk.opaque || seg.prof <= face.prof * 1.02)) return seg;
    return face;
  }

  recentrer(redessiner = true) {
    this.yaw = -0.6;
    this.pitch = 0.35;
    this.zoom = 1;
    if (redessiner) this.demander();
  }

  demander() {
    if (this.attente) return;
    this.attente = true;
    requestAnimationFrame(() => { this.attente = false; this.dessiner(); });
  }

  dessiner() {
    const c = this.c;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, w, h);
    const { feuille, sel, feuilles, tout } = this.fournir();
    const vol = this.volumes !== false;
    this.picks = { segs: [], faces: [], opaque: vol };
    // « Tout » : toutes les coupes et tous les plans de la version, chacun à sa place.
    const ens = !!feuille && tout && feuilles && feuilles.length > 1;
    const M = !feuille ? { segs: [], faces: [] }
      : ens ? modeleEnsemble(feuilles, vol, feuille)
        : estPlan(feuille) ? modelePlan(feuille)
          : vol ? volumes3D(feuille) : modele3D(feuille);
    // Sélection : les id ne valent que dans la feuille ouverte.
    const pris = (o) => sel.has(o.id) && (!o.fid || o.fid === feuille.id);
    if (!M.segs.length && !M.faces.length) {
      ctx.fillStyle = '#8c8c8c';
      ctx.font = '14px "Inter Tight", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(estPlan(feuille) ? 'Dessine des murs pour voir la 3D' : 'Dessine des barres pour voir la 3D', w / 2, h / 2);
      return;
    }
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    const borner = (p) => { for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } };
    for (const s of M.segs) { borner(s.a); borner(s.b); }
    for (const fa of M.faces) for (const p of fa.pts) borner(p);
    const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const taille = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1);
    const dist = (taille * 1.6) / this.zoom;
    const foc = Math.min(w, h) * 1.2;
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const proj = (p) => {
      const X = p[0] - ctr[0];
      const Y = p[1] - ctr[1];
      const Z = p[2] - ctr[2];
      const x1 = X * cy - Z * sy;
      const z1 = X * sy + Z * cy;
      const y2 = Y * cp + z1 * sp;
      const d = -Y * sp + z1 * cp + dist;
      if (d < 0.05 * taille) return null;
      return [w / 2 + (foc * x1) / d, h / 2 - (foc * y2) / d, d];
    };
    const trait = (a, b, couleur, ep, alpha = 1) => {
      const A = proj(a);
      const B = proj(b);
      if (!A || !B) return;
      ctx.globalAlpha = alpha * borne(1.25 - (0.5 * (A[2] + B[2])) / 2 / dist, 0.35, 1);
      ctx.strokeStyle = couleur;
      ctx.lineWidth = ep;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Grille au sol
    const pasG = [1, 2, 5, 10, 20, 50].find((p) => Math.max(mx[0] - mn[0], mx[2] - mn[2]) / p <= 40) || 100;
    const gx0 = Math.floor((mn[0] - 4) / pasG) * pasG;
    const gx1 = Math.ceil((mx[0] + 4) / pasG) * pasG;
    const gz0 = Math.floor((mn[2] - 4) / pasG) * pasG;
    const gz1 = Math.ceil((mx[2] + 4) / pasG) * pasG;
    for (let x = gx0; x <= gx1 + 1e-9; x += pasG) trait([x, 0, gz0], [x, 0, gz1], ...TRAIT.grille);
    for (let z = gz0; z <= gz1 + 1e-9; z += pasG) trait([gx0, 0, z], [gx1, 0, z], ...TRAIT.grille);
    // Faces, de la plus lointaine à la plus proche (peintre)
    const faces = [];
    for (const fa of M.faces) {
      const P = fa.pts.map(proj);
      if (P.some((p) => !p)) continue;
      faces.push({ P, d: P.reduce((s, p) => s + p[2], 0) / P.length, fa });
    }
    faces.sort((a, b) => b.d - a.d);
    for (const { P, d, fa } of faces) if (fa.id) this.picks.faces.push({ P, d, id: fa.id, fid: fa.fid });
    for (const s of M.segs) {
      if (!s.id || s.role === 'site') continue;
      const A = proj(s.a);
      const B = proj(s.b);
      if (A && B) this.picks.segs.push({ A, B, id: s.id, fid: s.fid });
    }
    for (const { P, fa } of faces) {
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.closePath();
      if (vol && fa.c) {
        const base = pris(fa) ? '#ff5a1f' : fa.c;
        const k = eclairage(fa.pts) * (fa.att === undefined ? 1 : fa.att);
        ctx.globalAlpha = fa.al === undefined ? 1 : fa.al;
        ctx.fillStyle = teinte(base, k);
        ctx.fill();
        ctx.strokeStyle = teinte(base, k * 0.5);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = pris(fa) ? 'rgba(255,90,31,.18)' : fa.st === 'sol' ? 'rgba(140,140,140,.07)' : fa.st === 'toit' ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.07)';
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Traits : site, lisses, secondaires, principaux, puis la sélection par-dessus
    for (const role of ['site', 'lisse', 'secondaire', 'principal']) {
      for (const s of M.segs) if (s.role === role && !pris(s)) trait(s.a, s.b, ...TRAIT[role], s.autre ? 0.5 : 1);
    }
    for (const s of M.segs) if (pris(s)) trait(s.a, s.b, '#ff5a1f', 2);
    ctx.globalAlpha = 1;
  }
}

// ---------- Plan : les murs montent du sol à la hauteur de la feuille ----------
// Le plan (x, y) devient la 3D (x, hauteur, y) : vu de dessus, le nord reste en haut, sans effet miroir.
function boite3D(pied, z0, z1, role, id, segs, faces, st = 'mur', c = null, al = 1) {
  const n = pied.length;
  const bas = pied.map((q) => [q[0], z0, q[1]]);
  const haut = pied.map((q) => [q[0], z1, q[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    segs.push({ a: bas[i], b: bas[j], role, id }, { a: haut[i], b: haut[j], role, id }, { a: bas[i], b: haut[i], role, id });
    faces.push({ pts: [bas[i], bas[j], haut[j], haut[i]], id, st, c, al });
  }
  if (n === 4) faces.push({ pts: haut, id, st, c, al });
}

const pied = (A, B, e) => {
  const u = unite(sub(B, A));
  const n = mul(normale(u), e / 2);
  return [add(A, n), add(B, n), sub(B, n), sub(A, n)];
};

export function modelePlan(f) {
  const N = carteNoeuds(f);
  const J = analysePlan(f, N);
  const H = Math.max(0.5, +f.etage || 2.7);
  const segs = [];
  const faces = [];
  const pt = (id) => { const n = N.get(id); return n ? [n.x, n.y] : null; };
  for (const b of f.barres) {
    const A = pt(b.a);
    const B = pt(b.b);
    if (!A || !B || dist(A, B) < 1e-6) continue;
    const role = b.type === 'cloison' ? 'secondaire' : 'principal';
    const col = matiereDe(b).c;
    if (MURS.has(b.type)) {
      const o = J.cache.get(b.id);
      if (!o) { boite3D(bandeMur(b, A, B, J, N), 0, H, role, b.id, segs, faces, 'mur', col); continue; }
      // Morceau de mur sous une ouverture : il reste le linteau (et l'allège pour une fenêtre).
      const p = pied(A, B, epaisseur(b));
      if (H > H_PORTE && o.type === 'porte') boite3D(p, Math.min(H_PORTE, H), H, role, b.id, segs, faces, 'mur', col);
      if (o.type === 'fenetre') {
        boite3D(p, 0, Math.min(H_ALLEGE, H), role, b.id, segs, faces, 'mur', col);
        if (H > H_LINTEAU) boite3D(p, H_LINTEAU, H, role, b.id, segs, faces, 'mur', col);
      }
    } else if (b.type === 'poutrep') {
      // Poutre : le dessus au niveau du haut des murs, sa hauteur de section en dessous.
      const S = sectionDe(b);
      const hs = Math.min(H, Math.max(0.02, S.h || 0.4));
      boite3D(pied(A, B, Math.max(0.02, S.b || 0.12)), H - hs, H, 'principal', b.id, segs, faces, 'mur', col);
    } else if (b.type === 'fenetre') {
      const h0 = Math.min(H_ALLEGE, H);
      const h1 = Math.min(H_LINTEAU, H);
      const c = [[A[0], h0, A[1]], [B[0], h0, B[1]], [B[0], h1, B[1]], [A[0], h1, A[1]]];
      for (let i = 0; i < 4; i++) segs.push({ a: c[i], b: c[(i + 1) % 4], role: 'secondaire', id: b.id });
      faces.push({ pts: c, id: b.id, st: 'vitre', c: MATIERES.verre.c, al: 0.5 });
    } else if (b.type === 'porte') {
      const h1 = Math.min(H_PORTE, H);
      const c = [[A[0], 0, A[1]], [A[0], h1, A[1]], [B[0], h1, B[1]], [B[0], 0, B[1]]];
      for (let i = 0; i < 3; i++) segs.push({ a: c[i], b: c[i + 1], role: 'secondaire', id: b.id });
    } else if (b.type === 'escalier') {
      // Les marches montent du départ jusqu'à la hauteur de la feuille.
      const s = b.escalier || {};
      const [D, F] = s.sens === -1 ? [B, A] : [A, B];
      const L = dist(D, F);
      const u = unite(sub(F, D));
      const nm = mul(normale(u), Math.max(0.2, +s.w || 1.2) / 2);
      const nb = Math.max(1, Math.min(400, Math.round(L / Math.max(0.1, +s.giron || 0.28))));
      const g = L / nb;
      const hm = H / nb;
      for (const cote of [nm, mul(nm, -1)]) {
        const d0 = add(D, cote);
        const pts = [[d0[0], 0, d0[1]]];
        for (let i = 0; i < nb; i++) {
          const q = add(add(D, cote), mul(u, i * g));
          const r = add(add(D, cote), mul(u, (i + 1) * g));
          pts.push([q[0], (i + 1) * hm, q[1]], [r[0], (i + 1) * hm, r[1]]);
        }
        const fin = add(F, cote);
        pts.push([fin[0], 0, fin[1]], pts[0]);
        for (let i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1], role: 'secondaire', id: b.id });
      }
      for (let i = 0; i < nb; i++) {
        const q = add(D, mul(u, i * g));
        const a = add(q, nm);
        const c = sub(q, nm);
        segs.push({ a: [a[0], (i + 1) * hm, a[1]], b: [c[0], (i + 1) * hm, c[1]], role: 'secondaire', id: b.id });
      }
    } else if (b.type === 'trame') {
      segs.push({ a: [A[0], 0, A[1]], b: [B[0], 0, B[1]], role: 'site', id: b.id });
    }
  }
  for (const n of f.noeuds) {
    if (n.type !== 'poteau') continue;
    const h = Math.max(0.05, +n.s || 0.3) / 2;
    boite3D([[n.x - h, n.y - h], [n.x + h, n.y - h], [n.x + h, n.y + h], [n.x - h, n.y + h]], 0, H, 'principal', n.id, segs, faces, 'mur', MATIERES.ba30.c);
  }
  return { segs, faces };
}

// ---------- Ensemble : toute la version dans une seule 3D ----------
// Plans : montés à leur niveau. Coupes : posées dans le plan par leur place (x0, y0, angle).
// Chaque trait et chaque face garde l'id de sa feuille (fid) : un clic ouvre la bonne feuille.
export function modeleEnsemble(feuilles, vol, ouverte) {
  const segs = [];
  const faces = [];
  for (const f of feuilles) {
    const autre = !!ouverte && f.id !== ouverte.id;
    let M;
    let T;
    if (estPlan(f)) {
      M = modelePlan(f);
      const h = +f.niveau || 0;
      T = (p) => [p[0], p[1] + h, p[2]];
    } else {
      M = vol ? volumes3D(f) : modele3D(f);
      const place = placeCoupe(f);
      T = (p) => { const q = place(p[0], p[2]); return [q[0], p[1], q[1]]; };
    }
    for (const sg of M.segs) segs.push({ ...sg, a: T(sg.a), b: T(sg.b), fid: f.id, autre });
    for (const fa of M.faces) faces.push({ ...fa, pts: fa.pts.map(T), fid: f.id, att: (fa.att === undefined ? 1 : fa.att) * (autre ? 0.8 : 1) });
  }
  return { segs, faces };
}
