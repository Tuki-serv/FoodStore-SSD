import type { UseQueryResult } from '@tanstack/react-query';
import { useId } from 'react';
import { ArbolCategorias, type CategoriaNodo } from '@/entities/categoria';
import type { ApiError } from '@/shared/api';
import type { FiltrosUrl } from '../model';
import { AvisoArbol } from './aviso-arbol';
import { FiltroStock } from './filtro-stock';
import { FormularioPrecio } from './formulario-precio';

export interface ContenidoFiltrosProps {
  arbol: UseQueryResult<CategoriaNodo[], ApiError>;
  filtros: FiltrosUrl;
  onElegirCategoria: (id: number | null) => void;
  onAplicarPrecio: (min: number | undefined, max: number | undefined) => void;
  onCambiarStock: (activo: boolean) => void;
}

function SeccionCategorias({ arbol, seleccionada, onElegir }: { arbol: UseQueryResult<CategoriaNodo[], ApiError>; seleccionada: number | null; onElegir: (id: number | null) => void }) {
  if (arbol.data !== undefined) return <ArbolCategorias arbol={arbol.data} seleccionada={seleccionada} onElegir={onElegir} />;
  if (arbol.isError) return <AvisoArbol arbol={arbol} />;
  return (
    <div aria-busy="true" role="status" aria-label="Cargando categorías" className="grid gap-2">
      {[0, 1, 2, 3].map((indice) => (
        <div key={indice} className="skel h-[36px]" />
      ))}
    </div>
  );
}

/** Categorías, precio y disponibilidad: es el contenido de la columna de filtros (desktop) y de la hoja «Filtros» (mobile). */
export function ContenidoFiltros({ arbol, filtros, onElegirCategoria, onAplicarPrecio, onCambiarStock }: ContenidoFiltrosProps) {
  const id = useId();
  return (
    <>
      <section className="f-sec" aria-labelledby={`${id}-categorias`}>
        <h2 className="f-title" id={`${id}-categorias`}>
          Categorías
        </h2>
        <SeccionCategorias arbol={arbol} seleccionada={filtros.categoria ?? null} onElegir={onElegirCategoria} />
      </section>
      <section className="f-sec" aria-labelledby={`${id}-precio`}>
        <h2 className="f-title" id={`${id}-precio`}>
          Precio
        </h2>
        {/* La clave reinicia los campos cuando el rango cambia desde afuera (chip, «Limpiar filtros», «Atrás»). */}
        <FormularioPrecio key={`${filtros.min ?? ''}-${filtros.max ?? ''}`} min={filtros.min} max={filtros.max} onAplicar={onAplicarPrecio} />
      </section>
      <section className="f-sec" aria-labelledby={`${id}-disponibilidad`}>
        <h2 className="f-title" id={`${id}-disponibilidad`}>
          Disponibilidad
        </h2>
        <FiltroStock activo={filtros.stock} onCambiar={onCambiarStock} />
      </section>
    </>
  );
}
