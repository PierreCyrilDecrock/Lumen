import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base: the game is served from /<repo-name>/ on GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
