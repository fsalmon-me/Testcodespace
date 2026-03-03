# Shapes Arena — prototype

Jeu 2D prototype (solo + multi) — rendu uniquement avec formes générées par le moteur.

Pour démarrer en développement:

1. Installer dépendances:

```bash
npm install
```

2. Lancer le serveur + client (Vite + Node):

```bash
npm run dev
```

Le client sera servi par Vite (http://localhost:5173) et le serveur WebSocket sur http://localhost:3000.

Construire pour production:

```bash
npm run build
npm start
```


Fichiers importants:

- `client/` : code client TypeScript + Phaser
- `server/` : serveur Node + socket.io
- `client/src/engine/shapeFactory.ts` : génération procédurale des formes

## Automatisation des tests (CI)

Ce projet utilise GitHub Actions pour lancer automatiquement les tests à chaque push ou pull request sur `main`.

Le workflow CI :
- Installe les dépendances
- Démarre le serveur Node.js
- Exécute le test automatisé de collecte de pickup et de score (`tools/test-pickup.js`)

Les résultats sont visibles dans l'onglet "Actions" du dépôt GitHub.

Pour tester en local :

```bash
node server/index.js &
sleep 2
node tools/test-pickup.js
```

Améliorations possibles : IA bots, meilleure synchronisation client/serveur, effets visuels, lobby.
