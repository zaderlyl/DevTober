# Day 03 - Bloom

Une plante qui pousse grâce à un bot Discord : chaque `/arroser` la fait passer à l'étape suivante (graine, pousse, tige, bouton, fleur). Une page web la montre en direct.

## Lien avec le mot
*Bloom* : la fleur qui s'ouvre. La plante a 5 étapes, et chaque arrosage en débloque une. Pour le test, **1 arrosage = 1 étape** (`PER_STAGE` en haut de `worker.js`).

## Fonctionnement
```
 Discord ──/arroser──▶ Worker Cloudflare ──écrit──▶ Durable Object « Plant »
                            │
 page GitHub ◀──?state=1────┘   (la page lit l'état toutes les 3 s)
```
Il n'y a **pas de programme qui tourne en permanence**. Discord permet de donner l'URL d'un service (*Interactions Endpoint URL*) : à chaque commande, Discord envoie une requête à cette URL et affiche ce que le service répond. Ici c'est un **Cloudflare Worker** (gratuit : 100 000 requêtes par jour), `worker/worker.js`.

- **`/arroser`** : la plante passe à l'étape suivante. Quand elle est en fleur, le bot le dit et ne la fait plus grandir.
- **`/plante`** : où en est la plante.
- **`/graine`** : replanter une graine (retour à zéro). Comme la plante est commune à tous, elle ne marche **qu'une fois la plante en fleur** : personne ne peut effacer la croissance en cours.

La plante est **unique et commune à tous les serveurs** qui ont ajouté le bot : chaque arrosage, d'où qu'il vienne, la fait grandir pour tout le monde. Son état (étape, nombre d'arrosages, date du dernier) vit dans un **Durable Object** : un objet unique pour le monde entier, qui traite ses accès au stockage l'un après l'autre. Il n'y a donc pas de copie périmée (la page voit un arrosage en quelques secondes) et deux arrosages simultanés comptent tous les deux. J'avais d'abord utilisé le stockage KV, mais il garde des copies jusqu'à 60 secondes, et la page restait en retard. Aucun nom d'utilisateur n'est gardé.

### Pourquoi pas le serveur de l'IUT ?
C'était le plan de départ (`bloom.php`), et le script marchait. Mais le serveur `web-mmi2` n'est joignable que depuis la France : mesuré depuis plusieurs pays, il répond en France et expire (timeout) en Allemagne, aux Pays-Bas, au Royaume-Uni, en Suisse, en Italie et aux États-Unis. Or les requêtes de Discord viennent de l'étranger, donc Discord ne pouvait pas vérifier l'URL. Le service qui reçoit Discord doit être joignable de partout.

## Ajouter le bot sur un autre serveur
Le bouton **« Ajouter le bot à ton serveur Discord »** de la page ouvre le lien d'invitation de l'application (`https://discord.com/oauth2/authorize?client_id=…&scope=applications.commands`). Le scope `applications.commands` suffit : le bot n'a pas de présence en ligne, il répond seulement aux commandes. Pour que n'importe qui puisse l'ajouter :
- sur le portail développeur, **Bot** : activer **Public Bot** ; **Installation** : garder « Guild Install » avec le scope `applications.commands` ;
- déclarer les commandes **globalement** (sans `DISCORD_GUILD_ID`), sinon elles n'existent que sur le serveur de test. Une commande globale peut mettre un moment à apparaître sur un nouveau serveur ; pour retirer les doublons du serveur de test : `DISCORD_CLEAR=1` avec son `DISCORD_GUILD_ID`.

## Sécurité
L'URL du Worker est publique : n'importe qui peut l'appeler. Donc **chaque requête de Discord est signée** (Ed25519), et le Worker vérifie la signature avec la **clé publique** de l'application avant de faire quoi que ce soit. Sans signature valide, il répond 401 (c'est même Discord qui teste ce refus quand on enregistre l'URL). Les requêtes de plus de 20 Ko sont refusées.

- La clé publique et l'identifiant de l'application ne sont pas des secrets : ils sont dans le code.
- **Le token du bot, lui, est un secret** : il n'est dans aucun fichier du repo. Il ne sert qu'une fois, pour déclarer les commandes (`register-commands.php`), et il est lu dans une variable d'environnement. S'il fuit, le remettre à zéro (*Reset Token*) sur le portail Discord.
- La page ne fait que **lire** l'état (`?state=1`) : elle ne peut pas arroser.
- Un bot public peut être ajouté par n'importe qui, et chaque `/arroser` d'un serveur compte pour tous : un petit groupe pourrait faire pousser la plante très vite. C'est le principe voulu ici.
- Limites à connaître : une requête signée valide peut être rejouée par quelqu'un qui l'aurait interceptée (ça ne ferait qu'arroser la plante) ; l'offre gratuite limite à 100 000 requêtes par jour, et chaque page ouverte et visible en consomme environ 29 000 (elle se met en pause quand l'onglet est masqué).

## Installation
1. **Discord** (portail développeur) : créer l'application, inviter le bot sur un serveur (scope `applications.commands`).
2. **Cloudflare** : créer un compte gratuit, puis, depuis le dossier `worker/` :
   ```
   npx wrangler login
   npx wrangler deploy      # crée le Worker et son Durable Object ; affiche l'adresse https://devtober-bloom.….workers.dev
   ```
3. **Discord** : dans *Informations générales*, coller l'adresse du Worker dans **Interactions Endpoint URL** et enregistrer. Discord envoie un test et n'enregistre que si le Worker répond correctement.
4. **Ordinateur** : déclarer les commandes (une fois) :
   ```
   DISCORD_TOKEN='le-token-du-bot' DISCORD_GUILD_ID='id-du-serveur' php register-commands.php
   ```
   Avec `DISCORD_GUILD_ID` (clic droit sur le serveur > *Copier l'identifiant*, après avoir activé le mode développeur), les commandes apparaissent tout de suite sur ce serveur.
5. **GitHub** : l'adresse du Worker est dans `BLOOM_URL` (`bloom.js`) ; pousser le repo. La page lit l'état à cette adresse (modifiable dans le champ, retenue d'une visite à l'autre).

## Bande d'annonce
`promo/bloom.mp4` (1080×1080, 30 images/s, 10,8 s) et `promo/bloom.gif` (600×600, 15 images/s) : une courte animation qui présente le projet. Elle est **générée par du code** (`promo/render.py`, Python + Pillow, puis `ffmpeg`) : chaque image est calculée à partir du temps, il n'y a aucune capture d'écran. Pour la refaire : `python3 promo/render.py`.

L'interface « chat » de l'animation est **une recréation stylisée**, pas une vraie capture de Discord ; les arrosages y sont mis en scène, pas enregistrés en direct.
