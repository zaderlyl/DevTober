// Day 09 - Gravity : la typographie à masse variable.
// Chaque lettre a une masse égale à son poids typographique (l'axe « wght » d'une police variable, de 100 à 900),
// et ce poids vient de son information : plus une lettre est rare en français, plus elle est lourde.
// Les lettres lourdes coulent, les légères flottent, et la phrase se range en strates. Tout est calculé ici, dans le navigateur.
'use strict';

const $ = id => document.getElementById(id);
const cv = $('tank'), ctx = cv.getContext('2d');
const ui = { form: $('form'), text: $('text'), wrap: $('wrap'), tip: $('tip'), anti: $('anti'), shake: $('shake'), replay: $('replay'), tilt: $('tilt'), caption: $('caption'), facts: $('facts'), fLight: $('f-light'), fHeavy: $('f-heavy'), fOrder: $('f-order'), phrase: $('phrase') };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = 'Epilogue';

// ---- la masse d'une lettre : son information, c'est-à-dire −log₂ de sa fréquence d'apparition en français
const FREQ = { a: 7.636, b: 0.901, c: 3.260, d: 3.669, e: 14.715, f: 1.066, g: 0.866, h: 0.737, i: 7.529, j: 0.613, k: 0.049, l: 5.456, m: 2.968, n: 7.095, o: 5.378, p: 3.021, q: 1.362, r: 6.553, s: 7.948, t: 7.244, u: 6.311, v: 1.628, w: 0.114, x: 0.387, y: 0.308, z: 0.136 };   // en %, d'après les fréquences courantes du français
const bitsOf = pct => -Math.log2(pct / 100);
const B_MIN = bitsOf(FREQ.e), B_MAX = bitsOf(FREQ.k);   // « e » : 2,8 bits (la plus légère) ; « k » : 11 bits (la plus lourde)
const PUNCT = { "'": 6.0, '’': 6.0, ',': 6.3, '.': 6.5, '-': 7.5, '?': 8.5, '!': 8.5, ';': 9, ':': 8.5, '«': 9, '»': 9 };   // la ponctuation courante, en bits
const base = ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function massOf(ch) {
  const lower = ch.toLowerCase(), b = base(ch);
  let bits;
  if (b.length === 1 && FREQ[b]) { bits = bitsOf(FREQ[b]); if (b !== lower) bits += 0.8; if (ch !== lower) bits += 0.6; }   // un accent ou une majuscule, c'est une information en plus
  else if (ch === 'œ' || ch === 'Œ' || ch === 'æ' || ch === 'Æ') bits = 9.5;
  else if (PUNCT[ch]) bits = PUNCT[ch];
  else if (/[0-9]/.test(ch)) bits = 8.8;
  else bits = B_MAX + 0.5;   // tout le reste (symboles, emoji…) est très rare dans un texte
  const w = Math.round(100 + (bits - B_MIN) / (B_MAX - B_MIN) * 800);
  return { bits, w: Math.max(100, Math.min(900, w)) };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
// la couleur suit le poids : bleu pâle (léger), blanc, jaune, orange (lourd)
const STOPS = [[100, [191, 233, 255]], [400, [255, 255, 255]], [700, [255, 216, 74]], [900, [255, 138, 61]]];
function colorOf(w) {
  for (let i = 1; i < STOPS.length; i++) if (w <= STOPS[i][0]) { const [w0, c0] = STOPS[i - 1], [w1, c1] = STOPS[i], u = (w - w0) / (w1 - w0); return `rgb(${Math.round(lerp(c0[0], c1[0], u))}, ${Math.round(lerp(c0[1], c1[1], u))}, ${Math.round(lerp(c0[2], c1[2], u))})`; }
  return 'rgb(255, 138, 61)';
}

// ---- le titre : les lettres de « Gravity » pèsent leur poids et s'affaissent en conséquence
const wordEl = $('word');
for (const ch of 'Gravity') {
  const s = document.createElement('span'), { w } = massOf(ch);
  s.textContent = ch; s.style.fontWeight = w; s.style.transform = `translateY(${((w - 450) / 450 * 7).toFixed(1)}px)`;
  wordEl.appendChild(s);
}

// ---- l'état du bassin
let W = 800, H = 420, DPR = 1;
let B = [];                               // les lettres (les « corps »)
let gdir = { x: 0, y: 1 }, anti = false;   // la direction du « bas », et l'antigravité
let frozen = true, releaseAt = 0, settled = false, settleTime = 0, medianW = 400, fs = 40, run = 0;
let tilting = false;
// les réglages de la physique, choisis en mesurant la part des paires de lettres bien rangées (plus lourde en dessous, plus légère au-dessus) :
// G : intensité de la gravité (px/s²), drag : frottement du liquide, e : rebond, fill : part du bassin occupée par les lettres.
// Avec un bassin moins plein et une gravité douce, 91 à 94 % des paires sont bien rangées (83 % avec le premier réglage, où les lettres se coinçaient).
const P = { G: 450, drag: 3.2, e: 0.06, fill: 0.1 };

function resize() {
  const r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(240, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  if (w === W && h === H && cv.width === Math.round(w * DPR)) return;
  const sx = w / W, sy = h / H; W = w; H = h;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  for (const b of B) { b.x = clamp(b.x * sx, b.hw, W - b.hw); b.y = clamp(b.y * sy, b.hh, H - b.hh); }
}

// ---- les lettres
function measure(b) {
  ctx.font = b.font = `${b.w} ${fs}px ${FONT}, sans-serif`;
  b.hw = Math.max(fs * 0.2, ctx.measureText(b.ch).width / 2) + 1.5; b.hh = fs * 0.5;
  b.m = 0.5 + b.w / 220;   // la masse, dans l'unité du moteur (de 0,95 à 4,6)
  b.color = colorOf(b.w);
}
function setMedian() { const ws = B.map(b => b.w).sort((a, b) => a - b); medianW = ws.length ? ws[Math.floor(ws.length / 2)] : 400; }

// pose les lettres dans l'ordre de lecture, comme du texte normal, au milieu du bassin
function layout(text) {
  const chars = [...text.trim().replace(/\s+/g, ' ')];
  const letters = chars.filter(c => c !== ' ').length;
  fs = clamp(Math.floor(Math.sqrt(P.fill * W * H / (0.6 * Math.max(letters, 1)))), 18, 66);
  B = [];
  const lines = [[]]; let lineW = 0; const maxW = W - 48, space = fs * 0.32, gap = fs * 0.04, wordBuf = [];
  const flushWord = () => {
    if (!wordBuf.length) return;
    const ww = wordBuf.reduce((s, b) => s + b.hw * 2 + gap, 0);
    if (lineW + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lineW = 0; }
    lines[lines.length - 1].push(...wordBuf); lineW += ww + space; wordBuf.length = 0;
  };
  for (const ch of chars) {
    if (ch === ' ') { flushWord(); continue; }
    const { bits, w } = massOf(ch), b = { ch, bits, w, x: 0, y: 0, vx: 0, vy: 0, angle: 0, grab: false }; measure(b); wordBuf.push(b);
  }
  flushWord();
  const lh = fs * 1.2, top = H / 2 - (lines.length * lh) / 2 + lh / 2;
  lines.forEach((ln, i) => {
    const total = ln.reduce((s, b) => s + b.hw * 2 + gap, 0);
    let x = W / 2 - total / 2;
    for (const b of ln) { b.x = x + b.hw; b.y = top + i * lh; x += b.hw * 2 + gap; B.push(b); }
  });
  setMedian();
  ui.phrase.textContent = text;
}

// ---- la physique : flottabilité (Archimède, simplifiée), frottement du liquide, collisions entre rectangles
function step(dt) {
  const sg = anti ? -1 : 1;
  for (const b of B) {
    if (b.grab) { b.x += b.vx * dt; b.y += b.vy * dt; continue; }   // la lettre saisie suit le pointeur : ni poussée ni frottement, mais elle bouge
    // la poussée : nulle pour le poids médian (le liquide), de −1 (le plus léger) à +1 (le plus lourd), de façon symétrique
    const buoy = (b.w < medianW ? (b.w - medianW) / Math.max(1, medianW - 100) : (b.w - medianW) / Math.max(1, 900 - medianW)) * sg;   // > 0 : coule vers le « bas » ; < 0 : remonte
    b.vx += gdir.x * P.G * buoy * dt; b.vy += gdir.y * P.G * buoy * dt;
    const d = Math.max(0, 1 - P.drag * dt); b.vx *= d; b.vy *= d;
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  collide();
}
function collide() {
  const n = B.length;
  for (let it = 0; it < 3; it++) {
    for (let i = 0; i < n; i++) {
      const a = B[i];
      for (let j = i + 1; j < n; j++) {
        const b = B[j], dx = b.x - a.x, px = a.hw + b.hw - Math.abs(dx);
        if (px <= 0) continue;
        const dy = b.y - a.y, py = a.hh + b.hh - Math.abs(dy);
        if (py <= 0) continue;
        const wa = a.grab ? 0 : 1 / a.m, wb = b.grab ? 0 : 1 / b.m, s = wa + wb;
        if (!s) continue;
        if (px < py) {   // on les écarte par le plus petit chevauchement
          const sgn = dx < 0 ? -1 : 1, pen = px + 0.01;
          a.x -= sgn * pen * wa / s; b.x += sgn * pen * wb / s;
          const rv = (b.vx - a.vx) * sgn;
          if (rv < 0) { const imp = -(1 + P.e) * rv / s; a.vx -= sgn * imp * wa; b.vx += sgn * imp * wb; }
        } else {
          const sgn = dy < 0 ? -1 : 1, pen = py + 0.01;
          a.y -= sgn * pen * wa / s; b.y += sgn * pen * wb / s;
          const rv = (b.vy - a.vy) * sgn;
          if (rv < 0) { const imp = -(1 + P.e) * rv / s; a.vy -= sgn * imp * wa; b.vy += sgn * imp * wb; }
        }
      }
    }
    for (const b of B) {   // les parois du bassin
      if (b.x < b.hw) { b.x = b.hw; if (b.vx < 0) b.vx *= -P.e; } else if (b.x > W - b.hw) { b.x = W - b.hw; if (b.vx > 0) b.vx *= -P.e; }
      if (b.y < b.hh) { b.y = b.hh; if (b.vy < 0) b.vy *= -P.e; } else if (b.y > H - b.hh) { b.y = H - b.hh; if (b.vy > 0) b.vy *= -P.e; }
    }
  }
}

// ---- l'affichage
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // le fond : plus clair du côté « léger », plus sombre du côté « lourd »
  const hd = { x: gdir.x * (anti ? -1 : 1), y: gdir.y * (anti ? -1 : 1) }, reach = Math.abs(hd.x) * W / 2 + Math.abs(hd.y) * H / 2;
  const gr = ctx.createLinearGradient(W / 2 - hd.x * reach, H / 2 - hd.y * reach, W / 2 + hd.x * reach, H / 2 + hd.y * reach);
  gr.addColorStop(0, 'rgba(191, 233, 255, 0.20)'); gr.addColorStop(0.5, 'rgba(0, 0, 0, 0.10)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // les mots « léger » et « lourd » aux deux bouts du bassin
  ctx.font = '600 12px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  // les étiquettes sont dans un coin, pour ne pas disparaître sous les lettres
  const labelAt = (dir, txt) => {
    const horizontal = Math.abs(dir.x) > Math.abs(dir.y);
    ctx.fillText(txt, horizontal ? clamp(W / 2 + dir.x * (W / 2 - 34), 36, W - 36) : 42, horizontal ? 18 : clamp(H / 2 + dir.y * (H / 2 - 14), 14, H - 14));
  };
  labelAt(hd, 'lourd ▾'); labelAt({ x: -hd.x, y: -hd.y }, 'léger ▴');
  // les lettres
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const b of B) {
    ctx.font = b.font; ctx.fillStyle = b.color;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); ctx.fillText(b.ch, 0, fs * 0.32); ctx.restore();
  }
}

let last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  const dtr = Math.min(0.05, (now - last) / 1000); last = now;
  if (frozen && now >= releaseAt && releaseAt) release();
  if (!frozen) {
    acc += dtr; const h = 1 / 120; let n = 0;
    while (acc >= h && n++ < 8) { stirPointer(h); followGrab(); step(h); acc -= h; }
    let sp = 0, mx = 0;
    for (const b of B) { const v = Math.hypot(b.vx, b.vy); sp += v; mx = Math.max(mx, v); b.angle = clamp(b.angle * 0.9 + b.vx * 0.00012, -0.3, 0.3); }
    const mean = B.length ? sp / B.length : 0;
    if (!settled && mean < 10 && mx < 90) { settleTime += dtr; if (settleTime > 0.8) { settled = true; onSettled(); } } else if (mean >= 10 || mx >= 90) { settleTime = 0; if (settled && mean > 30) { settled = false; ui.facts.hidden = true; } }
  }
  draw();
}

