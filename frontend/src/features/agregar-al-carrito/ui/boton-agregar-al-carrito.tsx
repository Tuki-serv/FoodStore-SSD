import { useLocation, useNavigate } from 'react-router-dom';
import { textoPersonalizacion, useCartStore, type IngredienteExcluido } from '@/entities/cart';
import { aProductoParaCarrito, estadoStock, type Producto } from '@/entities/producto';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { RUTAS } from '@/shared/config';
import { rutaRecordada } from '@/shared/lib';
import { useUiStore } from '@/shared/model';
import { claseBoton, Icon } from '@/shared/ui';

export interface BotonAgregarAlCarritoProps {
  producto: Producto;
  /** Unidades a sumar (el detalle las elige con su selector). */
  cantidad?: number;
  /** `tarjeta`: «Agregar» compacto; `detalle`: «Agregar al carrito» grande. */
  variante?: 'tarjeta' | 'detalle';
  /** Ingredientes que la persona quitó (solo el detalle los ofrece); sin ellos el producto va tal cual. */
  excluidos?: readonly IngredienteExcluido[];
}

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
  const clase = grande ? `${claseBoton('primario')} grow` : claseBoton('primario', { compacto: true });

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
      {grande ? 'Agregar al carrito' : 'Agregar'}
    </button>
  );
}
