<?php
// Essai : recevoir un fichier texte (.txt ou .html) envoyé depuis une page hébergée ailleurs (GitHub Pages).
// Un .html est accepté mais jamais conservé comme tel : il est rangé sous un nom .txt et relu en texte brut,
// pour qu'il ne puisse jamais s'exécuter sur ce domaine (web-mmi2 est partagé par tous les étudiants).
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
const NAME_RE    = '/^\d{8}-\d{6}-[a-f0-9]{8}\.txt$/';   // le seul format de nom que ce script crée et accepte de lire
const GUARD      = "<?php http_response_code(404); exit; ?>\n";

header('Access-Control-Allow-Origin: *');  // la page est sur une autre origine : elle doit pouvoir lire la réponse
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function fail(int $code, string $msg) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
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
    foreach (is_dir(DIR) ? scandir(DIR, SCANDIR_SORT_DESCENDING) : [] as $f) {
        if (!preg_match(NAME_RE, $f)) continue;
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

// le nom envoyé sert seulement à vérifier l'extension : le fichier est toujours enregistré sous un nom choisi ici,
// et toujours en .txt, même quand c'est du HTML
if (!preg_match('/\.(txt|html)$/i', (string) ($f['name'] ?? ''), $ext)) fail(400, 'seuls les fichiers .txt et .html sont acceptés');
$kind = strtolower($ext[1]);
$size = (int) ($f['size'] ?? 0);
if ($size < 1) fail(400, 'fichier vide');
if ($size > MAX_BYTES) fail(400, 'fichier trop gros (max 20 Ko)');

$content = (string) file_get_contents($f['tmp_name']);
if (strlen($content) < 1 || strlen($content) > MAX_BYTES) fail(400, 'taille invalide');
// du vrai texte : pas d'octet nul (signe d'un fichier binaire) et de l'UTF-8 valide
if (strpos($content, "\0") !== false || !mb_check_encoding($content, 'UTF-8')) fail(400, 'ce fichier n\'est pas du texte UTF-8');

$name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.txt';
if (file_put_contents(DIR . '/' . $name, $content, LOCK_EX) === false) fail(500, 'écriture impossible');

// on garde les KEEP_FILES derniers fichiers
$files = array_values(array_filter(scandir(DIR), fn($x) => preg_match(NAME_RE, $x)));
sort($files);
foreach (array_slice($files, 0, max(0, count($files) - KEEP_FILES)) as $old) @unlink(DIR . '/' . $old);

http_response_code(201);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok'      => true,
    'name'    => $name,
    'kind'    => $kind,                    // ce qui a été envoyé ; dans tous les cas, c'est rangé comme texte brut
    'bytes'   => strlen($content),
    'lines'   => substr_count(rtrim($content, "\n"), "\n") + 1,
    'sha256'  => hash('sha256', $content),   // empreinte du contenu reçu : la page la compare à la sienne
    'preview' => mb_substr($content, 0, 200),
    'time'    => (int) round(microtime(true) * 1000),
], JSON_UNESCAPED_UNICODE);
