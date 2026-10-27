import { defineConfig } from 'vite';

// GitHub Pages serves this project from /<repository-name>/; local development stays at /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/moonlit-red-cliff-learning-game/' : '/',
});
