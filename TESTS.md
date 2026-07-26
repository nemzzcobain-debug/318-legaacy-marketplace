# Tests et intégration continue

## Commandes locales

- `npm run typecheck` vérifie les types TypeScript sans produire de fichiers.
- `npm run test:run` exécute tous les tests une fois.
- `npm test` lance Vitest en mode interactif.
- `npm run build` vérifie que l'application Next.js peut être construite.

## Ce qui est actuellement couvert

- validation des inscriptions et connexions ;
- validation des beats et des enchères ;
- inscription artiste et beatmaker ;
- refus des doublons et des données invalides ;
- validation d'une tentative d'enchère ;
- montant minimal de surenchère et montant minimum renvoyé au client ;
- blocage d'une enchère sur son propre beat ;
- enchères terminées ou inactives ;
- gestion des erreurs serveur.

## CI GitHub

Le workflow `.github/workflows/ci.yml` s'exécute :

- sur chaque pull request ;
- sur chaque modification fusionnée dans `main`.

Il bloque la validation si TypeScript, les tests ou le build Next.js échouent.
