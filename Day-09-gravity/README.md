# Day 09 - Gravity

La **typographie à masse variable**. Une police variable peut avoir un poids continu de 100 à 900 (l'axe `wght`). Ici, **ce poids est une masse** : chaque lettre de ta phrase est un objet physique dans un bassin de liquide. Les lourdes coulent, les légères flottent, et la phrase se range toute seule en strates.

## Lien avec le mot
*Gravity* : la gravité n'est qu'une question de poids. Sauf qu'ici le poids n'est pas celui de la matière mais celui **d'une lettre dans une police**, et c'est l'information qu'elle porte qui le décide. Un bouton `import antigravity` inverse tout, clin d'œil à l'œuf de Pâques de Python et à la BD [xkcd n°353](https://xkcd.com/353/) : les lourdes montent, les légères tombent.

## D'où vient le poids d'une lettre
De sa **rareté en français**. En théorie de l'information (Claude Shannon), la quantité d'information d'un événement de probabilité *p* est **−log₂ p** bits : plus il est rare, plus il en porte. Chaque lettre reçoit donc son poids selon sa fréquence d'apparition, remise à l'échelle de 100 à 900 :

| Lettre | Fréquence en français | Information | Poids |
|---|---|---|---|
| **e** | 14,7 % | 2,76 bits | **100** (la plus légère) |
| s | 7,9 % | 3,65 bits | 186 |
| a, i, t, n | 7,1 à 7,6 % | 3,7 à 3,8 bits | 192 à 202 |
| p | 3,0 % | 5,05 bits | 322 |
| x | 0,39 % | 8,01 bits | 610 |
| y | 0,31 % | 8,34 bits | 642 |
| z | 0,14 % | 9,52 bits | 757 |
| w | 0,11 % | 9,78 bits | 782 |
| **k** | 0,049 % | 10,99 bits | **900** (la plus lourde) |

Quelques règles en plus : un **accent** ou une **majuscule** ajoute de l'information (donc du poids) ; la ponctuation courante a sa propre valeur ; les chiffres et les symboles très rares sont lourds ; une lettre inconnue (emoji, symbole…) pèse le maximum. Les fréquences sont celles, courantes, du français : sur un texte dans une autre langue, une lettre fréquente ailleurs mais rare en français (comme le « w » ou le « k » en anglais ou en néerlandais) sera lourde quand même.

## Ce qu'on peut faire
- **Écrire sa phrase** (160 caractères au plus) et la lâcher. Pendant 1,5 seconde, elle est posée comme du texte normal, puis les lettres sont libérées.
- **Saisir et lancer une lettre** avec la souris ou le doigt.
- **Cliquer sur une lettre** pour l'alourdir de 200 (au-delà de 900, elle redevient légère).
- **Remuer** le liquide en passant la souris dessus, ou **Secouer** le bassin d'un coup.
- **`import antigravity`** : inverse la poussée.
- **Changer la direction du « bas »** : avec les **flèches du clavier**, ou en **inclinant le téléphone**.
- Survoler une lettre affiche son poids et son information (« z » · poids 757 · 9,5 bits).

Quand tout est rangé, la page donne **la lettre la plus légère**, **la plus lourde**, et **la phrase lue de la plus légère à la plus lourde**, c'est-à-dire dans l'ordre où la physique l'a réellement rangée.

## La police variable
La police est **Epilogue** (axe de graisse 100 à 900), un fichier woff2 de 42 Ko repris de ton portfolio (voir `fonts/LICENSE.txt` pour la licence). En CSS :

```css
@font-face { font-family: 'Epilogue'; src: url('fonts/Epilogue-Variable.woff2') format('woff2'); font-weight: 100 900; font-display: block; }
```

La plage `font-weight: 100 900` dit au navigateur que la police couvre tous les poids intermédiaires. Dans un `canvas`, `ctx.font = "537 40px Epilogue"` fonctionne alors avec **n'importe quel entier** (537, comme 100 ou 900), ce qui donne une graisse différente à chaque lettre. Vérifié : la largeur de « Mwe » passe de 82 px (poids 100) à 100 px (poids 900) de façon régulière, et la graisse 537 tombe bien entre 500 et 600. La page attend le chargement de la police avant de démarrer, sinon tous les poids seraient identiques. Les lettres de « Gravity », dans le titre, ont aussi leur poids et s'affaissent en conséquence.

## La physique
Un petit moteur écrit pour l'occasion, sans bibliothèque :
- **Chaque lettre est un rectangle** (sa largeur dépend de son poids : une lettre plus grasse est plus large). Elles ne tournent pas : on garde le texte lisible, avec une légère inclinaison décorative quand elles bougent.
- **La poussée** est une version simplifiée de la poussée d'Archimède. Le liquide a le poids **médian** de la phrase : une lettre plus légère que lui remonte, plus lourde que lui coule, de façon symétrique entre −1 (la plus légère) et +1 (la plus lourde).
- **Le liquide freine** les lettres (frottement proportionnel à la vitesse), ce qui leur donne une vitesse limite.
- **Les collisions** tiennent compte des masses : une lettre lourde déplace une légère plus qu'elle ne se laisse déplacer. Le pas de temps est fixe (1/120 s).
- **Le calme** est détecté quand la vitesse moyenne des lettres reste très faible pendant 0,8 s : c'est alors que les résultats s'affichent.

### Le réglage, mesuré
Au premier essai, les lettres se coinçaient (une lourde piégée au-dessus d'une légère). Pour régler le moteur, j'ai mesuré la **part des paires de lettres bien rangées** (de poids très différents et à des étages différents, la plus lourde est-elle bien du côté « lourd » ?), sur six phrases, en poussée normale et en antigravité :

| Réglage | Paires bien rangées |
|---|---|
| Premier essai (bassin à 20 %, gravité forte) | environ 83 % |
| Bassin à 10 % de remplissage, gravité douce (réglage retenu) | **91 à 94 %** |
| Bassin à 8 %, gravité douce | 93 % (mais les lettres sont plus petites) |
| Ajout d'une agitation pour décoincer | pas d'amélioration (retirée) |

Le rangement n'est donc pas parfait : les lettres de poids proches se mélangent, et en antigravité les lourdes doivent traverser les légères, ce qui est plus lent.

## Limites et choix
- **Je n'ai pas pu tester l'inclinaison sur un vrai téléphone.** La conversion (`accelerationIncludingGravity`, signe et axes) suit la spécification et donne les bonnes directions dans mes tests simulés (debout, penché, sur le côté, à plat), mais elle n'a pas été vérifiée sur un appareil réel. Elle ne gère que le mode portrait. Sur iPhone, la permission est demandée par un bouton « Activer l'inclinaison » (obligatoire sur iOS). L'écouteur n'existe que sur un écran tactile.
- Les lettres sont des **rectangles non pivotants** : un empilement de formes réelles serait plus joli mais bien plus lourd à écrire.
- Avec **« réduire les animations »** activé, la simulation est jouée d'un coup en arrière-plan et la page affiche directement le résultat rangé.
- La police est chargée **depuis ton propre site** (aucun service externe).
- Si l'onglet est **en arrière-plan**, le navigateur suspend l'animation : la physique reprend quand on revient.
- La page est en français seulement (pas de système de langues).

## Vie privée et sécurité
Rien n'est envoyé : tout se calcule dans le navigateur. Le texte saisi n'est jamais interprété comme du HTML : il est dessiné dans un `canvas`, et les légendes sont écrites avec `textContent`. Le seul lien externe est celui vers la BD xkcd, avec `rel="noopener"`.

## Installation
Rien à installer : pousser le repo, la page est servie par GitHub Pages (le dossier `fonts/` fait partie du projet).
