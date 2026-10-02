<?php
// Day 02 - Loop : côté IUT du ping-pong.
//
// Trois usages, selon la façon dont on l'appelle :
//   ping.php?ttl=8&id=A3F9&msg=Salut   -> un saut : renvoie le paquet avec le TTL décrémenté,
//                                         et écrit le message dans la boîte de réception
//   ping.php?live=1&since=12           -> les arrivées depuis la n°12 (utilisé par la page de réception)
//   ping.php  (ouvert dans un navigateur) -> la page de réception, qui se met à jour en direct

// ---- réglages
const ALLOWED_ORIGINS = ['https://zaderlyl.github.io'];  // pages autorisées à écrire un message (+ localhost, pour tester)
const MAX_MSG   = 140;   // longueur max d'un message
const KEEP      = 300;   // nombre d'arrivées conservées
const RATE_MAX  = 120;   // messages écrits par minute et par visiteur
const DATA_FILE = __DIR__ . '/loop-data.php';   // en .php : ouvert directement, il répond 404 au lieu de se laisser lire
const GUARD     = "<?php http_response_code(404); exit; ?>\n";

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// ---- stockage : un fichier JSON verrouillé pendant l'écriture
function read_raw($fh): array {
    $raw = stream_get_contents($fh);
    if ($raw !== false && strncmp($raw, GUARD, strlen(GUARD)) === 0) {
        $raw = substr($raw, strlen(GUARD));
    }
    $data = json_decode((string) $raw, true);
    return is_array($data) ? $data : ['seq' => 0, 'salt' => bin2hex(random_bytes(8)), 'entries' => [], 'rl' => []];
}

