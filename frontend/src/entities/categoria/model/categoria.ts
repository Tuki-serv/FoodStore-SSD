/** Nodo de `GET /categorias/arbol` (`CategoriaTreeNode`). */
export interface CategoriaNodo {
  id: number;
  parent_id: number | null;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  imagen_public_id: string | null;
  subcategorias: CategoriaNodo[];
}

/** Busca un nodo por id en cualquier nivel; `undefined` si no existe. */
export function buscarCategoria(arbol: readonly CategoriaNodo[], id: number): CategoriaNodo | undefined {
  for (const nodo of arbol) {
    if (nodo.id === id) return nodo;
    const hijo = buscarCategoria(nodo.subcategorias, id);
    if (hijo !== undefined) return hijo;
  }
  return undefined;
}

function acumularIds(nodo: CategoriaNodo, destino: number[]): void {
  destino.push(nodo.id);
  nodo.subcategorias.forEach((hijo) => acumularIds(hijo, destino));
}

/** Ids de la categoría y de todas sus descendientes, ordenados; `[]` si el id no existe en el árbol. */
export function idsDelSubarbol(arbol: readonly CategoriaNodo[], id: number): number[] {
  const nodo = buscarCategoria(arbol, id);
  if (nodo === undefined) return [];
  const ids: number[] = [];
  acumularIds(nodo, ids);
  return ids.sort((a, b) => a - b);
}

/** Categorías de primer nivel, en el orden del servidor. */
export function raices(arbol: readonly CategoriaNodo[]): CategoriaNodo[] {
  return arbol.filter((nodo) => nodo.parent_id === null);
}
