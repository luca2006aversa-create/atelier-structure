// Vue 3D : le portique de la feuille est répété le long de z (entraxe × nombre), vu en perspective.
import { primitivesBarre, carteNoeuds, borne } from './geometrie.js';

const PRINCIPAL = new Set(['poteau', 'poutre', 'bequille', 'membrure', 'dalle']);
const SECONDAIRE = new Set(['diagonale', 'entretoise', 'cable', 'toile']);
const FACES = new Set(['dalle', 'sol', 'mur', 'toile']);
const TRAIT = {
  principal: ['#fff', 1.6],
  secondaire: ['#8c8c8c', 1],
  site: ['#5a5a5a', 1],
  lisse: ['#8c8c8c', 0.8],
  grille: ['#222', 1],
};

export function modele3D(f) {
  const N = carteNoeuds(f);
  const t = f.trois_d || {};
  const e = Math.max(0.5, +t.entraxe || 6);
  const nb = borne(Math.round(+t.nombre || 4), 1, 40);
  const zs = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * e);
  const z0 = nb > 1 ? zs[0] : -e / 2;
  const z1 = nb > 1 ? zs[nb - 1] : e / 2;
  const segs = [];
  const faces = [];
  const porteurs = new Set();
  const K = { su: 1, cote: 1, txt: { 1: 1, 2: 1, 3: 1 } };
  for (const b of f.barres) {
    const A = N.get(b.a);
    const B = N.get(b.b);
    if (!A || !B) continue;
    if (b.type !== 'sol' && b.type !== 'mur') { porteurs.add(b.a); porteurs.add(b.b); }
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
  if (nb > 1) for (const n of f.noeuds) if (n.y > 0.01 && porteurs.has(n.id)) segs.push({ a: [n.x, n.y, z0], b: [n.x, n.y, z1], role: 'lisse', id: n.id });
  return { segs, faces, z0, z1, e };
}

export class Vue3D {
  constructor(canvas, fournir) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.fournir = fournir;
    this.attente = false;
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
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const d = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaY;
      this.zoom = borne(this.zoom * Math.exp(-d * 0.0015), 0.2, 8);
      this.demander();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.recentrer());
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
    const { feuille, sel } = this.fournir();
    const M = feuille ? modele3D(feuille) : { segs: [], faces: [] };
    if (!M.segs.length) {
      ctx.fillStyle = '#8c8c8c';
      ctx.font = '14px "Inter Tight", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Dessine des barres pour voir la 3D', w / 2, h / 2);
      return;
    }
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const s of M.segs) for (const p of [s.a, s.b]) for (let k = 0; k < 3; k++) {
      if (p[k] < mn[k]) mn[k] = p[k];
      if (p[k] > mx[k]) mx[k] = p[k];
    }
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
    // Grille au sol
    const pasG = [1, 2, 5, 10, 20, 50].find((p) => Math.max(mx[0] - mn[0], mx[2] - mn[2]) / p <= 40) || 100;
    const gx0 = Math.floor((mn[0] - 4) / pasG) * pasG;
    const gx1 = Math.ceil((mx[0] + 4) / pasG) * pasG;
    const gz0 = Math.floor((mn[2] - 4) / pasG) * pasG;
    const gz1 = Math.ceil((mx[2] + 4) / pasG) * pasG;
    for (let x = gx0; x <= gx1 + 1e-9; x += pasG) trait([x, 0, gz0], [x, 0, gz1], ...TRAIT.grille);
    for (let z = gz0; z <= gz1 + 1e-9; z += pasG) trait([gx0, 0, z], [gx1, 0, z], ...TRAIT.grille);
    // Faces translucides, de la plus lointaine à la plus proche
    const faces = [];
    for (const f of M.faces) {
      const P = f.pts.map(proj);
      if (P.some((p) => !p)) continue;
      faces.push({ P, d: P.reduce((s, p) => s + p[2], 0) / 4, f });
    }
    faces.sort((a, b) => b.d - a.d);
    ctx.globalAlpha = 1;
    for (const { P, f } of faces) {
      ctx.fillStyle = sel.has(f.id) ? 'rgba(255,90,31,.18)' : f.st === 'sol' ? 'rgba(140,140,140,.07)' : 'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    // Traits : lisses, secondaires, principaux, puis la sélection par-dessus
    for (const role of ['site', 'lisse', 'secondaire', 'principal']) {
      for (const s of M.segs) if (s.role === role && !sel.has(s.id)) trait(s.a, s.b, ...TRAIT[role]);
    }
    for (const s of M.segs) if (sel.has(s.id)) trait(s.a, s.b, '#ff5a1f', 2);
    ctx.globalAlpha = 1;
  }
}
