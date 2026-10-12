# Day 12 - Lost

Un **musée de six langages de programmation perdus ou presque**. À gauche, le **code** d'un programme d'exemple, **modifiable** ; à droite, son **résultat**. Si tu connais le langage, tu écris le tien, tu cliques sur « Exécuter » et la page le lit. Quand un programme se termine sans erreur, le langage est **retrouvé** ; quand les six le sont, la page le dit.

## Lien avec le mot
*Lost* : ces langages sont perdus de plusieurs façons. **Plankalkül** a existé sur le papier trente ans avant qu'une machine puisse le lire. **COBOL** se perd à mesure que ses lecteurs partent à la retraite. **Befunge** est un langage où le programme se promène sur une grille et peut se perdre. **Whitespace** est invisible. **Brainfuck** et **Malbolge** sont faits pour qu'on s'y perde.

## Comment ça marche
1. On choisit un langage dans la liste : son code est « déterré » (il se déchiffre de gauche à droite).
2. Le code est dans une vraie zone de texte. On peut le modifier librement ; « Rétablir l'exemple » le remet.
3. « Exécuter » le lance à la vitesse choisie (de 1 pas par seconde à très vite), « Un pas » avance d'un seul pas, « Recommencer » repart de zéro.
4. Pendant l'exécution, le caractère ou la ligne en cours est éclairé, les endroits déjà passés restent teintés, et l'état de la machine (pile, bande, variables…) est affiché sous le résultat.
5. Une erreur dans le programme (parenthèse manquante, instruction inconnue, pile vide, etc.) est expliquée à droite, avec le numéro de ligne quand il y en a un. Un programme qui tourne plus de 3 millions de pas est arrêté (boucle infinie).

## Les six langages

Tous les six ont maintenant un **vrai interpréteur**, écrit pour la page. Les deux plus anciens ne gèrent qu'une partie du langage.

| Langage | Année | Ce qui est géré |
|---|---|---|
| Plankalkül | 1945 | **dialecte reconstitué** : `expression => variable` (V, Z ou R + numéro), `W (condition)` pour répéter, `Wenn (condition)` pour choisir, blocs décalés. Les variables R sont affichées à la fin. |
| COBOL | 1959 | **sous-ensemble** : `DISPLAY`, `MOVE`, `ADD … TO`, `SUBTRACT … FROM`, `MULTIPLY … BY`, `COMPUTE`, `IF / ELSE / END-IF`, `PERFORM UNTIL`, `PERFORM n TIMES`, `PERFORM VARYING`, `STOP RUN`, avec `PIC 9` et `PIC X`. |
| Brainfuck | 1993 | complet (la lecture `,` donne 0) |
| Befunge | 1993 | Befunge-93 complet sauf les entrées `&` et `~` |
| Whitespace | 2003 | complet sauf la lecture au clavier |
| Malbolge | 1998 | complet sauf la lecture au clavier |

### Les deux langages incomplets
- **COBOL** : les variables suivent la vraie règle des images `PIC`. Un `PIC 9(3)` affiche toujours trois chiffres (`031`, pas `31`), un nombre trop grand est tronqué, un `PIC X(5)` est complété par des espaces, un nombre n'a pas de signe. Les numéros de ligne à six chiffres sont facultatifs. Les phrases de COBOL réel (`IF X IS GREATER THAN Y`, `PERFORM paragraphe`, sections…) ne sont pas gérées : la page répond « instruction non reconnue ».
- **Plankalkül** : je n'ai pas de source pour un « vrai » Plankalkül exécutable, et la notation d'origine (trois lignes superposées) n'a pas de forme texte standard. J'ai donc **inventé un dialecte inspiré de ses idées** : le `=>` d'affectation est celui de Zuse, `W` pour Wiederholung (répéter) aussi ; `Wenn` est mon ajout. Si tu connais le vrai Plankalkül, ne t'attends pas à ce que ton code tourne tel quel.

