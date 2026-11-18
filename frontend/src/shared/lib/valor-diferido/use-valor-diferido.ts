import { useEffect, useState } from 'react';

/** El valor recién se actualiza cuando pasaron `ms` milisegundos sin cambios (*debounce*); cada cambio reinicia la espera. */
export function useValorDiferido<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return diferido;
}
