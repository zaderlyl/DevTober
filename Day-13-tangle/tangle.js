'use strict';

/* ============================================================
   Tangle : une photo devient un enchevêtrement de branches Git.
   1. on réduit la photo et on la simplifie en quelques couleurs (k-moyennes)
   2. on repère les contours (frontières entre couleurs + détails)
   3. on affine les contours en traits d'un pixel et on les suit pour en faire des branches
   4. on les fait pousser une à une, chacune partant d'un point déjà tracé (comme un fork)
   ============================================================ */

const $ = id => document.getElementById(id);
const els = {
  file: $('file'), sample: $('sample'), replay: $('replay'), colors: $('colors'), colorsv: $('colorsv'),
  detail: $('detail'), detailv: $('detailv'), speed: $('speed'), speedv: $('speedv'),
  stage: $('stage'), cv: $('cv'), heads: $('heads'), thumb: $('thumb'), pal: $('pal'), status: $('status'), drop: $('drop')
};
const ctx = els.cv.getContext('2d');
const hctx = els.heads.getContext('2d');
const BG = '#0d1117';
const WORK_MAX = 200;      // taille de travail de la photo (pixels)
const OUT = 1000;          // largeur du dessin (pixels)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let source = null;         // image ou canvas d'origine
let model = null;          // résultat de l'analyse : { chains, palette, count }
let anim = null;
let timer = 0;

/* ---------- petits outils ---------- */
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
/* les couleurs sont gardées, mais éclaircies si besoin pour rester lisibles sur le fond sombre */
function lineRGB(c) {
  const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
  return hslToRgb(h, Math.min(1, s * 1.15), Math.max(l, 0.55));
}
const rgbStr = c => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
const say = t => { els.status.textContent = t; };

/* ---------- 1. photo réduite et simplifiée ---------- */
function grab(src) {
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  const k = Math.min(WORK_MAX / sw, WORK_MAX / sh, 1);
  const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, w, h);
  return { w, h, data: x.getImageData(0, 0, w, h).data };
}

function blur(rgb, w, h) {
  const out = new Float32Array(rgb.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        sum += rgb[(yy * w + xx) * 3 + c]; n++;
      }
      out[(y * w + x) * 3 + c] = sum / n;
    }
  }
  return out;
}

function kmeans(rgb, n, k) {
  const rnd = mulberry(7);
  const centers = [];
  const first = Math.floor(rnd() * n);
  centers.push([rgb[first * 3], rgb[first * 3 + 1], rgb[first * 3 + 2]]);
  const dist = new Float32Array(n).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = (rgb[i * 3] - c[0]) ** 2 + (rgb[i * 3 + 1] - c[1]) ** 2 + (rgb[i * 3 + 2] - c[2]) ** 2;
      if (d < dist[i]) dist[i] = d;
      total += dist[i];
    }
    let r = rnd() * total, pick = n - 1;
    for (let i = 0; i < n; i++) { r -= dist[i]; if (r <= 0) { pick = i; break; } }
    centers.push([rgb[pick * 3], rgb[pick * 3 + 1], rgb[pick * 3 + 2]]);
  }
  const labels = new Uint8Array(n);
  for (let it = 0; it < 12; it++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const c = centers[j];
        const d = (rgb[i * 3] - c[0]) ** 2 + (rgb[i * 3 + 1] - c[1]) ** 2 + (rgb[i * 3 + 2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      labels[i] = best;
      const s = sum[best];
      s[0] += rgb[i * 3]; s[1] += rgb[i * 3 + 1]; s[2] += rgb[i * 3 + 2]; s[3]++;
    }
    for (let j = 0; j < k; j++) if (sum[j][3]) centers[j] = [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]];
  }
  return { centers, labels };
}

/* chaque pixel prend la couleur majoritaire autour de lui : on enlève les petites taches */
function majority(labels, w, h, k) {
  const out = new Uint8Array(labels.length);
  const cnt = new Uint8Array(k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    cnt.fill(0);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      cnt[labels[yy * w + xx]]++;
    }
    let best = labels[y * w + x];
    for (let j = 0; j < k; j++) if (cnt[j] > cnt[best]) best = j;
    out[y * w + x] = best;
  }
  return out;
}

