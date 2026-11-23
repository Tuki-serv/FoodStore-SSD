import { useEffect, useRef } from 'react';

/**
 * `true` solo en el primer render de la instancia y `false` desde el siguiente. No re-renderiza por sí mismo:
 * una lista que usa esto para animar su entrada la anima al montarse y no repite al cambiar filtros, páginas o refrescar datos.
 */
export function usePrimerMontaje(): boolean {
  const esPrimero = useRef(true);
  // Lectura de la ref durante el render a propósito: un estado re-renderizaría de inmediato y quitaría la clase de entrada en pleno efecto.
  // eslint-disable-next-line react-hooks/refs
  const valor = esPrimero.current;
  useEffect(() => {
    esPrimero.current = false;
  }, []);
  return valor;
}
