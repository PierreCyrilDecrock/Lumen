# Lumen — plan de développement

Nov 6, 2026 · @Pierre-Cyril

## Vue d'ensemble

Lumen sera un jeu de puzzle de lumière jouable dans le navigateur, sur mobile et sur desktop, livré en 11 étapes et hébergé sur GitHub Pages. Chaque étape a un prompt prêt à coller dans Claude Code, un livrable et un critère de validation.

Choix techniques :

- **Langage et build** : TypeScript avec Vite. La sortie est 100 % statique, ce qui convient exactement à GitHub Pages.
- **Rendu** : Canvas 2D avec fusion additive pour la lumière. Pas de moteur de jeu : le moteur optique est du code maison, séparé de l'affichage et testable sans écran.
- **Entrées** : Pointer Events, une seule API pour le doigt, la souris et le stylet.
- **Tests** : Vitest pour l'optique (réflexion, Snell-Descartes, dispersion), Playwright pour un test de bout en bout.
- **Données** : niveaux en JSON, validés au chargement. Sauvegarde dans localStorage.
- **Hébergement** : GitHub Actions vers GitHub Pages, avec `base: './'` pour que le jeu fonctionne sous `/nom-du-depot/`.

Principes tenus à chaque étape :

1. Le jeu se lance et peut être déployé à la fin de chaque étape.
2. Le cœur du rayon reste toujours net et continu, sans pointillé. Les effets de lumière se règlent, jamais au détriment de la lecture des faisceaux.
3. Fond uni, pas de décor superflu.
4. Le moteur optique ne dépend ni du DOM ni du Canvas.

## Brief à coller au début de chaque prompt

Ce brief donne à Claude Code tout le contexte du jeu. Enregistre-le dans un fichier `CLAUDE.md` à la racine du dépôt dès l'étape 1 : il sera relu automatiquement à chaque session. Sinon, colle-le avant le prompt de l'étape.

```text
CONTEXTE DU PROJET : Lumen
Jeu de puzzle web sur la lumière (réflexion, réfraction, diffusion, dispersion). Jouable sur mobile (tactile) et desktop (souris). Hébergé sur GitHub Pages. Interface en français, code et noms de variables en anglais.

STACK
TypeScript strict + Vite, Canvas 2D, Pointer Events, Vitest. Pas de moteur de jeu ni de framework UI. Build statique avec base './'.

ARCHITECTURE
src/engine/   moteur optique pur (aucun accès DOM ni Canvas)
src/render/   dessin Canvas
src/game/     état, interactions, réglages
src/ui/       menus, HUD, réglages
src/levels/   niveaux en JSON + schéma
src/storage/  localStorage versionné
tests/        Vitest

MÉCANIQUES
1 Réflexion : miroirs orientables par pas de 15°.
2 Réfraction : eau 1,33 / verre 1,5 / diamant 2,42, loi de Snell-Descartes, réflexion totale.
3 Diffusion : verre dépoli qui étale le rayon en éventail, cristaux à allumer, brume qui absorbe.
4 Dispersion : prisme qui sépare la lumière blanche en 6 couleurs, cibles colorées, filtres.

STYLE VISUEL
Fond uni #02030A, aucun décor. Rayon : cœur blanc net de 3 px + halo coloré discret. Éclat d'impact discret aux miroirs, interfaces et cibles. Couleurs : cyan #8FEFFF (sélection, actions), ambre #FFB84D (cibles), spectre #FF4D5E #FF9F43 #FFE14D #5BE37D #4DA3FF #B58CFF. Police Space Grotesk. Interface sombre, boutons ≥ 44 px.

RÈGLE D'OR
Les effets ne doivent jamais nuire à la lecture des faisceaux. Jamais de rayon en pointillé ni de points qui défilent sur un rayon. L'intensité du faisceau et celle des impacts sont réglables (0 à 100 %) dans les Réglages, et le cœur du rayon n'est jamais affecté.

QUALITÉ
60 fps sur mobile milieu de gamme. prefers-reduced-motion respecté. Contraste du texte ≥ 4,5:1. Moteur optique couvert par des tests. Chaque étape se termine par un jeu qui se lance, un commit propre, et un résumé de 5 lignes maximum.
```