/* ---------- 2. contours ---------- */
function edgeMask(labels, gray, w, h, thr) {
  const m = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let on = labels[i] !== labels[i + 1] || labels[i] !== labels[i + w];
    if (!on && thr < Infinity) {
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      on = Math.hypot(gx, gy) > thr;
    }
    if (on) m[i] = 1;
  }
  return m;
}

/* Zhang-Suen : on amincit les contours jusqu'à un pixel d'épaisseur */
function thin(m, w, h) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const del = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0;
        for (let j = 0; j < 8; j++) if (!seq[j] && seq[j + 1]) A++;
        if (A !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
        else if (p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(i);
      }
      for (const i of del) m[i] = 0;
      if (del.length) changed = true;
    }
  }
}

/* ---------- 3. des pixels aux branches ---------- */
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function trace(m, w, h) {
  const seen = new Uint8Array(w * h);
  const deg = i => { let d = 0; const x = i % w, y = (i / w) | 0; for (const [dx, dy] of N8) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) d++; } return d; };
  const next = i => {
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of N8) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { const j = yy * w + xx; if (m[j] && !seen[j]) return j; } }
    return -1;
  };
  const walk = start => { const out = []; let cur = start; for (;;) { const n = next(cur); if (n < 0) break; seen[n] = 1; out.push(n); cur = n; } return out; };
  const starts = [], later = [];
  for (let i = 0; i < w * h; i++) if (m[i]) (deg(i) === 2 ? later : starts).push(i);
  const chains = [];
  for (const s of starts.concat(later)) {
    if (seen[s]) continue;
    seen[s] = 1;
    const fwd = walk(s), back = walk(s);
    const idx = back.reverse().concat([s], fwd);
    chains.push(idx.map(i => [i % w, (i / w) | 0]).concat([]));
    chains[chains.length - 1].idx = idx;
  }
  return chains;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let md = 0, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > md) { md = d; mi = i; }
  }
  if (md <= eps) return [a, b];
  return rdp(pts.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(pts.slice(mi), eps));
}

const lerp = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const polyLen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };

/* ---------- 3. la grille : comme un graphe de commits, une ligne par rangée ---------- */
function gridSize() {
  const ratio = source ? (source.naturalHeight || source.height) / (source.naturalWidth || source.width) : 0.75;
  const C = Math.round(28 + (+els.detail.value) * 0.5);          // nombre de colonnes (de 28 à 78)
  const R = Math.max(8, Math.min(120, Math.round(C * ratio)));   // nombre de rangées
  return { C, R, cell: OUT / C };
}

