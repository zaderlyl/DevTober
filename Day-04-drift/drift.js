// Day 04 - Drift : on part d'un article Wikipédia ; à chaque étape on compte les pages liées, on tire un numéro
// au hasard et on suit ce lien. X fois. Tout se passe dans le navigateur : l'API de Wikipédia accepte ces appels.

const MAX_HOPS = 40;   // plafond : un saut = une requête, on reste poli avec Wikipédia
const NS = /^(Fichier|File|Image|Catégorie|Category|Aide|Help|Wikipédia|Wikipedia|Portail|Portal|Spécial|Special|Modèle|Template|Discussion|Talk|Utilisateur|User|MediaWiki|Projet|Draft|Brouillon|Référence|Module|Média|Media):/i;
const W0 = 800, H0 = 460;   // taille de référence du dessin

const $ = id => document.getElementById(id);
const form = $('form'), startIn = $('start'), hopsIn = $('hops'), langSel = $('lang'), speedSel = $('speed');
const goBtn = $('go'), stopBtn = $('stop'), randBtn = $('rand'), statusEl = $('status'), logEl = $('log');
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

// ---- le dessin : un chemin qui s'étire, avec une caméra qui se recadre à chaque saut
const gEdges = document.createElementNS(svgNS, 'g'), gNodes = document.createElementNS(svgNS, 'g');
svg.append(gEdges, gNodes);
let nodes = [], cam = { x: 0, y: 0, w: W0, h: H0 }, camAnim = 0;

const clearMap = () => { gEdges.replaceChildren(); gNodes.replaceChildren(); nodes = []; setCam({ x: 0, y: 0, w: W0, h: H0 }); };

function setCam(c) {
  cam = c;
  svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
  const k = c.w / (svg.getBoundingClientRect().width || W0);   // unités du dessin par pixel d'écran : tailles constantes à l'écran
  svg.style.setProperty('--k', k);
  for (const n of nodes) {
    n.text.setAttribute('x', n.x + 13 * k); n.text.setAttribute('y', n.y + (n.i % 2 ? 24 : -11) * k);   // au-dessus, puis en dessous
    n.circle.setAttribute('r', (n.now ? 9 : 7) * k);
    n.circle.style.strokeWidth = (n.now ? 4 : 2.5) * k;
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
    const p = px(n), w = n.text.textContent.length * 8.5, base = p.y + (n.i % 2 ? 24 : -11);
    let placed = false;
    for (const side of [1, -1]) {   // à droite du rond, sinon à gauche (si ça dépasse du bord)
      const box = side > 0 ? { x0: p.x + 11, x1: p.x + 15 + w } : { x0: p.x - 15 - w, x1: p.x - 11 };
      box.y0 = base - 14; box.y1 = base + 5;
      if (box.x0 < 2 || box.x1 > width - 2) continue;
      const hit = boxes.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)
        || nodes.some(o => { if (o === n) return false; const q = px(o); return q.x > box.x0 - 8 && q.x < box.x1 + 8 && q.y > box.y0 - 8 && q.y < box.y1 + 8; });
      if (hit) continue;
      n.text.setAttribute('x', n.x + side * 13 * k); n.text.setAttribute('text-anchor', side > 0 ? 'start' : 'end');
      boxes.push(box); placed = true; break;
    }
    n.text.style.display = placed ? '' : 'none';
  }
}

function fitCam() {
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ar = W0 / H0, px = svg.getBoundingClientRect().width || W0;
  let w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  let k = 0.3;
  for (let i = 0; i < 4; i++) {   // les étiquettes ont une taille fixe à l'écran : on laisse la place qu'il faut, en deux ou trois essais
    const padL = 40 * k, padR = 200 * k, padT = 34 * k, padB = 44 * k;
    const bw = w + padL + padR, bh = h + padT + padB;
    const vw = Math.max(bw, bh * ar, 300), vh = vw / ar;
    k = vw / px;
    var target = { x: x0 - padL - (vw - bw) / 2, y: y0 - padT - (vh - bh) / 2, w: vw, h: vh };
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
  const D = 150, ar = W0 / H0;
  const cols = plan.cols, row = Math.floor(i / cols), c = i % cols, col = row % 2 ? cols - 1 - c : c;
  const j = () => (Math.random() - 0.5) * D * 0.42;
  return { x: col * D + j(), y: row * D + Math.sin(col * 1.3 + row) * D * 0.12 + j() };
}
function planFor(hops) {
  const ar = W0 / H0, n = hops + 1;
  plan = { cols: Math.max(3, Math.min(n, Math.ceil(Math.sqrt(n * ar * 0.82)))), total: n };
}

function addNode(title, lang, isStart) {
  const prev = nodes[nodes.length - 1];
  const pos = layoutPos(nodes.length);
  if (prev) {
    const mx = (prev.x + pos.x) / 2, my = (prev.y + pos.y) / 2, dx = pos.x - prev.x, dy = pos.y - prev.y, len = Math.hypot(dx, dy);
    const bend = (Math.random() < 0.5 ? -1 : 1) * len * 0.16;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', `M${prev.x},${prev.y} Q${mx - dy / len * bend},${my + dx / len * bend} ${pos.x},${pos.y}`);
    path.setAttribute('class', 'edge');
    gEdges.appendChild(path);
    const L = path.getTotalLength(); path.style.setProperty('--len', L); path.classList.add('draw');
    prev.now = false; prev.g.classList.remove('now');
  }
  const g = document.createElementNS(svgNS, 'g'); g.setAttribute('class', 'node pop now' + (isStart ? ' start' : ''));
  const a = document.createElementNS(svgNS, 'a'); a.setAttribute('href', pageUrl(lang, title)); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
  const circle = document.createElementNS(svgNS, 'circle'), text = document.createElementNS(svgNS, 'text');
  text.textContent = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const tip = document.createElementNS(svgNS, 'title'); tip.textContent = title;
  a.append(tip, circle, text); g.appendChild(a); gNodes.appendChild(g);
  circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y);
  const node = { x: pos.x, y: pos.y, g, circle, text, now: true, start: !!isStart, i: nodes.length };
  nodes.push(node);
  animateCam(fitCam());
  return node;
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
  logEl.replaceChildren(); clearMap(); planFor(hops);
  let done = 0, startTitle = title0, revisits = 0;
  const visited = new Set();
  try {
    say('Ouverture de ', { b: title0 }, '…');
    let cur = await getPage(title0, lang, signal);
    startTitle = cur.title; startIn.value = cur.title; visited.add(cur.title);
    addNode(cur.title, lang, true);
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
      addNode(cur.title, lang, false);
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
