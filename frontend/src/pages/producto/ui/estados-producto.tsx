import { Link } from 'react-router-dom';
import type { ApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

/** 404 o id inválido: el producto no existe o no se ofrece al público. */
export function ProductoNoDisponible() {
  return (
    <section className="state is-solid" aria-labelledby="producto-no-disponible">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="plato" className="h-[30px] w-[30px]" />
      </span>
      <h1 id="producto-no-disponible" className="text-2xl">
        Este producto no está disponible
      </h1>
      <p>Puede que ya no esté en el menú o que el enlace esté mal. Mirá lo que tenemos hoy.</p>
      <Link className={claseBoton('primario')} to={RUTAS.catalogo}>
        Ver el catálogo
      </Link>
    </section>
  );
}

export function ErrorProducto({ error, onReintentar }: { error: ApiError; onReintentar: () => void }) {
  return (
    <div className="state is-error" role="alert">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="alerta" className="h-[30px] w-[30px]" />
      </span>
      <h2>No pudimos cargar el producto</h2>
      <p>{error.detail}</p>
      <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

export function EsqueletoProducto() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando producto" className="pd">
      <div className="pd-media skel" />
      <div className="pd-info">
        <div className="skel h-[16px] w-[30%]" />
        <div className="skel h-[40px] w-[70%]" />
        <div className="skel h-[28px] w-[25%]" />
        <div className="skel h-[72px] w-full" />
      </div>
    </div>
  );
}
