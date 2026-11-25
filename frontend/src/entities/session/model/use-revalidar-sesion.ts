import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { sesionQueries } from '../api';

/**
 * Como mucho una verificación de la sesión cada 15 s por pestaña (cambios de ruta, foco y visibilidad sumados):
 * acota la carga sobre `GET /auth/me` y los reintentos tras errores de red.
 */
export const INTERVALO_REVALIDACION_MS = 15_000;

/**
 * Revalida la sesión contra el backend para enterarse de un cierre hecho desde otro dispositivo (logout-all, baja, reuso)
 * aunque la pantalla no pida datos: al cambiar `ruta` y cuando la pestaña vuelve a estar visible o recupera el foco.
 *
 * - Solo con la sesión `autenticada` y la pestaña visible; abrir la sesión cuenta como la última verificación.
 * - Un 401 sigue el flujo de renovación del cliente HTTP (si falla, la sesión pasa a `anonima` por vencimiento); un error de
 *   red o un 5xx se ignora: sin backend no hay forma de saber, y el próximo pedido real lo resuelve.
 * - `ahora` es inyectable para los tests.
 */
export function useRevalidarSesion(ruta: string, ahora: () => number = Date.now): void {
  const queryClient = useQueryClient();
  const estado = useAuthStore(selectEstado);
  const reloj = useRef(ahora);
  const ultimaVerificacion = useRef(0);
  const rutaAnterior = useRef(ruta);

  useEffect(() => {
    reloj.current = ahora;
  }, [ahora]);

  // Login o rehidratación ya pidieron `GET /auth/me`: valen como la última verificación.
  useEffect(() => {
    if (estado === 'autenticada') ultimaVerificacion.current = reloj.current();
  }, [estado]);

  useEffect(() => {
    const revalidar = (): void => {
      if (useAuthStore.getState().estado !== 'autenticada' || document.visibilityState === 'hidden') return;
      const ahoraMs = reloj.current();
      if (ahoraMs - ultimaVerificacion.current < INTERVALO_REVALIDACION_MS) return;
      ultimaVerificacion.current = ahoraMs;
      queryClient.fetchQuery(sesionQueries.vigencia()).then(
        (usuario) => {
          // Si mientras tanto hubo logout o vencimiento, no se vuelve a poblar un usuario en una sesión anónima.
          if (useAuthStore.getState().estado === 'autenticada') useAuthStore.getState().establecerUsuario(usuario);
        },
        () => undefined,
      );
    };

    if (rutaAnterior.current !== ruta) {
      rutaAnterior.current = ruta;
      revalidar();
    }
    window.addEventListener('focus', revalidar);
    document.addEventListener('visibilitychange', revalidar);
    return () => {
      window.removeEventListener('focus', revalidar);
      document.removeEventListener('visibilitychange', revalidar);
    };
  }, [ruta, queryClient]);
}
