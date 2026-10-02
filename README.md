# DEVTOBER

Comme l'Inktober, mais pour les devs : **1 mot par jour pendant tout octobre**. Chaque jour, on crée quelque chose en code inspiré du mot, et on le publie.

Total liberté sur la forme : jeu, animation, art génératif, outil, expérience UI... chacun interprète le mot comme il veut.

- Environ **1h30 à 2h** par jour. Pas besoin que ce soit parfait, l'important c'est de publier.
- Pas obligé de faire les 31 jours, on participe quand on veut.
- Hashtag : **#devtober**

## Les mots

| Jour | Mot | Projet |
|---|---|---|
| 01 | Pulse | [Day-01-pulse](Day-01-pulse) |
| 02 | Loop | [Day-02-loop](Day-02-loop) |
| 03 | Bloom | |
| 04 | Drift | |
| 05 | Chaos | |
| 06 | Tiny | |
| 07 | Swarm | |
| 08 | Maze | |
| 09 | Gravity | |
| 10 | Fold | |
| 11 | Ripple | |
| 12 | Lost | |
| 13 | Tangle | |
| 14 | Bounce | |
| 15 | Shadow | |
| 16 | Tide | |
| 17 | Orbit | |
| 18 | Glitch | |
| 19 | Echo | |
| 20 | Fragile | |
| 21 | Signal | |
| 22 | Mirror | |
| 23 | Spark | |
| 24 | Hidden | |
| 25 | Melt | |
| 26 | Machine | |
| 27 | Haunted | |
| 28 | Grow | |
| 29 | Infinite | |
| 30 | Collapse | |
| 31 | Wake | |

## Organisation du repo

Un dossier par jour, nommé `Day-XX-mot` (ex : `Day-01-pulse`). Chaque dossier contient :

- le code du projet (le plus souvent une page HTML, ex : `pulse.html`, à ouvrir dans un navigateur) ;
- un `README.md` qui explique le code et **en quoi il correspond au mot**.

La page `index.html` à la racine est le **hub** : une grille des 31 mots où chaque jour terminé est cliquable. Pour y ajouter un projet, il suffit de renseigner son chemin à côté du mot dans la liste `DAYS` du script.

```
DevTober/
├── README.md
├── index.html        (le hub)
├── Day-01-pulse/
│   ├── pulse.html
│   └── README.md
├── Day-02-loop/
└── ...
```

## Participer

1. Crée un repo GitHub **public** avec un dossier par jour (`Day-01-pulse`, `Day-02-loop`...).
2. Dans chaque dossier, ajoute un README qui explique ton code et le lien avec le mot.
3. Ajoute le topic **`devtober`** à ton repo (la roue crantée à côté de « About ») pour qu'on puisse tous les retrouver : [github.com/topics/devtober](https://github.com/topics/devtober).
4. Poste ton lien avec un GIF ou un screenshot, avec **#devtober**.

## Et après ?

Une plateforme où les projets de chaque jour seront visibles et jouables par tout le monde est envisagée, pour que chacun puisse tester les créations des autres. Uniquement avec l'autorisation du créateur.
