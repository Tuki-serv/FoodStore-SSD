import { claseBoton } from '@/shared/ui';

export interface PaginacionDireccionesProps {
  page: number;
  pages: number;
  onCambiar: (page: number) => void;
}

/** «Anterior» / «Página X de N» / «Siguiente»; no se dibuja con una sola página. */
export function PaginacionDirecciones({ page, pages, onCambiar }: PaginacionDireccionesProps) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Paginación de direcciones">
      <button type="button" className={claseBoton('secundario', { compacto: true })} disabled={page <= 1} onClick={() => onCambiar(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button type="button" className={claseBoton('secundario', { compacto: true })} disabled={page >= pages} onClick={() => onCambiar(page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
