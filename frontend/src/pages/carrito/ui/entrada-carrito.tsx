import { Link } from 'react-router-dom';
import { claveLinea, subtotalLinea, textoPersonalizacion, useCartStore, type LineaCarrito } from '@/entities/cart';
import { formatearPrecio, ImagenProducto, Precio } from '@/entities/producto';
import { RUTAS } from '@/shared/config';
import { useUiStore } from '@/shared/model';
import { claseBoton, Icon, SelectorCantidad } from '@/shared/ui';

/** Tope de unidades por línea en la UI (el store acepta cualquier entero >= 1). */
export const CANTIDAD_MAXIMA = 99;

/** Una línea del carrito: producto, personalización, cantidad, subtotal y «Quitar». */
export function EntradaCarrito({ linea }: { linea: LineaCarrito }) {
  const fijarCantidad = useCartStore((carrito) => carrito.fijarCantidad);
  const quitar = useCartStore((carrito) => carrito.quitar);
  const clave = claveLinea(linea.productoId, linea.personalizacion);
  const personalizacion = textoPersonalizacion(linea);
  // Dos líneas del mismo producto se distinguen por su personalización: va en los nombres accesibles de las acciones.
  const nombreAccesible = personalizacion === null ? linea.nombre : `${linea.nombre} ${personalizacion.toLowerCase()}`;

  const alQuitar = (): void => {
    quitar(clave);
    useUiStore.getState().notificar({ tipo: 'info', titulo: 'Quitado del carrito', mensaje: linea.nombre });
  };

  return (
    <li className="cartitem">
      <div className="thumb">
        <ImagenProducto nombre={linea.nombre} url={linea.imagenUrl} />
      </div>
      <div className="meta">
        <Link to={`${RUTAS.catalogo}/${linea.productoId}`}>{linea.nombre}</Link>
        {personalizacion === null ? null : <span className="opts">{personalizacion}</span>}
        <span className="unit">{formatearPrecio(linea.precioUnitario)} c/u</span>
      </div>
      <SelectorCantidad
        valor={linea.cantidad}
        max={CANTIDAD_MAXIMA}
        onCambiar={(cantidad) => fijarCantidad(clave, cantidad)}
        etiqueta={`Cantidad de ${nombreAccesible}`}
        etiquetaRestar={`Restar una unidad de ${nombreAccesible}`}
        etiquetaSumar={`Sumar una unidad de ${nombreAccesible}`}
      />
      <div className="sub">
        <Precio valor={subtotalLinea(linea)} />
      </div>
      <button type="button" className={`${claseBoton('fantasmaPeligro')} remove`} aria-label={`Quitar ${nombreAccesible}`} onClick={alQuitar}>
        <Icon name="basura" />
        <span className="txt" aria-hidden="true">
          Quitar
        </span>
      </button>
    </li>
  );
}
