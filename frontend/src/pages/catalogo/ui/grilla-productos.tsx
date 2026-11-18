import type { Producto } from '@/entities/producto';
import { TarjetaProducto } from '@/entities/producto';
import { BotonAgregarAlCarrito } from '@/features/agregar-al-carrito';

export interface GrillaProductosProps {
  productos: Producto[];
  /** Llegó una consulta nueva y todavía se ve la anterior: la grilla se atenúa y se anuncia como ocupada. */
  actualizando: boolean;
}

/** Grilla de tarjetas con el botón de agregar de cada producto. */
export function GrillaProductos({ productos, actualizando }: GrillaProductosProps) {
  return (
    <ul className={actualizando ? 'prod-grid grid-busy' : 'prod-grid'} aria-label="Productos" {...(actualizando ? { 'aria-busy': 'true' as const } : {})}>
      {productos.map((producto) => (
        <li key={producto.id}>
          <TarjetaProducto producto={producto} accion={<BotonAgregarAlCarrito producto={producto} />} />
        </li>
      ))}
    </ul>
  );
}

const CANTIDAD_ESQUELETOS = 6;

/** Esqueleto de la primera carga: tarjetas con la forma de las reales. */
export function EsqueletoProductos() {
  return (
    <>
      <ul className="prod-grid" aria-busy="true" aria-label="Cargando productos">
        {Array.from({ length: CANTIDAD_ESQUELETOS }, (_, indice) => (
          <li key={indice} aria-hidden="true">
            <div className="card skel-prod">
              <div className="img skel" />
              <div className="body">
                <div className="skel h-[12px] w-[40%]" />
                <div className="skel h-[20px] w-[75%]" />
                <div className="skel h-[14px] w-[90%]" />
                <div className="foot">
                  <div className="skel h-[22px] w-[35%]" />
                  <div className="skel h-[36px] w-[38%]" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status">
        Cargando productos…
      </span>
    </>
  );
}
