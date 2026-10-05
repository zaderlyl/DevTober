// Day 05 - Chaos : on téléverse une image, la page la détruit au hasard et montre l'avant et l'après.
// On ne choisit rien : le sort pioche parmi neuf façons de tout casser, parfois plusieurs à la suite (un « combo »).
// Rien n'est envoyé : tout est calculé dans le navigateur, sur un tableau de pixels (Uint32Array).
'use strict';

const MAX_SIDE = 1400;                 // on réduit l'image pour rester fluide
const MAX_BYTES = 40 * 1024 * 1024;    // fichier : 40 Mo au maximum
const MAX_SOURCE_PIXELS = 100e6;       // image décodée : 100 mégapixels au maximum

const $ = id => document.getElementById(id);
const ui = { drop: $('drop'), file: $('file'), stage: $('stage'), before: $('before'), after: $('after'), what: $('what'), regret: $('regret'), origin: $('origin'), again: $('again'), change: $('change'), status: $('status'), caption: $('caption'), count: $('count') };
const bctx = ui.before.getContext('2d');
const actx = ui.after.getContext('2d', { willReadFrequently: true });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// les pixels sont lus par paquets de 4 octets (R, G, B, A) ; ça suppose un processeur « little-endian » (tous les ordinateurs et téléphones actuels)
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

// ---- le hasard : une graine tirée au sort à chaque fois (mulberry32), donc un chaos différent à chaque fois
function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const newRng = () => rng32(crypto.getRandomValues(new Uint32Array(1))[0]);
// Fisher-Yates : un mélange où chaque ordre possible a exactement la même probabilité
function shuffled(len, rnd) {
  const p = new Uint32Array(len);
  for (let i = 0; i < len; i++) p[i] = i;
  for (let i = len - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}
const pick = list => list[Math.floor(Math.random() * list.length)];
const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const lum = v => (((v & 255) * 77) + (((v >>> 8) & 255) * 150) + (((v >>> 16) & 255) * 29)) >> 8;
const smooth = u => u * u * (3 - 2 * u);
function say(msg, bad = false) { ui.status.textContent = msg; ui.status.className = 'status' + (bad ? ' bad' : ''); }

// ---- le titre : des lettres de couleurs au hasard (un clic les rebat, et chaque chaos aussi)
const PALETTE = ['#ffd84a', '#ff8fc2', '#7fd4ff', '#ff9b54', '#c9a8ff', '#ff6b6b', '#ffffff'];
const wordEl = $('chaosword');
for (const ch of 'Chaos') wordEl.appendChild(Object.assign(document.createElement('span'), { textContent: ch }));
function shuffleTitle() {
  for (const s of wordEl.children) {
    s.style.color = pick(PALETTE);
    s.style.transform = reduceMotion ? '' : `translateY(${(Math.random() - .5) * 10}px) rotate(${(Math.random() - .5) * 24}deg)`;
  }
}
shuffleTitle(); wordEl.addEventListener('click', shuffleTitle);

// ---- le téléversement
let S = null;        // l'image en cours : { w, h, n, orig32, imageData, out32 }
let run = 0;         // numéro du chaos en cours (un nouveau chaos arrête l'ancien)
let finished = false, chaosCount = 0;

async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { say('Ce fichier n\'est pas une image.', true); return; }
  if (file.size > MAX_BYTES) { say(`Ce fichier est trop gros (${(file.size / 1048576).toFixed(0)} Mo, maximum ${MAX_BYTES / 1048576} Mo).`, true); return; }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > MAX_SOURCE_PIXELS) throw new Error('taille');
    setImage(img, img.naturalWidth, img.naturalHeight);
  } catch (e) {
    say(e.message === 'taille' ? 'Cette image est trop grande pour être traitée ici.' : 'Impossible de lire cette image. Essaie un JPEG, un PNG ou un WebP.', true);
  } finally { URL.revokeObjectURL(url); }
}

