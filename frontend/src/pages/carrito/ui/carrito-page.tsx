import { Link } from 'react-router-dom';
import { claveLinea, selectLineas, useCartStore } from '@/entities/cart';
import { RUTAS } from '@/shared/config';
import { useUiStore } from '@/shared/model';
import { claseBoton, Icon } from '@/shared/ui';
import { CarritoVacio } from './carrito-vacio';
import { EntradaCarrito } from './entrada-carrito';
import { ResumenCarrito } from './resumen-carrito';

const plural = (cantidad: number, singular: string, plural: string): string => `${cantidad} ${cantidad === 1 ? singular : plural}`;

/** Carrito del cliente (US-015/US-016): líneas con su personalización, cantidades, quitar, vaciar y totales. Todo es estado local. */
export function CarritoPage() {
  const lineas = useCartStore(selectLineas);
  const vaciar = useCartStore((carrito) => carrito.vaciar);
  const contenedor = 'mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

  if (lineas.length === 0) {
    return (
      <div className={contenedor}>
        <header className="page-head">
          <h1 className="text-2xl">Carrito</h1>
        </header>
        <CarritoVacio />
      </div>
    );
  }

  const unidades = lineas.reduce((total, linea) => total + linea.cantidad, 0);

  const pedirVaciar = (): void => {
    useUiStore.getState().pedirConfirmacion({
      titulo: '¿Vaciar el carrito?',
      mensaje: `Se van a quitar los ${plural(unidades, 'producto', 'productos')} del carrito. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Vaciar',
      variante: 'peligro',
      onConfirmar: vaciar,
    });
  };

  return (
    <div className={contenedor}>
      <div className="page-head-row">
        <header className="page-head">
          <h1 className="text-2xl">Carrito</h1>
          <p>{`${plural(unidades, 'unidad', 'unidades')} en ${plural(lineas.length, 'línea', 'líneas')}`}</p>
        </header>
        <button type="button" className={`${claseBoton('fantasmaPeligro')} btn-vaciar`} onClick={pedirVaciar}>
          <Icon name="basura" className="h-[18px] w-[18px]" />
          Vaciar carrito
        </button>
      </div>
      <div className="cart">
        <div>
          <ul className="cart-list" aria-label="Productos del carrito">
            {lineas.map((linea) => (
              <EntradaCarrito key={claveLinea(linea.productoId, linea.personalizacion)} linea={linea} />
            ))}
          </ul>
          <div className="cart-foot">
            <Link to={RUTAS.catalogo}>
              <Icon name="volver" />
              Seguir comprando
            </Link>
          </div>
        </div>
        <ResumenCarrito />
      </div>
    </div>
  );
}
