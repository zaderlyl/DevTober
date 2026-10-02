# Essai - envoyer un fichier texte vers l'IUT

Une page hébergée sur GitHub Pages envoie un fichier `.txt` ou `.html`, choisi sur l'ordinateur de la personne, vers un serveur PHP de l'IUT (web-mmi). Le serveur le range et renvoie un reçu ; la page vérifie que le fichier reçu est strictement identique à l'original.

> Ce n'est pas un jour du DevTober : c'est un essai à part.

## Fonctionnement
```
 ordinateur ──(choisir un .txt)──▶ page (GitHub Pages) ──POST multipart──▶ upload.php (IUT)
                                          ▲                                      │
                                          └────── reçu : nom, taille, SHA-256 ◀──┘
```
1. **Choisir** : une div de dépôt (clic, clavier ou glisser-déposer).
2. **Vérifier ici** : extension `.txt` ou `.html`, taille, vrai texte UTF-8, avec un aperçu des premières lignes.
3. **Envoyer** : `fetch` avec un `FormData`. C'est une requête CORS « simple » (multipart), donc sans pré-requête.
4. **Reçu et identique** : la page calcule le SHA-256 du fichier (Web Crypto) et le compare à celui calculé par le serveur sur ce qu'il a reçu.

Une liste en bas montre les fichiers rangés sur le serveur (clic = le contenu en texte brut).

## Choisir le destinataire
Deux boutons remplissent l'URL de `upload.php` : **Mon espace** et **Espace de Lino**. On peut aussi coller n'importe quelle URL. `test.html` est un fichier d'exemple à envoyer pour essayer.

### Envoyer vers l'espace de quelqu'un d'autre
Un envoi ne peut réussir que si **le destinataire a déposé `upload.php` sur son propre espace** : on ne peut pas écrire sur le serveur de quelqu'un d'autre sans son accord, et la page ne contourne rien. Tant que ce n'est pas fait, la page l'indique : *« upload.php introuvable à cette adresse : le destinataire l'a-t-il déposé ? »*.

Pour recevoir des fichiers, le destinataire :
1. dépose `upload.php` sur son espace web (dossier accessible en écriture : le script crée `uploads/` tout seul) ;
2. n'a rien d'autre à régler : la liste `ALLOWED_ORIGINS` du script contient déjà la page GitHub Pages de DevTober (`https://zaderlyl.github.io`) ainsi que `localhost`. Pour accepter les envois d'une autre page, il ajoute son adresse dans cette liste, en haut du fichier.

## Installation
- **GitHub :** pousser le repo (la page est servie par GitHub Pages).
- **IUT :** déposer `upload.php` sur l'espace web, dans un dossier **accessible en écriture** pour PHP. Le script crée tout seul le dossier `uploads/` à côté de lui. Si la page indique « impossible de créer le dossier uploads/ », le créer à la main avec les droits d'écriture (`chmod 755`, ou `777` si PHP ne tourne pas sous ton compte).
- L'URL de `upload.php` (en **https**) est pré-remplie dans la page et modifiable ; elle est retenue d'une visite à l'autre.

## Sécurité
Un endpoint public qui reçoit des fichiers est une cible classique, donc le serveur ne fait confiance à rien de ce que la page lui envoie. Les contrôles de la page ne servent qu'à répondre plus vite : **le serveur refait tout** (testé en contournant la page).

| Risque | Réponse |
|---|---|
| Envoyer un script (`.php`, `.txt.php`, `.html.php`, `.svg`, `.htm`…) | seules les extensions `.txt` et `.html` sont acceptées (le nom doit **finir** par l'une des deux), **et le nom envoyé n'est jamais utilisé** : le fichier est toujours rangé sous un nom généré (`AAAAMMJJ-HHMMSS-8hex-test.html.txt` : le nom d'origine est gardé pour s'y retrouver, mais nettoyé (a-z 0-9 _ -, 30 caractères max) et toujours suivi de `.txt`) |
| Un fichier `.html` envoyé (donc potentiellement un script) | accepté mais **jamais conservé comme HTML** : il est rangé sous un nom `.txt` et relu en `text/plain` avec `nosniff` et une CSP `default-src 'none'`. Il ne peut pas s'exécuter, ce qui compte car `web-mmi2` est un seul domaine partagé par tous les étudiants (un HTML stocké tel quel s'exécuterait sur le même domaine que les espaces des autres) |
| Voir un `.html` reçu comme une page (`upload.php?view=NOM`) | la page s'affiche avec son style mais sous `Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:` : **aucun script ne s'exécute**, origine opaque (pas d'accès aux cookies ni aux autres espaces de `web-mmi2`), pas d'image ni de ressource externe. Testé avec un HTML contenant `<script>` et `onerror` : bloqué par le navigateur |
| Un faux `.txt` ou `.html` (image, binaire) | contenu vérifié : pas d'octet nul, UTF-8 valide |
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