/* un trait arrondi aux coins, comme les courbes d'un graphe Git */
function roundedPath(pts, r) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const d = Math.min(r, l1 / 2, l2 / 2);
    const p = [b[0] + (a[0] - b[0]) * d / l1, b[1] + (a[1] - b[1]) * d / l1];
    const q = [b[0] + (c[0] - b[0]) * d / l2, b[1] + (c[1] - b[1]) * d / l2];
    out.push(p);
    for (let k = 1; k < 7; k++) {
      const t = k / 7, u = 1 - t;
      out.push([u * u * p[0] + 2 * u * t * b[0] + t * t * q[0], u * u * p[1] + 2 * u * t * b[1] + t * t * q[1]]);
    }
    out.push(q);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function analyse() {
  const nColors = +els.colors.value, detail = +els.detail.value;
  const { w, h, data } = grab(source);
  const n = w * h;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { rgb[i * 3] = data[i * 4]; rgb[i * 3 + 1] = data[i * 4 + 1]; rgb[i * 3 + 2] = data[i * 4 + 2]; }
  const soft = blur(rgb, w, h);
  const { centers, labels: raw } = kmeans(soft, n, nColors);
  const labels = majority(majority(raw, w, h, nColors), w, h, nColors);
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = soft[i * 3] * 0.299 + soft[i * 3 + 1] * 0.587 + soft[i * 3 + 2] * 0.114;
  const thr = detail < 10 ? Infinity : 420 - detail * 3.6;
  const mask = edgeMask(labels, gray, w, h, thr);

  /* on pose le dessin sur une grille : une case est « allumée » si un contour la traverse */
  const { C, R, cell } = gridSize();
  const gw = C + 2, gh = R + 2;                        // une case de marge tout autour
  const gm = new Uint8Array(gw * gh);
  const cellLabel = new Uint8Array(gw * gh);
  const cnt = new Uint16Array(nColors);
  for (let cy = 0; cy < R; cy++) for (let cx = 0; cx < C; cx++) {
    const x0 = Math.floor(cx * w / C), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / C));
    const y0 = Math.floor(cy * h / R), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / R));
    let hits = 0;
    cnt.fill(0);
    for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < w; x++) { if (mask[y * w + x]) hits++; cnt[labels[y * w + x]]++; }
    let best = 0;
    for (let j = 1; j < nColors; j++) if (cnt[j] > cnt[best]) best = j;
    const gi = (cy + 1) * gw + cx + 1;
    cellLabel[gi] = best;
    if (hits >= 2) gm[gi] = 1;
  }
  thin(gm, gw, gh);

  const rgbOf = centers.map(lineRGB);
  const chains = trace(gm, gw, gh);
  /* chaque branche est reliée aux autres là où elles se touchent, pour qu'il n'y ait pas de trou aux croisements */
  const owner = new Int32Array(gw * gh).fill(-1);
  chains.forEach((c, k) => { for (const i of c.idx) owner[i] = k; });
  const mid = (x, y) => [(x - 1 + 0.5) * cell, (y - 1 + 0.5) * cell];
  const out = [];
  chains.forEach((c, k) => {
    let idx = c.idx.slice();
    const near = i => {
      const x = i % gw, y = (i / gw) | 0;
      for (const [dx, dy] of N8) { const j = (y + dy) * gw + x + dx; if (owner[j] >= 0 && owner[j] !== k) return j; }
      return -1;
    };
    const a = near(idx[0]), b = near(idx[idx.length - 1]);
    if (a >= 0) idx.unshift(a);
    if (b >= 0) idx.push(b);
    if (idx.length < 4) return;
    /* la couleur de chaque case : la couleur dominante autour, le long de la branche */
    const cols = idx.map((_, i) => {
      const k2 = new Array(nColors).fill(0);
      for (let j = Math.max(0, i - 2); j <= Math.min(idx.length - 1, i + 2); j++) k2[cellLabel[idx[j]]]++;
      let best = 0;
      for (let j = 1; j < nColors; j++) if (k2[j] > k2[best]) best = j;
      return rgbOf[best];
    });
    const cellPts = idx.map(i => mid(i % gw, (i / gw) | 0));
    const simple = rdp(cellPts.map((p, i) => [p[0], p[1], i]), cell * 0.7);
    out.push({ cellPts, cols, simple, len: idx.length });
  });
  return { chains: out, palette: rgbOf.map(rgbStr), count: out.length, cell, C, R };
}

