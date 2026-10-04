# Day 04 - Drift

On part d'un article Wikipédia. À chaque étape, la page **compte les liens** vers d'autres pages, **tire un numéro au hasard** et **suit ce lien**. Elle recommence **X fois** (X est choisi par l'utilisateur) et trace le chemin parcouru : un graphe qui s'étire, de « Pizza » jusqu'à un endroit où personne n'avait prévu d'aller.

## Lien avec le mot
*Drift* : la dérive. C'est un clin d'œil à la **théorie de la dérive** des situationnistes (Guy Debord) : se laisser porter par le hasard dans la ville, sans but, et voir où l'on arrive. Ici la ville est Wikipédia, et la règle est mécanique : compter, tirer, suivre.

## La règle, étape par étape
1. On ouvre l'article de départ (ou on en tire un au hasard).
2. On liste les **pages différentes** vers lesquelles il renvoie (N pages).
3. On tire un nombre entre 1 et N, et on **suit ce lien**.
4. On recommence depuis la page d'arrivée, jusqu'à X sauts.

Le journal sous le dessin garde chaque saut : « *Calabre — 604 pages liées · tirage n°592 sur 604 → Parc national de l'Aspromonte* ». On voit donc que le hasard est vérifiable, pas de la mise en scène.

## Ce qui compte comme un lien
- Seuls les liens vers **d'autres articles** comptent. Les liens vers les fichiers, les catégories, les pages d'aide ou de discussion sont ignorés.
- Les liens des **bandeaux de navigation**, des **notes**, des **références** et des bandeaux d'aide sont retirés : on ne compte que ce qui est dans le texte de l'article (y compris l'infobox).
- Un article lié plusieurs fois ne compte **qu'une fois** : le tirage « n°k sur N » est ainsi simple à expliquer.
- La page ne tire jamais son propre lien. Elle peut en revanche repasser par une page déjà visitée : la page le signale à la fin.

## Fonctionnement technique
Il n'y a **aucun serveur** : la page appelle directement l'API de Wikipédia (`action=parse`, avec `origin=*`, qui autorise les appels depuis une page web), extrait les liens du HTML de l'article avec `DOMParser`, puis tire au hasard avec `Math.random()`.

- **Une requête par saut**, avec une pause réglable (lente, normale, rapide), et un **plafond de 40 sauts** pour rester poli avec Wikipédia.
- **Redirections** : le titre affiché est le titre officiel après redirection.
- **Pages disparues** : si le lien tiré mène à un article qui n'existe plus, on en tire un autre (3 essais), sinon la dérive s'arrête avec le message d'erreur.
- **Impasse** : une page sans aucun lien arrête la dérive, avec une explication.
- **Bouton « Arrêter »** : interrompt proprement la dérive en cours (la requête en vol est annulée).

## Le dessin
Le tracé est un **serpentin** qui ondule, calculé d'après X (on le connaît au départ : il tient toujours dans la zone). La caméra ne cadre que les étapes déjà faites : le dessin **s'étire donc à chaque saut**, en zoomant peu à peu en arrière. Les noms n'apparaissent que s'ils ont la place (priorité à l'étape actuelle, au départ, puis aux plus récentes) ; les autres restent lisibles au survol et dans le journal. Chaque nom est un lien vers l'article.

## Sécurité
Les titres viennent de l'extérieur : ils sont toujours affichés avec `textContent` (jamais `innerHTML`), et les liens sont construits avec `encodeURIComponent` vers `https://<langue>.wikipedia.org/wiki/…`, avec `rel="noopener"`.

## Installation
Rien à installer : pousser le repo, la page est servie par GitHub Pages. Les réglages (article, X, langue, vitesse) sont retenus d'une visite à l'autre (`localStorage`).