Pour chaque étape : colle le prompt, laisse Claude Code travailler, vérifie les critères de validation, puis fais un commit et un tag (`v0.1`, `v0.2`…) avant de passer à la suivante.

## Roadmap en un coup d'œil

Onze étapes, toutes jouables et déployables ; la mécanique de réflexion est complète dès l'étape 5. L'effort est une estimation en sessions de travail avec Claude Code : S = 1 session, M = 2 à 3, L = 3 à 4.

| Étape | Objectif | Effort | Résultat jouable |
| --- | --- | --- | --- |
| 1 | Fondations du projet | S | Page déployable avec canvas responsive |
| 2 | Moteur optique : réflexion | M | Tracé de rayons correct, validé par des tests |
| 3 | Rendu de la lumière | M | Rayon net et lumineux à l'écran |
| 4 | Interactions tactile et souris | M | Miroirs qui se tournent et se déplacent |
| 5 | Niveaux, menus, progression | L | 12 niveaux de réflexion jouables |
| 6 | Réfraction | M | 10 niveaux avec eau, verre, diamant |
| 7 | Diffusion | M | 10 niveaux avec verre dépoli et cristaux |
| 8 | Dispersion | M | 10 niveaux avec prisme et couleurs |
| 9 | Réglages et écran titre | S | Intensités réglables et sauvegardées |
| 10 | Finition, performance, accessibilité | M | Jeu stable sur mobile et desktop |
| 11 | Livraison GitHub Pages | S | Dépôt prêt, site en ligne, archive de secours |

## Étape 1 — Fondations du projet

Objectif : un projet qui se lance, se construit et affiche un canvas net sur n'importe quel écran, avec la boucle de jeu et les entrées tactiles et souris.

Livrables :

- Dépôt Vite + TypeScript strict, ESLint, Prettier, Vitest
- Canvas plein écran avec repère logique fixe, boucle de jeu, couche d'entrée
- `README.md` et `CLAUDE.md` (le brief)

Prompt :

```text
Tu es mon développeur principal sur le projet Lumen (voir le brief ci-dessus). Étape 1 : fondations.

1. Crée le projet avec Vite + TypeScript strict, ESLint + Prettier et Vitest. Scripts npm : dev, build, preview, test, lint.
2. Dans vite.config.ts, mets base: './' (le jeu sera servi sous /nom-du-depot/ sur GitHub Pages).
3. Crée l'arborescence du brief (src/engine, render, game, ui, levels, storage, tests) avec un fichier index.ts vide dans chaque dossier.
4. Fais un canvas plein écran responsive : gestion de devicePixelRatio, du redimensionnement, de la rotation d'écran et des safe areas mobiles. Utilise un repère logique fixe de 390 x 560 unités, mis à l'échelle avec des marges (letterboxing), pour que les niveaux aient les mêmes coordonnées sur mobile et desktop.
5. Ajoute une boucle de jeu requestAnimationFrame avec delta time, mise en pause quand l'onglet est caché.
6. Ajoute une couche d'entrée Pointer Events (down, move, up, cancel) convertie en coordonnées logiques. Un seul pointeur actif pour l'instant. Applique touch-action: none sur le canvas pour bloquer le scroll et le zoom du navigateur.
7. Écran de démonstration : fond #02030A, le texte Lumen au centre, et un point qui suit le pointeur.
8. index.html : meta viewport, theme-color #02030A, police Space Grotesk auto-hébergée dans public/fonts (aucune requête vers un serveur externe).
9. Écris un README court (lancer, tester, construire) et un CLAUDE.md qui contient le brief du projet.
10. Fais un premier commit propre.

Contraintes : aucune dépendance inutile, aucun framework UI. À la fin, résume tes choix en 5 lignes maximum.
```

Validation :

- `npm run dev` affiche l'écran de démonstration sur desktop et sur téléphone (via le réseau local)
- `npm run build` produit `dist/` sans erreur
- Le point suit le doigt sans faire défiler la page, à toute taille d'écran, en portrait et en paysage

