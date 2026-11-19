import type { UseQueryResult } from '@tanstack/react-query';
import type { CategoriaNodo } from '@/entities/categoria';
import type { ApiError } from '@/shared/api';
import { claseBoton, Icon } from '@/shared/ui';

/** Aviso «No pudimos cargar las categorías» con «Reintentar»: lo comparten la barra superior y la hoja «Filtros». */
export function AvisoArbol({ arbol }: { arbol: UseQueryResult<CategoriaNodo[], ApiError> }) {
  return (
    <div className="tree-error" role="alert">
      <Icon name="alerta" className="h-[20px] w-[20px]" />
      <div>
        No pudimos cargar las categorías
        <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={() => void arbol.refetch()}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
