import type { CategoriaNodo } from '@/entities/categoria';
import { claseBoton, Icon } from '@/shared/ui';

export interface ArbolEditableProps {
  arbol: readonly CategoriaNodo[];
  /** Categoría recién creada: la fila se resalta un momento. */
  nuevoId: number | null;
  onAgregarSubcategoria: (categoria: CategoriaNodo) => void;
  onEditar: (categoria: CategoriaNodo) => void;
  onEliminar: (categoria: CategoriaNodo) => void;
}

const textoSubcategorias = (cantidad: number): string => `${cantidad} ${cantidad === 1 ? 'subcategoría' : 'subcategorías'}`;

type FilaProps = Omit<ArbolEditableProps, 'arbol'> & { nodo: CategoriaNodo };

function Fila({ nodo, nuevoId, onAgregarSubcategoria, onEditar, onEliminar }: FilaProps) {
  const cantidad = nodo.subcategorias.length;
  const esNueva = nodo.id === nuevoId;
  return (
    <li>
      <div className={esNueva ? 'crow is-new' : 'crow'} role="group" aria-label={nodo.nombre}>
        <span className="crow-ico" aria-hidden="true">
          <Icon name="categorias" />
        </span>
        <div className="crow-body">
          <div className="crow-title">
            <strong>{nodo.nombre}</strong>
            {cantidad > 0 ? <span className="meta-txt">{textoSubcategorias(cantidad)}</span> : null}
            {esNueva ? <span className="meta-txt">Nueva</span> : null}
          </div>
          {nodo.descripcion === null || nodo.descripcion === '' ? null : <span className="crow-desc">{nodo.descripcion}</span>}
        </div>
        <div className="crow-actions">
          <button
            type="button"
            className={`${claseBoton('fantasma', { compacto: true })} max-[719px]:px-2`}
            aria-label={`Agregar subcategoría a ${nodo.nombre}`}
            data-foco={`subcategoria-${nodo.id}`}
            onClick={() => onAgregarSubcategoria(nodo)}
          >
            <Icon name="subcategoria" />
            Subcategoría
          </button>
          <button
            type="button"
            className={`${claseBoton('fantasma', { compacto: true })} max-[719px]:px-2`}
            aria-label={`Editar ${nodo.nombre}`}
            data-foco={`editar-${nodo.id}`}
            onClick={() => onEditar(nodo)}
          >
            <Icon name="editar" />
            Editar
          </button>
          <button
            type="button"
            className={`${claseBoton('fantasmaPeligro', { compacto: true })} max-[719px]:px-2`}
            aria-label={`Eliminar ${nodo.nombre}`}
            onClick={() => onEliminar(nodo)}
          >
            <Icon name="basura" />
            Eliminar
          </button>
        </div>
      </div>
      {cantidad > 0 ? (
        <ul aria-label={`Subcategorías de ${nodo.nombre}`}>
          {nodo.subcategorias.map((hija) => (
            <Fila key={hija.id} nodo={hija} nuevoId={nuevoId} onAgregarSubcategoria={onAgregarSubcategoria} onEditar={onEditar} onEliminar={onEliminar} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Árbol de categorías con acciones por fila (nombre, descripción, cantidad de subcategorías, «Subcategoría», «Editar», «Eliminar»). */
export function ArbolEditable({ arbol, ...acciones }: ArbolEditableProps) {
  return (
    <ul className="ctree" aria-label="Árbol de categorías">
      {arbol.map((nodo) => (
        <Fila key={nodo.id} nodo={nodo} {...acciones} />
      ))}
    </ul>
  );
}
