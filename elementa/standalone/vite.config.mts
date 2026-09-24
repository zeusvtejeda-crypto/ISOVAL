import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Compila la app como SPA de un solo archivo (ver standalone/build.mjs). Los módulos de Next que usa la
 * app en el cliente (`next/link`, `next/navigation`, `next/image`) se sustituyen por equivalentes con
 * enrutador por hash.
 */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: './',
  publicDir: false,
  logLevel: 'warn',
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: here('./shims/next-link.tsx') },
      { find: /^next\/navigation$/, replacement: here('./shims/next-navigation.ts') },
      { find: /^next\/image$/, replacement: here('./shims/next-image.tsx') },
      { find: /^@\//, replacement: `${here('../src')}/` },
    ],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.NEXT_PUBLIC_BUILD_VERSION': JSON.stringify(process.env.ELEMENTA_BUILD ?? 'standalone'),
  },
  css: { postcss: here('..') },
  build: {
    outDir: here('../dist-standalone/.vite'),
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    target: 'es2020',
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: { inlineDynamicImports: true },
      // "use client" no aplica fuera de Next: se descarta sin aviso.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