/* ---------- 4. le dessin : des lignes colorées arrondies, et un commit toutes les deux cases ---------- */
function build(m) {
  const W = OUT, H = Math.round(m.R * m.cell);
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const lc = layer.getContext('2d');
  lc.lineCap = 'round'; lc.lineJoin = 'round'; lc.lineWidth = Math.max(3, m.cell * 0.16);
  const dots = [];
  for (const c of m.chains) {
    const dense = roundedPath(c.simple.map(p => [p[0], p[1]]), m.cell * 0.6);
    const colAt = p => {                           // la couleur de la case la plus proche
      let bi = 0, bd = Infinity;
      for (let i = 0; i < c.cellPts.length; i++) { const d = (c.cellPts[i][0] - p[0]) ** 2 + (c.cellPts[i][1] - p[1]) ** 2; if (d < bd) { bd = d; bi = i; } }
      return c.cols[bi];
    };
    const dc = dense.map(colAt);
    for (let i = 1; i < dense.length; i++) {
      lc.strokeStyle = rgbStr([(dc[i - 1][0] + dc[i][0]) / 2, (dc[i - 1][1] + dc[i][1]) / 2, (dc[i - 1][2] + dc[i][2]) / 2]);
      lc.beginPath(); lc.moveTo(dense[i - 1][0], dense[i - 1][1]); lc.lineTo(dense[i][0], dense[i][1]); lc.stroke();
    }
    for (let i = 0; i < c.cellPts.length; i += 2) {
      const p = c.cellPts[i];
      let bi = 0, bd = Infinity;
      for (let j = 0; j < dense.length; j++) { const d = (dense[j][0] - p[0]) ** 2 + (dense[j][1] - p[1]) ** 2; if (d < bd) { bd = d; bi = j; } }
      dots.push({ x: dense[bi][0], y: dense[bi][1], col: rgbStr(c.cols[i]) });
    }
    const e = dense[dense.length - 1], ec = dc[dc.length - 1];
    dots.push({ x: e[0], y: e[1], col: rgbStr(ec) });
  }
  dots.sort((a, b) => a.y - b.y);
  return { layer, dots, W, H };
}

/* ---------- animation : le graphe se révèle de haut en bas, comme un historique de commits ---------- */
function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } hctx.clearRect(0, 0, els.heads.width, els.heads.height); }
function clearCanvas() { ctx.fillStyle = BG; ctx.fillRect(0, 0, els.cv.width, els.cv.height); }

function drawDot(d, k, r) {
  ctx.beginPath(); ctx.arc(d.x, d.y, r * k + 3, 0, Math.PI * 2); ctx.fillStyle = BG; ctx.fill();   // l'anneau de fond autour du point
  ctx.beginPath(); ctx.arc(d.x, d.y, r * k, 0, Math.PI * 2); ctx.fillStyle = d.col; ctx.fill();
}

function draw(Y) {
  const { layer, dots, W, H } = model.art;
  clearCanvas();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, Math.min(H, Y)); ctx.clip();
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  const r = Math.max(5, model.cell * 0.2);
  for (const d of dots) {
    if (d.y > Y) break;
    const k = Math.min(1, (Y - d.y) / 70);
    drawDot(d, 1 - Math.pow(1 - k, 3) * (k < 1 ? Math.cos(k * 9) * 0.25 : 0), r);   // petit rebond à l'apparition
  }
}

function play() {
  stopAnim();
  clearCanvas();
  if (!model || !model.chains.length) { say('Aucun contour trouvé : essaie avec plus de détail ou une autre photo.'); return; }
  const { H } = model.art;
  const dur = 9 / +els.speed.value;
  const t0 = performance.now();
  anim = { raf: 0 };
  const finish = () => {
    draw(H + 100);
    hctx.clearRect(0, 0, els.heads.width, els.heads.height);
    say(model.count + ' branches et ' + model.art.dots.length + ' commits. Compare avec la photo d’origine.');
    anim = null;
  };
  if (reduce) { finish(); return; }
  const frame = now => {
    const u = Math.min(1, (now - t0) / (dur * 1000));
    const Y = (u < 1 ? u : 1) * (H + 100);
    draw(Y);
    hctx.clearRect(0, 0, els.heads.width, els.heads.height);
    const g = hctx.createLinearGradient(0, Y - 40, 0, Y);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.22)');
    hctx.fillStyle = g; hctx.fillRect(0, Y - 40, OUT, 40);
    hctx.fillStyle = 'rgba(255,255,255,.85)'; hctx.fillRect(0, Y, OUT, 2);
    if (u >= 1) { finish(); return; }
    say('Les commits s’empilent… ' + Math.round(u * 100) + ' %');
    anim.raf = requestAnimationFrame(frame);
  };
  anim.raf = requestAnimationFrame(frame);
}

