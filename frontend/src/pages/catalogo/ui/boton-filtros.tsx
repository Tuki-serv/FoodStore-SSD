import { claseBoton, Icon } from '@/shared/ui';

export interface BotonFiltrosProps {
  /** Cantidad de filtros aplicados (contador). */
  aplicados: number;
  onAbrir: () => void;
}

/** «Filtros» (solo en menos de 1024 px): abre la hoja con el árbol completo, el precio y la disponibilidad. */
export function BotonFiltros({ aplicados, onAbrir }: BotonFiltrosProps) {
  return (
    <button type="button" className={`${claseBoton('secundario')} btn-filtros`} aria-haspopup="dialog" onClick={onAbrir}>
      <Icon name="filtros" className="h-[18px] w-[18px]" />
      Filtros
      {aplicados > 0 ? (
        <>
          {' '}
          <span className="count" aria-label={`${aplicados} aplicados`}>
            {aplicados}
          </span>
        </>
      ) : null}
    </button>
  );
}
