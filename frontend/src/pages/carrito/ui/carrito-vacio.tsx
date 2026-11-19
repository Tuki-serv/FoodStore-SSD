import { Link } from 'react-router-dom';
import { RUTAS } from '@/shared/config';
import { claseBoton, EstadoVacio } from '@/shared/ui';

/** Carrito sin líneas: invita a volver al catálogo. */
export function CarritoVacio() {
  return (
    <EstadoVacio icono="carrito" titulo="Tu carrito está vacío" texto="Cuando agregues productos, los vas a ver acá con su personalización y el total.">
      <Link className={claseBoton('primario')} to={RUTAS.catalogo}>
        Ver catálogo
      </Link>
    </EstadoVacio>
  );
}
