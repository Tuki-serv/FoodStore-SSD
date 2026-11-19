import { act, screen } from '@testing-library/react';
import { useCartStore, type LineaCarrito } from '@/entities/cart';
import { crearEstadoDirecciones, direccionDto, handlersDirecciones, type DireccionDto } from './msw/direcciones';
import { crearEstadoPedidos, handlersPedidos, type EstadoPedidos } from './msw/pedidos';
import { server } from './msw/server';
import { renderApp } from './render-app';

export const hamburguesaSinCebollaNiTomate: LineaCarrito = {
  productoId: 1,
  nombre: 'Hamburguesa Clásica',
  precioUnitario: '1500.00',
  imagenUrl: null,
  cantidad: 2,
  personalizacion: [1, 3],
  personalizacionNombres: ['Cebolla', 'Tomate'],
};

export const cocaCola: LineaCarrito = {
  productoId: 5,
  nombre: 'Coca-Cola 500ml',
  precioUnitario: '800.00',
  imagenUrl: null,
  cantidad: 1,
  personalizacion: [],
  personalizacionNombres: [],
};

export const casa: DireccionDto = direccionDto({ id: 4, alias: 'Casa', linea1: 'Av. San Martín 1234', ciudad: 'Mendoza', es_principal: true });
export const trabajo: DireccionDto = direccionDto({ id: 6, alias: 'Trabajo', linea1: 'Belgrano 455', ciudad: 'Godoy Cruz' });

export interface OpcionesCheckout {
  lineas?: LineaCarrito[];
  direcciones?: DireccionDto[];
  pedidos?: Partial<EstadoPedidos>;
  ruta?: string;
}

/** Renderiza `/finalizar-compra` como un CLIENT con el carrito precargado y la red de direcciones y pedidos simulada. */
export function montarCheckout({ lineas = [hamburguesaSinCebollaNiTomate, cocaCola], direcciones = [casa, trabajo], pedidos, ruta = '/finalizar-compra' }: OpcionesCheckout = {}) {
  act(() => useCartStore.setState({ lineas }));
  const estadoDirecciones = crearEstadoDirecciones(direcciones);
  const estadoPedidos = crearEstadoPedidos(pedidos);
  server.use(...handlersDirecciones(estadoDirecciones), ...handlersPedidos(estadoPedidos));
  const app = renderApp(ruta, { sesion: { roles: ['CLIENT'] } });
  return { estadoDirecciones, estadoPedidos, ...app };
}

/** Espera a que la pantalla de checkout y las direcciones del cliente estén cargadas. */
export async function esperarCheckout() {
  await screen.findByRole('heading', { name: 'Finalizar compra', level: 1 });
  await screen.findByRole('radio', { name: /Retiro en el local/ });
}