## Étape 2 — Moteur optique : réflexion

Objectif : un tracé de rayons exact et testé, indépendant de l'affichage. C'est la base de toutes les mécaniques suivantes.

Livrables :

- `src/engine/` avec les types, l'intersection rayon-segment et `traceRays()`
- Suite de tests Vitest sur la réflexion

Prompt :

```text
Étape 2 : moteur optique de réflexion dans src/engine/, sans aucune dépendance au DOM ni au Canvas.

Implémente :
- Les types Vec2, Segment, Ray et les pièces Mirror, Wall, Emitter, Target (position, angle, longueur).
- intersect(ray, segment), robuste : rayons parallèles, extrémités, epsilon numérique.
- traceRays(level, options) : lance chaque émetteur, trouve la première intersection, applique la réflexion r = d - 2(d.n)n sur les miroirs, s'arrête sur les murs et en sortie de plateau. Limite de rebonds (32 par défaut) contre les boucles infinies. Retourne la liste des segments de rayon (départ, arrivée, index de rebond, couleur blanche pour l'instant) et la liste des impacts (position, type de pièce, normale).
- Détection des cibles atteintes.
- Miroirs à deux faces, et miroirs à une face dont le dos absorbe.

Écris des tests Vitest : miroir à 45° ; incidence rasante ; zigzag de trois miroirs (émetteur en (54,170) vers la droite, miroirs en (200,170) orienté \\, (200,350) orienté \\ et (320,350) orienté /, cible en (320,230) : la cible doit être atteinte) ; rayon qui touche l'extrémité d'un miroir ; deux miroirs parallèles face à face (boucle, doit s'arrêter) ; rayon absorbé par un mur ; aucune cible atteinte.

Contraintes : fonctions pures, TypeScript strict, aucune allocation inutile dans la boucle de tracé (elle sera appelée à chaque frame pendant un glisser), JSDoc bref.
```

Validation :

- `npm test` passe, y compris le cas du zigzag
- Le dossier `src/engine/` n'importe rien venant de `render/` ni de `ui/`
- Un tracé de 32 rebonds s'exécute en moins de 1 ms

## Étape 3 — Rendu de la lumière

Objectif : afficher le tracé avec un rayon net et un halo discret, et rendre l'intensité des effets réglable dès maintenant.

Livrables :

- `src/render/` : pipeline Canvas, faisceaux, impacts, pièces
- `src/game/settings.ts` avec l'intensité du faisceau et des impacts
- Page de démonstration avec deux curseurs pour régler le rendu en direct

Prompt :

```text
Étape 3 : rendu de la lumière dans src/render/, qui consomme le résultat de traceRays().

1. Pipeline Canvas 2D : fond uni #02030A ; couche des pièces ; couche de lumière en mode additif (globalCompositeOperation = 'lighter') ; puis le cœur du rayon dessiné en dernier pour rester net.
2. Faisceau : un cœur blanc de 3 px (lineCap et lineJoin round), toujours net et continu. Jamais de pointillé, jamais de points ou d'impulsions qui défilent sur le rayon. Autour du cœur, deux halos (large et moyen) dont l'opacité et l'épaisseur dépendent de settings.beamIntensity (0 à 1). Les halos sont rendus sur un canvas hors-écran avec flou, mis en cache et redessinés seulement quand le tracé change.
3. Impacts : un éclat radial discret (dégradé) et une petite traînnée horizontale aux miroirs, interfaces et cibles. Taille et opacité selon settings.impactIntensity (0 à 1). À 0, l'impact est invisible mais le rayon reste net.
4. Pièces : miroirs (trait épais clair avec reflet), murs hachurés, émetteur, cible ambre #FFB84D avec un anneau qui pulse doucement (désactivable).
5. Module src/game/settings.ts avec beamIntensity (défaut 0,55), impactIntensity (défaut 0,45) et reducedMotion.
6. Page /demo : le niveau « Le Zigzag » et deux curseurs HTML (faisceau, impacts) pour régler le rendu en direct.

Contraintes : 60 fps sur mobile, aucune création d'objet dans la boucle de rendu, gradients mis en cache, rendu net en haute densité. Mesure le temps de frame et affiche-le en mode debug (touche D).
```

