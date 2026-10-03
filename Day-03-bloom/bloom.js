// Lit l'état de la plante sur le Worker Cloudflare (?state=1) et la dessine. Rien n'est écrit d'ici.
const BLOOM_URL = 'https://devtober-bloom.devtober-lilian.workers.dev';   // valeur par défaut du champ (le Worker déployé)
const POLL_MS = 3000;   // une page ouverte et visible toute la journée fait ~29 000 requêtes (limite gratuite : 100 000 par jour)

const $ = id => document.getElementById(id);
const server = $('server'), statusEl = $('status'), steps = $('steps'), drops = $('drops');

try { server.value = localStorage.getItem('devtober-bloom-url') || BLOOM_URL; } catch (e) { server.value = BLOOM_URL; }
server.addEventListener('change', () => {
  try { localStorage.setItem('devtober-bloom-url', server.value.trim()); } catch (e) {}
  last = null; poll();
});

// position de la plante pour chaque étape (1..5) : hauteur de la tige, feuilles et tête
const HEIGHT = [0, 0, 55, 115, 140, 150];   // index = étape ; hauteur de la tige en pixels du dessin
function draw(stage) {
  const h = HEIGHT[stage];
  $('seed').style.opacity = stage === 1 ? 1 : 0;
  $('stem').style.transform = `scaleY(${h / 150})`;
  $('head').style.transform = `translateY(${220 - h}px)`;
  // feuilles à mi-hauteur de la tige, qui apparaissent à partir de l'étape 3
  const leafY = 220 - h * 0.45, on = stage >= 3;
  for (const id of ['leaf-l', 'leaf-r']) {
    $(id).style.opacity = on ? 1 : 0;
    $(id).style.transform = `translateY(${leafY}px) scale(${on ? 1 : 0.2})`;
  }
  $('bud').style.opacity = stage === 4 ? 1 : 0;
  $('bud').style.transform = stage === 4 ? 'scale(1)' : 'scale(.3)';
  $('flower').style.opacity = stage === 5 ? 1 : 0;
  $('flower').style.transform = stage === 5 ? 'scale(1)' : 'scale(.2)';
}

const NAMES = ['Graine', 'Pousse', 'Tige', 'Bouton', 'Fleur'];
steps.replaceChildren(...NAMES.map(n => { const li = document.createElement('li'); li.textContent = n; return li; }));

function fmtAgo(ms) {
  if (!ms) return 'jamais arrosée';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `arrosée il y a ${s} s`;
  if (s < 3600) return `arrosée il y a ${Math.round(s / 60)} min`;
  return `arrosée le ${new Date(ms).toLocaleString('fr-FR')}`;
}

let last = null;
function show(st) {
  statusEl.classList.remove('bad');
  const waterings = `${st.waterings} arrosage${st.waterings > 1 ? 's' : ''}`;
  statusEl.textContent = `${st.emoji} ${st.name} · ${st.stage}/${st.stages} · ${waterings} · ${fmtAgo(st.lastAt)}`;
  [...steps.children].forEach((li, i) => {
    li.className = i + 1 < st.stage ? 'done' : i + 1 === st.stage ? 'now' : '';
  });
  draw(st.stage);
  if (last && st.waterings > last.waterings) {   // quelqu'un vient d'arroser : un peu de pluie
    drops.classList.remove('rain'); void drops.getBoundingClientRect(); drops.classList.add('rain');
  }
  last = st;
}

async function poll() {
  const url = server.value.trim();
  if (!url) { statusEl.className = 'status bad'; statusEl.textContent = 'Indique l\'URL du Worker (voir le README).'; return; }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'state=1', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    const st = await res.json();
    if (!res.ok || !st.ok) throw new Error(st.error || 'réponse inattendue');
    show(st);
  } catch (e) {
    statusEl.className = 'status bad';
    statusEl.textContent = 'Plante injoignable (Worker déployé ? URL en https ?)';
  }
}

draw(1);
poll();
setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);   // en pause quand l'onglet n'est pas visible
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
