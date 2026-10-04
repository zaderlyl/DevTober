// Day 04 - Drift : on part d'un article Wikipédia ; à chaque étape on compte les pages liées, on tire un numéro
// au hasard et on suit ce lien. X fois. Tout se passe dans le navigateur : l'API de Wikipédia accepte ces appels.

const MAX_HOPS = 40;   // plafond : un saut = deux requêtes (la page, puis sa vignette), on reste poli avec Wikipédia
const NS = /^(Fichier|File|Image|Catégorie|Category|Aide|Help|Wikipédia|Wikipedia|Portail|Portal|Spécial|Special|Modèle|Template|Discussion|Talk|Utilisateur|User|MediaWiki|Projet|Draft|Brouillon|Référence|Module|Média|Media):/i;
const W0 = 800, H0 = 460;   // taille de référence du dessin
const SPACING = 150;        // écart de base entre deux étapes, dans le dessin

const $ = id => document.getElementById(id);
const form = $('form'), startIn = $('start'), hopsIn = $('hops'), langSel = $('lang'), speedSel = $('speed');
const goBtn = $('go'), stopBtn = $('stop'), randBtn = $('rand'), statusEl = $('status'), logEl = $('log');
const card = $('card'), cardImg = $('card-img'), cardTitle = $('card-title'), cardDesc = $('card-desc'), cardText = $('card-text'), cardInit = $('card-init');
const svg = $('map'), svgNS = 'http://www.w3.org/2000/svg';

// ---- mémoire des réglages d'une visite à l'autre
try {
  const s = JSON.parse(localStorage.getItem('devtober-drift') || '{}');
  if (s.start) startIn.value = s.start;
  if (s.hops) hopsIn.value = s.hops;
  if (s.lang) langSel.value = s.lang;
  if (s.speed) speedSel.value = s.speed;
} catch (e) {}
const remember = () => { try { localStorage.setItem('devtober-drift', JSON.stringify({ start: startIn.value, hops: hopsIn.value, lang: langSel.value, speed: speedSel.value })); } catch (e) {} };

// ---- Wikipédia
const api = (lang, params) => `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });

async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wikipédia a répondu HTTP ${res.status}`);
  return res.json();
}