Validation :

- Le cœur du rayon reste net et continu même avec les deux curseurs à 100 %
- Aucune animation de points sur les rayons
- Le temps de frame reste sous 16 ms sur un téléphone récent

## Étape 4 — Interactions tactile et souris

Objectif : manipuler les pièces au doigt comme à la souris, avec un tracé qui suit en direct.

Livrables :

- Sélection, rotation par pas de 15°, déplacement sur grille
- Annuler et rétablir
- Retours visuels, clavier et vibration

Prompt :

```text
Étape 4 : interactions tactile et souris dans src/game/.

1. Sélection : toucher ou cliquer un miroir le sélectionne. Zone de capture d'au moins 44 px même si la pièce est plus petite. Affiche l'anneau de rotation cyan #8FEFFF et la poignée.
2. Rotation : glisser la poignée fait tourner le miroir autour de son centre, avec aimantation tous les 15°. Affiche l'angle en degrés. Au clavier : R et Maj+R, ou flèches gauche et droite, pour ±15°.
3. Déplacement : les pièces marquées movable se glissent sur une grille de 10 unités, sans sortir du plateau ni chevaucher un mur.
4. Annuler et rétablir : pile d'historique, Ctrl+Z, Ctrl+Maj+Z et deux boutons.
5. Recalcule le tracé à chaque changement pendant le glisser (limité à une fois par frame).
6. Retours : léger rebond visuel à la pose, curseur adapté sur desktop, vibration courte (navigator.vibrate) à chaque cran de 15° sur mobile si disponible.
7. Multitouch : un seul pointeur actif, les autres sont ignorés ; aucun zoom involontaire.

Ajoute des tests pour la pile d'historique et l'aimantation d'angle. À la fin, donne une liste de 8 cas à tester à la main sur téléphone.
```

Validation :

- Un miroir se tourne de 15° en 15° au doigt, sans que la page bouge
- Annuler et rétablir restaurent exactement l'état précédent
- Le rayon se met à jour pendant le glisser, sans saccade visible

## Étape 5 — Niveaux, menus et progression

Objectif : une première version complète du jeu autour de la réflexion, de l'écran de sélection jusqu'à la victoire. C'est la première version qu'on peut montrer.

Livrables :

- Format de niveau JSON avec validation et 12 niveaux de réflexion
- Test qui prouve que chaque niveau est résolvable
- Menu, sélection de niveaux, HUD, victoire, pause, indices, progression sauvegardée

Prompt :

```text
Étape 5 : niveaux, menus et progression. À la fin, la mécanique de réflexion est complète.

1. Format de niveau JSON (src/levels/schema.ts) avec validation à l'exécution et messages d'erreur clairs : id, titre, mécanique, taille du plateau, pièces (type, position, angle, movable, rotatable), émetteurs, cibles, nombre de rotations pour 3, 2 et 1 étoile(s), solution (angles des miroirs).
2. Crée 12 niveaux de réflexion de difficulté croissante, dont « Le Zigzag ». Ajoute un test Vitest qui applique la solution de chaque niveau et vérifie que toutes les cibles sont atteintes.
3. Écrans : menu principal (simple pour l'instant), sélection de niveaux (grille, étoiles, niveaux verrouillés), niveau en cours (HUD : retour, titre, indice, compteur de rotations, étoiles), victoire (animation sobre, étoiles gagnées, bouton suivant), pause.
4. Compteur de rotations et calcul des étoiles.
5. Indices : un bouton qui surligne la prochaine pièce à tourner, à partir de la solution décrite.
6. Progression sauvegardée dans localStorage (src/storage/) avec un numéro de version de schéma pour les migrations futures.
7. Navigation sans rechargement, avec history.pushState pour que le bouton retour du navigateur ne fasse pas quitter le jeu.

Interface en français, boutons de 44 px minimum, style du brief.
```

