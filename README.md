# Lumen

Jeu de puzzle sur la lumière (réflexion, réfraction, diffusion, dispersion), jouable dans le navigateur sur mobile et sur ordinateur.

> État : étape 3 du [plan de développement](docs/plan-de-developpement.md). Moteur de réflexion testé et rendu de la lumière. La page `demo/` montre « Le Zigzag » avec deux curseurs (faisceau, impacts) ; la touche D affiche le temps de frame.

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
