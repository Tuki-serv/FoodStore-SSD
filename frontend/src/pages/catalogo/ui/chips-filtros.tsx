import { formatearPrecio } from '@/entities/producto';
import { Icon } from '@/shared/ui';
import { contarFiltros, type FiltrosUrl } from '../model';

export type FiltroQuitable = 'categoria' | 'q' | 'precio' | 'stock';

export interface ChipsFiltrosProps {
  filtros: FiltrosUrl;
  /** Nombre de la categoría elegida (del árbol); sin él se usa un texto genérico. */
  nombreCategoria: string | undefined;
  onQuitar: (filtro: FiltroQuitable) => void;
  /** Ofrece «Limpiar filtros» cuando hay dos o más. */
  onLimpiar?: () => void;
}

const pesos = (valor: number): string => formatearPrecio(String(valor));

/** Texto del chip de rango: «$ 1.000 – $ 2.000», «Desde $ 1.000» o «Hasta $ 2.000». */
export function textoPrecio(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${pesos(min)} – ${pesos(max)}`;
  return min !== undefined ? `Desde ${pesos(min)}` : `Hasta ${pesos(max ?? 0)}`;
}

function Chip({ texto, etiqueta, onQuitar }: { texto: string; etiqueta: string; onQuitar: () => void }) {
  return (
    <span className="chip">
      {texto}
      <button type="button" aria-label={`Quitar filtro ${etiqueta}`} onClick={onQuitar}>
        <Icon name="cerrar" className="h-[14px] w-[14px]" />
      </button>
    </span>
  );
}

/** Un chip por filtro aplicado (con botón para quitarlo) y, con dos o más, «Limpiar filtros». */
export function ChipsFiltros({ filtros, nombreCategoria, onQuitar, onLimpiar }: ChipsFiltrosProps) {
  const cantidad = contarFiltros(filtros);
  if (cantidad === 0) return null;
  const categoria = nombreCategoria ?? 'Categoría elegida';
  return (
    <div className="chips" role="group" aria-label="Filtros aplicados">
      {filtros.categoria === undefined ? null : <Chip texto={categoria} etiqueta={categoria} onQuitar={() => onQuitar('categoria')} />}
      {filtros.q === undefined ? null : <Chip texto={`«${filtros.q}»`} etiqueta={filtros.q} onQuitar={() => onQuitar('q')} />}
      {filtros.min === undefined && filtros.max === undefined ? null : (
        <Chip texto={textoPrecio(filtros.min, filtros.max)} etiqueta={textoPrecio(filtros.min, filtros.max)} onQuitar={() => onQuitar('precio')} />
      )}
      {filtros.stock ? <Chip texto="Solo con stock" etiqueta="Solo con stock" onQuitar={() => onQuitar('stock')} /> : null}
      {onLimpiar !== undefined && cantidad >= 2 ? (
        <button type="button" className="link-btn" onClick={onLimpiar}>
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
