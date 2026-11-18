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

/** Categoría ofrecible como padre en el formulario: nombre y profundidad (0 = raíz) para indentar. */
export interface PadrePosible {
  id: number;
  nombre: string;
  nivel: number;
}

function aplanar(nodos: readonly CategoriaNodo[], nivel: number, excluidos: ReadonlySet<number>, destino: PadrePosible[]): void {
  for (const nodo of nodos) {
    if (excluidos.has(nodo.id)) continue;
    destino.push({ id: nodo.id, nombre: nodo.nombre, nivel });
    aplanar(nodo.subcategorias, nivel + 1, excluidos, destino);
  }
}

/**
 * Lista plana (en orden de árbol, con nivel) de las categorías que pueden ser padre. Al editar (`idEditado`) excluye a la
 * propia categoría y a toda su descendencia, así la UI nunca ofrece un ciclo (el servidor sigue siendo la autoridad).
 */
export function padresPosibles(arbol: readonly CategoriaNodo[], idEditado?: number): PadrePosible[] {
  const excluidos = new Set(idEditado === undefined ? [] : idsDelSubarbol(arbol, idEditado));
  const lista: PadrePosible[] = [];
  aplanar(arbol, 0, excluidos, lista);
  return lista;
}

/** Cantidad de subcategorías directas (activas) de la categoría; 0 si es hoja o el id no existe. */
export function contarDescendientes(arbol: readonly CategoriaNodo[], id: number): number {
  return buscarCategoria(arbol, id)?.subcategorias.length ?? 0;
}

/** Cuerpo de `POST /categorias/` (`CategoriaCreate`): `imagen_url` es obligatoria en la API (`''` si no hay imagen; C-28 trae la subida). */
export interface CategoriaDatos {
  nombre: string;
  parent_id: number | null;
  descripcion: string | null;
  imagen_url: string;
}

/** Cuerpo de `PATCH /categorias/{id}` (`CategoriaUpdate`): solo los campos que cambian. */
export type CategoriaCambios = Partial<CategoriaDatos>;

/** Lo que se usa de la respuesta del alta (`CategoriaRead`): el id sirve para resaltar la fila nueva. */
export interface CategoriaCreada {
  id: number;
  nombre: string;
}
