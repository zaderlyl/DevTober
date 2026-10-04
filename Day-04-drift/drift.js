// Day 04 - Drift : plusieurs dériveurs partent du même article Wikipédia. À chaque étape, chacun compte les pages liées,
// tire un numéro au hasard et suit ce lien. X fois. Tout se passe dans le navigateur : l'API de Wikipédia accepte ces appels.

const MAX_HOPS = 40, MAX_DRIFTERS = 6;
const MAX_TOTAL = 120;      // plafond du total de sauts (dériveurs × sauts) : on reste poli avec Wikipédia
const MAX_PARALLEL = 3;     // jamais plus de trois requêtes en même temps
const NS_FALLBACK = /^(Fichier|File|Image|Catégorie|Category|Aide|Help|Wikipédia|Wikipedia|Portail|Portal|Spécial|Special|Modèle|Template|Discussion|Talk|Utilisateur|User|MediaWiki|Projet|Draft|Brouillon|Référence|Module|Média|Media):/i;
const W0 = 800, H0 = 520;   // taille de référence du dessin
const SPACING = 150;        // écart de base entre deux étapes, dans le dessin
const COLORS = ['#ffd84a', '#ff8fc2', '#7fd4ff', '#ff9b54', '#c9a8ff', '#ff6b6b'];   // une couleur par branche
const ROOT_COLOR = '#ffffff';

const $ = id => document.getElementById(id);
const form = $('form'), startIn = $('start'), hopsIn = $('hops'), drifIn = $('drifters'), langSel = $('lang'), speedSel = $('speed');
const goBtn = $('go'), stopBtn = $('stop'), randBtn = $('rand'), statusEl = $('status'), logEl = $('log'), cardsEl = $('cards');
const svg = $('map'), svgNS = 'http://www.w3.org/2000/svg', mapbox = $('mapbox');
const zinBtn = $('zin'), zoutBtn = $('zout'), fitBtn = $('fit');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// le rapport largeur / hauteur réel de la carte (il change sur petit écran)
const aspect = () => { const r = svg.getBoundingClientRect(); return r.width && r.height ? r.width / r.height : W0 / H0; };

// ---- langues et réglages mémorisés d'une visite à l'autre
const uiSel = $('ui');
for (const [k, v] of Object.entries(UI_LANGS)) uiSel.add(new Option(v, k));
for (const [k, v] of Object.entries(EDITIONS)) langSel.add(new Option(v, k));
let saved = {};
try { saved = JSON.parse(localStorage.getItem('devtober-drift') || '{}'); } catch (e) {}
const uiStart = UI_LANGS[saved.ui] ? saved.ui : detectUI();
const editionSaved = saved.edition || saved.lang;   // « lang » = l'ancien nom du réglage
uiSel.value = uiStart;
langSel.value = EDITIONS[editionSaved] ? editionSaved : uiStart;
startIn.value = saved.start || START_ARTICLE[langSel.value];
if (saved.hops) hopsIn.value = saved.hops;
if (saved.drifters) drifIn.value = saved.drifters;
if (saved.speed) speedSel.value = saved.speed;
let prevUi = uiStart, prevEdition = langSel.value;
applyUI(uiStart);
const remember = () => { try { localStorage.setItem('devtober-drift', JSON.stringify({ start: startIn.value, hops: hopsIn.value, drifters: drifIn.value, ui: uiSel.value, edition: langSel.value, speed: speedSel.value })); } catch (e) {} };

