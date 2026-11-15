/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const raiz = (ruta: string): string => fileURLToPath(new URL(ruta, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@design-system': raiz('../design-system'),
      '@': raiz('./src'),
    },
  },
  server: {
    fs: { allow: ['.', '../design-system'] },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