function setImage(source, sw, sh) {
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const work = document.createElement('canvas'); work.width = w; work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, w, h);   // une image transparente est posée sur du blanc
  wctx.drawImage(source, 0, 0, w, h);
  const orig32 = new Uint32Array(w * h); orig32.set(new Uint32Array(wctx.getImageData(0, 0, w, h).data.buffer));
  ui.before.width = ui.after.width = w; ui.before.height = ui.after.height = h;
  bctx.drawImage(work, 0, 0);
  const imageData = actx.createImageData(w, h);
  S = { w, h, n: w * h, orig32, imageData, out32: new Uint32Array(imageData.data.buffer) };
  S.out32.set(orig32); actx.putImageData(imageData, 0, 0);
  chaosCount = 0; finished = false;
  ui.drop.hidden = true; ui.stage.hidden = false; ui.origin.hidden = true; ui.what.textContent = ''; ui.regret.textContent = ''; ui.caption.textContent = ''; ui.count.textContent = '';
  say('');
  const id = ++run;
  setTimeout(() => { if (id === run) startChaos(); }, 800);   // on laisse voir l'avant un instant
}
const paint = () => actx.putImageData(S.imageData, 0, 0);

// fait avancer un chaos de 0 à 1 ; « ease » règle le rythme ; un nouveau chaos (ou une autre image) arrête celui-ci
function play(id, ms, draw, ease) {
  return new Promise(resolve => {
    if (reduceMotion) { draw(1); resolve(); return; }
    const t0 = performance.now();
    const step = now => {
      if (id !== run) { resolve(); return; }
      const u = Math.min(1, (now - t0) / ms);
      draw(u >= 1 ? 1 : (ease ? ease(u) : u));
      if (u < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// ================================ les neuf chaos ================================
// Chacun reçoit « src », l'image de départ de cette étape (l'original, ou le résultat de l'étape d'avant dans un combo),
// et dessine dans S.out32 en avançant de 0 à 1.

// 1. les pixels et les couleurs mélangés : chaque pixel reçoit son rouge, son vert et son bleu de trois pixels différents
async function kMix(id, src) {
  const { w, h, n, out32 } = S, rnd = newRng();
  const pr = shuffled(n, rnd), pg = shuffled(n, rnd), pb = shuffled(n, rnd);
  const chaotic = new Uint32Array(n);
  for (let d = 0; d < n; d++) chaotic[d] = (0xFF000000 | (((src[pb[d]] >>> 16) & 255) << 16) | (((src[pg[d]] >>> 8) & 255) << 8) | (src[pr[d]] & 255)) >>> 0;
  // et la façon d'apparaître est tirée au sort aussi : au hasard, en vague, ou en explosion
  const arr = new Float32Array(n), style = Math.floor(rnd() * 3), ang = rnd() * Math.PI * 2, cx = rnd() * w, cy = rnd() * h;
  const dirx = Math.cos(ang), diry = Math.sin(ang), far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;
  const span = (Math.abs(dirx) * w + Math.abs(diry) * h) || 1;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    let v;
    if (style === 0) v = rnd();
    else if (style === 1) v = ((x * dirx + y * diry) - Math.min(0, w * dirx) - Math.min(0, h * diry)) / span * 0.8 + rnd() * 0.2;
    else v = Math.hypot(x - cx, y - cy) / far * 0.8 + rnd() * 0.2;
    arr[i] = Math.max(1e-6, Math.min(0.9999, v));
  }
  await play(id, 3200, t => { for (let i = 0; i < n; i++) out32[i] = arr[i] < t ? chaotic[i] : src[i]; paint(); }, smooth);
}

// 2. une couleur qui se propage depuis un seul pixel, chaque nouveau pixel prenant une couleur au hasard (modèle d'Eden)
async function kGrow(id, src) {
  const { w, h, n, out32 } = S, rnd = newRng();
  const origin = Math.floor(rnd() * n);
  const order = new Uint32Array(n), colors = new Uint32Array(n);   // dans quel ordre les pixels sont gagnés, et la couleur de chacun
  const seen = new Uint8Array(n), frontier = new Uint32Array(n);
  let fl = 0, k = 0;
  seen[origin] = 1; frontier[fl++] = origin;
  while (fl) {   // on prend au hasard un pixel du bord, on le colorie, et ses voisins rejoignent le bord
    const j = Math.floor(rnd() * fl), p = frontier[j];
    frontier[j] = frontier[--fl];
    order[k] = p; colors[k] = (0xFF000000 | Math.floor(rnd() * 16777216)) >>> 0; k++;
    const x = p % w, y = (p / w) | 0;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; frontier[fl++] = p - 1; }
    if (x < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; frontier[fl++] = p + 1; }
    if (y > 0 && !seen[p - w]) { seen[p - w] = 1; frontier[fl++] = p - w; }
    if (y < h - 1 && !seen[p + w]) { seen[p + w] = 1; frontier[fl++] = p + w; }
  }
  out32.set(src); paint();
  ui.origin.style.left = `${((origin % w) + .5) / w * 100}%`; ui.origin.style.top = `${(((origin / w) | 0) + .5) / h * 100}%`; ui.origin.hidden = false;
  let done = 0;
  // la surface d'un disque croît comme le carré de son rayon : avec le temps au carré, la tache avance à vitesse constante
  await play(id, 4500, t => {
    const upto = Math.min(n, Math.floor(t * n));
    for (let i = done; i < upto; i++) out32[order[i]] = colors[i];
    done = upto; paint();
  }, u => u * u);
  ui.origin.hidden = true;
}

// 3. la tornade : tout tourne autour d'un point, de plus en plus fort au centre
async function kSwirl(id, src) {
  const { w, h, n, out32 } = S, rnd = newRng();
  const cx = w * (0.25 + rnd() * 0.5), cy = h * (0.25 + rnd() * 0.5), A = (12 + rnd() * 14) * (rnd() < 0.5 ? -1 : 1);
  const R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const wgt = new Float32Array(n);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) wgt[i] = Math.exp(-2.4 * Math.hypot(x - cx, y - cy) / R);
  const LUT = 4096, sinT = new Float32Array(LUT), cosT = new Float32Array(LUT), K = LUT / (Math.PI * 2);
  for (let i = 0; i < LUT; i++) { sinT[i] = Math.sin(i / K); cosT[i] = Math.cos(i / K); }
  await play(id, 4200, t => {
    for (let y = 0, i = 0; y < h; y++) {
      const dy = y - cy;
      for (let x = 0; x < w; x++, i++) {
        const idx = Math.round(A * t * wgt[i] * K) & (LUT - 1), c = cosT[idx], s = sinT[idx], dx = x - cx;
        let sx = (cx + dx * c - dy * s) | 0, sy = (cy + dx * s + dy * c) | 0;
        sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
        out32[i] = src[sy * w + sx];
      }
    }
    paint();
  }, smooth);
}

// 4. la fonte : l'image coule (vers le bas, le haut, la gauche ou la droite : le sort décide), chaque colonne à sa vitesse
async function kDrip(id, src) {
  const { w, h, out32 } = S, rnd = newRng();
  const dir = Math.floor(rnd() * 4), vertical = dir < 2, flip = dir % 2 === 1;
  const lines = vertical ? w : h, max = (vertical ? h : w) * 1.1, b = new Float32Array(lines);
  let prev = rnd();
  for (let i = 0; i < lines; i++) { prev = prev * 0.6 + rnd() * 0.4; b[i] = 0.12 + 0.88 * prev * (rnd() < 0.1 ? 1.6 : 1); }
  await play(id, 4200, t => {
    const tt = t * t * max;
    if (vertical) {
      for (let x = 0; x < w; x++) { const off = (tt * b[x]) | 0; for (let y = 0; y < h; y++) { let sy = flip ? y + off : y - off; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy; out32[y * w + x] = src[sy * w + x]; } }
    } else {
      for (let y = 0; y < h; y++) { const off = (tt * b[y]) | 0, row = y * w; for (let x = 0; x < w; x++) { let sx = flip ? x + off : x - off; sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx; out32[row + x] = src[row + sx]; } }
    }
    paint();
  });
}

// 5. le bug : des tranches décalées, les couleurs qui se séparent, et ça saccade
async function kGlitch(id, src) {
  const { w, h, out32 } = S, rnd = newRng();
  const shift = new Int32Array(h), split = new Int32Array(h);
  let phase = -1;
  const regen = amp => {
    for (let y = 0; y < h;) {
      const hh = 1 + Math.floor(rnd() * Math.max(2, h * 0.07)), big = rnd() < 0.4;
      const sh = big ? Math.round((rnd() - .5) * 2 * w * 0.5 * amp) : 0, sp = Math.round(rnd() * w * 0.05 * amp);
      for (let k = 0; k < hh && y < h; k++, y++) { shift[y] = sh; split[y] = sp; }
    }
  };
  await play(id, 4200, t => {
    const amp = smooth(Math.min(1, t * 1.15)), ph = Math.floor(t * 28);
    if (ph !== phase) { phase = ph; regen(amp); }
    for (let y = 0; y < h; y++) {
      const row = y * w, sh = shift[y], sp = split[y];
      if (!sh && !sp) { for (let x = 0; x < w; x++) out32[row + x] = src[row + x]; continue; }
      for (let x = 0; x < w; x++) {
        const base = x - sh, xr = (((base + sp) % w) + w) % w, xg = ((base % w) + w) % w, xb = (((base - sp) % w) + w) % w;
        out32[row + x] = (0xFF000000 | (((src[row + xb] >>> 16) & 255) << 16) | (((src[row + xg] >>> 8) & 255) << 8) | (src[row + xr] & 255)) >>> 0;
      }
    }
    paint();
  });
}

// 6. la pluie numérique : des colonnes de caractères tombent et mangent l'image
async function kMatrix(id, src) {
  const { w, h, out32 } = S, rnd = newRng();
  out32.set(src); paint();
  const fs = Math.max(11, Math.round(w / 60)), cols = Math.ceil(w / fs), rows = Math.ceil(h / fs);
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
  const drop = new Float32Array(cols), speed = new Float32Array(cols);
  for (let c = 0; c < cols; c++) { drop[c] = -rnd() * rows * 1.4; speed[c] = 0.22 + rnd() * 0.5; }
  actx.font = `${fs}px Menlo, "Courier New", monospace`; actx.textBaseline = 'top';
  const g = () => GLYPHS[Math.floor(rnd() * GLYPHS.length)];
  const frame = () => {
    for (let c = 0; c < cols; c++) {
      const y = drop[c] * fs;
      if (y > 0) { actx.fillStyle = 'rgba(0,0,0,0.16)'; actx.fillRect(c * fs, 0, fs, Math.min(h, y + fs)); }   // la colonne noircit au-dessus de la tête
      if (y > -fs && y < h + fs) {
        actx.fillStyle = '#12e35a'; actx.fillText(g(), c * fs, y - fs);
        actx.fillStyle = '#d6ffd9'; actx.fillText(g(), c * fs, y);
      }
      drop[c] += speed[c];
      if (drop[c] * fs > h + fs * 4 && rnd() < 0.08) drop[c] = -rnd() * rows * 0.5;
    }
  };
  if (reduceMotion) for (let i = 0; i < 160; i++) frame(); else await play(id, 5600, frame);
  if (id === run) {
    actx.fillStyle = 'rgba(0,0,0,0.55)'; actx.fillRect(0, 0, w, h);
    for (let c = 0; c < cols; c++) {   // on fige la pluie : une traînée de caractères qui s'éteint, dans chaque colonne
      const head = Math.floor(rnd() * (rows + 4)), len = 5 + Math.floor(rnd() * 14);
      for (let k = 0; k < len; k++) {
        const a = 1 - k / len; actx.fillStyle = k === 0 ? '#d6ffd9' : `rgba(18, 227, 90, ${(a * a * 0.95).toFixed(3)})`;
        actx.fillText(g(), c * fs, (head - k) * fs);
      }
    }
    out32.set(new Uint32Array(actx.getImageData(0, 0, w, h).data.buffer));
  }
}

// 7. le tri sauvage : les pixels se rangent par luminosité, par paquets, sans demander la permission
async function kSort(id, src) {
  const { w, h, n, out32 } = S, rnd = newRng();
  const horizontal = rnd() < 0.5, lo = 4 + Math.floor(rnd() * 40), hi = 215 + Math.floor(rnd() * 41), asc = rnd() < 0.5, wave = rnd() < 0.5;   // on trie presque tout : les seuils sont larges
  const sorted = new Uint32Array(src), arr = new Float32Array(n).fill(2);
  const lines = horizontal ? h : w, len = horizontal ? w : h, at = (l, k) => horizontal ? l * w + k : k * w + l;
  const keys = new Uint32Array(len);
  for (let l = 0; l < lines; l++) {
    for (let k = 0; k < len;) {
      const v0 = lum(src[at(l, k)]);
      if (v0 < lo || v0 > hi) { k++; continue; }
      let e = k;
      while (e < len) { const v = lum(src[at(l, e)]); if (v < lo || v > hi) break; e++; }
      const sl = e - k;
      if (sl > 2) {
        for (let j = 0; j < sl; j++) keys[j] = (lum(src[at(l, k + j)]) << 11) | j;
        const sub = keys.subarray(0, sl); sub.sort();
        const tau = Math.max(1e-6, Math.min(0.9999, wave ? k / len * 0.8 + rnd() * 0.2 : rnd()));
        for (let j = 0; j < sl; j++) { const kk = (asc ? sub[j] : sub[sl - 1 - j]) & 2047; sorted[at(l, k + j)] = src[at(l, k + kk)]; arr[at(l, k + j)] = tau; }
      }
      k = e;
    }
  }
  await play(id, 3600, t => { for (let i = 0; i < n; i++) out32[i] = arr[i] < t ? sorted[i] : src[i]; paint(); }, smooth);
}

// 8. l'agitation : à chaque instant, des pixels échangent leur place avec un autre pixel tiré au hasard, de plus en plus loin
async function kJitter(id, src) {
  const { w, h, n, out32 } = S;
  out32.set(src);
  let s = crypto.getRandomValues(new Uint32Array(1))[0] | 1;
  const per = Math.floor(n * 0.45), R = Math.max(8, Math.round(Math.min(w, h) / 8));
  await play(id, 5200, t => {
    const r = Math.max(1, Math.round(1 + (R - 1) * t * t)), span = 2 * r + 1;   // la portée des échanges grandit avec le temps
    for (let q = 0; q < per; q++) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const u = s >>> 0, p = u % n, nx = (p % w) + ((u >>> 7) % span) - r, ny = ((p / w) | 0) + ((u >>> 17) % span) - r;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const o = ny * w + nx, tmp = out32[p]; out32[p] = out32[o]; out32[o] = tmp;
    }
    paint();
  });
}

// 9. les ondes de choc : des vagues de teintes partent d'un point et font tourner les couleurs
async function kShock(id, src) {
  const { w, h, n, out32 } = S, rnd = newRng();
  const cx = rnd() * w, cy = rnd() * h, far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;
  const rd = new Float32Array(n);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) rd[i] = Math.hypot(x - cx, y - cy) / far;
  const freq = 2.2 + rnd() * 3.2, speed = 2.5 + rnd() * 2.5, sat = 1.5 + rnd() * 0.9, STEPS = 64, M = new Float32Array(STEPS * 9);
  await play(id, 4800, t => {
    const A = smooth(Math.min(1, t * 5));   // les ondes montent en puissance au début
    for (let k = 0; k < STEPS; k++) {
      const a = A * (k / STEPS) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      const H00 = .213 + cs * .787 - sn * .213, H01 = .715 - cs * .715 - sn * .715, H02 = .072 - cs * .072 + sn * .928;
      const H10 = .213 - cs * .213 + sn * .143, H11 = .715 + cs * .285 + sn * .140, H12 = .072 - cs * .072 - sn * .283;
      const H20 = .213 - cs * .213 - sn * .787, H21 = .715 - cs * .715 + sn * .715, H22 = .072 + cs * .928 + sn * .072;
      const S00 = .213 + .787 * sat, S01 = .715 - .715 * sat, S02 = .072 - .072 * sat, S10 = .213 - .213 * sat, S11 = .715 + .285 * sat, S12 = .072 - .072 * sat, S20 = .213 - .213 * sat, S21 = .715 - .715 * sat, S22 = .072 + .928 * sat;
      const o = k * 9;   // saturation × rotation de teinte
      M[o] = S00 * H00 + S01 * H10 + S02 * H20; M[o + 1] = S00 * H01 + S01 * H11 + S02 * H21; M[o + 2] = S00 * H02 + S01 * H12 + S02 * H22;
      M[o + 3] = S10 * H00 + S11 * H10 + S12 * H20; M[o + 4] = S10 * H01 + S11 * H11 + S12 * H21; M[o + 5] = S10 * H02 + S11 * H12 + S12 * H22;
      M[o + 6] = S20 * H00 + S21 * H10 + S22 * H20; M[o + 7] = S20 * H01 + S21 * H11 + S22 * H21; M[o + 8] = S20 * H02 + S21 * H12 + S22 * H22;
    }
    for (let i = 0; i < n; i++) {
      let ph = rd[i] * freq - t * speed; ph -= Math.floor(ph);
      const o = ((ph * STEPS) | 0) * 9, v = src[i], r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
      out32[i] = (0xFF000000 | (clamp255(M[o + 6] * r + M[o + 7] * g + M[o + 8] * b) << 16) | (clamp255(M[o + 3] * r + M[o + 4] * g + M[o + 5] * b) << 8) | clamp255(M[o] * r + M[o + 1] * g + M[o + 2] * b)) >>> 0;
    }
    paint();
  });
}

