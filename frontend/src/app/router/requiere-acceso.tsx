import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ForbiddenPage } from '@/pages/forbidden';
import { selectEstado, selectRoles, useAuthStore } from '@/shared/auth';
import { puedeAcceder, RUTAS, type Acceso } from '@/shared/config';
import { PantallaCarga } from '@/shared/ui';
import { destinoTrasIngresar, rutaRecordada } from './destino';

/**
 * Guard de una ruta según su acceso (ayuda de navegación: el backend autoriza cada pedido):
 * - anónimo en ruta con sesión o por roles → `/ingresar` recordando la ruta pedida (tras un logout voluntario, `/catalogo`);
 * - con sesión sin el rol → «Sin permiso» en el lugar, sin cambiar la URL;
 * - con sesión en una ruta solo para visitantes → a la ruta recordada o a `/catalogo`.
 */
export function RequiereAcceso({ acceso, children }: { acceso: Acceso; children: ReactNode }) {
  const estado = useAuthStore(selectEstado);
  const roles = useAuthStore(selectRoles);
  const motivo = useAuthStore((sesion) => sesion.motivo);
  const location = useLocation();

  // Defensa: SesionGate no monta el router mientras se verifica.
  if (estado === 'verificando') return <PantallaCarga />;
  if (puedeAcceder(acceso, estado, roles)) return <>{children}</>;
  if (estado === 'anonima') {
    if (motivo === 'logout') return <Navigate to={RUTAS.catalogo} replace />;
    return <Navigate to={RUTAS.ingresar} replace state={{ desde: rutaRecordada(location) }} />;
  }
  if (acceso === 'anonima') return <Navigate to={destinoTrasIngresar(location.state, roles)} replace />;
  return <ForbiddenPage />;
}
