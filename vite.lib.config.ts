import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: r('./src/index.ts'),
      name: 'ZiWei',
      formats: ['es', 'iife'],
      fileName: (format) =>
        format === 'es' ? 'ziwei-bible.esm.js' : 'ziwei-bible.browser.js'
    },
    rollupOptions: {
      output: {
        exports: 'named'
      }
    }
  },
  resolve: {
    alias: {
      '@src': r('./src'),
      '@rules': r('./rules'),
      '@tables': r('./tables'),
      '@sources': r('./sources'),
      '@evidence': r('./evidence'),
      '@profiles': r('./profiles'),
      '@variants': r('./variants')
    }
  }
});
