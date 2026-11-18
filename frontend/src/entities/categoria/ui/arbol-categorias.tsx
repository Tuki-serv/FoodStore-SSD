import type { CategoriaNodo } from '../model';

export interface ArbolCategoriasProps {
  arbol: readonly CategoriaNodo[];
  /** Id de la categoría elegida; `null` es «Todas». */
  seleccionada: number | null;
  onElegir: (id: number | null) => void;
}

const contiene = (nodo: CategoriaNodo, id: number): boolean => nodo.id === id || nodo.subcategorias.some((hijo) => contiene(hijo, id));

interface NodoProps {
  nodo: CategoriaNodo;
  seleccionada: number | null;
  onElegir: (id: number | null) => void;
}

function Nodo({ nodo, seleccionada, onElegir }: NodoProps) {
  const esActual = nodo.id === seleccionada;
  const esAncestro = seleccionada !== null && !esActual && contiene(nodo, seleccionada);
  return (
    <li>
      <button
        type="button"
        className={esAncestro ? 'tree-item is-ancestor' : 'tree-item'}
        {...(esActual ? { 'aria-current': 'true' as const } : {})}
        onClick={() => onElegir(nodo.id)}
      >
        {nodo.nombre}
      </button>
      {nodo.subcategorias.length === 0 ? null : (
        <ul>
          {nodo.subcategorias.map((hijo) => (
            <Nodo key={hijo.id} nodo={hijo} seleccionada={seleccionada} onElegir={onElegir} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Árbol de categorías como navegación («Categorías»): «Todas» primero y las subcategorías anidadas; sin estado propio. */
export function ArbolCategorias({ arbol, seleccionada, onElegir }: ArbolCategoriasProps) {
  return (
    <nav aria-label="Categorías">
      <ul className="tree">
        <li>
          <button type="button" className="tree-item" {...(seleccionada === null ? { 'aria-current': 'true' as const } : {})} onClick={() => onElegir(null)}>
            Todas
          </button>
        </li>
        {arbol.map((nodo) => (
          <Nodo key={nodo.id} nodo={nodo} seleccionada={seleccionada} onElegir={onElegir} />
        ))}
      </ul>
    </nav>
  );
}
