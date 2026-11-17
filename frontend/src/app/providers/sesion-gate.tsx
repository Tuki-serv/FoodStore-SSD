import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { sesionQueries } from '@/entities/session';
import { esConsultaPrivada } from '@/shared/api';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { PantallaCarga } from '@/shared/ui';

/**
 * Espera a que se sepa si hay sesión antes de mostrar la app (rehidratación única por carga) y, cuando la sesión
 * pasa de `autenticada` a `anonima` (logout o vencimiento), descarta de la caché los datos privados del usuario anterior.
 */
export function SesionGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const estado = useAuthStore(selectEstado);
  useQuery(sesionQueries.rehidratar());

  useEffect(
    () =>
      useAuthStore.subscribe((actual, previo) => {
        if (previo.estado === 'autenticada' && actual.estado === 'anonima') {
          queryClient.removeQueries({ predicate: ({ queryKey }) => esConsultaPrivada(queryKey) });
        }
      }),
    [queryClient],
  );

  return estado === 'verificando' ? <PantallaCarga /> : <>{children}</>;
}
