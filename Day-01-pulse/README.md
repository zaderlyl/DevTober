# Day 01 - Pulse

Chaque touche pressée fait apparaître sa lettre au centre de l'écran, avec un battement. Si on tape assez vite, les lettres s'alignent et forment un mot, qui tombe d'un seul bloc dès qu'on s'arrête. Un clic envoie une onde (un "pulse") qui pousse et fait vibrer les lettres sur son passage.

## Lancer
Ouvrir `index.html` dans un navigateur. Aucune dépendance.

## Interactions
- **Touche** : fait apparaître la lettre au centre. Elle bat, et les lettres déjà tapées glissent pour la laisser s'aligner avec elles.
- **Pause de 0,6 s** (ou **espace**) : le mot tombe d'un bloc. Une pause plus longue entre deux séries de lettres donne deux mots.
- Un mot qui dépasse 90 % de la largeur de l'écran tombe tout seul.
- **Clic** : une zone part du curseur, grossit et se dissipe. Son front pousse et fait trembler les lettres qu'il traverse.

## Lien avec le mot
Le *pulse* est présent à trois niveaux :
- la lettre apparaît avec un battement (elle grossit puis revient à sa taille, comme un pouls) ;
- le halo du clic est une impulsion qui se propage ;
- la vibration des lettres est l'écho de cette impulsion, qui s'éteint peu à peu.

## Technique
- Le DOM uniquement (une `div` par lettre), boucle `requestAnimationFrame`, aucune librairie.
- **Mesure du glyphe** : `measureText` donne la vraie hauteur et largeur visibles de chaque lettre, pour que le sol et les contacts collent au dessin et pas à sa boîte CSS.
- **Physique 2D maison** : position et vitesse en x et y, gravité, frottement au sol, murs latéraux. L'appui de chaque lettre est recalculé à chaque frame (le bas de la fenêtre ou le haut de la lettre en dessous), donc une lettre retombe si on retire celle qui la porte.
- **Collisions** : les lettres qui se chevauchent sont séparées selon l'axe où elles pénètrent le moins (quelques passes par frame). Un choc latéral échange un peu de vitesse.
- **Halo** : le rayon est calculé comme l'animation CSS (de 0,3 à 4 fois la taille de base, avec décélération). Seule la bande proche du front pousse, de moins en moins fort avec le temps. Un léger biais vers le haut permet de décoller du sol.
- **Vibration** : décalage aléatoire et petite rotation appliqués au rendu seulement, sans toucher à la physique, avec une amplitude qui s'éteint exponentiellement.

## Réglages
Les constantes en haut du script : `WORD_DELAY` (la pause qui fait tomber le mot), `GRAVITY`, `HALO_FORCE`, `HALO_BAND`, `SHAKE_MAX`, `SHAKE_DECAY`, `COLLISION_BOUNCE`.
