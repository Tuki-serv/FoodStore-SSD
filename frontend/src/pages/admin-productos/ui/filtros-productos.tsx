import { useState } from 'react';
import type { PadrePosible } from '@/entities/categoria';
import { Icon } from '@/shared/ui';
import type { EstadoListado, FiltroDisponible } from '../model';

export interface FiltrosProductosProps {
  estado: EstadoListado;
  /** Categorías activas en orden de árbol, con nivel para indentar. */
  categorias: readonly PadrePosible[];
  /** Cualquier cambio de filtro vuelve a la página 1 (lo resuelve quien usa el componente). */
  onCambiar: (cambios: Partial<Pick<EstadoListado, 'q' | 'categoria' | 'disponible'>>) => void;
}

const OPCIONES: readonly { valor: FiltroDisponible; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'si', etiqueta: 'Disponibles' },
  { valor: 'no', etiqueta: 'No disponibles' },
];

/** Búsqueda por nombre (se aplica al enviar, no por tecla), categoría y disponibilidad. */
export function FiltrosProductos({ estado, categorias, onCambiar }: FiltrosProductosProps) {
  // Lo escrito se anota contra la búsqueda de la URL con la que se escribió: si la URL cambia (p. ej. «Limpiar filtros»), manda la URL.
  const [escrito, setEscrito] = useState<{ base: string; texto: string } | null>(null);
  const texto = escrito !== null && escrito.base === estado.q ? escrito.texto : estado.q;

  return (
    <form
      className="toolbar ptools"
      role="search"
      onSubmit={(evento) => {
        evento.preventDefault();
        onCambiar({ q: texto.trim() });
      }}
    >
      <div className="search">
        <Icon name="buscar" />
        <label className="sr-only" htmlFor="buscar-productos">
          Buscar productos por nombre
        </label>
        <input id="buscar-productos" className="input" type="search" placeholder="Buscar por nombre" value={texto} onChange={(evento) => setEscrito({ base: estado.q, texto: evento.target.value })} />
      </div>
      <div className="tool-row">
        <label className="sr-only" htmlFor="filtrar-categoria">
          Categoría
        </label>
        <select
          id="filtrar-categoria"
          className="input"
          value={estado.categoria === null ? '' : String(estado.categoria)}
          onChange={(evento) => onCambiar({ categoria: evento.target.value === '' ? null : Number(evento.target.value) })}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={String(categoria.id)}>
              {`${'— '.repeat(categoria.nivel)}${categoria.nombre}`}
            </option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="Filtrar por disponibilidad">
          {OPCIONES.map(({ valor, etiqueta }) => (
            <button key={valor} type="button" aria-pressed={estado.disponible === valor} onClick={() => onCambiar({ disponible: valor })}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
