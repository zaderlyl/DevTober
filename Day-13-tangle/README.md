# Day 13 - Tangle

On choisit une **photo**, et des **branches Git** colorées poussent sur un fond sombre, s'enchevêtrent et redessinent ses **contours**, avec ses **couleurs en version simplifiée**. Le but : reconnaître l'image à l'œil, uniquement avec des traits, des points (les « commits ») et des courbes de fusion.

## Lien avec le mot
*Tangle* : un enchevêtrement. L'image n'est jamais dessinée d'un coup : elle apparaît parce que des dizaines de branches colorées se croisent, se rejoignent et partent les unes des autres, comme un historique Git qui s'emmêle.

## Ce qu'on peut faire
- **Choisir une photo** (bouton, ou la glisser sur la zone noire). Elle reste dans le navigateur, rien n'est envoyé.
- **Exemple** : une petite image dessinée par le code (montagnes, maison, soleil), pour essayer sans photo.
- **Rejouer** l'animation.
- **Couleurs** (3 à 10) : le nombre de couleurs gardées. Peu de couleurs = très simplifié.
- **Détail** (0 à 100 %) : plus on monte, plus la grille a de colonnes (le dessin est plus précis) et plus on ajoute de petits contours. À 0, seules les frontières entre zones de couleurs sont tracées.
- **Vitesse** de l'animation (environ 9 secondes à ×1).
- À côté du dessin : la **photo d'origine** en miniature et la **palette** gardée, pour comparer.

## Comment ça marche
1. **Réduction** : la photo est ramenée à 200 pixels de large au plus, puis floutée légèrement.
2. **Simplification des couleurs** : un algorithme de **k-moyennes** (avec une initialisation k-means++) regroupe les pixels en *k* couleurs. Un filtre « couleur majoritaire du voisinage », passé deux fois, enlève les petites taches.
3. **Contours** : on marque les pixels où la couleur change (frontières entre zones), plus, selon le réglage Détail, les pixels où le **filtre de Sobel** trouve un changement net de luminosité.
4. **La grille** : le dessin est posé sur une grille de cases (de 28 à 78 colonnes selon le Détail). Une case est « allumée » si un contour la traverse, et prend la couleur dominante de la zone. C'est ce qui donne le côté ordonné d'un graphe de commits, où tout est rangé en rangées.
5. **Affinage** : l'algorithme de **Zhang-Suen** amincit les cases allumées jusqu'à une seule case d'épaisseur.
6. **Branches** : on suit les cases de proche en proche. Les branches sont reliées là où elles se touchent, simplifiées (**Douglas-Peucker**) et dessinées avec des **coins arrondis**, comme les courbes d'un graphe Git. La couleur change le long de la branche, selon la zone qu'elle longe.
7. **Commits** : un point toutes les deux cases, avec un anneau de la couleur du fond autour, comme sur GitHub.
8. **Animation** : le graphe se révèle **de haut en bas**, comme un historique de commits qui s'empile. Une ligne lumineuse descend et chaque point apparaît avec un petit rebond.

## Limites et choix
- **Moins libre, plus lisible** : les branches ne suivent plus les contours pixel par pixel. Elles sont rangées sur une grille, avec des angles et des coins arrondis. L'image est donc un peu moins précise, mais le dessin est calme et ressemble à un vrai graphe. Pour plus de précision, monte le réglage Détail (plus de colonnes).
- Ce n'est **pas un vrai graphe Git** : les lignes ne sont pas toutes verticales et les points ne sont pas tous alignés sur des colonnes fixes. On garde l'esprit (lignes colorées arrondies, commits, révélation de haut en bas), pas la structure.
- **Pas d'étiquettes ni de fusions marquées** : j'ai retiré les noms de branches et les nœuds de fusion de la version précédente, qui chargeaient le dessin.
- Les **petits contours** (moins de quatre cases) sont ignorés.
- **Les photos peu colorées** (comme une photo en gris) donnent des branches grises : la page garde les couleurs de l'image, elle n'en invente pas.
- Les **photos très détaillées** (feuillages, foule) donnent un dessin chargé. Baisser le détail ou le nombre de couleurs aide.
- Les branches ne sont **pas de vrais commits Git** : rien n'est écrit dans un dépôt, c'est seulement un dessin.
- Testé sur l'exemple intégré et sur une photo presque grise (un œil), dans un navigateur de bureau : **je n'ai pas pu vérifier le rendu sur une photo très colorée**, ni sur téléphone.
- Avec **« réduire les animations »** activé, le dessin apparaît d'un coup.

## Vie privée et sécurité
La photo est lue localement avec un `canvas`, jamais envoyée. Aucune bibliothèque, aucune police externe.

## Installation
Rien à installer : ouvrir `tangle.html` dans un navigateur, ou pousser le repo (GitHub Pages).
