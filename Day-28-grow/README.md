# Day 28 - Grow

Une fausse startup doit **grandir**. Chaque levier de croissance fait monter la courbe, et **réécrit le code de la page**, affiché à côté. Ce code est celui qui tourne vraiment : on peut le copier ou le télécharger, et la page obtenue démarre déjà avec les leviers activés.

## Lien avec le mot
*Grow* : à deux endroits à la fois. La courbe « croissance » grimpe, mais seulement en trichant. Le fichier, lui, grandit pour de vrai : chaque levier ajoute des lignes au code.

## Ce qu'on peut faire
**Le but** : atteindre **1 million d'utilisateurs affichés** et lever des fonds (la « licorne »), sans tomber en faillite. Un mois passe par seconde (bouton **Pause** et **Vitesse ×3**).

**L'argent.** La startup a 150 000 €, dépense 4 000 € par mois et gagne 27 € (3 vrais utilisateurs à 9 €). Chaque levier a un prix, affiché sur son bouton. Si la trésorerie passe sous zéro : faillite, et il faut tout annuler pour recommencer.

**Onze leviers**, dont trois qu'on peut actionner plusieurs fois (le prix monte) :
- **Acheter 10 000 utilisateurs** (×6, de 5 000 € à 38 000 €).
- **Article sponsorisé** (×5) : du *buzz* qui triple la croissance, puis retombe de 12 % par mois.
- **Embaucher un Head of Growth** (×4) : croissance en hausse, mais +6 000 € de salaire par mois.
- **Renommer la métrique** : « Utilisateurs actifs » devient « Personnes ayant déjà vu la page » (×12).
- **Compter chaque rechargement** : ×3.
- **Couper l'axe** : l'axe vertical ne part plus de zéro et ses chiffres disparaissent.
- **Bouton « Inviter 10 amis »** : croissance +2 points par mois.
- **Pivoter vers l'IA** : nouveau nom, croissance +6 points.
- **Retirer la courbe réelle** : la ligne pointillée des vrais utilisateurs disparaît.
- **Lever 40 M€** : verrouillé tant qu'il n'y a pas 50 000 utilisateurs affichés. Seule la première tranche (400 k€) est versée, et la valorisation apparaît.
- **Passer aux microservices** : aucun effet pour les utilisateurs, une soixantaine de lignes de code en plus, et +3 000 € de dépenses par mois.

**Des événements au hasard** (journal sous la courbe) : un article sur Hacker News, un journaliste qui demande les vrais chiffres (réaction différente si la courbe réelle est masquée), des comptes en double qui sont repérés, une panne, un séminaire à Ibiza, un investisseur curieux, un concurrent qui copie la page.

**Le code est au centre** : à droite sur ordinateur (il reste visible quand on défile), juste sous le tableau de bord sur téléphone. Un gros compteur donne la taille du fichier, avec une jauge. Les lignes ajoutées par un levier se tapent à l'écran, un « +N lignes · +N octets » s'affiche, et le bloc de croissance est colorié (mots-clés, chaînes, nombres).

Boutons : **Copier le code**, **Télécharger cette page**, **Tout annuler**.

## Comment ça marche
1. **La page lit son propre code** : au chargement, elle garde son texte (`document.documentElement.outerHTML`).
2. Le code contient un **bloc de croissance**, entre deux lignes repères (`// === CROISSANCE ===` et `// === FIN ===`). Il est vide au départ.
3. Chaque levier a ses **lignes de code** (par exemple `buy(10000, 5000);`, où 5000 est le prix payé). En l'actionnant, la page les **exécute** (`new Function`) et les **ajoute au bloc** : ce qu'on voit à droite est donc ce qui a été exécuté.
4. Le code affiché est le texte d'origine avec le bloc remplacé. **Copier** ou **télécharger** donne ce même texte.
5. Quand on ouvre la page téléchargée, les lignes du bloc s'exécutent toutes seules, et la page relit le bloc pour savoir quels leviers sont déjà là (repère `// levier : <nom>`). Le code qu'elle affiche est identique au fichier : le texte est un **point fixe**, c'est l'idée du quine.
6. La courbe est une simple ligne SVG sur les 24 derniers mois, avec une croissance mensuelle et un peu de bruit. « Couper l'axe » change seulement les bornes verticales.

## Limites et choix
- **Quine « honnête », pas pur** : un quine strict n'a pas le droit de lire son propre texte. Ici la page le lit (`outerHTML`) : c'est le navigateur qui recrée le texte à partir de la page chargée, donc les espaces ou guillemets du HTML peuvent différer légèrement du fichier d'origine. Le code JavaScript, lui, est identique.
- Le fichier grandit peu (quelques pourcents, une dizaine au mieux : il fait déjà environ 27 ko avant le premier levier), alors que la croissance affichée se compte en dizaines de milliers de fois. C'est voulu, mais le compteur de taille ne grimpe pas vite.
- Le temps, le buzz et les événements ne sont **pas** dans le code : une page téléchargée reprend les leviers (utilisateurs, prix payés, salaires), pas les mois écoulés, et repart donc du mois 0 avec la trésorerie déjà dépensée.
- « Tout annuler » repart de la page telle qu'elle s'est ouverte : si tu as ouvert une page téléchargée, ses leviers de départ sont retirés de l'affichage, mais pas du fichier.
- Satire : aucun utilisateur n'est acheté, rien n'est envoyé, aucune donnée ne quitte la page.
- Testé dans le navigateur de bureau (leviers, copie du code, round-trip du fichier, mobile 375 px). Le téléchargement et le presse-papiers n'ont pas été essayés sur un vrai téléphone.
