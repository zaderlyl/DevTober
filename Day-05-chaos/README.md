# Day 05 - Chaos

On téléverse une image, et la page **la détruit au hasard** : on voit l'**avant** et l'**après**. Il n'y a **aucun réglage** : on ne choisit rien. Le sort pioche parmi **neuf façons de tout casser**, parfois **plusieurs à la suite** (un « combo »), commente ce qui vient d'arriver, et on peut même **semer son propre chaos** en cliquant. Tout est calculé **dans le navigateur** : l'image n'est envoyée nulle part.

## Lien avec le mot
*Chaos* : le désordre total, obtenu par le hasard pur. Pas de curseur pour doser le désordre, pas de graine pour le rejouer : chaque chaos est différent, et on ne peut pas le refaire. Le seul geste qui reste, c'est de **tirer un autre chaos**.

## Ce qu'on peut faire
- **Téléverser** une image : la déposer, cliquer pour la choisir, ou la coller (Ctrl / ⌘ + V). Le chaos se lance tout seul après un instant, pour qu'on voie d'abord l'avant.
- **Un autre chaos** (ou la barre d'espace) : en tire un nouveau, pour la même image. Un compteur compte les chaos.
- **Cliquer sur l'image détruite** : une tache de chaos y apparaît à l'endroit du clic.
- **Une autre image**.

Et c'est tout : ni mode, ni intensité, ni couleurs, ni graine à choisir.

## Les neuf chaos
Chacun est tiré au sort à parts égales, et chacun a ses propres hasards (direction, centre, vitesse, teintes…). Chaque fois, un commentaire s'affiche, choisi au hasard parmi quelques phrases, et l'« Avant » regrette un peu.

| Chaos | Ce qui se passe |
|---|---|
| **Pixels et couleurs mélangés** | Chaque pixel reçoit son rouge, son vert et son bleu de **trois pixels différents**, pris au hasard dans toute l'image (trois mélanges de **Fisher-Yates** indépendants). Ça apparaît au hasard, en vague ou en explosion : c'est tiré au sort aussi. |
| **Une couleur qui se propage** | À partir d'**un seul pixel** (un anneau le montre), on prend au hasard un pixel du bord de la zone gagnée, on lui donne une **couleur aléatoire**, et ses voisins rejoignent le bord : un modèle de croissance appelé **modèle d'Eden**. À la fin, tout est du bruit de couleurs. |
| **La tornade** | Tout tourne autour d'un point, de plus en plus fort au centre (jusqu'à plusieurs tours), dans un sens tiré au sort. |
| **La fonte** | L'image coule vers le **bas, le haut, la gauche ou la droite** (tiré au sort), chaque colonne à sa vitesse. |
| **Le bug** | Des tranches de lignes se décalent, le rouge, le vert et le bleu se séparent, et ça saccade comme un écran qui hoquette. |
| **La pluie numérique** | Des colonnes de caractères tombent, noircissent l'image au-dessus d'elles et la mangent, façon *Matrix*. |
| **Le tri sauvage** | Les pixels se rangent **par luminosité**, par paquets, en lignes ou en colonnes : un classique de l'art glitch. |
| **L'agitation** | À chaque instant, des pixels échangent leur place avec un autre pixel tiré au hasard, **de plus en plus loin** : l'image se disperse en poussière. |
| **Les ondes de choc** | Des vagues de **teintes** partent d'un point et font tourner les couleurs (la cape d'un magicien devient arc-en-ciel). |

### Les combos
Une fois sur cinq environ, le sort enchaîne **deux ou trois chaos**, chacun partant du résultat du précédent. La page l'annonce (« combo 2/3 : … »).

### Semer son propre chaos
Une fois le chaos fini, un clic sur l'image détruite lance une **tache** qui grandit de proche en proche à partir du clic, sur environ 1,5 à 5 % de l'image. Chaque tache est d'un type tiré au sort : du **bruit** de couleurs, de la **peinture** (une couleur au hasard, un peu bruitée) ou un **négatif** (les couleurs inversées).

## Comment ça marche
L'image est lue comme un tableau de pixels (`Uint32Array`, un nombre par pixel : rouge, vert, bleu, transparence). Chaque chaos reçoit l'image de départ de son étape et dessine, à chaque image de l'animation, dans un second tableau qu'on copie ensuite dans un `canvas`. Le hasard vient d'un générateur à graine (`mulberry32`), initialisé par `crypto.getRandomValues` à chaque chaos : c'est ce qui rend chaque chaos différent.

Quelques détails :
- **Fisher-Yates** donne à chaque ordre possible exactement la même probabilité. (Un premier essai du tirage utilisait un tri avec `Math.random() - 0.5`, connu pour favoriser certains résultats : « le bug » sortait 3 fois sur 100 au lieu de 11. Remplacé par un vrai mélange : 48 à 62 sorties pour chacun des neuf chaos sur 493 tirages.)
- **La tornade** utilise une table de sinus et de cosinus (4096 valeurs) au lieu d'appeler `Math.sin` pour chaque pixel et à chaque image.
- **La propagation** avance au **carré du temps**, car la surface d'un disque croît comme le carré de son rayon : ainsi la tache avance à vitesse constante.
- **Les ondes de choc** combinent une rotation de teinte (la même matrice que le `hue-rotate` de CSS) et une hausse de saturation, avec 64 matrices précalculées à chaque image.
- **La pluie numérique** dessine directement sur le `canvas` avec `fillText` ; à la fin, la pluie est figée (une traînée de caractères par colonne), puis l'image est relue pour que les combos puissent continuer dessus.
- **Le tri** utilise `Uint32Array.sort` (un tri numérique natif) sur des clés `luminosité << 11 | position`.

## Vérifications faites
- Les neuf chaos tournent sans erreur sur des images de 960 000 pixels à **77 à 121 images par seconde** (écran à 120 Hz) ; la tornade sur 1,3 million de pixels tourne à 114 images par seconde.
- Pas d'erreur dans la console, pas de débordement sur mobile ; un fichier texte et une fausse image sont refusés avec un message.
- Les clics lancent bien des taches (3 clics : 11,3 % des pixels modifiés), la barre d'espace relance un chaos, et le tirage donne 18 % de combos.

## Limites et choix
- **L'image est réduite à 1400 px de côté** au maximum (et 40 Mo, 100 mégapixels à l'origine), pour que les calculs restent rapides.
- Une image **transparente est posée sur un fond blanc** avant d'être détruite.
- Le code suppose un processeur « little-endian » (tous les ordinateurs et téléphones actuels) et le dit si ce n'est pas le cas.
- Si l'onglet est **en arrière-plan**, le navigateur suspend l'animation (et le décodage d'une image) : elle reprend quand on revient sur l'onglet.
- Avec « réduire les animations » activé dans le système, chaque chaos saute directement à son résultat, sans animation ni secousse.
- La page est en français seulement (pas de système de langues, contrairement au jour 4).
- **Pas de son** : un son qui se déclenche tout seul est vite pénible. Facile à ajouter si on le veut.

## Vie privée et sécurité
L'image est lue avec `Image` et `canvas` **localement** : elle n'est envoyée à aucun serveur, et il n'y a d'ailleurs aucun serveur. Les messages et commentaires sont écrits avec `textContent`.

## Installation
Rien à installer : pousser le repo, la page est servie par GitHub Pages.