Validation :

- Les 12 niveaux sont résolubles (test automatique) et jouables au doigt
- La progression survit à un rechargement de la page
- Le bouton retour du navigateur ramène à l'écran précédent du jeu

## Étape 6 — Réfraction

Objectif : faire plier le rayon selon la matière traversée, avec la vraie loi de Snell-Descartes. Avant de coder, demande à Claude Code de lister ses hypothèses de physique pour les relire.

Livrables :

- Pièce `Medium` et loi de Snell-Descartes dans le moteur, avec réflexion totale
- Bac de matières et teinte du halo par milieu
- 10 niveaux de réfraction avec solutions testées

Prompt :

```text
Étape 6 : ajoute la réfraction au moteur et au jeu. Commence par me lister en 5 lignes tes hypothèses de physique, puis code.

Moteur (src/engine/) :
- Pièce Medium : polygone convexe (rectangle pour commencer) avec un indice n (air 1,0 ; eau 1,33 ; verre 1,5 ; diamant 2,42).
- À chaque entrée ou sortie d'un milieu : n1.sin(t1) = n2.sin(t2), angles mesurés depuis la normale. Gère la réflexion totale interne quand sin(t2) serait supérieur à 1.
- Réflexion partielle faible à chaque interface (rayon secondaire à 15 % d'intensité, limité à un niveau pour éviter l'explosion du nombre de rayons).
- Les rayons portent une intensité (0 à 1). Le moteur retourne aussi l'angle d'incidence et l'angle de réfraction pour l'affichage.
- Tests : 50° air vers eau = 35,2° ; air vers verre = 30,7° ; air vers diamant = 18,4° ; dalle à faces parallèles (l'angle de sortie égale l'angle d'entrée) ; réflexion totale diamant vers air au-delà de l'angle critique (24,4°) ; incidence normale (aucune déviation).

Rendu : la teinte du halo change selon le milieu (eau cyan, verre lavande, diamant rose) ; le cœur du rayon reste blanc et net. Les normales sont des traits pleins fins, jamais en pointillé. Les reflets partiels sont des traits fins et faibles.

Jeu : un bac de matières (Eau, Verre, Diamant) pour poser et déplacer des blocs ; affiche l'angle d'entrée et de sortie.

Niveaux : 10 niveaux (initiation à l'eau, ordre des blocs, réflexion totale, « Trois milieux »), avec leurs solutions et les tests correspondants.
```

Validation :

- Les angles des tests coïncident avec les valeurs ci-dessus à 0,1° près
- Un rayon qui sort d'un bloc de diamant au-delà de 24,4° est bien réfléchi
- Les 10 niveaux passent le test de solution

## Étape 7 — Diffusion

Objectif : un verre dépoli qui étale le rayon en éventail, des cristaux à allumer et une brume qui absorbe la lumière.

Livrables :

- Pièces `Diffuser`, `Crystal` et `Fog` dans le moteur, avec limite de rayons
- Rendu du cône lumineux, de la brume et des cristaux
- 10 niveaux de diffusion avec solutions testées

Prompt :

```text
Étape 7 : diffusion.

Moteur (src/engine/) :
- Pièce Diffuser (verre dépoli) : quand un rayon la traverse, il est remplacé par un éventail de N rayons (9 par défaut) répartis sur un angle réglable de 20° à 90°. Chaque rayon a une intensité qui décroît avec l'angle (profil de Lambert) et avec la distance.
- Pièce Crystal : s'allume quand l'intensité cumulée des rayons qui la touchent dépasse un seuil ; expose une progression de 0 à 1.
- Pièce Fog (zone de brume) : atténue l'intensité selon la longueur parcourue dans la zone (loi de Beer-Lambert simplifiée, coefficient réglable).
- Les rayons de l'éventail peuvent être réfléchis une fois. Limite globale de 200 rayons pour tenir 60 fps.
- Tests : l'énergie totale est conservée à l'atténuation près ; cristal dans le cône et hors du cône ; une brume épaisse éteint un cristal lointain ; la limite de 200 rayons est respectée.

Rendu :
- Le cône est un volume lumineux doux (polygone dégradé) dessiné sous les rayons fins, qui restent nets.
- La brume est une zone légère texturant un bruit généré une seule fois sur un canvas hors-écran, sans animation.
- Les cristaux sont des losanges qui s'embrasent avec un éclat discret réglé par impactIntensity.

Jeu : un curseur « Dépoli du verre » pour l'angle de l'éventail, et un compteur de cristaux allumés (x sur total).

Niveaux : 10 niveaux, dont « La grotte aux cristaux », avec solutions et tests.
```

