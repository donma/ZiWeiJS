import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist/standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    rollupOptions: {
      input: r('./ui/app/main.ts'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: '[name][extname]'
      }
    }
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
