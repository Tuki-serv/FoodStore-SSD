import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { crearQueryClient } from '@/shared/api';

/** QueryClient nuevo por test, sin reintentos ni esperas. */
export function crearQueryClientDePrueba(): QueryClient {
  return crearQueryClient({ conReintentos: false });
}

/** `wrapper` de `renderHook`/`render` con el cliente dado. */
export function envolverConQuery(cliente: QueryClient) {
  return function EnvoltorioQuery({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}
