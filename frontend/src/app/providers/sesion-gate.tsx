import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { sesionQueries } from '@/entities/session';
import { CLAVE_SESION, esConsultaPrivada } from '@/shared/api';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { useUiStore } from '@/shared/model';
import { PantallaCarga } from '@/shared/ui';

/**
 * Espera a que se sepa si hay sesión antes de mostrar la app (rehidratación única por carga) y, cuando la sesión
 * pasa de `autenticada` a `anonima` (logout o vencimiento), descarta de la caché los datos privados del usuario anterior y la UI transitoria (toasts y confirmación),
 * y vuelve a pedir como anónimas las consultas públicas que quedaron en error.
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
          // La verificación de vigencia (`['sesion', 'vigencia']`) describe la sesión anterior; la rehidratación se conserva.
          queryClient.removeQueries({ queryKey: sesionQueries.vigencia().queryKey });
          // Una lectura pública con el access de una sesión cerrada responde 401 (catalog-visibility) y quedó en error: se
          // repite sin `Authorization` (el store ya no tiene access) para que el catálogo vuelva a mostrarse como anónimo.
          void queryClient.refetchQueries({
            predicate: ({ queryKey, state }) =>
              !esConsultaPrivada(queryKey) && queryKey[0] !== CLAVE_SESION && state.status === 'error',
          });
          // Un diálogo de confirmación o avisos del usuario anterior no deben sobrevivir a la sesión.
          useUiStore.getState().limpiarTransitorios();
        }
      }),
    [queryClient],
  );

  return estado === 'verificando' ? <PantallaCarga /> : <>{children}</>;
}
