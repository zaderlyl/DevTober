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

- **Deux requêtes par saut** (la page, puis sa fiche), avec une pause réglable (lente, normale, rapide), et un **plafond de 40 sauts** pour rester poli avec Wikipédia.
- **Redirections** : le titre affiché est le titre officiel après redirection.
- **Pages disparues** : si le lien tiré mène à un article qui n'existe plus, on en tire un autre (3 essais), sinon la dérive s'arrête avec le message d'erreur.
- **Impasse** : une page sans aucun lien arrête la dérive, avec une explication.
- **Bouton « Arrêter »** : interrompt proprement la dérive en cours (la requête en vol est annulée).

## Les langues
Deux sélecteurs, qui font deux choses différentes :
- **La langue de la page** (en haut à droite) traduit tout : textes, boutons, messages, journal. 8 langues : français, English, español, Deutsch, italiano, português, Bahasa Indonesia, 日本語. La langue du navigateur est détectée à la première visite, et le choix est retenu.
- **L'édition de Wikipédia** (dans les réglages) est l'encyclopédie dans laquelle on dérive. Elle propose les 8 langues de la page et 8 autres (nl, sv, pl, ru, tr, zh, ko, ar). Elle **suit la langue de la page** tant qu'on n'en choisit pas une autre : on peut donc lire la page en français et dériver dans Wikipédia en japonais.

Quand on change d'édition, **l'article de départ est traduit** : Wikipédia connaît les équivalents d'un article dans les autres langues (`prop=langlinks`), donc « Piza » (indonésien) devient « ピザ » (japonais) et « Napoléon Ier » devient « Napoleon » en anglais. Si l'article n'a pas d'équivalent, on prend l'article de départ par défaut de la langue.

Ce que la langue change aussi, côté technique :
- **Les pages « spéciales »** (fichiers, catégories, aide…) ont un nom différent dans chaque édition : *Fichier* en français, *Berkas* en indonésien, *Datei* en allemand, *ファイル* en japonais. Plutôt qu'une liste codée en dur, la page demande à chaque édition sa liste exacte (`meta=siteinfo`), alias compris, pour ne jamais tirer un fichier ou une catégorie comme « article ».
- **Les pluriels** suivent les règles de chaque langue (`Intl.PluralRules`) : « 0 saut » en français, « 0 hops » en anglais, pas de pluriel en indonésien ni en japonais. Les textes s'écrivent donc avec une forme par catégorie de pluriel.
- **La première phrase** d'un article est coupée aussi sur « 。 » (japonais, chinois), et la carte s'aligne selon le sens d'écriture (arabe).

**Attention : les traductions ont été écrites par une IA (Claude)**, pas par des locuteurs natifs. Elles sont complètes et cohérentes (vérification automatique : mêmes phrases et mêmes champs dans chaque langue), mais elles méritent d'être relues par quelqu'un dont c'est la langue, surtout l'indonésien et le japonais. Pour corriger ou ajouter une langue : tout est dans `i18n.js` (l'objet `STR`, une entrée par langue ; ajouter aussi la langue dans `UI_LANGS`).

## Une balade illustrée
- **Chaque rond montre la vignette de l'article** (l'image principale de la page). Quand une page n'a pas d'image, le rond affiche sa première lettre.
- **Une carte en haut** décrit la page où l'on est : son titre (un lien vers l'article), sa **description courte** (« région d'Italie méridionale »), et sa **première phrase**. Les longues parenthèses de traductions (« en italien : Calabria /kaˈlabrja/ ; … ») sont retirées pour garder une phrase lisible, et elle est coupée à environ 190 caractères.
- La fiche (vignette, description, phrase) arrive **un instant après** le rond, avec un seul appel supplémentaire par saut (`prop=pageimages|extracts|description`) : la dérive n'attend pas.
- Le rond grossit quand il y a peu d'étapes et rétrécit quand le dessin s'étire. En dessous d'une certaine taille (petits écrans, longues dérives), les images sont masquées et il reste des points : la carte, elle, montre toujours l'image de l'étape en cours.
- Une image n'est affichée que si elle vient des serveurs d'images de Wikimedia (`upload.wikimedia.org` ou `thumb.wikimedia.org`).

## Le dessin
Le tracé est un **serpentin** qui ondule, calculé d'après X (on le connaît au départ : il tient toujours dans la zone). La caméra ne cadre que les étapes déjà faites : le dessin **s'étire donc à chaque saut**, en zoomant peu à peu en arrière. Les noms n'apparaissent que s'ils ont la place (priorité à l'étape actuelle, au départ, puis aux plus récentes) ; les autres restent lisibles au survol et dans le journal. Chaque nom est un lien vers l'article.

## Sécurité
Les titres, descriptions et phrases viennent de l'extérieur : ils sont toujours affichés avec `textContent` (jamais `innerHTML`), et les liens sont construits avec `encodeURIComponent` vers `https://<langue>.wikipedia.org/wiki/…`, avec `rel="noopener"`.

## Vie privée
La page ne parle qu'à Wikipédia et Wikimedia, directement depuis le navigateur du visiteur : leurs serveurs voient donc son adresse IP, comme pour n'importe quelle visite sur Wikipédia. Aucune donnée n'est envoyée ailleurs, et rien n'est stocké hors du navigateur (les réglages, en `localStorage`).

## Installation
Rien à installer : pousser le repo, la page est servie par GitHub Pages. Les réglages (article, X, langue, vitesse) sont retenus d'une visite à l'autre (`localStorage`).