Validation :

- Aucun niveau ne dépasse 200 rayons, et le jeu reste à 60 fps sur téléphone
- La brume rend un cristal lointain impossible à allumer, comme prévu par le test
- Les 10 niveaux passent le test de solution

## Étape 8 — Dispersion

Objectif : un prisme qui sépare la lumière blanche en six couleurs, et des cibles colorées qui demandent de choisir le bon rayon.

Livrables :

- Pièce `Prism` avec dispersion en 6 couleurs, filtres colorés et cibles colorées
- Mélange additif des couleurs (rouge + vert = jaune, etc.)
- 12 niveaux de dispersion avec solutions testées

Prompt :

```text
Étape 8 : dispersion.

Moteur (src/engine/) :
- Pièce Prism (triangle) : un rayon blanc qui entre est divisé en 6 rayons colorés (rouge #FF4D5E, orange #FF9F43, jaune #FFE14D, vert #5BE37D, bleu #4DA3FF, violet #B58CFF). Chaque couleur a un indice de réfraction légèrement différent (rouge le plus faible, violet le plus fort), donc un angle de sortie différent. Utilise la loi de Snell-Descartes déjà écrite à l'étape 6.
- Représente la couleur d'un rayon par trois composantes (r, g, b) entre 0 et 1, pour que le mélange additif soit un simple calcul : deux rayons qui se croisent sur une cible donnent la somme, plafonnée à 1.
- Pièce ColorTarget : s'allume quand la couleur reçue correspond à sa couleur cible avec une tolérance réglable.
- Pièce Filter : ne laisse passer qu'une couleur ou une famille de couleurs.
- Tests : un rayon blanc donne 6 rayons dans l'ordre spectral ; le violet dévie plus que le rouge ; rouge + vert = jaune ; une cible jaune s'allume avec rouge + vert mais pas avec le rouge seul ; un filtre bloque les autres couleurs.

Rendu :
- Les 6 rayons sont des lignes nettes avec leur halo coloré, sans aucun effet pointillé. Le cœur blanc de 3 px reste visible pour la lumière blanche.
- Les rayons colorés qui se superposent utilisent le mode additif ('lighter') pour que le mélange se voie.
- Le prisme est un triangle de verre discret avec un liseré clair.

Jeu : le joueur tourne le prisme ; une barre latérale montre les couleurs captées.

Niveaux : 12 niveaux, dont « Arc-en-ciel » (allumer 6 cibles) et « Mélange » (obtenir du jaune), avec solutions et tests.
```

Validation :

- Les tests de couleur passent, y compris le mélange additif
- Les 6 faisceaux restent distinguables à l'œil, même avec les effets réglés au maximum
- Les 12 niveaux passent le test de solution

## Étape 9 — Réglages, sauvegarde, écran titre

Objectif : l'écran de réglages avec l'intensité des faisceaux et des impacts, la progression sauvegardée et l'écran titre.

Livrables :

- Écran Réglages : curseurs Faisceau et Impact, interrupteur Réduire les animations, préréglages Doux, Normal, Intense
- Aperçu en direct des réglages
- Sauvegarde de la progression et des réglages dans localStorage
- Écran titre, sélection de niveau avec étoiles, écran de victoire

Prompt :

