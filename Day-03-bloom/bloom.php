<?php
// Day 03 - Bloom : le « bot » Discord. Pas de programme qui tourne en permanence : Discord appelle ce script
// (Interactions Endpoint URL) à chaque commande /arroser, /plante ou /graine, et affiche ce qu'il répond.
//
//   POST bloom.php           Discord -> une commande ; la signature Ed25519 est vérifiée avant toute chose
//   GET  bloom.php?state=1   l'état de la plante en JSON (lu par la page bloom.html)
//   GET  bloom.php           un petit diagnostic (PHP, extension sodium)

// ---- réglages
const PUBLIC_KEY = 'ab4636713fd09b3b530cc509f174d47d60d954000c8ba1051f2271f3068116ec';  // clé PUBLIQUE de l'application Discord (pas un secret)
const PER_STAGE  = 1;                      // arrosages nécessaires pour passer à l'étape suivante (1 pour le test)
const DATA       = __DIR__ . '/bloom-data.php';
const GUARD      = "<?php http_response_code(404); exit; ?>\n";   // le fichier de données répond 404 s'il est ouvert
const STAGES     = [
    ['emoji' => '🌰', 'name' => 'Graine'],
    ['emoji' => '🌱', 'name' => 'Pousse'],
    ['emoji' => '🌿', 'name' => 'Tige'],
    ['emoji' => '🌷', 'name' => 'Bouton'],
    ['emoji' => '🌸', 'name' => 'Fleur'],
];

date_default_timezone_set('Europe/Paris');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function json_out(int $code, array $data): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- l'état de la plante : un petit fichier, verrouillé pendant qu'on le lit et le réécrit
function with_state(callable $fn) {
    $fh = @fopen(DATA, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) json_out(500, ['ok' => false, 'error' => 'écriture impossible sur le serveur (droits du dossier ?)']);
    $raw = (string) stream_get_contents($fh);
    if (strncmp($raw, GUARD, strlen(GUARD)) === 0) $raw = substr($raw, strlen(GUARD));
    $s = json_decode($raw, true);
    if (!is_array($s)) $s = [];
    $s += ['stage' => 0, 'progress' => 0, 'waterings' => 0, 'lastAt' => 0];
    $s['stage'] = max(0, min(count(STAGES) - 1, (int) $s['stage']));
    $result = $fn($s);   // $s est modifié par référence si besoin
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, GUARD . json_encode($s));
    flock($fh, LOCK_UN); fclose($fh);
    return $result;
}

function public_state(array $s): array {
    return [
        'ok'        => true,
        'stage'     => $s['stage'] + 1,                 // 1..5
        'stages'    => count(STAGES),
        'name'      => STAGES[$s['stage']]['name'],
        'emoji'     => STAGES[$s['stage']]['emoji'],
        'progress'  => $s['progress'],
        'perStage'  => PER_STAGE,
        'bloomed'   => $s['stage'] === count(STAGES) - 1,
        'waterings' => $s['waterings'],
        'lastAt'    => $s['lastAt'] * 1000,
    ];
}

function status_line(array $s): string {
    $i = $s['stage'];
    return STAGES[$i]['emoji'] . ' ' . STAGES[$i]['name'] . ' · ' . ($i + 1) . '/' . count(STAGES) . '  '
         . str_repeat('▰', $i + 1) . str_repeat('▱', count(STAGES) - $i - 1);
}

function reply(string $text, bool $private = false): void {
    json_out(200, ['type' => 4, 'data' => ['content' => $text] + ($private ? ['flags' => 64] : [])]);
}

// ---- GET : l'état pour la page, ou un diagnostic
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    header('Access-Control-Allow-Origin: *');   // la page est sur GitHub Pages : elle doit pouvoir lire la réponse
    if (isset($_GET['state'])) json_out(200, with_state(fn(array &$s) => public_state($s)));
    json_out(200, ['ok' => true, 'service' => 'bloom', 'php' => PHP_VERSION, 'sodium' => function_exists('sodium_crypto_sign_verify_detached')]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(405, ['ok' => false, 'error' => 'méthode non acceptée']);

// ---- POST : doit venir de Discord. On vérifie la signature de la requête avant de lire quoi que ce soit.
if (!function_exists('sodium_crypto_sign_verify_detached')) json_out(500, ['ok' => false, 'error' => 'extension PHP sodium absente sur ce serveur']);
$body = (string) file_get_contents('php://input', false, null, 0, 20001);
if (strlen($body) > 20000) json_out(413, ['ok' => false, 'error' => 'requête trop grosse']);
$sig = (string) ($_SERVER['HTTP_X_SIGNATURE_ED25519'] ?? '');
$ts  = (string) ($_SERVER['HTTP_X_SIGNATURE_TIMESTAMP'] ?? '');
$ok = ctype_xdigit($sig) && strlen($sig) === 128 && $ts !== ''
   && @sodium_crypto_sign_verify_detached(hex2bin($sig), $ts . $body, hex2bin(PUBLIC_KEY));
if (!$ok) json_out(401, ['ok' => false, 'error' => 'signature invalide']);   // Discord teste volontairement ce refus à l'enregistrement de l'URL

$in = json_decode($body, true);
if (!is_array($in)) json_out(400, ['ok' => false, 'error' => 'JSON invalide']);

// le test de Discord : « ping » -> « pong »
if (($in['type'] ?? 0) === 1) json_out(200, ['type' => 1]);

if (($in['type'] ?? 0) !== 2) json_out(400, ['ok' => false, 'error' => 'interaction non gérée']);
$cmd = (string) ($in['data']['name'] ?? '');

if ($cmd === 'arroser') {
    $r = with_state(function (array &$s) {
        if ($s['stage'] >= count(STAGES) - 1) return ['done' => true, 's' => $s];
        $s['waterings']++; $s['lastAt'] = time(); $s['progress']++;
        if ($s['progress'] >= PER_STAGE) { $s['stage']++; $s['progress'] = 0; }
        return ['done' => false, 's' => $s];
    });
    if ($r['done']) reply("🌸 La fleur est déjà éclose ! Elle n'a plus besoin d'eau. Utilise /graine pour replanter.");
    $s = $r['s'];
    $bloom = $s['stage'] === count(STAGES) - 1;
    reply("💧 Arrosé !\n" . status_line($s) . ($bloom ? "\n🎉 La plante a fleuri !" : ''));
}
if ($cmd === 'plante') {
    $s = with_state(fn(array &$s) => $s);
    reply(status_line($s) . "\n" . $s['waterings'] . ' arrosage' . ($s['waterings'] > 1 ? 's' : '') . ' au total');
}
if ($cmd === 'graine') {
    $s = with_state(function (array &$s) { $s = ['stage' => 0, 'progress' => 0, 'waterings' => 0, 'lastAt' => 0]; return $s; });
    reply("🌰 Une nouvelle graine est plantée.\n" . status_line($s));
}
reply('Commande inconnue.', true);