// ---- les mots autour : ce que dit la page, et le résultat
const LINES = {
  frozen: ['Voici ta phrase. Elle ne se doute de rien.', 'Voici ta phrase, bien rangée. Ça ne durera pas.'],
  go: ['Chaque lettre pèse son poids d\'information : plus elle est rare en français, plus elle est lourde.', 'Le « e » est la lettre la plus légère du français. Le « k », la plus lourde.'],
  settled: ['Tout s\'est rangé : les plus légères en haut, les plus rares tout au fond.', 'Le bassin a trié ta phrase sans lire un mot.', 'Plus personne ne bouge. Les lettres sont à leur étage.'],
  settledAnti: ['Ici tout est à l\'envers : les lourdes ont décollé, les légères sont tombées.', 'Antigravité : les plus rares sont en haut, comme des ballons.'],
};
const pick = list => list[Math.floor(Math.random() * list.length)];
function say(text, small) {
  ui.caption.textContent = text;
  if (small) { const s = document.createElement('small'); s.append(small); ui.caption.appendChild(s); }
}
function fmt(b) { return `« ${b.ch} » · poids ${b.w} · ${b.bits.toFixed(1).replace('.', ',')} bits`; }
function onSettled() {
  if (!B.length) return;
  const hd = { x: gdir.x * (anti ? -1 : 1), y: gdir.y * (anti ? -1 : 1) };
  const sorted = [...B].sort((a, b) => (a.x * hd.x + a.y * hd.y) - (b.x * hd.x + b.y * hd.y));   // du côté « léger » au côté « lourd »
  const light = [...B].sort((a, b) => a.w - b.w)[0], heavy = [...B].sort((a, b) => b.w - a.w)[0];
  ui.fLight.textContent = fmt(light); ui.fHeavy.textContent = fmt(heavy);
  const str = sorted.map(b => b.ch).join(' ');
  ui.fOrder.textContent = str.length > 150 ? str.slice(0, 149) + '…' : str;
  ui.facts.hidden = false;
  say(pick(anti ? LINES.settledAnti : LINES.settled));
}
function release() {
  frozen = false; releaseAt = 0; settled = false; settleTime = 0; acc = 0;
  for (const b of B) { b.vx = (Math.random() - 0.5) * 60; b.vy = (Math.random() - 0.5) * 60; }   // un léger souffle, pour que rien ne reste parfaitement figé
  say(pick(LINES.go));
  if (reduceMotion) { for (let i = 0; i < 1200; i++) step(1 / 120); for (const b of B) { b.vx = b.vy = 0; } }
}

