/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: r('./index.html')
      }
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '@src': r('./src'),
      '@ui': r('./ui'),
      '@rules': r('./rules'),
      '@tables': r('./tables'),
      '@sources': r('./sources'),
      '@evidence': r('./evidence'),
      '@profiles': r('./profiles'),
      '@variants': r('./variants')
    }
  }
});
