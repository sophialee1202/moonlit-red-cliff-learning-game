# Moonlit Red Cliff Learning Game

A browser based learning game inspired by Su Shi's *Ode to the Red Cliffs*. Players explore clues, compose a scene, answer interpretation questions, and reflect on their reading.

## Run locally

```bash
npm ci
npm run dev
```

Create a production build with:

```bash
npm run build
```

The GitHub Pages workflow builds the site on pushes to `main`. Its deploy job stays disabled until the repository variable `PAGES_PUBLISH_ENABLED` is set to `true` and Pages is configured to use GitHub Actions.
