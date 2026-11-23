import type { Ingrediente } from '@/entities/ingrediente';
import { etiquetaUnidad, type UnidadMedida } from '@/entities/unidad-medida';
import { claseBoton, Icon } from '@/shared/ui';

export interface ListaIngredientesProps {
  ingredientes: readonly Ingrediente[];
  /** Unidades del servidor, para nombrar la de cada ingrediente. */
  unidades: readonly UnidadMedida[];
  /** Ingrediente recién creado: la fila se resalta un momento. */
  nuevoId: number | null;
  onEditar: (ingrediente: Ingrediente) => void;
  onEliminar: (ingrediente: Ingrediente) => void;
}

function Uso({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) return <>Sin productos</>;
  return (
    <>
      Usado en <strong>{cantidad}</strong> {cantidad === 1 ? 'producto' : 'productos'}
    </>
  );
}

/** Listado de ingredientes con nombre, descripción, unidad, marca «Alérgeno», uso y acciones por fila. */
export function ListaIngredientes({ ingredientes, unidades, nuevoId, onEditar, onEliminar }: ListaIngredientesProps) {
  return (
    <ul className="ilist" aria-label="Ingredientes">
      <li className="irow ihead" aria-hidden="true">
        <span>Ingrediente</span>
        <span>Unidad</span>
        <span>Uso</span>
        <span />
      </li>
      {ingredientes.map((ingrediente) => {
        const unidad = unidades.find((u) => u.id === ingrediente.unidad_medida_id);
        const esNuevo = ingrediente.id === nuevoId;
        return (
          <li key={ingrediente.id}>
            <div className={esNuevo ? 'irow is-new' : 'irow'} role="group" aria-label={ingrediente.nombre}>
              <div className="iname">
                <div className="iname-top">
                  <strong>{ingrediente.nombre}</strong>
                  {ingrediente.es_alergeno ? (
                    <span className="al">
                      <Icon name="alergeno" />
                      Alérgeno
                    </span>
                  ) : null}
                  {esNuevo ? <span className="meta-txt">Nuevo</span> : null}
                </div>
                {ingrediente.descripcion === null || ingrediente.descripcion === '' ? null : <small>{ingrediente.descripcion}</small>}
              </div>
              <div className="imeta">
                <span className="iunit">{unidad === undefined ? '' : etiquetaUnidad(unidad)}</span>
                <span className="iuse">
                  <Uso cantidad={ingrediente.productos.length} />
                </span>
              </div>
              <div className="crow-actions">
                <button
                  type="button"
                  className={claseBoton('fantasma', { compacto: true })}
                  aria-label={`Editar ${ingrediente.nombre}`}
                  data-foco={`editar-${ingrediente.id}`}
                  onClick={() => onEditar(ingrediente)}
                >
                  <Icon name="editar" />
                  Editar
                </button>
                <button
                  type="button"
                  className={claseBoton('fantasmaPeligro', { compacto: true })}
                  aria-label={`Eliminar ${ingrediente.nombre}`}
                  onClick={() => onEliminar(ingrediente)}
                >
                  <Icon name="basura" />
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
