import { Dialogo, claseBoton } from '@/shared/ui';
import { ContenidoFiltros, type ContenidoFiltrosProps } from './contenido-filtros';

export interface HojaFiltrosProps extends ContenidoFiltrosProps {
  /** Total de resultados con los filtros actuales (se aplican al instante detrás de la hoja). */
  total: number | undefined;
  onLimpiar: () => void;
  onCerrar: () => void;
}

/** Hoja inferior «Filtros» (mobile): el árbol completo, el precio y la disponibilidad; el pie queda fijo. */
export function HojaFiltros({ total, onLimpiar, onCerrar, ...contenido }: HojaFiltrosProps) {
  return (
    <Dialogo
      titulo="Filtros"
      desplazable
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className={claseBoton('fantasma')} onClick={onLimpiar}>
            Limpiar
          </button>
          <button type="button" className={`${claseBoton('primario')} grow`} data-autofocus onClick={onCerrar}>
            Ver resultados{total === undefined ? '' : ` (${total})`}
          </button>
        </>
      }
    >
      <ContenidoFiltros {...contenido} />
    </Dialogo>
  );
}
