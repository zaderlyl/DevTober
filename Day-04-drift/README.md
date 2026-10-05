# Day 04 - Drift

On part d'un article Wikipédia, et **plusieurs dériveurs partent du même point**. À chaque étape, chacun **compte les liens** de sa page, **tire un numéro au hasard** et **suit ce lien**. Ils recommencent **X fois** (X et le nombre de dériveurs sont choisis par l'utilisateur). Toutes les branches sont dessinées sur **le même canevas**, chacune dans sa couleur, et à la fin on peut **circuler** pour aller voir où chacune a fini.

## Lien avec le mot
*Drift* : la dérive. C'est un clin d'œil à la **théorie de la dérive** des situationnistes (Guy Debord) : se laisser porter par le hasard dans la ville, sans but, et voir où l'on arrive. Ici la ville est Wikipédia, et la règle est mécanique : compter, tirer, suivre. Avec plusieurs dériveurs partis du même endroit, c'est aussi **l'effet papillon** : une toute petite différence au premier saut, et on finit dans des endroits sans aucun rapport.

## La règle, étape par étape
1. On ouvre l'article de départ (ou on en tire un au hasard).
2. Chaque dériveur liste les **pages différentes** vers lesquelles sa page renvoie (N pages).
3. Il tire un nombre entre 1 et N, et **suit ce lien**. Au premier saut, les dériveurs prennent **des liens différents** : les branches se séparent vraiment.
4. Chacun recommence depuis sa page d'arrivée, jusqu'à X sauts.

Le journal garde chaque saut, avec un point de la couleur de la branche : « *Calabre — 604 pages liées · tirage n°592 sur 604 → Parc national de l'Aspromonte* ». Le hasard est vérifiable, pas de la mise en scène.

À la fin, la page fait un bilan : **combien d'endroits différents** les dériveurs ont atteints, et **combien de fois leurs chemins se sont recroisés** sur une même page.