function start(text) {
  run++;
  anti = false; ui.anti.classList.remove('active'); ui.anti.textContent = 'import antigravity';
  ui.facts.hidden = true; ui.tip.hidden = true; frozen = true; settled = false; grab = null; cv.classList.remove('grabbing');
  layout(text);
  say(pick(LINES.frozen));
  releaseAt = performance.now() + 1500;
}

// ---- la souris remue le liquide ; on peut saisir une lettre et la lancer, ou la cliquer pour l'alourdir
const ptr = { x: -999, y: -999, vx: 0, vy: 0, in: false, lx: 0, ly: 0, lt: 0 };
let grab = null;
function canvasPoint(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
function bodyAt(p) { for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; if (Math.abs(p.x - b.x) <= b.hw + 3 && Math.abs(p.y - b.y) <= b.hh + 3) return b; } return null; }
function stirPointer(dt) {
  if (!ptr.in || grab || Math.hypot(ptr.vx, ptr.vy) < 30) return;
  const R = 80;
  for (const b of B) { const d = Math.hypot(b.x - ptr.x, b.y - ptr.y); if (d < R) { const f = (1 - d / R) * 14 * dt; b.vx += (ptr.vx - b.vx) * f; b.vy += (ptr.vy - b.vy) * f; } }
}
cv.addEventListener('pointermove', e => {
  const p = canvasPoint(e), now = performance.now(), dt = Math.max(1, now - ptr.lt) / 1000;
  ptr.vx = lerp(ptr.vx, (p.x - ptr.lx) / dt, 0.4); ptr.vy = lerp(ptr.vy, (p.y - ptr.ly) / dt, 0.4);
  ptr.x = p.x; ptr.y = p.y; ptr.lx = p.x; ptr.ly = p.y; ptr.lt = now; ptr.in = true;
  if (grab) { grab.tx = p.x - grab.ox; grab.ty = p.y - grab.oy; grab.moved = grab.moved || Math.hypot(p.x - grab.sx, p.y - grab.sy) > 5; }
  const b = grab ? grab.b : bodyAt(p);
  if (b) { ui.tip.textContent = fmt(b); ui.tip.hidden = false; const r = cv.getBoundingClientRect(), wr = ui.wrap.getBoundingClientRect(); ui.tip.style.left = `${r.left - wr.left + b.x * (r.width / W)}px`; ui.tip.style.top = `${r.top - wr.top + (b.y - b.hh) * (r.height / H)}px`; } else ui.tip.hidden = true;
});
cv.addEventListener('pointerleave', () => { ptr.in = false; if (!grab) ui.tip.hidden = true; });
cv.addEventListener('pointerdown', e => {
  const p = canvasPoint(e), b = bodyAt(p);
  ptr.lx = p.x; ptr.ly = p.y; ptr.lt = performance.now(); ptr.in = true; ptr.x = p.x; ptr.y = p.y;
  if (!b || frozen) return;
  cv.setPointerCapture(e.pointerId); cv.classList.add('grabbing');
  b.grab = true; b.vx = b.vy = 0; grab = { b, ox: p.x - b.x, oy: p.y - b.y, tx: b.x, ty: b.y, sx: p.x, sy: p.y, moved: false, t: performance.now() };
});
function release2(e) {
  if (!grab) return;
  const { b } = grab; b.grab = false; cv.classList.remove('grabbing');
  if (!grab.moved && performance.now() - grab.t < 450) {   // un simple clic : la lettre s'alourdit
    b.w = b.w >= 900 ? 100 : Math.min(900, b.w + 200); measure(b); setMedian(); settled = false; settleTime = 0; ui.facts.hidden = true;
    say(`« ${b.ch} » pèse maintenant ${b.w}.`, 'Un clic alourdit une lettre de 200 ; au-delà de 900, elle redevient légère.');
  } else { b.vx = clamp(ptr.vx, -1500, 1500); b.vy = clamp(ptr.vy, -1500, 1500); }   // on la lance avec la vitesse de la souris
  grab = null;
}
cv.addEventListener('pointerup', release2); cv.addEventListener('pointercancel', release2);
// la lettre saisie suit le pointeur (avec un ressort), même si elle est gênée par les autres
function followGrab() { if (grab) { const b = grab.b; b.vx = (grab.tx - b.x) * 24; b.vy = (grab.ty - b.y) * 24; } }

