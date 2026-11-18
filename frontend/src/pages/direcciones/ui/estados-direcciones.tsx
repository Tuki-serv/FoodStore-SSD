import type { ApiError } from '@/shared/api';
import { claseBoton, Icon } from '@/shared/ui';

/** Indicador de carga del listado (esqueleto con `aria-busy`). */
export function CargandoDirecciones() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando direcciones" className="grid gap-3">
      {[0, 1, 2].map((indice) => (
        <div key={indice} className="skel h-[96px]" />
      ))}
    </div>
  );
}

export interface ErrorDireccionesProps {
  error: ApiError;
  onReintentar: () => void;
}

export function ErrorDirecciones({ error, onReintentar }: ErrorDireccionesProps) {
  return (
    <div className="state" role="alert">
      <Icon name="alerta" className="h-8 w-8 text-danger" />
      <h2>No pudimos cargar tus direcciones</h2>
      <p>{error.detail}</p>
      <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

/** Aviso no bloqueante: el listado que se ve es el último que llegó y no se pudo actualizar. */
export function ListadoDesactualizado({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="form-alert" role="alert">
      <Icon name="alerta" />
      <div>
        No pudimos actualizar tus direcciones
        <p>Lo que ves puede estar desactualizado.</p>
        <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

export function VacioDirecciones({ onAgregar }: { onAgregar: () => void }) {
  return (
    <section className="state empty" aria-labelledby="vacio-titulo">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="direcciones" className="h-[30px] w-[30px]" />
      </span>
      <h2 id="vacio-titulo">Todavía no tenés direcciones</h2>
      <p>Agregá una para recibir tus pedidos. La primera que guardes queda como principal.</p>
      <button type="button" className={claseBoton('primario')} data-foco="agregar" onClick={onAgregar}>
        <Icon name="mas" />
        Agregar dirección
      </button>
    </section>
  );
}