## Ce qui compte comme un lien
- Seuls les liens vers **d'autres articles** comptent. Les liens vers les fichiers, les catégories, les pages d'aide ou de discussion sont ignorés.
- Les liens des **bandeaux de navigation**, des **notes**, des **références** et des bandeaux d'aide sont retirés : on ne compte que ce qui est dans le texte de l'article (y compris l'infobox).
- Un article lié plusieurs fois ne compte **qu'une fois** : le tirage « n°k sur N » est ainsi simple à expliquer.
- La page ne tire jamais son propre lien. Un dériveur peut repasser par une page déjà visitée.

## Un seul canevas, et on circule
Le point de départ est au centre, et **chaque branche part dans sa propre direction** (360° partagés entre les dériveurs) en changeant peu à peu de cap : le dessin ressemble à une étoile qui s'étire. Pendant la dérive, la caméra recadre tout seul pour garder l'ensemble visible. **Dès qu'on touche à la carte, ce recadrage automatique s'arrête**, et le bouton « Tout voir » se met en évidence pour le rétablir.

| Pour… | À la souris | Au clavier | Au doigt |
|---|---|---|---|
| **Se déplacer** | glisser | flèches | – (un doigt fait défiler la page) |
| **Zoomer** | `Ctrl` ou `⌘` + molette, ou les boutons **+** et **−** | `+` et `-` | pincer à deux doigts |
| **Tout revoir** | bouton « Tout voir » | `0` | bouton « Tout voir » |
| **Rejoindre une branche** | cliquer sa carte | `Entrée` sur sa carte | toucher sa carte |

- **La molette seule fait défiler la page** : on ne piège pas le défilement. Le zoom demande `Ctrl`/`⌘` (ce qui correspond aussi au pincement du pavé tactile).
- **Un doigt fait défiler la page** sur un écran tactile ; la carte ne se déplace qu'à deux doigts, ou avec les boutons.
- En **zoomant**, les ronds grossissent : les **vignettes** et davantage de **noms** apparaissent. Les noms n'apparaissent que s'ils ont la place (priorité aux bouts de branche et au départ) ; tous restent lisibles au survol et dans le journal.
- Un glissement qui se termine sur un rond n'ouvre pas son article.

## Des cartes, une par branche
En haut, une carte par dériveur (de la couleur de sa branche) montre **où il en est** : la vignette de sa page, son titre (un lien vers l'article), sa **description courte** (« région d'Italie méridionale »), sa **première phrase**, et le numéro du saut. Cliquer sur la carte **amène la caméra au bout de la branche**. Les longues parenthèses de traductions que Wikipédia met en tête d'article sont retirées de la phrase, et elle est coupée à environ 190 caractères.

## Les langues
Deux sélecteurs, qui font deux choses différentes :
- **La langue de la page** (en haut à droite) traduit tout : textes, boutons, messages, journal. 8 langues : français, English, español, Deutsch, italiano, português, Bahasa Indonesia, 日本語. La langue du navigateur est détectée à la première visite, et le choix est retenu.
- **L'édition de Wikipédia** (dans les réglages) est l'encyclopédie dans laquelle on dérive. Elle propose les 8 langues de la page et 8 autres (nl, sv, pl, ru, tr, zh, ko, ar). Elle **suit la langue de la page** tant qu'on n'en choisit pas une autre : on peut donc lire la page en français et dériver dans Wikipédia en japonais.

Quand on change d'édition, **l'article de départ est traduit** : Wikipédia connaît les équivalents d'un article dans les autres langues (`prop=langlinks`), donc « Piza » (indonésien) devient « ピザ » (japonais) et « Napoléon Ier » devient « Napoleon » en anglais. Si l'article n'a pas d'équivalent, on prend l'article de départ par défaut de la langue.

Ce que la langue change aussi, côté technique :
- **Les pages « spéciales »** (fichiers, catégories, aide…) ont un nom différent dans chaque édition : *Fichier* en français, *Berkas* en indonésien, *Datei* en allemand, *ファイル* en japonais. Plutôt qu'une liste codée en dur, la page demande à chaque édition sa liste exacte (`meta=siteinfo`), alias compris, pour ne jamais tirer un fichier ou une catégorie comme « article ».
- **Les pluriels** suivent les règles de chaque langue (`Intl.PluralRules`) : « 0 saut » en français, « 0 hops » en anglais, pas de pluriel en indonésien ni en japonais. Les textes s'écrivent donc avec une forme par catégorie de pluriel.
- **La première phrase** d'un article est coupée aussi sur « 。 » (japonais, chinois), et les cartes s'alignent selon le sens d'écriture (arabe).

**Attention : les traductions ont été écrites par une IA (Claude)**, pas par des locuteurs natifs. Elles sont complètes et cohérentes (vérification automatique : mêmes phrases et mêmes champs dans chaque langue), mais elles méritent d'être relues par quelqu'un dont c'est la langue, surtout l'indonésien et le japonais. Pour corriger ou ajouter une langue : tout est dans `i18n.js` (l'objet `STR`, une entrée par langue ; ajouter aussi la langue dans `UI_LANGS`).

## Une balade illustrée
- **Chaque rond montre la vignette de l'article** (l'image principale de la page). Quand une page n'a pas d'image, le rond affiche sa première lettre. Si une image ne se charge pas, la lettre prend aussi sa place.
- La fiche (vignette, description, phrase) arrive **un instant après** le rond, avec un seul appel supplémentaire par saut (`prop=pageimages|extracts|description`) : la dérive n'attend pas.
- Les ronds de bout de branche sont plus gros, et leur anneau est de la couleur de la branche. Le rond de départ, commun à toutes les branches, est blanc.
- Une image n'est affichée que si elle vient des serveurs d'images de Wikimedia (`upload.wikimedia.org` ou `thumb.wikimedia.org`).

## Fonctionnement technique
Il n'y a **aucun serveur** : la page appelle directement l'API de Wikipédia (`action=parse`, avec `origin=*`, qui autorise les appels depuis une page web), extrait les liens du HTML de l'article avec `DOMParser`, puis tire au hasard avec `Math.random()`.

- **Deux requêtes par saut et par dériveur** (la page, puis sa fiche), avec une pause réglable (lente, normale, rapide) et **jamais plus de trois requêtes en même temps**, quel que soit le nombre de dériveurs.
- **Le total de sauts est plafonné à 120** (dériveurs × sauts), et chaque dériveur à 40 sauts : 1 dériveur peut faire jusqu'à 40 sauts, 4 dériveurs jusqu'à 30, 6 dériveurs jusqu'à 20. La page ajuste X toute seule et l'explique. Ça reste poli avec Wikipédia.
- **Redirections** : le titre affiché est le titre officiel après redirection.
- **Pages disparues** : si le lien tiré mène à un article qui n'existe plus, on en tire un autre (3 essais) ; sinon la **branche s'arrête** avec un message dans le journal, et les autres continuent.
- **Impasse** : une page sans aucun lien arrête sa branche, avec une explication. Si c'est l'article de départ, tout s'arrête.
- **Bouton « Arrêter »** : interrompt proprement toutes les branches (les requêtes en vol sont annulées).

## Sécurité
Les titres, descriptions et phrases viennent de l'extérieur : ils sont toujours affichés avec `textContent` (jamais `innerHTML`), et les liens sont construits avec `encodeURIComponent` vers `https://<langue>.wikipedia.org/wiki/…`, avec `rel="noopener"`.

## Vie privée
La page ne parle qu'à Wikipédia et Wikimedia, directement depuis le navigateur du visiteur : leurs serveurs voient donc son adresse IP, comme pour n'importe quelle visite sur Wikipédia. Aucune donnée n'est envoyée ailleurs, et rien n'est stocké hors du navigateur (les réglages, en `localStorage`).

## Installation
Rien à installer : pousser le repo, la page est servie par GitHub Pages. Les réglages (article, nombre de dériveurs, X, langue, édition, vitesse) sont retenus d'une visite à l'autre (`localStorage`).

## Bande d'annonce
`promo/drift.mp4` (1080×1080, 30 images/s, 14,4 s) et `promo/drift.gif` (600×600, 15 images/s) : une courte animation qui présente le projet.

- **Les données sont réelles.** `promo/drift-run.json` est le résultat d'une **vraie dérive** faite sur Wikipédia le 2026-10-04 à 19:39 (heure de Paris) avec exactement la règle de la page : 4 dériveurs partis de « Pizza » (170 pages liées), 8 sauts chacun, vrais titres, vrai nombre de pages liées, vrai numéro tiré. C'est la première dérive lancée : elle n'a pas été triée. Pour en refaire une : `python3 promo/fetch_run.py [article] [dériveurs] [sauts] [langue]`.
- **Le dessin est calculé.** `promo/render.py` (Python + Pillow, puis `ffmpeg`) dessine chaque image à partir du temps : aucune capture d'écran. Il refait le même tracé en étoile que la page, avec une caméra qui s'éloigne puis plonge dans une branche. Pour refaire l'animation : `python3 promo/render.py`.
- **Aucune image d'article n'est utilisée.** Les vignettes de Wikipédia ont des licences variées qui demandent une attribution : l'animation n'affiche donc que des titres, des nombres et des couleurs. Les titres d'articles ne sont pas protégés.
- `fetch_run.py` respecte l'étiquette de l'API de Wikimedia : une requête à la fois, avec une pause, et un `User-Agent` qui dit qui on est. Il n'enregistre que des titres et des nombres.