/* ---------- interface ---------- */
function resizeCanvases() {
  const { C, R, cell } = gridSize();
  const h = Math.round(R * cell);
  for (const c of [els.cv, els.heads]) { c.width = OUT; c.height = h; }
  els.stage.style.aspectRatio = OUT + ' / ' + h;
  void C;
}

function showThumb() {
  const c = els.thumb, x = c.getContext('2d');
  const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  const k = Math.min(160 / sw, 160 / sh);
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  x.drawImage(source, 0, 0, c.width, c.height);
}

function showPalette() {
  els.pal.textContent = '';
  for (const col of model.palette) {
    const i = document.createElement('i');
    i.style.background = col;
    els.pal.appendChild(i);
  }
}

function rebuild() {
  if (!source) return;
  stopAnim();
  say('Analyse de la photo…');
  setTimeout(() => {
    resizeCanvases();
    showThumb();
    model = analyse();
    model.art = build(model);
    showPalette();
    play();
  }, 20);
}

function setSource(src) {
  source = src;
  els.replay.disabled = false;
  els.stage.classList.add('has');
  rebuild();
}

function loadFile(file) {
  if (!file || !/^image\//.test(file.type)) { say('Ce fichier n’est pas une image.'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); setSource(img); };
  img.onerror = () => { URL.revokeObjectURL(url); say('Impossible de lire cette image.'); };
  img.src = url;
}

/* une petite image d'exemple dessinée par le code, pour tester sans photo */
function drawSample() {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 440;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#3d8bff'); sky.addColorStop(1, '#ffe29a');
  x.fillStyle = sky; x.fillRect(0, 0, 600, 440);
  x.fillStyle = '#ff7a1a'; x.beginPath(); x.arc(450, 120, 52, 0, 7); x.fill();
  x.fillStyle = '#6a4fb5'; x.beginPath(); x.moveTo(0, 300); x.lineTo(150, 130); x.lineTo(300, 300); x.lineTo(380, 190); x.lineTo(540, 300); x.lineTo(600, 250); x.lineTo(600, 330); x.lineTo(0, 330); x.fill();
  x.fillStyle = '#2fa84f'; x.beginPath(); x.moveTo(0, 440); x.lineTo(0, 300); x.quadraticCurveTo(250, 240, 600, 320); x.lineTo(600, 440); x.fill();
  x.fillStyle = '#d63a2f'; x.fillRect(110, 280, 150, 100);
  x.fillStyle = '#3b2a20'; x.beginPath(); x.moveTo(95, 285); x.lineTo(185, 215); x.lineTo(275, 285); x.fill();
  x.fillStyle = '#ffd84a'; x.fillRect(150, 310, 36, 36);
  x.fillStyle = '#ffffff'; x.fillRect(215, 330, 28, 50);
  x.fillStyle = '#5b3a1e'; x.fillRect(420, 310, 20, 70);
  x.fillStyle = '#1d7a3a'; x.beginPath(); x.arc(430, 290, 48, 0, 7); x.fill();
  return c;
}

els.file.addEventListener('change', () => loadFile(els.file.files[0]));
els.sample.addEventListener('click', () => setSource(drawSample()));
els.replay.addEventListener('click', () => { if (model) play(); });
function slider(el, out, fmt) {
  const upd = () => { out.textContent = fmt(+el.value); };
  upd();
  el.addEventListener('input', () => { upd(); clearTimeout(timer); timer = setTimeout(() => { if (el === els.speed) { if (model) play(); } else rebuild(); }, 250); });
}
slider(els.colors, els.colorsv, v => v + ' couleurs');
slider(els.detail, els.detailv, v => v + ' %');
slider(els.speed, els.speedv, v => '×' + v);

for (const ev of ['dragenter', 'dragover']) els.stage.addEventListener(ev, e => { e.preventDefault(); els.stage.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) els.stage.addEventListener(ev, e => { e.preventDefault(); els.stage.classList.remove('over'); });
els.stage.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

resizeCanvases();
clearCanvas();
say('Choisis une photo, ou glisse-la ici.');
