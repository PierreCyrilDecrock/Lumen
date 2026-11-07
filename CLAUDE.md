# CONTEXTE DU PROJET : Lumen

Jeu de puzzle web sur la lumière (réflexion, réfraction, diffusion, dispersion). Jouable sur mobile (tactile) et desktop (souris). Hébergé sur GitHub Pages. Interface en français, code et noms de variables en anglais.

## STACK

TypeScript strict + Vite, Canvas 2D, Pointer Events, Vitest. Pas de moteur de jeu ni de framework UI. Build statique avec base './'.

## ARCHITECTURE

```text
src/engine/   moteur optique pur (aucun accès DOM ni Canvas)
src/render/   dessin Canvas
src/game/     état, interactions, réglages
src/ui/       menus, HUD, réglages
src/levels/   niveaux en JSON + schéma
src/storage/  localStorage versionné
tests/        Vitest
```

## MÉCANIQUES

1. Réflexion : miroirs orientables par pas de 15°.
2. Réfraction : eau 1,33 / verre 1,5 / diamant 2,42, loi de Snell-Descartes, réflexion totale.
3. Diffusion : verre dépoli qui étale le rayon en éventail, cristaux à allumer, brume qui absorbe.
4. Dispersion : prisme qui sépare la lumière blanche en 6 couleurs, cibles colorées, filtres.

## STYLE VISUEL

Fond uni #02030A, aucun décor. Rayon : cœur blanc net de 3 px + halo coloré discret. Éclat d'impact discret aux miroirs, interfaces et cibles. Couleurs : cyan #8FEFFF (sélection, actions), ambre #FFB84D (cibles), spectre #FF4D5E #FF9F43 #FFE14D #5BE37D #4DA3FF #B58CFF. Police Space Grotesk. Interface sombre, boutons ≥ 44 px.

## RÈGLE D'OR

Les effets ne doivent jamais nuire à la lecture des faisceaux. Jamais de rayon en pointillé ni de points qui défilent sur un rayon. L'intensité du faisceau et celle des impacts sont réglables (0 à 100 %) dans les Réglages, et le cœur du rayon n'est jamais affecté.

## QUALITÉ

60 fps sur mobile milieu de gamme. prefers-reduced-motion respecté. Contraste du texte ≥ 4,5:1. Moteur optique couvert par des tests. Chaque étape se termine par un jeu qui se lance, un commit propre, et un résumé de 5 lignes maximum.

---

## Notes de travail

- Plan complet en 11 étapes : `docs/plan-de-developpement.md`. Une étape à la fois, puis tag `v0.N`.
- Commandes : `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Repère logique fixe 390 × 560 (`src/render/viewport.ts`) : toutes les coordonnées de jeu et de niveau sont dans ce repère.
- ESLint interdit à `src/engine/` d'importer `render/`, `ui/`, `game/`, `storage/` et d'utiliser les globales DOM.
- Fichiers de `public/` : référencés avec `/…` dans les sources, Vite les réécrit en chemins relatifs au build (`base: './'`). Ne jamais écrire de chemin absolu en dur ailleurs.
- Pas d'allocation dans les boucles de tracé et de rendu ; les objets d'événement de pointeur sont réutilisés.
- Rendu (`src/render/scene.ts`) : fond, pièces, lumière additive (halos en cache dans `halo.ts`, sprites d'impact), puis cœur du rayon en dernier. Le cœur fait 3 unités logiques, blanc opaque, et ne lit aucun réglage.
- Angles en degrés, 0° vers +x, sens horaire à l'écran (y vers le bas) : « \\ » = 45°, « / » = 135°.
- Interactions (`src/game/interaction.ts`) : sans DOM, testées en simulant des événements logiques. `src/game-view.ts` (GameView) relie canvas, entrées, interactions, tracé (une fois par frame au plus), rendu, compteur de rotations, victoire et indices. `window.__lumen` expose l'état pour les tests de bout en bout.
- Placement (`src/game/placement.ts`) : un miroir reste sur le plateau et ne chevauche ni mur, ni miroir, ni cible, ni émetteur.
- Niveaux : un fichier JSON par niveau dans `src/levels/<mécanique>/NN-nom.json`, validé par `parseLevel()` (`schema.ts`). Chaque niveau a une solution de référence ; `tests/levels.test.ts` vérifie qu'il n'est pas résolu au départ, que la solution allume toutes les cibles, que les pièces sont bien placées et que 3 étoiles sont atteignables.
- Étoiles : rotations (pas de 15°, arc le plus court, modulo 180° pour un miroir double face) ≤ `stars[0]` → 3, ≤ `stars[1]` → 2, sinon 1.
- Interface (`src/ui/`) : écrans en DOM dans `index.html`, routes en hash (`#/`, `#/niveaux`, `#/niveau/r01`) avec `history.pushState`. Sauvegarde : `src/storage/save.ts` (`lumen.save`, `schemaVersion`).
- Réfraction : `Medium` (rectangle, matière eau/verre/diamant). Hypothèses : milieux sans chevauchement dans l'air ; Snell-Descartes et réflexion totale ; reflet partiel à 15 % pour les rayons principaux seulement ; seule une lumière d'intensité ≥ 0,5 allume une cible ; pas de dispersion avant l'étape 8. Les pièces manipulables sont indexées miroirs puis blocs (`Interaction.piece(i)`). Les blocs `inTray` partent du bac.
- Diffusion : `Diffuser` (éventail de 9 rayons autour de la normale de sortie, poids de Lambert normalisés, décroissance 1/(1 + d/200)), `Crystal` (traversé, s'allume quand la lumière cumulée atteint son seuil), `Fog` (exp(-densité × longueur)). Un rayon d'éventail se réfléchit une fois au plus ; 200 rayons au plus par tracé. Victoire : `TraceResult.solved` (toutes les cibles et tous les cristaux). Pièces indexées miroirs, blocs, puis verres dépolis.
