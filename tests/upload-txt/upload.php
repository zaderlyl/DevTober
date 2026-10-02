<?php
// Essai : recevoir un .txt envoyé depuis une page hébergée ailleurs (GitHub Pages).
// Chaque fichier est rangé sous le nom « pseudo GitHub de l'expéditeur + heure et date », ex. zaderlyl_15h42.02.10.2026.txt
//
//   POST upload.php             (multipart, champ "file")  -> enregistre le fichier et renvoie un reçu
//   GET  upload.php?list=1                                 -> les derniers fichiers reçus
//   GET  upload.php?file=NOM                               -> le contenu d'un fichier reçu (en texte brut)

// ---- réglages
const ALLOWED_ORIGINS = ['https://zaderlyl.github.io'];  // pages autorisées à envoyer (+ localhost, pour tester)
const MAX_BYTES  = 20480;                  // 20 Ko
const KEEP_FILES = 50;                     // les plus anciens sont supprimés au-delà
const RATE_MAX   = 10;                     // envois par minute et par visiteur
const DIR        = __DIR__ . '/uploads';
// les seuls formats de nom que ce script crée et accepte de lire (aucun chemin, aucun « .. » possible) :
//   zaderlyl_15h42.02.10.2026.txt   (pseudo, heure, date ; « -2 » si deux envois dans la même minute)
//   20261002-154317-d9ae8adb.txt    (ancien format, pour que les anciens fichiers restent lisibles)
const NAME_RE    = '/^(?:[a-z0-9-]{1,39}_\d{2}h\d{2}\.\d{2}\.\d{2}\.\d{4}(?:-\d{1,2})?|\d{8}-\d{6}-[a-f0-9]{8}(?:-[a-z0-9_-]{1,30}\.(?:txt|html))?)\.txt$/';
const GUARD      = "<?php http_response_code(404); exit; ?>\n";

date_default_timezone_set('Europe/Paris');
header('Access-Control-Allow-Origin: *');  // la page est sur une autre origine : elle doit pouvoir lire la réponse
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function fail(int $code, string $msg) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// les fichiers reçus, du plus récent au plus ancien (le nom ne contient plus la date en premier : on trie sur la date du fichier)
function received_files(): array {
    $files = array_values(array_filter(is_dir(DIR) ? scandir(DIR) : [], fn($x) => preg_match(NAME_RE, $x)));
    usort($files, fn($a, $b) => filemtime(DIR . '/' . $b) <=> filemtime(DIR . '/' . $a) ?: strcmp($b, $a));
    return $files;
}

// le pseudo GitHub se déduit de la page d'où vient l'envoi : https://PSEUDO.github.io -> PSEUDO (en local : « local »)
function pseudo_from_origin(?string $origin): string {
    $host = strtolower((string) parse_url((string) $origin, PHP_URL_HOST));
    return preg_match('/^([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\.github\.io$/', $host, $m) ? $m[1] : 'local';
}

function origin_allowed(?string $origin): bool {
    if ($origin === null) return false;
    if (in_array($origin, ALLOWED_ORIGINS, true)) return true;
    $host = parse_url($origin, PHP_URL_HOST);
    return $host === 'localhost' || $host === '127.0.0.1';
}

// ---- 1. lire un fichier reçu : toujours en texte brut, jamais interprété
if (isset($_GET['file'])) {
    $name = (string) $_GET['file'];
    // le nom doit avoir exactement le format généré par ce script : aucun chemin, aucun "..", aucun autre fichier
    if (!preg_match(NAME_RE, $name) || !is_file(DIR . '/' . $name)) fail(404, 'fichier introuvable');
    header('Content-Type: text/plain; charset=utf-8');
    header("Content-Security-Policy: default-src 'none'");
    readfile(DIR . '/' . $name);
    exit;
}