```text
Étape 9 : réglages, sauvegarde et écran titre.

Réglages (src/ui/settings.ts) :
- Deux curseurs de 0 à 100 : beamIntensity (halo et lueur du faisceau) et impactIntensity (éclat aux points d'impact, anneaux, étincelles). Valeurs par défaut : 60 et 60.
- Règle absolue : le cœur blanc de 3 px du faisceau et sa netteté ne dépendent JAMAIS de ces réglages. À 0, le faisceau reste parfaitement lisible.
- Interrupteur « Réduire les animations » : initialisé depuis prefers-reduced-motion, coupe les pulsations et les anneaux animés.
- Préréglages Doux (30/30), Normal (60/60), Intense (100/100).
- Un aperçu en direct : un faisceau court avec un impact, redessiné à chaque changement de curseur.
- Le moteur de rendu lit ces valeurs à chaque image ; aucun rechargement.

Sauvegarde (src/save/) :
- Un seul objet JSON dans localStorage, avec un champ schemaVersion. Contenu : réglages, niveaux terminés, étoiles par niveau, dernier niveau joué.
- Lecture défensive : si le JSON est invalide ou d'une version inconnue, repartir d'une sauvegarde vide sans planter. Enveloppe tous les accès dans try/catch (navigation privée, stockage plein).
- Tests unitaires de la lecture, de l'écriture, de la migration et des cas corrompus.

Écrans :
- Écran titre : Jouer, Niveaux, Réglages.
- Sélection de niveau : grille par chapitre (Réflexion, Réfraction, Diffusion, Dispersion), étoiles gagnées, niveaux verrouillés tant que le précédent n'est pas fini.
- Écran de victoire : étoiles selon le nombre de pièces utilisées, boutons Rejouer et Suivant.
- Boutons d'au moins 44 px, navigation clavier, libellés accessibles.
```

Validation :

- Mettre les deux curseurs à 0 laisse les faisceaux nets et lisibles
- La progression survit à un rechargement de la page, et une sauvegarde corrompue ne plante pas le jeu
- Tout se manipule au doigt sur téléphone et à la souris sur ordinateur

## Étape 10 — Finition, performance, accessibilité

Objectif : un jeu fluide sur un téléphone d'entrée de gamme, accessible, avec du son et un tutoriel court.

Livrables :

- Audio Web Audio (sons générés, pas de fichiers lourds) avec coupure du son
- Tutoriel intégré aux trois premiers niveaux
- Profilage et optimisations
- Passe d'accessibilité : contraste, mode daltonien, clavier
- Tests de bout en bout avec Playwright

Prompt :

```text
Étape 10 : finition.

Performance :
- Mesure d'abord (outil de performance du navigateur, simulation d'un téléphone d'entrée de gamme avec ralentissement CPU x4). Objectif : 60 fps sur les niveaux les plus chargés, 30 fps minimum sur appareil lent.
- Optimisations probables : halos pré-rendus sur canvas hors-écran, un seul canvas redessiné par image, pas d'allocation dans la boucle de rendu, ajustement du devicePixelRatio (plafonné à 2), pause quand l'onglet est caché.
- Ajoute un mode de qualité automatique : si la moyenne des 60 dernières images dépasse 24 ms, réduire la qualité des halos d'un cran.

Audio :
- Sons générés avec Web Audio : clic de pièce, tintement de cristal, accord de victoire. Aucun fichier audio.
- L'audio démarre après le premier geste de l'utilisateur (règle des navigateurs mobiles). Bouton Son activé/coupé, état sauvegardé.

Tutoriel :
- Niveaux 1 à 3 : une bulle qui montre le geste (glisser, tourner) et disparaît dès que le joueur l'a fait. Pas de long texte.

Accessibilité :
- Contraste suffisant pour tous les textes. Mode daltonien : chaque couleur du spectre reçoit aussi un symbole (cercle, carré, triangle…) sur les cibles et les filtres.
- Jouable au clavier : Tab pour choisir une pièce, flèches pour la déplacer, R pour tourner.
- Les animations respectent prefers-reduced-motion.

Tests de bout en bout (Playwright) : le jeu se charge, le niveau 1 se résout par un script de souris, la sauvegarde persiste après rechargement, test sur un viewport de téléphone et un viewport d'ordinateur.
```

Validation :

