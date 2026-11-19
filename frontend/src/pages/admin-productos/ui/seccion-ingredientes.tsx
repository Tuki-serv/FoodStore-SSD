import type { Ingrediente } from '@/entities/ingrediente';
import { etiquetaUnidad, type UnidadMedida } from '@/entities/unidad-medida';
import { Campo, claseBoton, Icon } from '@/shared/ui';
import type { ErroresProducto, IngredienteValores } from '../model';

export interface SeccionIngredientesProps {
  filas: readonly IngredienteValores[];
  /** Ingredientes activos que se pueden elegir. */
  ingredientes: readonly Ingrediente[];
  unidades: readonly UnidadMedida[];
  /** Unidad con la que arranca una fila nueva (la «Unidad (u)»). */
  unidadPorDefecto: string;
  errores: ErroresProducto['ingredientes'];
  onCambiar: (filas: IngredienteValores[]) => void;
}

/** Filas editables de ingredientes: ingrediente (sin repetir), cantidad, unidad propuesta y «Se puede quitar». */
export function SeccionIngredientes({ filas, ingredientes, unidades, unidadPorDefecto, errores, onCambiar }: SeccionIngredientesProps) {
  const cambiarFila = (indice: number, cambios: Partial<IngredienteValores>): void =>
    onCambiar(filas.map((fila, k) => (k === indice ? { ...fila, ...cambios } : fila)));

  const elegirIngrediente = (indice: number, id: string): void => {
    const elegido = ingredientes.find((ingrediente) => String(ingrediente.id) === id);
    // La unidad se propone con la del ingrediente (el backend la expone desde C-17b).
    cambiarFila(indice, { ingrediente_id: id, ...(elegido === undefined ? {} : { unidad_medida_id: String(elegido.unidad_medida_id) }) });
  };

  const agregar = (): void => onCambiar([...filas, { ingrediente_id: '', cantidad: '1', unidad_medida_id: unidadPorDefecto, es_removible: false }]);

  return (
    <div className="fsec">
      <div className="fsec-head">
        <h3>Ingredientes</h3>
        <p>«Se puede quitar» permite que el cliente lo saque al personalizar su pedido. La unidad se propone con la del ingrediente.</p>
      </div>
      {filas.length === 0 ? null : (
        <ul className="pilist" aria-label="Ingredientes del producto">
          {filas.map((fila, indice) => {
            const elegido = ingredientes.find((ingrediente) => String(ingrediente.id) === fila.ingrediente_id);
            const error = errores?.[indice];
            return (
              <li key={indice} className={error === undefined ? 'pirow' : 'pirow has-err'}>
                <Campo
                  etiqueta={`Ingrediente ${indice + 1}`}
                  className="pi-ing"
                  {...(elegido?.es_alergeno === true
                    ? {
                        marca: (
                          <span className="pi-al">
                            <Icon name="alergeno" />
                            Alérgeno
                          </span>
                        ),
                      }
                    : {})}
                  {...(error?.ingrediente_id === undefined ? {} : { error: error.ingrediente_id })}
                >
                  {(control) => (
                    <select {...control} className="input" value={fila.ingrediente_id} onChange={(evento) => elegirIngrediente(indice, evento.target.value)}>
                      <option value="">Elegí un ingrediente</option>
                      {ingredientes.map((ingrediente) => (
                        <option key={ingrediente.id} value={String(ingrediente.id)}>
                          {ingrediente.nombre}
                          {ingrediente.es_alergeno ? ' (alérgeno)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo etiqueta="Cantidad" className="pi-cant" {...(error?.cantidad === undefined ? {} : { error: error.cantidad })}>
                  {(control) => <input {...control} className="input" inputMode="decimal" value={fila.cantidad} onChange={(evento) => cambiarFila(indice, { cantidad: evento.target.value })} />}
                </Campo>
                <Campo etiqueta="Unidad" className="pi-uni">
                  {(control) => (
                    <select {...control} className="input" value={fila.unidad_medida_id} onChange={(evento) => cambiarFila(indice, { unidad_medida_id: evento.target.value })}>
                      {unidades.map((unidad) => (
                        <option key={unidad.id} value={String(unidad.id)}>
                          {etiquetaUnidad(unidad)}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <label className={fila.es_removible ? 'mini-check pi-rem is-on' : 'mini-check pi-rem'}>
                  <input type="checkbox" checked={fila.es_removible} onChange={(evento) => cambiarFila(indice, { es_removible: evento.target.checked })} />
                  <span>Se puede quitar</span>
                </label>
                <button
                  type="button"
                  className="icon-btn pi-del"
                  aria-label={`Quitar ${elegido?.nombre ?? `ingrediente ${indice + 1}`}`}
                  onClick={() => onCambiar(filas.filter((_, k) => k !== indice))}
                >
                  <Icon name="basura" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className={`${claseBoton('secundario', { compacto: true })} btn-add`} onClick={agregar}>
        <Icon name="mas" />
        Agregar ingrediente
      </button>
    </div>
  );
}