// une page : son titre officiel (après redirection) et la liste de ses pages liées, SANS doublon
async function getPage(title, lang, signal) {
  const j = await getJSON(api(lang, { action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1', disabletoc: '1' }), signal);
  if (j.error) throw new Error(j.error.code === 'missingtitle' ? `l'article « ${title} » n'existe pas` : j.error.info);
  const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
  // on retire ce qui n'est pas « dans le texte » : bandeaux de navigation, notes, références, bandeaux d'aide
  doc.querySelectorAll('.navbox, .reflist, .references, .reference, .mw-editsection, .hatnote, .noprint, .mw-references-wrap, style, script').forEach(n => n.remove());
  const own = j.parse.title, seen = new Set();
  for (const a of doc.querySelectorAll('a[href^="/wiki/"]')) {
    const raw = a.getAttribute('href').slice(6).split('#')[0];
    if (!raw) continue;
    let t; try { t = decodeURIComponent(raw).replace(/_/g, ' '); } catch (e) { continue; }
    if (NS.test(t) || t === own) continue;
    seen.add(t);
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
  let t = text.replace(/\n[\s\S]*/, '');
  for (let i = 0; i < 4; i++) t = t.replace(/\s*\([^()]*\)/g, '');
  t = t.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s+[A-ZÀ-ÝÉ«"“]|$)/);
  let s = m ? m[0] : t;
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
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// ---- la carte : où l'on est, avec sa vignette et sa première phrase
function showCard(node) {
  card.hidden = false;
  cardTitle.textContent = node.title; cardTitle.href = pageUrl(node.lang, node.title);
  const info = node.info;
  cardDesc.textContent = info ? info.description : '';
  cardText.textContent = info ? info.sentence : 'Chargement de la fiche…';
  cardInit.textContent = node.title.charAt(0).toUpperCase();
  if (info && info.thumb) { cardImg.src = info.thumb; cardImg.hidden = false; cardInit.hidden = true; }
  else { cardImg.hidden = true; cardImg.removeAttribute('src'); cardInit.hidden = false; }
  card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
}

// ---- le dessin : un chemin qui s'étire, avec une caméra qui se recadre à chaque saut
const gEdges = document.createElementNS(svgNS, 'g'), gNodes = document.createElementNS(svgNS, 'g'), defs = document.createElementNS(svgNS, 'defs');
svg.append(defs, gEdges, gNodes);
let nodes = [], cam = { x: 0, y: 0, w: W0, h: H0 }, camAnim = 0, runId = 0;

const clearMap = () => { gEdges.replaceChildren(); gNodes.replaceChildren(); defs.replaceChildren(); nodes = []; setCam({ x: 0, y: 0, w: W0, h: H0 }); };

function setCam(c) {
  cam = c;
  svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
  const k = c.w / (svg.getBoundingClientRect().width || W0);   // unités du dessin par pixel d'écran : tailles constantes à l'écran
  svg.style.setProperty('--k', k);
  // rayon des ronds à l'écran : grand quand il y a peu d'étapes, plus petit quand le dessin s'étire
  const rpx = Math.max(7, Math.min(22, 0.3 * SPACING / k));
  for (const n of nodes) {
    n.rpx = (n.now ? 1.25 : 1) * rpx;
    const r = n.rpx * k, showImg = n.info && n.info.thumb && rpx >= 10, showInit = !showImg && rpx >= 11;
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

// Les noms n'apparaissent que s'ils ont la place : l'étape actuelle, le départ, puis les plus récentes sont prioritaires.
// Les autres restent lisibles au survol (info-bulle) et dans le journal.
function placeLabels(k) {
  const px = n => ({ x: (n.x - cam.x) / k, y: (n.y - cam.y) / k });
  const width = svg.getBoundingClientRect().width || W0;
  const boxes = [];
  const order = [...nodes].sort((a, b) => (b.now - a.now) || (b.start - a.start) || (b.i - a.i));
  for (const n of order) {
    const p = px(n), w = n.text.textContent.length * 8.5, base = p.y + (n.i % 2 ? n.rpx + 17 : -(n.rpx + 4));
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

function fitCam() {
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ar = W0 / H0, px = svg.getBoundingClientRect().width || W0;
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  let k = 0.3, target;
  for (let i = 0; i < 4; i++) {   // les ronds et les noms ont une taille fixe à l'écran : on laisse la place qu'il faut, en plusieurs essais
    const padL = 60 * k, padR = 215 * k, padT = 60 * k, padB = 64 * k;
    const bw = w + padL + padR, bh = h + padT + padB;
    const vw = Math.max(bw, bh * ar, 300), vh = vw / ar;
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

// Le tracé est un serpentin qui ondule (on connaît X au départ : il tient toujours dans la zone). La caméra, elle,
// ne cadre que les étapes déjà faites : le dessin s'étire donc à chaque saut.
let plan = { cols: 4, total: 1 };
function layoutPos(i) {
  const D = SPACING, cols = plan.cols, row = Math.floor(i / cols), c = i % cols, col = row % 2 ? cols - 1 - c : c;
  const j = () => (Math.random() - 0.5) * D * 0.42;
  return { x: col * D + j(), y: row * D + Math.sin(col * 1.3 + row) * D * 0.12 + j() };
}
function planFor(hops) {
  const ar = W0 / H0, n = hops + 1;
  plan = { cols: Math.max(3, Math.min(n, Math.ceil(Math.sqrt(n * ar * 0.82)))), total: n };
}

const el = (tag, attrs = {}) => { const e = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

function addNode(title, lang, isStart) {
  const prev = nodes[nodes.length - 1];
  const pos = layoutPos(nodes.length), id = `clip-${runId}-${nodes.length}`;
  if (prev) {
    const mx = (prev.x + pos.x) / 2, my = (prev.y + pos.y) / 2, dx = pos.x - prev.x, dy = pos.y - prev.y, len = Math.hypot(dx, dy);
    const bend = (Math.random() < 0.5 ? -1 : 1) * len * 0.16;
    const path = el('path', { d: `M${prev.x},${prev.y} Q${mx - dy / len * bend},${my + dx / len * bend} ${pos.x},${pos.y}`, class: 'edge' });
    gEdges.appendChild(path);
    path.style.setProperty('--len', path.getTotalLength()); path.classList.add('draw');
    prev.now = false; prev.g.classList.remove('now');
  }
  const clipPath = el('clipPath', { id }), clip = el('circle', { cx: pos.x, cy: pos.y });
  clipPath.appendChild(clip); defs.appendChild(clipPath);
  const g = el('g', { class: 'node pop now' + (isStart ? ' start' : '') });
  const a = el('a', { href: pageUrl(lang, title), target: '_blank', rel: 'noopener' });
  const tip = el('title'); tip.textContent = title;
  const base = el('circle', { class: 'base', cx: pos.x, cy: pos.y });
  const init = el('text', { class: 'init', 'text-anchor': 'middle', 'dominant-baseline': 'central' }); init.textContent = title.charAt(0).toUpperCase();
  const img = el('image', { 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMid slice' }); img.style.display = 'none';
  const ring = el('circle', { class: 'ring', cx: pos.x, cy: pos.y });
  const text = el('text', { class: 'label' }); text.textContent = title.length > 22 ? title.slice(0, 21) + '…' : title;
  a.append(tip, base, init, img, ring, text); g.appendChild(a); gNodes.appendChild(g);
  const node = { title, lang, x: pos.x, y: pos.y, g, base, ring, clip, img, init, text, tip, now: true, start: !!isStart, i: nodes.length, rpx: 10, info: null };
  nodes.push(node);
  animateCam(fitCam());
  showCard(node);
  return node;
}

// la fiche arrive un peu après : on met à jour la vignette, l'info-bulle et, si on y est encore, la carte
function attachInfo(node, info) {
  node.info = info;
  if (info.thumb) node.img.setAttribute('href', info.thumb);
  node.tip.textContent = info.description ? `${node.title} — ${info.description}` : node.title;
  setCam(cam);
  if (node.now) showCard(node);
}

// ---- le journal : une ligne par saut
function logStep(i, from, n, pick, to, lang) {
  const li = document.createElement('li');
  const link = t => { const a = document.createElement('a'); a.href = pageUrl(lang, t); a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; return a; };
  const dim = document.createElement('span'); dim.className = 'dim';
  dim.textContent = ` — ${plural(n, 'page')} liée${n > 1 ? 's' : ''} · tirage n°${pick + 1} sur ${n} → `;
  li.append(`${i}. `, link(from), dim, link(to));
  logEl.prepend(li);
}

// ---- la dérive
let ctl = null;
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('arrêt', 'AbortError')); }, { once: true });
});

async function drift() {
  const lang = langSel.value, delay = Number(speedSel.value);
  let hops = Math.round(Number(hopsIn.value));
  if (!Number.isFinite(hops) || hops < 1) hops = 1;
  if (hops > MAX_HOPS) hops = MAX_HOPS;
  hopsIn.value = hops;
  const title0 = startIn.value.trim();
  if (!title0) { fail('Indique un article de départ.'); return; }
  remember();

  ctl = new AbortController(); const { signal } = ctl;
  goBtn.disabled = true; stopBtn.hidden = false; randBtn.disabled = true;
  logEl.replaceChildren(); runId++; clearMap(); planFor(hops); card.hidden = true;
  let done = 0, startTitle = title0, revisits = 0;
  const visited = new Set();
  // chaque page arrivée : on dessine le rond tout de suite, et on va chercher sa fiche sans faire attendre la dérive
  const arrive = (page, isStart) => {
    const node = addNode(page.title, lang, isStart);
    getInfo(page.title, lang, signal).then(info => attachInfo(node, info)).catch(e => { if (e.name !== 'AbortError') attachInfo(node, { thumb: null, description: '', sentence: '' }); });
  };
  try {
    say('Ouverture de ', { b: title0 }, '…');
    let cur = await getPage(title0, lang, signal);
    startTitle = cur.title; startIn.value = cur.title; visited.add(cur.title);
    arrive(cur, true);
    say('Tu es parti de ', { b: startTitle }, ', tu es maintenant à ', { b: startTitle }, ', à ', { b: '0 saut' }, '.');

    for (let i = 1; i <= hops; i++) {
      if (!cur.links.length) {
        say('Impasse : ', { b: cur.title }, ' ne contient aucun lien. La dérive s\'arrête après ', { b: plural(done, 'saut') }, '.');
        return;
      }
      await sleep(delay, signal);
      // on tire un numéro ; si la page choisie n'existe plus, on en tire un autre (3 essais)
      let next = null, pick = 0, tries = 0;
      while (!next && tries++ < 3) {
        pick = Math.floor(Math.random() * cur.links.length);
        try { next = await getPage(cur.links[pick], lang, signal); }
        catch (e) { if (e.name === 'AbortError') throw e; if (tries >= 3) throw e; }
      }
      logStep(i, cur.title, cur.links.length, pick, next.title, lang);
      if (visited.has(next.title)) revisits++; visited.add(next.title);
      cur = next; done = i;
      arrive(cur, false);
      say('Tu es parti de ', { b: startTitle }, ', tu es maintenant à ', { b: cur.title }, ', à ', { b: plural(done, 'saut') }, ` (sur ${hops}).`);
    }
    say('Terminé : parti de ', { b: startTitle }, ', arrivé à ', { b: cur.title }, ' après ', { b: plural(hops, 'saut') }, '.' + (revisits ? ` Tu es repassé ${revisits} fois par une page déjà visitée.` : ''));
  } catch (e) {
    if (e.name === 'AbortError') say(`Arrêté après ${plural(done, 'saut')}.`);
    else fail(`La dérive s'est interrompue après ${plural(done, 'saut')} : ${e.message || e}`);
  } finally {
    goBtn.disabled = false; stopBtn.hidden = true; randBtn.disabled = false; ctl = null;
  }
}

form.addEventListener('submit', e => { e.preventDefault(); if (!ctl) drift(); });
stopBtn.addEventListener('click', () => ctl && ctl.abort());
randBtn.addEventListener('click', async () => {
  randBtn.disabled = true;
  try { startIn.value = await randomTitle(langSel.value); remember(); }
  catch (e) { fail('Impossible de tirer un article au hasard pour l\'instant.'); }
  finally { randBtn.disabled = false; }
});
[startIn, hopsIn, langSel, speedSel].forEach(el => el.addEventListener('change', remember));
window.addEventListener('resize', () => setCam(cam));