// ---- le catalogue : un nom, quelques phrases pour commenter, et le chaos lui-même
const KINDS = [
  { id: 'mix', name: 'pixels et couleurs mélangés', run: kMix, lines: ['Chaque pixel a changé de place. Et de couleur. Sans prévenir.', 'Le rouge, le vert et le bleu sont partis chacun de leur côté.', 'Personne n\'est resté à sa place. Même pas les couleurs.'] },
  { id: 'grow', name: 'une couleur qui se propage', run: kGrow, lines: ['Un seul pixel a eu une idée. Elle s\'est propagée.', 'Ça a commencé par un point. C\'est contagieux.', 'Un pixel rebelle, puis tous les autres.'] },
  { id: 'swirl', name: 'la tornade', run: kSwirl, lines: ['Une tornade est passée. Elle ne s\'est pas excusée.', 'Tout tourne. Surtout le centre.', 'L\'œil du cyclone est calme. Le reste, beaucoup moins.'] },
  { id: 'drip', name: 'la fonte', run: kDrip, lines: ['L\'image fond. Elle n\'a pas supporté la chaleur.', 'Ça coule, et ça ne remontera pas. Enfin, ça dépend de la direction.', 'Chaque colonne a coulé à sa propre vitesse. Personne ne s\'est concerté.'] },
  { id: 'glitch', name: 'le bug', run: kGlitch, lines: ['Un bug, mais un bug avec du style.', 'L\'écran hoquette. Les couleurs aussi.', 'Rien de grave : le rouge, le vert et le bleu se sont juste disputés.'] },
  { id: 'matrix', name: 'la pluie numérique', run: kMatrix, lines: ['Tu as pris la pilule rouge ? Trop tard : c\'est vert.', 'Il n\'y a pas d\'image. Il n\'y a que de la pluie.', 'L\'image est tombée en colonnes. Il y a des survivants, mais pas beaucoup.'] },
  { id: 'sort', name: 'le tri sauvage', run: kSort, lines: ['Les pixels se sont triés par luminosité, par paquets, sans demander la permission.', 'Du plus sombre au plus clair, ligne par ligne, n\'importe comment.', 'Tout est en ordre. Un ordre que personne n\'a demandé.'] },
  { id: 'jitter', name: 'l\'agitation', run: kJitter, lines: ['Trop de café chez les pixels : ils échangent avec leurs voisins sans s\'arrêter.', 'Chaque pixel a bougé des centaines de fois. Aucun ne sait où il est.', 'Ça ne tient plus en place.'] },
  { id: 'shock', name: 'les ondes de choc', run: kShock, lines: ['Des vagues de couleurs sont passées. La psychédélie n\'a pas de mode d\'emploi.', 'Les teintes tournent en rond, en rond, en rond.', 'Un caillou est tombé dans l\'eau. L\'eau était en arc-en-ciel.'] },
];
const REGRETS = ['c\'était pourtant bien', 'il ne s\'en remettra pas', 'paix à son âme', 'le bon temps', 'on ne le reverra plus'];

