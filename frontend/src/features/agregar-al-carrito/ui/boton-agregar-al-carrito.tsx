import { useLocation, useNavigate } from 'react-router-dom';
import { textoPersonalizacion, useCartStore, type IngredienteExcluido } from '@/entities/cart';
import { aProductoParaCarrito, estadoStock, formatearPrecio, type Producto } from '@/entities/producto';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { RUTAS } from '@/shared/config';
import { rutaRecordada } from '@/shared/lib';
import { useUiStore } from '@/shared/model';
import { claseBoton, Icon } from '@/shared/ui';

export interface BotonAgregarAlCarritoProps {
  producto: Producto;
  /** Unidades a sumar (el detalle las elige con su selector). */
  cantidad?: number;
  /** `tarjeta`: botón «+» redondo (con texto «Agregar» desde desktop); `detalle`: «Agregar al carrito · $ N» grande (en mobile, «Agregar · $ N»). */
  variante?: 'tarjeta' | 'detalle';
  /** Ingredientes que la persona quitó (solo el detalle los ofrece); sin ellos el producto va tal cual. */
  excluidos?: readonly IngredienteExcluido[];
}

/** Total de `cantidad` unidades a `precio` (decimal del servidor), con dos decimales. */
const totalDe = (precio: string, cantidad: number): string => (Number(precio) * cantidad).toFixed(2);

/**
 * Agrega el producto al carrito local y avisa «Agregado al carrito». Sin sesión no toca el carrito: lleva a «Ingresar»
 * recordando la ruta actual (el guard de rutas devuelve a la persona al mismo lugar al iniciar sesión). Sin stock, deshabilitado.
 * No valida contra lo ya acumulado en el carrito: lo resuelve la creación del pedido (`INSUFFICIENT_STOCK`).
 */
export function BotonAgregarAlCarrito({ producto, cantidad = 1, variante = 'tarjeta', excluidos = [] }: BotonAgregarAlCarritoProps) {
  const estado = useAuthStore(selectEstado);
  const agregar = useCartStore((carrito) => carrito.agregar);
  const navigate = useNavigate();
  const location = useLocation();
  const grande = variante === 'detalle';
  const clase = grande ? `${claseBoton('primario')} grow add-detail` : `${claseBoton('primario', { compacto: true })} add-round`;

  if (estadoStock(producto.stock_cantidad) === 'agotado') {
    return (
      <button type="button" className={clase} disabled>
        Agotado
      </button>
    );
  }

  const alPulsar = (): void => {
    if (estado !== 'autenticada') {
      navigate(RUTAS.ingresar, { state: { desde: rutaRecordada(location) } });
      return;
    }
    agregar(aProductoParaCarrito(producto), cantidad, excluidos);
    const ids = excluidos.map((excluido) => excluido.id);
    const nombres = excluidos.map((excluido) => excluido.nombre);
    const personalizacion = textoPersonalizacion({ personalizacion: ids, personalizacionNombres: nombres });
    const detalle = `${cantidad} × ${producto.nombre}`;
    useUiStore.getState().notificar({
      tipo: 'success',
      titulo: 'Agregado al carrito',
      mensaje: personalizacion === null ? detalle : `${detalle}, ${personalizacion.toLowerCase()}`,
    });
  };

  return (
    <button type="button" className={clase} aria-label={`Agregar ${producto.nombre} al carrito`} onClick={alPulsar}>
      <Icon name={grande ? 'carrito' : 'mas'} className="h-[18px] w-[18px]" />
      {grande ? (
        <>
          Agregar<span className="add-extra"> al carrito</span> · {formatearPrecio(totalDe(producto.precio_base, cantidad))}
        </>
      ) : (
        <span className="add-txt">Agregar</span>
      )}
    </button>
  );
}