// ---- Wikipédia
const api = (lang, params) => `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });

// jamais plus de MAX_PARALLEL requêtes en même temps, même avec six dériveurs
let inFlight = 0; const waiting = [];
async function slot() { if (inFlight >= MAX_PARALLEL) await new Promise(r => waiting.push(r)); inFlight++; }
function release() { inFlight--; const w = waiting.shift(); if (w) w(); }

async function getJSON(url, signal) {
  await slot();
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(t('http', { code: res.status }));
    return await res.json();
  } finally { release(); }
}

// Quand on change d'édition, un article porte un autre nom (« Piza » en indonésien, « ピザ » en japonais) : on demande à
// Wikipédia l'équivalent dans la nouvelle langue ; à défaut, on prend l'article de départ par défaut de cette langue.
async function translateStart(from, to) {
  const v = startIn.value.trim();
  if (v && from !== to) {
    try {
      const j = await getJSON(api(from, { action: 'query', prop: 'langlinks', lllang: to, lllimit: '1', redirects: '1', titles: v }));
      const ll = j.query.pages[0].langlinks;
      if (ll && ll[0] && ll[0].title) { startIn.value = ll[0].title; remember(); return; }
    } catch (e) { /* pas grave : on retombe sur l'article par défaut */ }
  }
  startIn.value = START_ARTICLE[to]; remember();
}

// les noms des pages « spéciales » (Fichier:, Datei:, Berkas:, ファイル:…) changent d'une édition à l'autre : on demande la liste exacte à Wikipédia
const nsCache = {};
async function getNamespaces(lang, signal) {
  if (nsCache[lang]) return nsCache[lang];
  try {
    const j = await getJSON(api(lang, { action: 'query', meta: 'siteinfo', siprop: 'namespaces|namespacealiases' }), signal);
    const names = new Set();
    for (const [id, ns] of Object.entries(j.query.namespaces)) { if (Number(id) === 0) continue; if (ns.name) names.add(ns.name); if (ns.canonical) names.add(ns.canonical); }
    for (const a of j.query.namespacealiases || []) names.add(a.alias);
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (nsCache[lang] = new RegExp('^(' + [...names].sort((x, y) => y.length - x.length).map(esc).join('|') + '):', 'i'));
  } catch (e) { if (e.name === 'AbortError') throw e; return (nsCache[lang] = NS_FALLBACK); }
}

// une page : son titre officiel (après redirection) et la liste de ses pages liées, SANS doublon
async function getPage(title, lang, signal, nsRe) {
  const j = await getJSON(api(lang, { action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1', disabletoc: '1' }), signal);
  if (j.error) throw new Error(j.error.code === 'missingtitle' ? t('missing', { title }) : j.error.info);
  const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
  // on retire ce qui n'est pas « dans le texte » : bandeaux de navigation, notes, références, bandeaux d'aide
  doc.querySelectorAll('.navbox, .reflist, .references, .reference, .mw-editsection, .hatnote, .noprint, .mw-references-wrap, style, script').forEach(n => n.remove());
  const own = j.parse.title, seen = new Set();
  for (const a of doc.querySelectorAll('a[href^="/wiki/"]')) {
    const raw = a.getAttribute('href').slice(6).split('#')[0];
    if (!raw) continue;
    let name; try { name = decodeURIComponent(raw).replace(/_/g, ' '); } catch (e) { continue; }
    if (nsRe.test(name) || name === own) continue;
    seen.add(name);
  }
  return { title: own, links: [...seen] };
}

// la fiche d'une page : sa vignette, sa description courte et sa première phrase (un seul appel)
async function getInfo(title, lang, signal) {
  const j = await getJSON(api(lang, { action: 'query', prop: 'pageimages|extracts|description', piprop: 'thumbnail', pithumbsize: '240', exintro: '1', explaintext: '1', exsentences: '2', redirects: '1', titles: title }), signal);
  const p = (j.query && j.query.pages && j.query.pages[0]) || {};
  // on n'affiche une image que si elle vient bien des serveurs d'images de Wikimedia
  const thumb = p.thumbnail && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(p.thumbnail.source) ? p.thumbnail.source : null;
  return { thumb, description: p.description || '', sentence: firstSentence(p.extract || '') };
}

// la première phrase, sans les longues parenthèses de traductions (« en italien : Calabria /kaˈlabrja/ ; … »)
function firstSentence(text) {
  let x = text.replace(/\n[\s\S]*/, '');
  for (let i = 0; i < 4; i++) x = x.replace(/\s*\([^()]*\)/g, '');
  x = x.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  const m = x.match(/^[\s\S]*?[.!?。！？](?=\s+[\p{Lu}«"“\p{Lo}]|$)|^[\s\S]*?[。！？]/u);
  let s = m ? m[0] : x;
  if (s.length > 190) s = s.slice(0, 187).replace(/\s+\S*$/, '') + '…';
  return s;
}

async function randomTitle(lang, signal) {
  const j = await getJSON(api(lang, { action: 'query', list: 'random', rnnamespace: '0', rnlimit: '1' }), signal);
  return j.query.random[0].title;
}

const pageUrl = (lang, title) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// ---- affichage du texte d'état (sans innerHTML : les titres viennent de l'extérieur)
function say(...parts) {
  statusEl.className = 'status';
  statusEl.replaceChildren(...parts.map(p => {
    if (typeof p === 'string') return document.createTextNode(p);
    const b = document.createElement('b'); b.textContent = p.b; return b;
  }));
}
function fail(msg) { statusEl.className = 'status bad'; statusEl.textContent = msg; }
// le dernier message est gardé : si on change de langue, on le réécrit dans la nouvelle langue
let lastStatus = null;
// « vars » peut être une fonction : ainsi les mots traduits (« 4 sauts ») sont recalculés si on change de langue
const V = vars => (typeof vars === 'function' ? vars() : vars);
const sayT = (key, vars, bold) => { lastStatus = () => say(...tparts(key, V(vars), bold)); lastStatus(); };
const failT = (key, vars) => { lastStatus = () => fail(t(key, V(vars))); lastStatus(); };
const hopsOf = n => t('hopsWord', { n });
const driftersOf = n => t('driftersWord', { n });

// ---- une carte par branche : où en est chaque dériveur
let branches = [];
function buildCards(n) {
  cardsEl.replaceChildren();
  for (const br of branches) {
    const c = document.createElement('article'); c.className = 'bcard'; c.style.setProperty('--c', br.color);
    c.tabIndex = 0; c.setAttribute('role', 'button'); c.title = t('goBranch');
    c.dir = 'auto';
    const pic = document.createElement('div'); pic.className = 'pic';
    const img = document.createElement('img'); img.alt = ''; img.hidden = true;
    const init = document.createElement('span'); init.className = 'init'; init.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => { img.hidden = true; init.hidden = false; });
    pic.append(img, init);
    const body = document.createElement('div'); body.className = 'body';
    const head = document.createElement('div'); head.className = 'head';
    const title = document.createElement('a'); title.className = 'title'; title.target = '_blank'; title.rel = 'noopener';
    const tag = document.createElement('span'); tag.className = 'tag';
    head.append(title, tag);
    const desc = document.createElement('p'); desc.className = 'desc';
    const txt = document.createElement('p'); txt.className = 'txt';
    body.append(head, desc, txt); c.append(pic, body);
    const go = () => flyToBranch(br);
    c.addEventListener('click', e => { if (!e.target.closest('a')) go(); });
    c.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); go(); } });
    br.card = { el: c, img, init, title, tag, desc, txt };
    cardsEl.appendChild(c);
  }
}
function updateCard(br) {
  const c = br.card, node = br.tip; if (!c || !node) return;
  c.title.textContent = node.title; c.title.href = pageUrl(node.lang, node.title);
  c.tag.textContent = `${t('branchN', { i: br.i + 1 })} · ${hopsOf(br.done)}`;
  const info = node.info;
  c.desc.textContent = info ? info.description : '';
  c.txt.textContent = info ? info.sentence : t('loading');
  c.init.textContent = node.title.charAt(0).toUpperCase();
  if (info && info.thumb) { c.img.src = info.thumb; c.img.hidden = false; c.init.hidden = true; }
  else { c.img.hidden = true; c.img.removeAttribute('src'); c.init.hidden = false; }
  c.el.classList.remove('swap'); void c.el.offsetWidth; c.el.classList.add('swap');
}

// ---- le dessin : toutes les branches sur le même canevas, avec une caméra qu'on peut déplacer
const gEdges = document.createElementNS(svgNS, 'g'), gNodes = document.createElementNS(svgNS, 'g'), defs = document.createElementNS(svgNS, 'defs');
svg.append(defs, gEdges, gNodes);
let nodes = [], cam = { x: 0, y: 0, w: W0, h: H0 }, camAnim = 0, runId = 0, follow = true, fitW = W0;

const clearMap = () => { gEdges.replaceChildren(); gNodes.replaceChildren(); defs.replaceChildren(); nodes = []; follow = true; fitBtn.classList.remove('attention'); setCam({ x: 0, y: 0, w: W0, h: H0 }); };

function setCam(c) {
  cam = c;
  svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
  const k = c.w / (svg.getBoundingClientRect().width || W0);   // unités du dessin par pixel d'écran : tailles constantes à l'écran
  svg.style.setProperty('--k', k);
  // rayon des ronds à l'écran : grand quand on est près, plus petit quand on s'éloigne (les vignettes apparaissent en zoomant)
  const rpx = Math.max(7, Math.min(22, 0.3 * SPACING / k));
  for (const n of nodes) {
    n.rpx = (n.now || n.start ? 1.25 : 1) * rpx;
    const r = n.rpx * k, showImg = n.info && n.info.thumb && !n.imgFailed && rpx >= 10, showInit = !showImg && rpx >= 11;
    n.base.setAttribute('r', r); n.ring.setAttribute('r', r); n.clip.setAttribute('r', r);
    n.ring.style.strokeWidth = (n.now ? 3.5 : 2.5) * k;
    n.img.setAttribute('x', n.x - r); n.img.setAttribute('y', n.y - r); n.img.setAttribute('width', 2 * r); n.img.setAttribute('height', 2 * r);
    n.img.style.display = showImg ? '' : 'none';
    n.init.style.display = showInit ? '' : 'none';
    n.init.setAttribute('x', n.x); n.init.setAttribute('y', n.y); n.init.style.fontSize = `${r * 1.05}px`;
  }
  gEdges.style.strokeWidth = 2 * k;
  placeLabels(k);
}

// Les noms n'apparaissent que s'ils ont la place : les bouts de branche, le départ, puis les plus récents sont prioritaires.
// En zoomant, il y a plus de place et d'autres noms apparaissent ; tous restent lisibles au survol et dans le journal.
function placeLabels(k) {
  const px = n => ({ x: (n.x - cam.x) / k, y: (n.y - cam.y) / k });
  const width = svg.getBoundingClientRect().width || W0, height = svg.getBoundingClientRect().height || H0;
  const boxes = [];
  const order = [...nodes].sort((a, b) => (b.now - a.now) || (b.start - a.start) || (b.i - a.i));
  for (const n of order) {
    const p = px(n);
    // hors de l'écran : inutile de placer un nom
    if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) { n.text.style.display = 'none'; continue; }
    const w = n.text.textContent.length * 8.5, base = p.y + (n.i % 2 ? n.rpx + 17 : -(n.rpx + 4));
    n.text.setAttribute('y', n.y + (base - p.y) * k);
    let placed = false;
    for (const side of [1, -1]) {   // à droite du rond, sinon à gauche (si ça dépasse du bord)
      const off = n.rpx + 4, box = side > 0 ? { x0: p.x + off - 2, x1: p.x + off + w + 2 } : { x0: p.x - off - w - 2, x1: p.x - off + 2 };
      box.y0 = base - 14; box.y1 = base + 5;
      if (box.x0 < 2 || box.x1 > width - 2) continue;
      const hit = boxes.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)
        || nodes.some(o => { if (o === n) return false; const q = px(o); return q.x > box.x0 - o.rpx && q.x < box.x1 + o.rpx && q.y > box.y0 - o.rpx && q.y < box.y1 + o.rpx; });
      if (hit) continue;
      n.text.setAttribute('x', n.x + side * off * k); n.text.setAttribute('text-anchor', side > 0 ? 'start' : 'end');
      boxes.push(box); placed = true; break;
    }
    n.text.style.display = placed ? '' : 'none';
  }
}

// le cadrage qui montre tous les ronds (ou seulement ceux qu'on donne)
function fitCam(list = nodes, minW = 300) {
  const xs = list.map(n => n.x), ys = list.map(n => n.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ar = aspect(), px = svg.getBoundingClientRect().width || W0;
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  let k = 0.3, target;
  for (let i = 0; i < 4; i++) {   // les ronds et les noms ont une taille fixe à l'écran : on laisse la place qu'il faut, en plusieurs essais
    // marges en pixels d'écran, proportionnelles à la carte : 215 px pour les noms sur grand écran, bien moins sur un téléphone
    const padL = clamp(px * 0.12, 30, 60) * k, padR = clamp(px * 0.25, 50, 215) * k, padT = 56 * k, padB = 60 * k;
    const bw = w + padL + padR, bh = h + padT + padB;
    const vw = Math.max(bw, bh * ar, minW), vh = vw / ar;
    k = vw / px;
    target = { x: x0 - padL - (vw - bw) / 2, y: y0 - padT - (vh - bh) / 2, w: vw, h: vh };
  }
  return target;
}

function animateCam(target, ms = 650) {
  cancelAnimationFrame(camAnim);
  const from = { ...cam }, t0 = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = now => {
    const u = reduce ? 1 : Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
    setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
    if (u < 1) camAnim = requestAnimationFrame(step);
  };
  camAnim = requestAnimationFrame(step);
}

// ---- circuler : déplacer, zoomer, tout revoir, rejoindre une branche
function userMoved() { follow = false; cancelAnimationFrame(camAnim); fitBtn.classList.add('attention'); }
function refit() { follow = true; fitBtn.classList.remove('attention'); if (nodes.length) { const f = fitCam(); fitW = f.w; animateCam(f); } }
function zoomAt(factor, cx, cy) {   // cx, cy : le point de l'écran qui reste immobile (en proportion de la carte, de 0 à 1)
  const w = clamp(cam.w / factor, 140, Math.max(fitW * 3, 600)), h = w * cam.h / cam.w;
  setCam({ x: cam.x + cx * (cam.w - w), y: cam.y + cy * (cam.h - h), w, h });
}
function panBy(dx, dy) { setCam({ ...cam, x: cam.x + dx, y: cam.y + dy }); }
function flyToBranch(br) {
  if (!br.tip) return;
  const list = [br.tip]; let n = br.tip; for (let i = 0; i < 3 && n.parent; i++) { n = n.parent; list.push(n); }
  follow = false; fitBtn.classList.add('attention');
  animateCam(fitCam(list, 520), 800);
  mapbox.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
zinBtn.addEventListener('click', () => { userMoved(); zoomAt(1.5, 0.5, 0.5); });
zoutBtn.addEventListener('click', () => { userMoved(); zoomAt(1 / 1.5, 0.5, 0.5); });
fitBtn.addEventListener('click', refit);

const pointers = new Map(); let dragged = false, lastDist = 0, lastMid = null, suppressClick = false;
const mid = () => { const a = [...pointers.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; };
const dist = () => { const a = [...pointers.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
svg.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  suppressClick = false; dragged = false;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  if (pointers.size === 2) { lastDist = dist(); lastMid = mid(); }
});
svg.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  const rect = svg.getBoundingClientRect(), k = cam.w / rect.width;
  if (pointers.size === 1 && p.type !== 'touch') {   // à la souris : on glisse pour se déplacer
    if (!dragged && Math.hypot(dx, dy) < 2 && !svg.classList.contains('dragging')) return;
    if (!dragged) { dragged = true; svg.classList.add('dragging'); try { svg.setPointerCapture(e.pointerId); } catch (err) {} }
    userMoved(); panBy(-dx * k, -dy * k);
  } else if (pointers.size === 2) {   // à deux doigts : on pince pour zoomer et on déplace
    const d = dist(), m = mid(); dragged = true; userMoved();
    zoomAt(d / (lastDist || d), clamp((m.x - rect.left) / rect.width, 0, 1), clamp((m.y - rect.top) / rect.height, 0, 1));
    panBy(-(m.x - lastMid.x) * (cam.w / rect.width), -(m.y - lastMid.y) * (cam.w / rect.width));
    lastDist = d; lastMid = m;
  }
});
const endPointer = e => { pointers.delete(e.pointerId); if (dragged) suppressClick = true; if (!pointers.size) { svg.classList.remove('dragging'); dragged = false; } };
svg.addEventListener('pointerup', endPointer); svg.addEventListener('pointercancel', endPointer); svg.addEventListener('lostpointercapture', () => svg.classList.remove('dragging'));
// un glissement qui finit sur un rond ne doit pas ouvrir son article
svg.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
// Ctrl ou ⌘ + molette (et le pincement du pavé tactile) zoome ; la molette seule fait défiler la page normalement
svg.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault(); userMoved();
  const rect = svg.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * 0.0025 * (e.deltaMode === 1 ? 16 : 1)), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
}, { passive: false });
// pincement du pavé tactile sous Safari
let gestureScale = 1;
svg.addEventListener('gesturestart', e => { e.preventDefault(); gestureScale = 1; });
svg.addEventListener('gesturechange', e => { e.preventDefault(); userMoved(); const rect = svg.getBoundingClientRect(); zoomAt(e.scale / gestureScale, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height); gestureScale = e.scale; });
// au clavier : flèches pour se déplacer, + et − pour zoomer, 0 pour tout voir
svg.addEventListener('keydown', e => {
  const s = cam.w * 0.15; let used = true;
  if (e.key === 'ArrowLeft') { userMoved(); panBy(-s, 0); } else if (e.key === 'ArrowRight') { userMoved(); panBy(s, 0); }
  else if (e.key === 'ArrowUp') { userMoved(); panBy(0, -s); } else if (e.key === 'ArrowDown') { userMoved(); panBy(0, s); }
  else if (e.key === '+' || e.key === '=') { userMoved(); zoomAt(1.4, 0.5, 0.5); } else if (e.key === '-' || e.key === '_') { userMoved(); zoomAt(1 / 1.4, 0.5, 0.5); }
  else if (e.key === '0') refit(); else used = false;
  if (used) e.preventDefault();
});

// ---- le tracé : chaque branche part du même point dans sa propre direction, et son cap dérive peu à peu
let plan = { branches: [] };
function planFor(n) {
  const turn = Math.random() * Math.PI * 2;
  plan = { branches: Array.from({ length: n }, (_, b) => ({ angle: turn + (n > 1 ? (b / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25 : 0), w: 0 })) };
}
function branchPos(parent, b) {
  const br = plan.branches[b]; let best = null, bestD = -1;
  for (let i = 0; i < 10; i++) {   // on essaie plusieurs caps et on garde celui qui laisse le plus de place
    const w = clamp(br.w * 0.6 + (Math.random() - 0.5) * 0.9, -0.9, 0.9), a = br.angle + w, r = SPACING * (0.8 + Math.random() * 0.4);
    const p = { x: parent.x + Math.cos(a) * r, y: parent.y + Math.sin(a) * r, w };
    const d = Math.min(...nodes.map(n => Math.hypot(n.x - p.x, n.y - p.y)));
    if (d > bestD) { best = p; bestD = d; }
    if (d > 100) break;
  }
  br.w = best.w;
  return best;
}

const el = (tag, attrs = {}) => { const e = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// b = numéro de la branche (-1 pour le point de départ commun) ; parent = le rond d'où l'on vient
function addNode(title, lang, b, parent) {
  const pos = parent ? branchPos(parent, b) : { x: 0, y: 0 }, id = `clip-${runId}-${nodes.length}`, color = b >= 0 ? COLORS[b % COLORS.length] : ROOT_COLOR;
  if (parent) {
    const mx = (parent.x + pos.x) / 2, my = (parent.y + pos.y) / 2, dx = pos.x - parent.x, dy = pos.y - parent.y, len = Math.hypot(dx, dy);
    const bend = (Math.random() < 0.5 ? -1 : 1) * len * 0.16;
    const path = el('path', { d: `M${parent.x},${parent.y} Q${mx - dy / len * bend},${my + dx / len * bend} ${pos.x},${pos.y}`, class: 'edge' });
    path.style.stroke = color;
    gEdges.appendChild(path);
    path.style.setProperty('--len', path.getTotalLength()); path.classList.add('draw');
    parent.now = false; parent.g.classList.remove('now');
  }
  const clipPath = el('clipPath', { id }), clip = el('circle', { cx: pos.x, cy: pos.y });
  clipPath.appendChild(clip); defs.appendChild(clipPath);
  const g = el('g', { class: 'node pop now' + (b < 0 ? ' start' : '') });
  const a = el('a', { href: pageUrl(lang, title), target: '_blank', rel: 'noopener' });
  const tip = el('title'); tip.textContent = title;
  const base = el('circle', { class: 'base', cx: pos.x, cy: pos.y });
  const init = el('text', { class: 'init', 'text-anchor': 'middle', 'dominant-baseline': 'central' }); init.textContent = title.charAt(0).toUpperCase();
  const img = el('image', { 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMid slice' }); img.style.display = 'none';
  img.addEventListener('error', () => { if (node) { node.imgFailed = true; setCam(cam); } });
  const ring = el('circle', { class: 'ring', cx: pos.x, cy: pos.y }); ring.style.stroke = color;
  const text = el('text', { class: 'label' }); text.textContent = title.length > 22 ? title.slice(0, 21) + '…' : title;
  a.append(tip, base, init, img, ring, text); g.appendChild(a); gNodes.appendChild(g);
  const node = { title, lang, x: pos.x, y: pos.y, g, base, ring, clip, img, init, text, tip, now: true, start: b < 0, i: nodes.length, rpx: 10, info: null, branch: b, parent: parent || null };
  nodes.push(node);
  if (follow) { const f = fitCam(); fitW = f.w; animateCam(f); }
  return node;
}

// la fiche arrive un peu après : on met à jour la vignette, l'info-bulle et, si c'est un bout de branche, sa carte
function attachInfo(node, info) {
  node.info = info;
  if (info.thumb) node.img.setAttribute('href', info.thumb);
  node.tip.textContent = info.description ? `${node.title} — ${info.description}` : node.title;
  setCam(cam);
  const br = node.branch >= 0 ? branches[node.branch] : null;
  if (br && br.tip === node) updateCard(br);
}

// ---- le journal : une ligne par saut, avec un point de la couleur de la branche
function logStep(b, i, from, n, pick, to, lang) {
  const li = document.createElement('li');
  const link = ttl => { const a = document.createElement('a'); a.href = pageUrl(lang, ttl); a.target = '_blank'; a.rel = 'noopener'; a.textContent = ttl; return a; };
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.setProperty('--c', COLORS[b % COLORS.length]); dot.title = t('branchN', { i: b + 1 });
  const dim = document.createElement('span'); dim.className = 'dim';
  dim.textContent = ` — ${t('pagesLinked', { n })} · ${t('draw', { k: pick + 1, n })} → `;
  li.append(dot, `${i}. `, link(from), dim, link(to));
  logEl.prepend(li);
}
function logNote(b, text) {
  const li = document.createElement('li'); li.className = 'dim';
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.setProperty('--c', COLORS[b % COLORS.length]);
  li.append(dot, text); logEl.prepend(li);
}

// ---- la dérive
let ctl = null;
const sleep = (ms, signal) => new Promise((res, rej) => {
  const tm = setTimeout(res, ms);
  signal.addEventListener('abort', () => { clearTimeout(tm); rej(new DOMException('arrêt', 'AbortError')); }, { once: true });
});

// le nombre de sauts autorisé dépend du nombre de dériveurs (total plafonné)
const hopsMaxFor = n => Math.min(MAX_HOPS, Math.floor(MAX_TOTAL / n));
function syncLimits(announce) {
  const n = clamp(Math.round(Number(drifIn.value)) || 1, 1, MAX_DRIFTERS), max = hopsMaxFor(n);
  drifIn.value = n; hopsIn.max = max;
  if (Number(hopsIn.value) > max) { hopsIn.value = max; if (announce && !ctl) failT('capped', () => ({ drifters: driftersOf(n), max })); }
}
syncLimits(false);

async function drift() {
  const lang = langSel.value, delay = Number(speedSel.value);
  syncLimits(false);
  const N = Number(drifIn.value), hopsMax = hopsMaxFor(N);
  let hops = Math.round(Number(hopsIn.value));
  if (!Number.isFinite(hops) || hops < 1) hops = 1;
  if (hops > hopsMax) hops = hopsMax;
  hopsIn.value = hops;
  const title0 = startIn.value.trim();
  if (!title0) { failT('needStart'); return; }
  remember();

  ctl = new AbortController(); const { signal } = ctl;
  goBtn.disabled = true; stopBtn.hidden = false; randBtn.disabled = true;
  logEl.replaceChildren(); runId++; clearMap(); cardsEl.replaceChildren(); branches = [];
  let startTitle = title0, maxDone = 0;
  const visitedBy = new Map();   // page -> branches qui y sont passées
  // chaque page arrivée : on dessine le rond tout de suite, et on va chercher sa fiche sans faire attendre la dérive
  const arrive = (node, page) => getInfo(page.title, lang, signal).then(info => attachInfo(node, info)).catch(e => { if (e.name !== 'AbortError') attachInfo(node, { thumb: null, description: '', sentence: '' }); });
  try {
    sayT('opening', { title: title0 }, ['title']);
    const nsRe = await getNamespaces(lang, signal);
    const root = await getPage(title0, lang, signal, nsRe);
    startTitle = root.title; startIn.value = root.title;
    const rootNode = addNode(root.title, lang, -1, null);
    arrive(rootNode, root);
    if (!root.links.length) { sayT('deadend', { title: root.title }, ['title']); return; }

    planFor(N);
    branches = Array.from({ length: N }, (_, i) => ({ i, color: COLORS[i % COLORS.length], tip: rootNode, cur: root, done: 0, card: null }));
    buildCards(N);
    const status = () => sayT('runStatus', () => ({ drifters: driftersOf(N), start: startTitle, i: maxDone, total: hops }), ['drifters', 'start']);
    status();
    // au premier saut, chacun prend un lien différent : les branches se séparent vraiment
    const first = []; { const pool = root.links.map((_, i) => i); for (let b = 0; b < N; b++) { const j = Math.floor(Math.random() * pool.length); first.push(pool.length ? pool.splice(j, 1)[0] : Math.floor(Math.random() * root.links.length)); } }

    await Promise.all(branches.map(async br => {
      for (let i = 1; i <= hops; i++) {
        if (!br.cur.links.length) { logNote(br.i, t('stuck', { i: br.i + 1, title: br.cur.title })); return; }
        await sleep(delay + br.i * 60, signal);   // un léger décalage : les ronds n'arrivent pas tous au même instant
        // on tire un numéro ; si la page choisie n'existe plus, on en tire un autre (3 essais)
        let next = null, pick = 0, tries = 0, lastErr = null;
        while (!next && tries++ < 3) {
          pick = (i === 1 && tries === 1) ? first[br.i] : Math.floor(Math.random() * br.cur.links.length);
          try { next = await getPage(br.cur.links[pick], lang, signal, nsRe); }
          catch (e) { if (e.name === 'AbortError') throw e; lastErr = e; }
        }
        if (!next) { logNote(br.i, t('branchFailed', { i: br.i + 1, msg: (lastErr && lastErr.message) || '?' })); return; }
        logStep(br.i, i, br.cur.title, br.cur.links.length, pick, next.title, lang);
        const node = addNode(next.title, lang, br.i, br.tip);
        br.tip = node; br.cur = next; br.done = i; maxDone = Math.max(maxDone, i);
        if (!visitedBy.has(next.title)) visitedBy.set(next.title, new Set()); visitedBy.get(next.title).add(br.i);
        updateCard(br); arrive(node, next);
        status();
      }
    }));

    // fin : le bilan
    const ends = new Set(branches.map(b => b.cur.title)).size;
    const meet = [...visitedBy.entries()].filter(([ttl, set]) => set.size > 1 && ttl !== root.title).length;
    lastStatus = () => say(...tparts('doneMulti', { drifters: driftersOf(N), start: startTitle, hops: hopsOf(hops) }, ['drifters', 'start', 'hops']),
      N > 1 ? ' ' + t('spread', { n: ends }) : '', meet ? ' ' + t('meet', { n: meet }) : '');
    lastStatus();
    if (follow) refit();
  } catch (e) {
    if (e.name === 'AbortError') sayT('stopped', () => ({ hops: hopsOf(maxDone) }), ['hops']);
    else failT('failed', () => ({ hops: hopsOf(maxDone), msg: e.message || e }));
  } finally {
    goBtn.disabled = false; stopBtn.hidden = true; randBtn.disabled = false; ctl = null;
  }
}

form.addEventListener('submit', e => { e.preventDefault(); if (!ctl) drift(); });
stopBtn.addEventListener('click', () => ctl && ctl.abort());
randBtn.addEventListener('click', async () => {
  randBtn.disabled = true;
  try { startIn.value = await randomTitle(langSel.value); remember(); }
  catch (e) { failT('randFail'); }
  finally { randBtn.disabled = false; }
});
[startIn, hopsIn, speedSel].forEach(e => e.addEventListener('change', remember));
drifIn.addEventListener('change', () => { syncLimits(true); remember(); });
// l'édition de Wikipédia : si on la change, l'article de départ est traduit (ou remplacé par celui de la langue)
langSel.addEventListener('change', () => { const from = prevEdition; prevEdition = langSel.value; remember(); translateStart(from, prevEdition); });
// la langue de la page : tout est retraduit ; l'édition la suit tant qu'on n'en a pas choisi une autre
uiSel.addEventListener('change', () => {
  const follows = langSel.value === prevUi;
  prevUi = uiSel.value;
  applyUI(uiSel.value);
  if (follows) { const from = prevEdition; langSel.value = uiSel.value; prevEdition = langSel.value; translateStart(from, prevEdition); }
  for (const br of branches) { br.card && (br.card.el.title = t('goBranch')); updateCard(br); }
  if (lastStatus) lastStatus();
  remember();
});
window.addEventListener('resize', () => setCam({ ...cam, h: cam.w / aspect() }));
