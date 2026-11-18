/** Ruta pedida por un visitante anónimo, recordada en el `state` de la navegación a `/ingresar`. */
export interface RutaRecordada {
  pathname: string;
  search: string;
  hash: string;
}

/** Path, query y hash de una ubicación (de `useLocation`), sin `state` ni `key`. */
export function rutaRecordada(location: { pathname: string; search: string; hash: string }): RutaRecordada {
  return { pathname: location.pathname, search: location.search, hash: location.hash };
}
