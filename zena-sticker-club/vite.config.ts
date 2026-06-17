/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { imagetools } from 'vite-imagetools';
import { fileURLToPath, URL } from 'node:url';

// The 48 source PNGs live in /assets/cards and are transcoded at build time by
// vite-imagetools (AVIF/WebP at thumb + hero sizes). three.js is split into its
// own deferrable chunk so the core loop never blocks on the WebGL accent layer.
export default defineConfig({
  plugins: [imagetools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
