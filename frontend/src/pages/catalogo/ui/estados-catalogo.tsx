import type { ReactNode } from 'react';
import type { ApiError } from '@/shared/api';
import { claseBoton, Icon } from '@/shared/ui';

/** Error del listado (503, sin conexión…) con reintento. */
export function ErrorCatalogo({ error, onReintentar }: { error: ApiError; onReintentar: () => void }) {
  return (
    <div className="state is-error" role="alert">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="alerta" className="h-[30px] w-[30px]" />
      </span>
      <h2>No pudimos cargar los productos</h2>
      <p>{error.detail}</p>
      <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

/** Catálogo sin ningún producto y sin filtros: no hay nada que limpiar. */
export function CatalogoVacio() {
  return (
    <section className="state empty" aria-labelledby="catalogo-vacio-titulo">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="plato" className="h-[30px] w-[30px]" />
      </span>
      <h2 id="catalogo-vacio-titulo">Todavía no hay productos</h2>
      <p>Estamos preparando el menú. Volvé en un rato.</p>
    </section>
  );
}

export interface SinResultadosProps {
  /** Texto buscado, si lo hay: se menciona en el mensaje. */
  q: string | undefined;
  /** Chips de los filtros aplicados. */
  filtros: ReactNode;
  onLimpiar: () => void;
}

/** Hay filtros aplicados y ningún producto coincide. */
export function SinResultados({ q, filtros, onLimpiar }: SinResultadosProps) {
  return (
    <section className="state empty" aria-labelledby="sin-resultados-titulo">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="buscar" className="h-[30px] w-[30px]" />
      </span>
      <h2 id="sin-resultados-titulo">No encontramos productos</h2>
      <p>
        {q === undefined ? 'Nada coincide con los filtros elegidos.' : `Nada coincide con «${q}» y los filtros elegidos.`} Probá con otra palabra o quitá algún
        filtro.
      </p>
      {filtros}
      <button type="button" className={claseBoton('primario')} onClick={onLimpiar}>
        Limpiar filtros
      </button>
    </section>
  );
}
