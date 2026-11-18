import { raices, type CategoriaNodo } from '@/entities/categoria';
import { claseBoton, Icon } from '@/shared/ui';

export interface BarraMobileProps {
  /** Árbol de categorías; sin él (cargando o con error) no se ofrecen chips. */
  arbol: CategoriaNodo[] | undefined;
  /** Id de la raíz que contiene a la categoría elegida; `null` si no hay ninguna. */
  raizActual: number | null;
  /** Cantidad de filtros aplicados (contador de «Filtros»). */
  filtrosAplicados: number;
  onElegirRaiz: (id: number | null) => void;
  onAbrirFiltros: () => void;
}

/** En menos de 1024 px: chips de las categorías de primer nivel (desplazables) y el botón «Filtros» que abre la hoja. */
export function BarraMobile({ arbol, raizActual, filtrosAplicados, onElegirRaiz, onAbrirFiltros }: BarraMobileProps) {
  return (
    <div className="mob-bar">
      <div className="mob-row">
        {arbol === undefined ? (
          <div className="cat-scroll" />
        ) : (
          <div className="cat-scroll" role="group" aria-label="Categorías principales">
            <button type="button" className="pill" aria-pressed={raizActual === null} onClick={() => onElegirRaiz(null)}>
              Todas
            </button>
            {raices(arbol).map((nodo) => (
              <button key={nodo.id} type="button" className="pill" aria-pressed={raizActual === nodo.id} onClick={() => onElegirRaiz(nodo.id)}>
                {nodo.nombre}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={`${claseBoton('secundario')} btn-filtros`} aria-haspopup="dialog" onClick={onAbrirFiltros}>
          <Icon name="filtros" className="h-[18px] w-[18px]" />
          Filtros
          {filtrosAplicados > 0 ? (
            <>
              {' '}
              <span className="count" aria-label={`${filtrosAplicados} aplicados`}>
                {filtrosAplicados}
              </span>
            </>
          ) : null}
        </button>
      </div>
    </div>
  );
}
