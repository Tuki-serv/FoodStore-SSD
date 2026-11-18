import { useEffect, useRef, useState } from 'react';
import { useValorDiferido } from '@/shared/lib';

/** Milisegundos sin teclear antes de buscar. */
export const ESPERA_BUSQUEDA_MS = 300;

export interface Busqueda {
  texto: string;
  setTexto: (texto: string) => void;
  /** Borra el campo y el filtro sin esperar el *debounce*. */
  borrar: () => void;
}

/**
 * Campo de búsqueda con *debounce* sobre el `q` de la URL. El texto sin espacios sobrantes se escribe en la URL 300 ms
 * después de la última tecla; si la URL cambia desde afuera («Limpiar filtros», «Atrás») el campo se sincroniza con ella.
 */
export function useBusqueda(qUrl: string, escribir: (q: string) => void): Busqueda {
  const [texto, setTexto] = useState(qUrl);
  // Último valor de `q` que el campo y la URL comparten: distingue un cambio propio de uno externo.
  const sincronizado = useRef(qUrl);
  const diferido = useValorDiferido(texto.trim(), ESPERA_BUSQUEDA_MS);
  // La última función de escritura, sin que su identidad dispare el efecto: solo un `diferido` nuevo escribe la URL.
  const escribirRef = useRef(escribir);
  useEffect(() => {
    escribirRef.current = escribir;
  });

  useEffect(() => {
    if (qUrl === sincronizado.current) return;
    sincronizado.current = qUrl;
    setTexto(qUrl);
  }, [qUrl]);

  useEffect(() => {
    if (diferido === sincronizado.current) return;
    sincronizado.current = diferido;
    escribirRef.current(diferido);
  }, [diferido]);

  const borrar = (): void => {
    setTexto('');
    if (sincronizado.current === '') return;
    sincronizado.current = '';
    escribir('');
  };

  return { texto, setTexto, borrar };
}
