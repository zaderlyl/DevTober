<?php
// Day 02 - Loop : côté IUT du ping-pong.
// Reçoit un paquet (id, ttl, trace), le renvoie avec le TTL décrémenté et son propre passage ajouté à la trace.
// Le navigateur fait le relais avec GitHub : ce fichier ne parle qu'à lui.

header('Access-Control-Allow-Origin: *');          // la page est hébergée sur GitHub Pages, donc une autre origine
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// plafond : même si on appelle l'URL à la main, un paquet ne vit jamais plus de 32 sauts
$ttl = isset($_GET['ttl']) ? (int) $_GET['ttl'] : 0;
$ttl = max(0, min(32, $ttl));

// identifiant du paquet : renvoyé tel quel, pour prouver que c'est bien le même paquet qui revient
$id = isset($_GET['id']) ? (string) $_GET['id'] : '';
if (!preg_match('/^[A-Za-z0-9]{1,16}$/', $id)) {
    $id = null;
}

// carnet de bord : la liste des serveurs déjà traversés, ex. "iut@1,github@2"
$trace = isset($_GET['trace']) ? preg_replace('/[^A-Za-z0-9@,~]/', '', substr((string) $_GET['trace'], 0, 400)) : '';
$hops = $trace === '' ? [] : array_slice(explode(',', $trace), 0, 40);
$hops[] = 'iut@' . (count($hops) + 1);

// d'où vient la requête, vu depuis ce serveur
$origin = isset($_SERVER['HTTP_ORIGIN']) && preg_match('#^https?://[A-Za-z0-9.:-]{1,100}$#', $_SERVER['HTTP_ORIGIN'])
    ? $_SERVER['HTTP_ORIGIN']
    : null;

echo json_encode([
    'server'   => 'iut',
    'id'       => $id,
    'received' => $ttl,
    'ttl'      => max(0, $ttl - 1),
    'trace'    => implode(',', $hops),
    'origin'   => $origin,
    'time'     => (int) round(microtime(true) * 1000),
]);