### Whitespace : comment on saisit l'invisible
- Le programme d'exemple est écrit avec un petit assembleur (`push 76`, `outc`, `label 1`…) qui produit du vrai texte fait d'espaces, de tabulations et de retours à la ligne, puis la page l'affiche avec des symboles : `·` espace, `⇥` tabulation, `↵` retour à la ligne.
- L'interpréteur lit le texte saisi : **s'il contient un de ces symboles, seuls les symboles comptent** (tout le reste est un commentaire, comme dans le vrai langage). **S'il n'en contient aucun**, ce sont les vrais espaces, tabulations et retours à la ligne qui comptent : on peut donc y coller un vrai programme Whitespace.
- Trois boutons (· ⇥ ↵) insèrent les symboles à l'endroit du curseur, parce que la tabulation est difficile à taper dans une zone de texte.

### Befunge
Grille de 80 colonnes sur 25 lignes au plus, pile, quatre directions, bords qui se rejoignent. Le pointeur éclairé suit le chemin du programme.

### Malbolge
L'interpréteur suit la spécification (mémoire de 59 049 mots de dix trits, registres A, C, D, opération « folle » sur les trits, chiffrement de chaque instruction après lecture). Chaque caractère du programme doit être une instruction valide à sa position, sinon la page indique lequel et où : c'est ce qui rend le langage presque impossible à écrire à la main.

## Le programme Malbolge a été trouvé par une recherche
Malbolge est fait pour qu'on ne puisse pas l'écrire à la main. Au lieu de recopier de mémoire un programme connu (je n'ai pas réussi à en retrouver un qui marche), j'ai écrit un programme qui **cherche** le sien :

1. Si on n'utilise ni saut ni déplacement du pointeur de données, le programme s'exécute en ligne droite : à chaque pas, la case lue est celle de l'instruction.
2. À chaque position, l'instruction est `(caractère + position) mod 94`. Pour obtenir une instruction voulue (opération folle, rotation, rien, afficher, fin), un seul caractère imprimable convient.
3. Pour afficher une lettre, une recherche en largeur explore les états `(A, position mod 94)` en essayant ces opérations, jusqu'à ce que `A mod 256` vaille le code de la lettre. On ajoute alors l'instruction « afficher » et on passe à la lettre suivante.
4. On termine par l'instruction « fin ».

Le résultat est un programme de 173 caractères qui affiche « Lost ». Je l'ai exécuté avec l'interpréteur de la page (172 pas) : la sortie est bien `Lost`. Le début, une suite de caractères qui descend dans la table ASCII, est une longue série d'instructions « rien » qui servent à décaler la position.

## Limites et choix
- Les interpréteurs sont **testés sur les programmes d'exemple et sur quelques programmes écrits pour les mettre à l'épreuve** (sorties vérifiées sous Node.js, puis dans le navigateur). Je ne garantis pas qu'ils lisent tous les programmes de leur langage : voir le tableau pour ce qui manque.
- La zone de code est une `textarea` posée sur un calque qui l'éclaire : pas de coloration syntaxique, et la tabulation du clavier change de champ au lieu d'insérer une tabulation (d'où les boutons pour Whitespace).
- La « fouille » est purement visuelle. Avec **« réduire les animations »** activé, elle est sautée.
- Les statuts « retrouvé » ne sont pas sauvegardés : ils se remettent à zéro quand on recharge la page. Un langage est « retrouvé » dès qu'un programme, même modifié, se termine sans erreur.
- Tout est testé dans un navigateur de bureau en fenêtre étroite ; pas sur un vrai téléphone.
- Pas de bibliothèque ni de police externe : tout est dans les trois fichiers.

## Vie privée et sécurité
Rien n'est envoyé ni stocké. Le code saisi et la sortie des programmes sont écrits avec `textContent`, jamais interprétés comme du HTML.

## Installation
Rien à installer : ouvrir `lost.html` dans un navigateur, ou pousser le repo (GitHub Pages).
