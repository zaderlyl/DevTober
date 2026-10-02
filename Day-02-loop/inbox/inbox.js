const big = document.getElementById('big'), list = document.getElementById('list');
const dot = document.getElementById('dot'), status = document.getElementById('status');
let seq = 0, first = true;
const PING = '../ping.php';   // vu depuis le dossier inbox/ (la page est servie avec <base href="inbox/"> par ping.php)

// tout passe par textContent : un message, même piégé, n'est jamais interprété comme du HTML
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function show(e, animate) {
  // le gros titre : le dernier message et combien de fois il est arrivé
  big.replaceChildren();
  big.append(el('div', 'msg', e.msg), el('div', 'times' + (animate ? ' pop' : ''), '× ' + e.count));

  const li = el('li', animate ? 'new' : '');
  const time = new Date(e.t).toLocaleTimeString('fr-FR');
  li.append(
    el('span', 'n', '#' + e.n),
    el('span', 't', time),
    el('span', 'm', e.msg),
    el('span', 'meta', `arrivée n°${e.count} · TTL ${e.ttl}` + (e.id ? ` · paquet ${e.id}` : ''))
  );
  list.prepend(li);
  while (list.children.length > 100) list.lastChild.remove();
}

async function poll() {
  try {
    const res = await fetch(PING + '?live=1&since=' + seq, { cache: 'no-store' });
    const data = await res.json();
    for (const e of data.entries) show(e, !first);
    seq = data.seq;
    first = false;
    dot.classList.add('on');
    status.textContent = 'en direct · ' + seq + ' arrivée' + (seq > 1 ? 's' : '') + ' au total';
  } catch (err) {
    dot.classList.remove('on');
    status.textContent = 'connexion perdue, nouvelle tentative…';
  }
  setTimeout(poll, 1000);
}
poll();
