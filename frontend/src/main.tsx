import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { aplicarFavicon } from '@/app/favicon';
import { AppProviders } from '@/app/providers';
import { readConfig } from '@/shared/config';
import faviconUrl from '@design-system/assets/favicon.svg';
import '@/app/styles/index.css';

// Falla rápido (antes de montar React) si falta la configuración obligatoria.
readConfig(import.meta.env);

aplicarFavicon(faviconUrl);

const raiz = document.getElementById('root');
if (raiz === null) throw new Error('No se encontró el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
