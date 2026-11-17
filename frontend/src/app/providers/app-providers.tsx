import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router/routes';
import { crearQueryClient } from '@/shared/api';
import { SesionGate } from './sesion-gate';

/** Caché de datos del servidor de toda la app: una sola instancia (creada acá, fuera del render). */
export const queryClient = crearQueryClient();

/** Proveedores globales de la app: caché de consultas, espera de la sesión y router. */
export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <SesionGate>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </SesionGate>
    </QueryClientProvider>
  );
}