// ---- les boutons, le clavier, le téléphone
ui.form.addEventListener('submit', e => { e.preventDefault(); const t = ui.text.value.trim(); if (t) start(t); });
ui.replay.addEventListener('click', () => start(ui.text.value.trim() || 'gravité'));
ui.anti.addEventListener('click', () => {
  anti = !anti; ui.anti.classList.toggle('active', anti); ui.anti.textContent = anti ? 'import gravity' : 'import antigravity';
  settled = false; settleTime = 0; ui.facts.hidden = true;
  if (anti) { say('import antigravity', ''); const s = document.createElement('small'); s.append('Comme dans la BD '); const a = document.createElement('a'); a.href = 'https://xkcd.com/353/'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'xkcd n°353'; s.append(a, ' : les lourdes montent, les légères tombent.'); ui.caption.appendChild(s); }
  else say('import gravity : tout redevient normal. Enfin, presque.');
});
ui.shake.addEventListener('click', () => { if (frozen) return; for (const b of B) { b.vx += (Math.random() - 0.5) * 1700; b.vy += (Math.random() - 0.5) * 1700; } settled = false; settleTime = 0; ui.facts.hidden = true; say('Le bassin a été secoué. Tout est à refaire.'); });
document.addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  const m = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (!m) return; e.preventDefault(); tilting = false; gdir = { x: m[0], y: m[1] }; settled = false; settleTime = 0; ui.facts.hidden = true;
});
// l'inclinaison du téléphone donne la vraie direction du « bas » (accélération mesurée par le capteur, gravité comprise)
function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null) return;
  const gx = -a.x, gy = a.y, len = Math.hypot(gx, gy); if (len < 1.5) return;   // téléphone à plat : pas de direction dans l'écran
  tilting = true; gdir = { x: gx / len, y: gy / len }; settled = false; settleTime = 0;
}
const touchScreen = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;   // pas de bouton d'inclinaison sur un ordinateur
if (typeof DeviceMotionEvent !== 'undefined' && touchScreen) {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {   // iPhone : il faut demander la permission, par un geste
    ui.tilt.hidden = false;
    ui.tilt.addEventListener('click', async () => { try { if ((await DeviceMotionEvent.requestPermission()) === 'granted') { addEventListener('devicemotion', onMotion); ui.tilt.hidden = true; say('Incline ton téléphone : le « bas » suit.'); } } catch (e) { say('Impossible d\'activer l\'inclinaison sur cet appareil.'); } });
  } else addEventListener('devicemotion', onMotion);
}

// ---- démarrage : on attend que la police variable soit chargée (sinon les poids seraient tous identiques)
addEventListener('resize', resize);
(async function init() {
  try { await document.fonts.load(`400 40px ${FONT}`); await document.fonts.ready; } catch (e) {}
  resize(); start(ui.text.value);
  requestAnimationFrame(frame);
})();
