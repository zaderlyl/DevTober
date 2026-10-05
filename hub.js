// Pour ajouter un projet : renseigner le chemin de sa page à côté du mot.
const DAYS = [
  { word: 'Pulse', path: 'Day-01-pulse/pulse.html' },
  { word: 'Loop', path: 'Day-02-loop/loop.html' },
  { word: 'Bloom', path: 'Day-03-bloom/bloom.html' },
  { word: 'Drift', path: 'Day-04-drift/drift.html' },
  { word: 'Chaos', path: 'Day-05-chaos/chaos.html' },
  { word: 'Tiny' },
  { word: 'Swarm' },
  { word: 'Maze' },
  { word: 'Gravity' },
  { word: 'Fold' },
  { word: 'Ripple' },
  { word: 'Lost' },
  { word: 'Tangle' },
  { word: 'Bounce' },
  { word: 'Shadow' },
  { word: 'Tide' },
  { word: 'Orbit' },
  { word: 'Glitch' },
  { word: 'Echo' },
  { word: 'Fragile' },
  { word: 'Signal' },
  { word: 'Mirror' },
  { word: 'Spark' },
  { word: 'Hidden' },
  { word: 'Melt' },
  { word: 'Machine' },
  { word: 'Haunted' },
  { word: 'Grow' },
  { word: 'Infinite' },
  { word: 'Collapse' },
  { word: 'Wake' },
];

// le jour du mois, uniquement en octobre 2026
const now = new Date();
const today = now.getFullYear() === 2026 && now.getMonth() === 9 ? now.getDate() : null;

const grid = document.getElementById('grid');
DAYS.forEach((d, i) => {
  const n = i + 1;
  const li = document.createElement('li');
  const el = document.createElement(d.path ? 'a' : 'div');
  el.className = 'day ' + (d.path ? 'done' : 'pending') + (n === today ? ' today' : '');
  if (d.path) el.href = d.path;
  el.innerHTML =
    `<span class="num">${String(n).padStart(2, '0')}</span>` +
    `<span class="word">${d.word}</span>` +
    `<span class="state">${d.path ? 'ouvrir' : n === today ? 'aujourd\'hui' : 'à venir'}</span>`;
  li.appendChild(el);
  grid.appendChild(li);
});

const done = DAYS.filter(d => d.path).length;
document.getElementById('count').textContent = `${done} / ${DAYS.length} projets`;