// ---- un chaos : un des neuf, ou parfois un combo de deux ou trois à la suite
function startChaos() {
  if (!S) return;
  const id = ++run; finished = false; splats.length = 0;
  S.out32.set(S.orig32); paint(); ui.origin.hidden = true; ui.after.classList.remove('poke'); ui.regret.textContent = '';
  const combo = Math.random() < 0.2;
  const picks = [...shuffled(KINDS.length, newRng())].slice(0, combo ? (Math.random() < 0.4 ? 3 : 2) : 1).map(i => KINDS[i]);   // un vrai mélange équitable (pas un tri au hasard, qui favorise certains)
  shuffleTitle();
  chaosCount++; ui.count.textContent = `Chaos n°${chaosCount}`;
  runKinds(id, picks);
}
async function runKinds(id, picks) {
  const combo = picks.length > 1;
  for (let i = 0; i < picks.length; i++) {
    if (id !== run) return;
    const kind = picks[i];
    ui.what.textContent = `— ${combo ? `combo ${i + 1}/${picks.length} : ` : ''}${kind.name}`;
    ui.caption.textContent = combo ? (i === 0 ? 'Combo ! Le sort a décidé de ne pas se contenter d\'un seul chaos.' : pick(kind.lines)) : pick(kind.lines);
    if (combo && i === 0) { const l = pick(kind.lines); const s = document.createElement('small'); s.textContent = l; ui.caption.appendChild(s); }
    await kind.run(id, S.out32.slice());   // chaque étape part du résultat de la précédente
  }
  if (id === run) finish(picks);
}
function finish(picks) {
  finished = true; ui.origin.hidden = true;
  ui.regret.textContent = `— ${pick(REGRETS)}`;
  const note = document.createElement('small'); note.textContent = 'Clique sur l\'image détruite pour y semer ton propre chaos.';
  ui.caption.appendChild(note);
  ui.after.classList.add('poke');
  const fig = ui.after.closest('figure'); fig.classList.remove('shake'); void fig.offsetWidth; if (!reduceMotion) fig.classList.add('shake');
}