- Le jeu tient la fréquence d'images visée sur un vrai téléphone, pas seulement sur l'ordinateur
- Il se joue entièrement au clavier
- Les tests Playwright passent sur les deux tailles d'écran

## Étape 11 — Livraison GitHub Pages

Objectif : un jeu publié à une adresse publique, avec un déploiement automatique à chaque mise à jour, et une archive prête à déposer en cas de besoin.

Livrables :

- Build de production configuré pour un sous-dossier (Vite avec `base: './'`)
- Workflow GitHub Actions qui teste, construit et déploie sur GitHub Pages
- Archive `lumen-dist.zip` contenant le site déjà construit, à déposer à la main si besoin
- README : comment jouer, comment lancer en local, comment déployer
- Optionnel : version installable (manifeste et service worker)

Prompt :

```text
Étape 11 : livraison sur GitHub Pages.

Build :
- Vérifie que vite.config.ts utilise base: './' pour que le jeu fonctionne dans un sous-dossier (https://<utilisateur>.github.io/<depot>/). Aucun chemin absolu commençant par / dans le code, le HTML ou les niveaux.
- npm run build produit dist/. Teste-le avec npm run preview, puis avec un petit serveur statique placé dans un sous-dossier pour reproduire GitHub Pages.
- Ajoute un fichier public/.nojekyll vide.

Déploiement automatique :
- Crée .github/workflows/deploy.yml : sur chaque push vers main, installer les dépendances (npm ci), lancer le typecheck et les tests Vitest, construire, puis déployer dist/ avec les actions officielles actions/configure-pages, actions/upload-pages-artifact et actions/deploy-pages. Permissions minimales : contents read, pages write, id-token write. Une seule exécution à la fois (concurrency).
- Explique dans le README, en trois lignes, le réglage à faire une seule fois : Settings > Pages > Source : GitHub Actions.

Archive de secours :
- Un script npm run package construit puis crée lumen-dist.zip à partir du contenu de dist/ (les fichiers à la racine de l'archive, pas dans un sous-dossier).

Optionnel, version installable :
- manifest.webmanifest (nom, icônes 192 et 512, couleur de fond #02030A, display standalone) et un service worker qui met en cache les fichiers du jeu avec un nom de cache versionné, pour que le jeu fonctionne hors ligne et que les mises à jour remplacent l'ancien cache.

README : description du jeu, captures d'écran, lancer en local, lancer les tests, déployer, structure du code, licence.

Final : vérifie le site déployé sur un téléphone et un ordinateur (chargement, son, sauvegarde, plein écran) et donne-moi la liste de ce qui reste à faire, s'il y a lieu.
```

Validation :

- Le site s'ouvre à l'adresse GitHub Pages, sans erreur 404 dans la console
- Un push sur main redéploie automatiquement le jeu
- Le jeu fonctionne dans un sous-dossier, au rechargement, et sur téléphone
- `lumen-dist.zip` s'ouvre avec un index.html à la racine

## Risques et conseils

- **Effets trop forts** : le risque principal de ce jeu est de masquer les faisceaux. Garde le cœur blanc de 3 px hors de portée des réglages, et teste chaque niveau avec les curseurs à 100.
- **Performance mobile** : la diffusion multiplie les rayons. Garde la limite de 200 rayons et teste sur un vrai téléphone avant l'étape 11.
- **Physique contre plaisir** : quand une règle réaliste rend un niveau frustrant, simplifie. Le jeu doit rester lisible avant d'être exact.
- **Niveaux** : fais toujours écrire une solution à chaque niveau et teste-la automatiquement. Un niveau sans solution vérifiée finit par casser.
- **Un prompt à la fois** : lance une étape, vérifie la validation, puis passe à la suivante. Si le résultat dérive, ouvre une nouvelle session et recolle le brief.
- **Chemins GitHub Pages** : la plupart des échecs de déploiement viennent de chemins absolus. L'étape 11 les vérifie, mais pense-y dès le début.
- **Pas de pointillés** : aucun rayon animé en points, ni dans le rendu ni dans les réglages. Les anneaux pointillés de l'interface sont les seuls autorisés.
