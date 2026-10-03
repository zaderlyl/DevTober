<?php
// À lancer UNE fois depuis ton ordinateur (pas sur l'IUT) pour dire à Discord quelles commandes existent :
//
//   DISCORD_TOKEN='ton-token' DISCORD_GUILD_ID='id-du-serveur' php register-commands.php
//
// Le token du bot n'est lu que dans la variable d'environnement : il n'est écrit dans aucun fichier.
// Avec DISCORD_GUILD_ID, les commandes apparaissent tout de suite sur ce serveur (idéal pour tester) ;
// sans, elles sont globales (tous les serveurs où le bot est invité) et peuvent mettre plus de temps à apparaître.

const APPLICATION_ID = '1555882289844461639';   // identifiant de l'application Discord (public)

$token = getenv('DISCORD_TOKEN');
if (!$token) { fwrite(STDERR, "Il manque DISCORD_TOKEN (voir le début du fichier).\n"); exit(1); }
$guild = getenv('DISCORD_GUILD_ID');
if ($guild !== false && $guild !== '' && !ctype_digit($guild)) { fwrite(STDERR, "DISCORD_GUILD_ID doit être un nombre (clic droit sur le serveur > Copier l'identifiant).\n"); exit(1); }

$commands = [
    ['name' => 'arroser', 'type' => 1, 'description' => 'Arroser la plante : elle passe à l\'étape suivante'],
    ['name' => 'plante',  'type' => 1, 'description' => 'Voir où en est la plante'],
    ['name' => 'graine',  'type' => 1, 'description' => 'Replanter une graine (la plante repart de zéro)'],
];

$url = 'https://discord.com/api/v10/applications/' . APPLICATION_ID . ($guild ? '/guilds/' . $guild : '') . '/commands';
$ctx = stream_context_create(['http' => [
    'method'        => 'PUT',   // remplace toute la liste des commandes : relancer le script ne crée pas de doublons
    'header'        => "Authorization: Bot $token\r\nContent-Type: application/json\r\nUser-Agent: DiscordBot (https://zaderlyl.github.io/DevTober, 1.0)\r\n",
    'content'       => json_encode($commands),
    'ignore_errors' => true,
    'timeout'       => 15,
]]);
$res = @file_get_contents($url, false, $ctx);
$code = (int) (preg_match('#HTTP/\S+ (\d+)#', $http_response_header[0] ?? '', $m) ? $m[1] : 0);
if ($res === false || $code === 0) { fwrite(STDERR, "Discord injoignable.\n"); exit(1); }

if ($code === 200) {
    echo 'OK : ' . count(json_decode($res, true)) . ' commandes enregistrées (' . ($guild ? "serveur $guild" : 'globales') . ")\n";
    foreach (json_decode($res, true) as $c) echo '  /' . $c['name'] . "\n";
    exit(0);
}
$err = json_decode($res, true);
fwrite(STDERR, "Échec (HTTP $code) : " . ($err['message'] ?? $res) . "\n");
if ($code === 401) fwrite(STDERR, "-> le token est refusé : refais « Reset Token » sur le portail Discord et recopie-le.\n");
if ($code === 403 || $code === 404) fwrite(STDERR, "-> le bot est-il bien invité sur ce serveur, avec le scope applications.commands ?\n");
exit(1);
