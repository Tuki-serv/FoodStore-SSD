import type { IngredienteProducto } from '@/entities/producto';

export interface SelectorPersonalizacionProps {
  /** Ingredientes que se pueden quitar, en el orden del servidor. */
  ingredientes: readonly IngredienteProducto[];
  /** Ids de los ingredientes marcados «Sin …». */
  excluidos: ReadonlySet<number>;
  onAlternar: (id: number) => void;
}

/** «Personalizá tu pedido»: una casilla «Sin <ingrediente>» por ingrediente removible; sin marcar, el producto va tal cual. */
export function SelectorPersonalizacion({ ingredientes, excluidos, onAlternar }: SelectorPersonalizacionProps) {
  return (
    <fieldset className="custom">
      <legend>Personalizá tu pedido</legend>
      <p className="hint">Marcá lo que querés sacar. Si no marcás nada, va tal cual.</p>
      <div className="opts-grid">
        {ingredientes.map((ingrediente) => {
          const marcado = excluidos.has(ingrediente.id);
          return (
            <label key={ingrediente.id} className={marcado ? 'opt is-checked' : 'opt'}>
              <input type="checkbox" checked={marcado} onChange={() => onAlternar(ingrediente.id)} />
              <span className="lbl">
                Sin {ingrediente.nombre}
                {ingrediente.es_alergeno ? (
                  <span className="badge b-pendiente" aria-hidden="true">
                    Alérgeno
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
