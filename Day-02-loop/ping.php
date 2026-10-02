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

// la page est dans inbox/ (HTML, CSS et JS séparés) ; ses liens sont relatifs à ce fichier, d'où le dossier à côté de ping.php
$page = __DIR__ . '/inbox/inbox.html';
if (!is_readable($page)) {
    http_response_code(500);
    echo 'Dossier inbox/ manquant à côté de ping.php.';
    exit;
}
readfile($page);
