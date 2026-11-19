import type { CSSProperties } from 'react';
import type { PadrePosible } from '@/entities/categoria';
import { Campo } from '@/shared/ui';

export interface SeccionCategoriasProps {
  /** Categorías activas en orden de árbol, con nivel para indentar. */
  categorias: readonly PadrePosible[];
  /** Ids marcados, en el orden en que se marcaron. */
  marcadas: readonly number[];
  principal: number | null;
  error?: string | undefined;
  onCambiar: (marcadas: number[], principal: number | null) => void;
}

/** Casillas de categorías (orden de árbol) y selector de la principal entre las marcadas. */
export function SeccionCategorias({ categorias, marcadas, principal, error, onCambiar }: SeccionCategoriasProps) {
  const alternar = (id: number, marcar: boolean): void => {
    const siguientes = marcar ? [...marcadas, id] : marcadas.filter((marcada) => marcada !== id);
    // Si se desmarca la principal pasa a la primera que queda; la primera que se marca es la principal.
    const nuevaPrincipal = principal !== null && siguientes.includes(principal) ? principal : (siguientes[0] ?? null);
    onCambiar(siguientes, nuevaPrincipal);
  };
  const nombreDe = (id: number): string => categorias.find((c) => c.id === id)?.nombre ?? `Categoría ${id}`;

  return (
    <div className="fsec">
      <div className="fsec-head">
        <h3>Categorías</h3>
        <p>Marcá una o más. La principal es la que se muestra en la tarjeta del catálogo.</p>
      </div>
      <div className="catgrid">
        <div className="field">
          <span className="field-label" id="categorias-etiqueta">
            <strong>Categorías del producto</strong>
          </span>
          <ul className="catpick" aria-labelledby="categorias-etiqueta" {...(error === undefined ? {} : { 'data-invalid': true })}>
            {categorias.map((categoria) => {
              const marcada = marcadas.includes(categoria.id);
              return (
                <li key={categoria.id} style={{ '--nivel': categoria.nivel } as CSSProperties}>
                  <label className={marcada ? 'mini-check is-on' : 'mini-check'}>
                    <input type="checkbox" checked={marcada} onChange={(evento) => alternar(categoria.id, evento.target.checked)} />
                    <span>{categoria.nombre}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error === undefined ? null : <span className="err">{error}</span>}
        </div>
        <Campo etiqueta="Categoría principal" ayuda="Solo ofrece las categorías marcadas.">
          {(control) => (
            <select
              {...control}
              className="input"
              disabled={marcadas.length === 0}
              value={principal === null ? '' : String(principal)}
              onChange={(evento) => onCambiar([...marcadas], Number(evento.target.value))}
            >
              {marcadas.length === 0 ? <option value="">Marcá una categoría primero</option> : null}
              {marcadas.map((id) => (
                <option key={id} value={String(id)}>
                  {nombreDe(id)}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
    </div>
  );
}
