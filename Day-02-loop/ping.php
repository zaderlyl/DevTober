<?php
// Day 02 - Loop : côté IUT du ping-pong.
// Reçoit un TTL, répond avec le TTL décrémenté. Le navigateur fait le relais avec GitHub.

header('Access-Control-Allow-Origin: *');          // la page est hébergée sur GitHub Pages, donc une autre origine
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// plafond : même si on appelle l'URL à la main, un paquet ne vit jamais plus de 32 sauts
$ttl = isset($_GET['ttl']) ? (int) $_GET['ttl'] : 0;
$ttl = max(0, min(32, $ttl));

echo json_encode([
    'server'   => 'iut',
    'received' => $ttl,
    'ttl'      => max(0, $ttl - 1),
    'time'     => (int) round(microtime(true) * 1000),
]);
