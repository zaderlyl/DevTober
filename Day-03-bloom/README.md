# Day 03 - Bloom

Une plante qui pousse grâce à un bot Discord : chaque `/arroser` la fait passer à l'étape suivante (graine, pousse, tige, bouton, fleur). Une page web la montre en direct.

## Lien avec le mot
*Bloom* : la fleur qui s'ouvre. La plante a 5 étapes, et chaque arrosage en débloque une. Pour le test, **1 arrosage = 1 étape** (`PER_STAGE` en haut de `bloom.php`).

## Fonctionnement
```
 Discord ──/arroser──▶ bloom.php (IUT) ──écrit──▶ bloom-data.php
                            │
 page GitHub ◀──?state=1────┘   (la page lit l'état toutes les 2 s)
```
Il n'y a **pas de programme qui tourne en permanence**. Discord permet de donner l'URL d'un script (*Interactions Endpoint URL*) : à chaque commande, Discord envoie une requête à cette URL et affiche ce que le script répond. Ici, c'est `bloom.php` sur l'espace web de l'IUT, comme `upload.php` ou `ping.php`.

- **`/arroser`** : la plante passe à l'étape suivante. Quand elle est en fleur, le bot le dit et ne la fait plus grandir.
- **`/plante`** : où en est la plante.
- **`/graine`** : replanter une graine (retour à zéro).

La plante est **commune à tout le serveur**. Son état (étape, nombre d'arrosages, date du dernier) est dans un petit fichier `bloom-data.php`, créé tout seul au premier appel. Il répond 404 si on l'ouvre directement. Aucun nom d'utilisateur n'y est gardé.

## Sécurité
L'URL de `bloom.php` est publique : n'importe qui peut l'appeler. Donc **chaque requête de Discord est signée** (Ed25519), et le script vérifie la signature avec la **clé publique** de l'application avant de faire quoi que ce soit. Sans signature valide, il répond 401 (c'est même Discord qui teste ce refus quand on enregistre l'URL). Les requêtes de plus de 20 Ko sont refusées.

- La clé publique et l'identifiant de l'application ne sont pas des secrets : ils sont dans le code.
- **Le token du bot, lui, est un secret** : il n'est dans aucun fichier du repo. Il ne sert qu'une fois, pour déclarer les commandes (`register-commands.php`), et il est lu dans une variable d'environnement. S'il fuit, le remettre à zéro (*Reset Token*) sur le portail Discord.
- La page ne fait que **lire** l'état (`?state=1`) : elle ne peut pas arroser.
- Limite à connaître : une requête signée valide peut être rejouée par quelqu'un qui l'aurait interceptée ; ici ça ne ferait qu'arroser la plante.

## Installation
1. **Discord** (portail développeur) : créer l'application, inviter le bot sur un serveur (scope `applications.commands`).
2. **IUT** : déposer **`bloom.php`** sur l'espace web, dans un dossier accessible en écriture pour PHP (il crée `bloom-data.php`). Vérifier en ouvrant `…/bloom.php` : le JSON doit indiquer `"sodium": true` (extension PHP nécessaire à la vérification des signatures).
3. **Discord** : dans *General Information*, coller l'URL de `bloom.php` dans **Interactions Endpoint URL** et enregistrer. Discord envoie un test et n'enregistre que si le script répond correctement.
4. **Ordinateur** : déclarer les commandes (une fois) :
   ```
   DISCORD_TOKEN='le-token-du-bot' DISCORD_GUILD_ID='id-du-serveur' php register-commands.php
   ```
   Avec `DISCORD_GUILD_ID` (clic droit sur le serveur > *Copier l'identifiant*, après avoir activé le mode développeur), les commandes apparaissent tout de suite sur ce serveur.
5. **GitHub** : pousser le repo. La page `bloom.html` lit l'état à l'URL de `bloom.php` (pré-remplie, modifiable, retenue d'une visite à l'autre).

L'URL de l'IUT doit être en **https** : Discord l'exige, et une page https ne peut pas appeler une URL en http.
