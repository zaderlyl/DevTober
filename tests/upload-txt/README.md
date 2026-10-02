# Essai - envoyer un .txt vers l'IUT

Une page hébergée sur GitHub Pages envoie un fichier `.txt`, choisi sur l'ordinateur de la personne, vers un serveur PHP de l'IUT (web-mmi). Le serveur le range et renvoie un reçu ; la page vérifie que le fichier reçu est strictement identique à l'original.

> Ce n'est pas un jour du DevTober : c'est un essai à part.

## Fonctionnement
```
 ordinateur ──(choisir un .txt)──▶ page (GitHub Pages) ──POST multipart──▶ upload.php (IUT)
                                          ▲                                      │
                                          └────── reçu : nom, taille, SHA-256 ◀──┘
```
1. **Choisir** : une div de dépôt (clic, clavier ou glisser-déposer).
2. **Vérifier ici** : extension `.txt`, taille, vrai texte UTF-8, avec un aperçu des premières lignes.
3. **Envoyer** : `fetch` avec un `FormData`. C'est une requête CORS « simple » (multipart), donc sans pré-requête.
4. **Reçu et identique** : la page calcule le SHA-256 du fichier (Web Crypto) et le compare à celui calculé par le serveur sur ce qu'il a reçu.

Une liste en bas montre les fichiers rangés sur le serveur (clic = le contenu en texte brut).

## Installation
- **GitHub :** pousser le repo (la page est servie par GitHub Pages).
- **IUT :** déposer `upload.php` sur l'espace web, dans un dossier **accessible en écriture** pour PHP. Le script crée tout seul le dossier `uploads/` à côté de lui. Si la page indique « impossible de créer le dossier uploads/ », le créer à la main avec les droits d'écriture (`chmod 755`, ou `777` si PHP ne tourne pas sous ton compte).
- L'URL de `upload.php` (en **https**) est pré-remplie dans la page et modifiable ; elle est retenue d'une visite à l'autre.

## Sécurité
Un endpoint public qui reçoit des fichiers est une cible classique, donc le serveur ne fait confiance à rien de ce que la page lui envoie. Les contrôles de la page ne servent qu'à répondre plus vite : **le serveur refait tout** (testé en contournant la page).

| Risque | Réponse |
|---|---|
| Envoyer un script (`.php`, `.txt.php`…) | seule l'extension `.txt` est acceptée, **et le nom envoyé n'est jamais utilisé** : le fichier est toujours rangé sous un nom généré (`AAAAMMJJ-HHMMSS-8hex.txt`) |
| Un faux `.txt` (image, binaire) | contenu vérifié : pas d'octet nul, UTF-8 valide |
| Contenu piégé dans un vrai `.txt` (`<?php`, `<script>`) | rangé en `.txt`, relu **en `text/plain`** avec `nosniff` et `Content-Security-Policy: default-src 'none'` : jamais exécuté ni interprété |
| Lire un autre fichier du serveur (`?file=../upload.php`) | `?file=` n'accepte que le format de nom généré par le script : tout le reste donne 404 |
| Envois depuis un autre site | l'en-tête `Origin` doit être la page DevTober (ou `localhost`) ; la vérification est stricte (`github.io.evil.com` est refusé) |
| Remplir le disque ou spammer | 20 Ko max, 10 envois par minute et par visiteur, 50 fichiers conservés (les plus anciens sont supprimés) |
| Fuite d'adresses IP | jamais écrites en clair ; le fichier de compteurs (`uploads/rate.php`) répond 404 s'il est ouvert |
| Listing du dossier | un `index.html` vide y est déposé |

**Limite à connaître :** le contrôle d'origine arrête les navigateurs et les appels directs, mais quelqu'un qui connaît l'URL peut fabriquer un faux en-tête `Origin` depuis un script. Les autres protections (taille, format, quota, texte brut) limitent alors les dégâts à « quelques petits fichiers texte, 10 par minute ». Les fichiers sont visibles par quiconque ouvre `upload.php?list=1` : n'y envoie rien de privé.

## Technique
- `$_FILES` + `file_get_contents` du fichier temporaire, validation, puis `file_put_contents` avec verrou ; aucun `move_uploaded_file` du nom d'origine.
- Tout ce qui vient du fichier ou du serveur est affiché avec `textContent` : jamais interprété comme du HTML.
- Code séparé : `upload.html`, `upload.css`, `upload.js`, `upload.php`.
