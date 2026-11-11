import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 }, // Phaser alone is ~1.2 MB minified
});