// ---- 2. la liste des derniers fichiers
if (isset($_GET['list'])) {
    header('Content-Type: application/json; charset=utf-8');
    $out = [];
    foreach (received_files() as $f) {
        $content = (string) file_get_contents(DIR . '/' . $f, false, null, 0, 400);
        $out[] = ['name' => $f, 'size' => filesize(DIR . '/' . $f), 'time' => filemtime(DIR . '/' . $f) * 1000,
                  'preview' => mb_substr(trim($content), 0, 120)];
        if (count($out) >= KEEP_FILES) break;
    }
    echo json_encode(['ok' => true, 'files' => $out], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- 3. recevoir un fichier
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'envoie un fichier avec POST');

$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if (!origin_allowed($origin)) fail(403, 'envoi réservé à la page DevTober');

// limite par visiteur ; l'adresse n'est jamais écrite en clair, et le fichier de compteurs répond 404 s'il est ouvert
function rate_ok(string $ip): bool {
    $path = DIR . '/rate.php';
    $fh = @fopen($path, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) return true;   // si le compteur est indisponible, on ne bloque pas
    $raw = (string) stream_get_contents($fh);
    if (strncmp($raw, GUARD, strlen(GUARD)) === 0) $raw = substr($raw, strlen(GUARD));
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = ['salt' => bin2hex(random_bytes(8)), 'rl' => []];
    $win = intdiv(time(), 60);
    $who = substr(sha1($ip . '|' . $data['salt']), 0, 12);
    $rl = array_filter($data['rl'], fn($v) => ($v['w'] ?? 0) === $win);
    $cur = $rl[$who]['c'] ?? 0;
    $ok = $cur < RATE_MAX;
    if ($ok) $rl[$who] = ['w' => $win, 'c' => $cur + 1];
    $data['rl'] = $rl;
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, GUARD . json_encode($data));
    flock($fh, LOCK_UN); fclose($fh);
    return $ok;
}

if (!is_dir(DIR)) {
    if (!@mkdir(DIR, 0755, true)) fail(500, 'impossible de créer le dossier uploads/ (droits d\'écriture ?)');
    @file_put_contents(DIR . '/index.html', '');    // évite l'affichage du contenu du dossier
}
if (!is_writable(DIR)) fail(500, 'le dossier uploads/ n\'est pas accessible en écriture');
if (!rate_ok($_SERVER['REMOTE_ADDR'] ?? '')) fail(429, 'trop d\'envois, réessaie dans une minute');

$f = $_FILES['file'] ?? null;
if (!$f || !is_array($f) || !isset($f['error'])) fail(400, 'aucun fichier reçu (champ "file")');
if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) fail(400, 'fichier trop gros (max 20 Ko)');
if ($f['error'] !== UPLOAD_ERR_OK) fail(400, 'envoi interrompu (code ' . (int) $f['error'] . ')');

// le nom envoyé sert seulement à vérifier l'extension : le fichier est toujours enregistré sous un nom choisi ici
if (!preg_match('/\.txt$/i', (string) ($f['name'] ?? ''))) fail(400, 'seuls les fichiers .txt sont acceptés');
$size = (int) ($f['size'] ?? 0);
if ($size < 1) fail(400, 'fichier vide');
if ($size > MAX_BYTES) fail(400, 'fichier trop gros (max 20 Ko)');

$content = (string) file_get_contents($f['tmp_name']);
if (strlen($content) < 1 || strlen($content) > MAX_BYTES) fail(400, 'taille invalide');
// du vrai texte : pas d'octet nul (signe d'un fichier binaire) et de l'UTF-8 valide
if (strpos($content, "\0") !== false || !mb_check_encoding($content, 'UTF-8')) fail(400, 'ce fichier n\'est pas du texte UTF-8');

// nom = pseudo GitHub + heure + date, ex. zaderlyl_15h42.02.10.2026.txt (le « : » de 15:42 est remplacé par « h » : il est interdit dans les noms de fichiers)
$stem = pseudo_from_origin($origin) . '_' . date('H\hi.d.m.Y');
$name = $stem . '.txt';
for ($i = 2; is_file(DIR . '/' . $name) && $i < 100; $i++) $name = $stem . '-' . $i . '.txt';   // deux envois dans la même minute : -2, -3…
if (file_put_contents(DIR . '/' . $name, $content, LOCK_EX) === false) fail(500, 'écriture impossible');

// on garde les KEEP_FILES derniers fichiers
foreach (array_slice(received_files(), KEEP_FILES) as $old) @unlink(DIR . '/' . $old);

http_response_code(201);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok'      => true,
    'name'    => $name,
    'bytes'   => strlen($content),
    'lines'   => substr_count(rtrim($content, "\n"), "\n") + 1,
    'sha256'  => hash('sha256', $content),   // empreinte du contenu reçu : la page la compare à la sienne
    'preview' => mb_substr($content, 0, 200),
    'time'    => (int) round(microtime(true) * 1000),
], JSON_UNESCAPED_UNICODE);