function store_snapshot(): array {
    $fh = @fopen(DATA_FILE, 'r');
    if (!$fh) return ['seq' => 0, 'entries' => []];
    flock($fh, LOCK_SH);
    $data = read_raw($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $data;
}

// écrit une arrivée ; renvoie [écrit ?, numéro d'arrivée de ce message, raison du refus]
function store_append(string $id, string $msg, int $ttl, string $ip): array {
    $fh = @fopen(DATA_FILE, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return [false, null, 'écriture impossible sur le serveur'];
    }
    $data = read_raw($fh);

    // limite par visiteur : on ne garde que la minute en cours, et l'adresse n'est jamais stockée en clair
    $win = intdiv(time(), 60);
    $who = substr(sha1($ip . '|' . ($data['salt'] ?? '')), 0, 12);
    $rl  = array_filter($data['rl'] ?? [], fn($v) => ($v['w'] ?? 0) === $win);
    $cur = $rl[$who]['c'] ?? 0;
    if ($cur >= RATE_MAX) {
        flock($fh, LOCK_UN); fclose($fh);
        return [false, null, 'trop de messages, réessaie dans une minute'];
    }
    $rl[$who] = ['w' => $win, 'c' => $cur + 1];

    // numéro d'arrivée : combien de fois ce même paquet (ou, à défaut, ce même texte) est déjà arrivé, plus un
    $key = $id !== '' ? $id : $msg;
    $count = 1;
    foreach ($data['entries'] as $e) {
        if (($e['key'] ?? null) === $key) $count++;
    }

    $data['seq'] = ($data['seq'] ?? 0) + 1;
    $data['entries'][] = [
        'n' => $data['seq'], 'key' => $key, 'id' => $id, 'msg' => $msg,
        'ttl' => $ttl, 'count' => $count, 't' => (int) round(microtime(true) * 1000),
    ];
    $data['entries'] = array_slice($data['entries'], -KEEP);
    $data['rl'] = $rl;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, GUARD . json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return [true, $count, null];
}

function origin_allowed(?string $origin): bool {
    if ($origin === null) return false;
    if (in_array($origin, ALLOWED_ORIGINS, true)) return true;
    $host = parse_url($origin, PHP_URL_HOST);
    return $host === 'localhost' || $host === '127.0.0.1';
}

// ---- 1. les arrivées depuis un numéro donné (pour la page de réception)
if (isset($_GET['live'])) {
    header('Access-Control-Allow-Origin: *');
    header('Content-Type: application/json; charset=utf-8');
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $data = store_snapshot();
    $new = array_values(array_filter($data['entries'], fn($e) => $e['n'] > $since));
    $new = array_map(fn($e) => ['n' => $e['n'], 'id' => $e['id'], 'msg' => $e['msg'], 'ttl' => $e['ttl'], 'count' => $e['count'], 't' => $e['t']], array_slice($new, -50));
    echo json_encode(['seq' => $data['seq'], 'entries' => $new], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- 2. un saut du paquet
if (isset($_GET['ttl'])) {
    header('Access-Control-Allow-Origin: *');          // la page est hébergée sur GitHub Pages, donc une autre origine
    header('Content-Type: application/json; charset=utf-8');

    // plafond : même si on appelle l'URL à la main, un paquet ne vit jamais plus de 32 sauts
    $ttl = max(0, min(32, (int) $_GET['ttl']));

    // identifiant du paquet : renvoyé tel quel, pour prouver que c'est bien le même paquet qui revient
    $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
    if (!preg_match('/^[A-Za-z0-9]{1,16}$/', $id)) $id = '';

    // carnet de bord : la liste des serveurs déjà traversés, ex. "iut@1,github@2"
    $trace = isset($_GET['trace']) ? preg_replace('/[^A-Za-z0-9@,~]/', '', substr((string) $_GET['trace'], 0, 400)) : '';
    $hops = $trace === '' ? [] : array_slice(explode(',', $trace), 0, 40);
    $hops[] = 'iut@' . (count($hops) + 1);

    // le message transporté : sans caractères de contrôle, limité en longueur
    $msg = isset($_GET['msg']) ? (string) $_GET['msg'] : '';
    $msg = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $msg) ?? '');
    $msg = mb_substr($msg, 0, MAX_MSG);

    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null && !preg_match('#^https?://[A-Za-z0-9.:-]{1,100}$#', $origin)) $origin = null;

    // écrit le message dans la boîte de réception (seulement depuis une page autorisée)
    $stored = false; $count = null; $why = null;
    if ($msg !== '') {
        if (!origin_allowed($origin)) {
            $why = 'écriture réservée à la page DevTober';
        } else {
            [$stored, $count, $why] = store_append($id, $msg, $ttl, $_SERVER['REMOTE_ADDR'] ?? '');
        }
    }

    echo json_encode([
        'server'   => 'iut',
        'id'       => $id !== '' ? $id : null,
        'received' => $ttl,
        'ttl'      => max(0, $ttl - 1),
        'trace'    => implode(',', $hops),
        'origin'   => $origin,
        'time'     => (int) round(microtime(true) * 1000),
        'msg'      => $msg !== '' ? $msg : null,
        'stored'   => $stored,
        'count'    => $count,
        'why'      => $why,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- 3. ouvert dans un navigateur : la page de réception
if (stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'text/html') === false) {
    // un outil (curl...) qui n'a rien demandé de précis : on garde l'ancien comportement, un ping à TTL 0
    header('Access-Control-Allow-Origin: *');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['server' => 'iut', 'id' => null, 'received' => 0, 'ttl' => 0, 'trace' => 'iut@1', 'origin' => null, 'time' => (int) round(microtime(true) * 1000)]);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IUT · réception en direct</title>
<style>
  :root { --bg: #1f9d55; --ink: #fff; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { min-height: 100vh; background: var(--bg); color: var(--ink); font-family: ui-monospace, Menlo, monospace; padding: 32px 16px 56px; }
  main { max-width: 760px; margin: 0 auto; }
  .top { display: flex; align-items: center; gap: 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .85; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.35); }
  .dot.on { background: var(--ink); box-shadow: 0 0 10px var(--ink); animation: blink 1.4s infinite; }
  @keyframes blink { 50% { opacity: .35; } }
  h1 { margin-top: 10px; font-size: clamp(26px, 6vw, 40px); }
  .big { margin: 34px 0 6px; min-height: 120px; }
  .big .msg { font-size: clamp(24px, 6vw, 44px); font-weight: 700; word-break: break-word; line-height: 1.15; }
  .big .times { display: inline-block; margin-top: 10px; font-size: clamp(20px, 5vw, 32px); font-weight: 700; background: var(--ink); color: var(--bg); padding: 2px 14px; border-radius: 999px; }
  .big .times.pop { animation: pop .35s ease-out; }
  @keyframes pop { 0% { transform: scale(1.5); } 100% { transform: scale(1); } }
  .empty { font-size: 14px; opacity: .75; line-height: 1.7; max-width: 52ch; }
  .list { list-style: none; margin-top: 26px; font-size: 13px; }
  .list li { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.18); }
  .list li.new { animation: slide .4s ease-out; }
  @keyframes slide { from { opacity: 0; transform: translateY(-8px); } }
  .list .n { opacity: .6; width: 42px; }
  .list .t { opacity: .7; }
  .list .m { flex: 1 1 200px; font-weight: 700; word-break: break-word; }
  .list .meta { opacity: .7; }
  .foot { margin-top: 28px; font-size: 12px; opacity: .65; line-height: 1.7; }
</style>
</head>
<body>
<main>
  <div class="top"><span class="dot" id="dot"></span><span id="status">connexion…</span></div>
  <h1>Réception IUT</h1>

  <div class="big" id="big">
    <p class="empty">Aucun message pour l'instant. Garde cette page ouverte, lance la boucle depuis la page Day 02 : chaque arrivée s'affichera ici en direct.</p>
  </div>

  <ul class="list" id="list"></ul>

  <p class="foot">Les messages sont écrits par la page DevTober Day 02 · seules les 300 dernières arrivées sont conservées.</p>
</main>

<script>
const big = document.getElementById('big'), list = document.getElementById('list');
const dot = document.getElementById('dot'), status = document.getElementById('status');
let seq = 0, first = true;

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
    const res = await fetch('?live=1&since=' + seq, { cache: 'no-store' });
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
</script>
</body>
</html>