// ---- semer son propre chaos : un clic sur l'image détruite y lance une tache (bruit, peinture ou négatif)
const splats = []; let splatLoop = 0;
ui.after.addEventListener('click', e => {
  if (!S || !finished) return;
  const r = ui.after.getBoundingClientRect(), { w, h, n } = S;
  const x = Math.min(w - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * w))), y = Math.min(h - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * h)));
  const base = (0xFF000000 | Math.floor(Math.random() * 16777216)) >>> 0, p = y * w + x;
  splats.push({ frontier: [p], seen: new Set([p]), left: Math.floor(n * (0.015 + Math.random() * 0.035)), style: Math.floor(Math.random() * 3), base });
  if (!splatLoop) splatLoop = requestAnimationFrame(stepSplats);
});
function stepSplats() {
  splatLoop = 0;
  if (!S) { splats.length = 0; return; }
  const { w, n, out32 } = S;
  for (let si = splats.length - 1; si >= 0; si--) {
    const sp = splats[si], quota = Math.max(300, Math.ceil(n * 0.0012));
    for (let q = 0; q < quota && sp.left > 0 && sp.frontier.length; q++) {
      const j = Math.floor(Math.random() * sp.frontier.length), p = sp.frontier[j];
      sp.frontier[j] = sp.frontier[sp.frontier.length - 1]; sp.frontier.pop();
      if (sp.style === 0) out32[p] = (0xFF000000 | Math.floor(Math.random() * 16777216)) >>> 0;                  // du bruit de couleurs
      else if (sp.style === 1) { const b = sp.base, j2 = () => Math.floor((Math.random() - .5) * 60); out32[p] = (0xFF000000 | (clamp255(((b >>> 16) & 255) + j2()) << 16) | (clamp255(((b >>> 8) & 255) + j2()) << 8) | clamp255((b & 255) + j2())) >>> 0; }   // de la peinture
      else out32[p] = ((out32[p] ^ 0x00FFFFFF) | 0xFF000000) >>> 0;                                              // un négatif
      sp.left--;
      const x = p % w;
      for (const o of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (o >= 0 && o < n && !sp.seen.has(o)) { sp.seen.add(o); sp.frontier.push(o); }
    }
    if (sp.left <= 0 || !sp.frontier.length) splats.splice(si, 1);
  }
  paint();
  if (splats.length) splatLoop = requestAnimationFrame(stepSplats);
}

ui.again.addEventListener('click', () => { if (S) startChaos(); });
ui.change.addEventListener('click', () => { run++; splats.length = 0; ui.stage.hidden = true; ui.drop.hidden = false; S = null; say(''); });
document.addEventListener('keydown', e => { if (e.code === 'Space' && S && !ui.stage.hidden && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); startChaos(); } });

// ---- déposer, choisir, coller une image
const choose = () => ui.file.click();
ui.drop.addEventListener('click', choose);
ui.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
ui.file.addEventListener('change', () => { loadFile(ui.file.files[0]); ui.file.value = ''; });
for (const zone of [ui.drop, ui.stage]) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); loadFile([...e.dataTransfer.files].find(f => f.type.startsWith('image/')) || e.dataTransfer.files[0]); });
}
document.addEventListener('paste', e => { const f = [...(e.clipboardData ? e.clipboardData.files : [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); loadFile(f); } });

if (!LITTLE_ENDIAN) { say('Cet appareil n\'est pas pris en charge (ordre des octets inhabituel).', true); ui.drop.hidden = true; }
