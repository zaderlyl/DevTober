# Day 01 - Pulse

Chaque touche pressée fait apparaître sa lettre au centre de l'écran, puis elle tombe.

## Lancer
Ouvrir `index.html` dans un navigateur. Aucune dépendance.

## Lien avec le mot
La lettre apparaît avec un battement (elle grossit puis revient à sa taille, comme un pouls) avant que la gravité la prenne.

## Technique
- Un `keydown` crée un élément par lettre
- Boucle `requestAnimationFrame` : phase de pulse (scale sinusoïdal), puis chute avec accélération constante
- La lettre est supprimée du DOM quand elle sort de l'écran
