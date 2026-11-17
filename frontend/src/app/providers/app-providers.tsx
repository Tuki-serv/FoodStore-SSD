import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router/routes';

/** Proveedores globales de la app. Hoy solo el router; TanStack Query y la sesión se suman en C-13b. */
export function AppProviders() {
  return <RouterProvider router={router} />;
}
