import { useCallback, useSyncExternalStore } from 'react';

/** `true` mientras la media query coincide; se actualiza al cambiar el tamaño de la ventana. */
export function useMediaQuery(consulta: string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    [consulta],
  );
  const leer = useCallback(() => window.matchMedia(consulta).matches, [consulta]);
  return useSyncExternalStore(suscribir, leer);
}
