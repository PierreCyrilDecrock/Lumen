# Lumen

Jeu de puzzle sur la lumière (réflexion, réfraction, diffusion, dispersion), jouable dans le navigateur sur mobile et sur ordinateur.

> État : étape 5 du [plan de développement](docs/plan-de-developpement.md). 12 niveaux de réflexion jouables, avec menu, sélection des niveaux, étoiles, indices, pause et progression sauvegardée. La page `demo/` garde les curseurs de rendu.

## Commandes de jeu

| Action                                     | Tactile / souris                    | Clavier                            |
| ------------------------------------------ | ----------------------------------- | ---------------------------------- |
| Sélectionner un miroir                     | Toucher ou cliquer le miroir        |                                    |
| Tourner (pas de 15°)                       | Glisser la poignée ou l'anneau cyan | R / Maj+R, flèches gauche / droite |
| Déplacer (miroir avec un anneau au centre) | Glisser le miroir                   |                                    |
| Annuler / Rétablir                         | Boutons en haut à droite            | Ctrl+Z / Ctrl+Maj+Z (ou Ctrl+Y)    |
| Désélectionner                             | Toucher une zone vide               | Échap                              |
| Temps de frame                             |                                     | D                                  |

## Lancer

Node 20.19+ ou 22.12+.

```sh
npm install
npm run dev       # http://localhost:5173, et l'adresse réseau local pour tester sur téléphone
                  # démo du rendu : http://localhost:5173/demo/
```

## Tester

```sh
npm test          # Vitest
npm run lint      # ESLint + Prettier
npm run typecheck # TypeScript strict
```

## Construire

```sh
npm run build     # produit dist/, 100 % statique, chemins relatifs (GitHub Pages)
npm run preview   # sert dist/ en local
```

## Licence

Police Space Grotesk : SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
