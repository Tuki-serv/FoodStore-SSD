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
    // Los tests no dependen del `.env` local: la URL del backend es fija (los pedidos los intercepta MSW).
    env: { VITE_API_URL: 'http://localhost:8000' },
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
