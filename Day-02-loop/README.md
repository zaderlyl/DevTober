# Day 02 - Loop

Un paquet fait des allers-retours entre un serveur GitHub et un serveur de l'IUT, avec le navigateur comme relais. Chaque aller-retour lui coûte une vie (TTL), jusqu'à ce qu'il se dissipe.

## Lien avec le mot
Le *loop* est une vraie boucle réseau : le paquet repart d'un serveur vers l'autre tant que son TTL n'est pas à 0, comme un paquet IP qui tourne en rond entre routeurs jusqu'à expiration. C'est ce TTL qui garantit que la boucle se termine.

## Fonctionnement
```
 GitHub Pages  ◀──▶  NAVIGATEUR  ◀──▶  serveur IUT (PHP)
   (statique)        (le relais)
```
1. Le navigateur envoie le paquet (TTL) au serveur IUT, qui répond avec le TTL décrémenté.
2. Il le renvoie ensuite vers GitHub, puis revient à l'IUT, et ainsi de suite.
3. À 0, le paquet se dissipe.

Chaque saut est une vraie requête `fetch`, et la latence affichée est celle mesurée. Le trajet est ralenti à l'écran (environ 0,4 s) pour qu'on puisse le suivre.

Les deux serveurs ne se parlent jamais directement : c'est le navigateur qui fait le relais. Comme GitHub Pages ne sert que des fichiers statiques, il ne peut pas décrémenter le TTL lui-même, donc c'est la page qui le fait pour les sauts GitHub. Côté IUT, c'est bien `ping.php` qui décrémente.

## Ce qu'on voit
- **Un paquet identifié** : un identifiant aléatoire (`#A3F9`) suit le paquet pendant tout le trajet, avec son TTL restant.
- **Un carnet de bord** : à chaque serveur traversé, une pastille s'ajoute (`iut@1`, `github@2`, `iut@3`...) avec la latence mesurée. Le serveur IUT reçoit le carnet de bord, y ajoute son passage et le renvoie : c'est la preuve que ce qui part est bien ce qui revient.
- **Un volet « Envoyé / Reçu »** en direct, avec ce qui a changé en surbrillance :
  - IUT : statut HTTP, durée, taille, **l'identifiant renvoyé** (comparé à celui envoyé), le TTL avant/après, la trace, **l'origine vue par le serveur** (`https://….github.io`) et son heure.
  - GitHub : le contenu réel de `pong.json`, preuve que le fichier a bien été lu.
- Si le serveur IUT n'écho pas l'identifiant (ancienne version du script), la page le signale au lieu de faire semblant.

## Installation
- **GitHub :** pousser le repo et activer GitHub Pages. La page appelle `Day-02-loop/pong.json`.
- **IUT :** déposer `ping.php` sur l'espace web. Son URL (en `https://`) est pré-remplie dans le champ de la page, et on peut la remplacer par la sienne : elle est retenue d'une visite à l'autre (`localStorage`).

L'URL de l'IUT doit être en **https** : une page en https ne peut pas appeler une URL en http (contenu mixte bloqué par le navigateur).

## Que se passe-t-il si un serveur est injoignable ?
Le saut est **simulé** avec une latence plausible, et la page l'indique clairement : le nœud passe en pointillés et la ligne du journal affiche « simulé ». Les visiteurs sans accès à l'IUT voient donc quand même la visualisation, sans qu'on leur fasse croire qu'une mesure est réelle.

## Technique
- `fetch` avec `cache: 'no-store'` et un paramètre `t=` pour contourner les caches, et un délai maximum de 4 s par saut.
- `ping.php` renvoie du JSON avec l'en-tête CORS nécessaire (la page est sur une autre origine). Il **assainit ce qu'il reçoit** (identifiant alphanumérique de 16 caractères max, trace nettoyée et limitée) avant de le renvoyer. Le TTL est **plafonné à 32 côté serveur**, et la page prend toujours `min(réponse, TTL - 1)` : même un serveur qui répondrait n'importe quoi ne pourrait pas faire durer la boucle.
- Les réponses des serveurs ne sont jamais insérées comme du HTML : tout le volet de détail passe par `textContent`.
- Visualisation : un paquet animé en `requestAnimationFrame` dont l'opacité suit le TTL restant, puis une gerbe de particules (Web Animations API) quand il se dissipe.
