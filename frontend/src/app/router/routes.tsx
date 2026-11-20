import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';
import { ShellConSesion } from '@/app/layouts/app-shell';
import { AdminCategoriasPage } from '@/pages/admin-categorias';
import { AdminIngredientesPage } from '@/pages/admin-ingredientes';
import { AdminProductosPage } from '@/pages/admin-productos';
import { CarritoPage } from '@/pages/carrito';
import { CatalogoPage } from '@/pages/catalogo';
import { DireccionesPage } from '@/pages/direcciones';
import { FinalizarCompraPage } from '@/pages/finalizar-compra';
import { GestionPedidoDetallePage, GestionPedidosPage } from '@/pages/gestion-pedidos';
import { IngresarPage } from '@/pages/ingresar';
import { MiCuentaPage } from '@/pages/mi-cuenta';
import { ErrorPage } from '@/pages/error';
import { NotFoundPage } from '@/pages/not-found';
import { PagoPedidoPage } from '@/pages/pago-pedido';
import { PedidoCreadoPage } from '@/pages/pedido-creado';
import { PlaceholderPage } from '@/pages/placeholder';
import { ProductoPage } from '@/pages/producto';
import { RegistrarsePage } from '@/pages/registrarse';
import { ACCESO_RUTAS, RUTA_FINALIZAR_COMPRA, RUTA_GESTION_PEDIDO, RUTA_PAGO_PEDIDO, RUTA_PEDIDO_CREADO, RUTA_PRODUCTO, RUTAS, type Acceso, type Ruta } from '@/shared/config';
import { FUTURO_ROUTER } from './future';
import { RequiereAcceso } from './requiere-acceso';
import { MAPA_RUTAS } from './route-map';

/** El checkout solo lo abre un cliente (el backend exige `CLIENT` para crear y pagar pedidos). */
const ACCESO_CLIENTE: Acceso = { roles: ['CLIENT'] };

/** Pantallas reales por ruta: cada change visual agrega su línea; las rutas sin entrada usan `PlaceholderPage`. */
const PAGINAS: Partial<Record<Ruta, ComponentType>> = {
  [RUTAS.catalogo]: CatalogoPage,
  [RUTAS.ingresar]: IngresarPage,
  [RUTAS.registrarse]: RegistrarsePage,
  [RUTAS.carrito]: CarritoPage,
  [RUTAS.direcciones]: DireccionesPage,
  [RUTAS.miCuenta]: MiCuentaPage,
  [RUTAS.gestionPedidos]: GestionPedidosPage,
  [RUTAS.adminCategorias]: AdminCategoriasPage,
  [RUTAS.adminIngredientes]: AdminIngredientesPage,
  [RUTAS.adminProductos]: AdminProductosPage,
};

/**
 * Árbol de rutas único: lo usa la app (`router`) y los tests (con `createMemoryRouter`).
 * Todo cuelga de un layout con el shell; las rutas sin pantalla usan la página provisoria de su dueño.
 * Cada ruta del mapa se envuelve en `RequiereAcceso` según la tabla `ACCESO_RUTAS`.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <ShellConSesion />,
        children: [
          { index: true, element: <Navigate to={RUTAS.catalogo} replace /> },
          ...MAPA_RUTAS.map(({ path, title, owner }) => {
            const Pagina = PAGINAS[path];
            return {
              path,
              element: (
                <RequiereAcceso acceso={ACCESO_RUTAS[path]}>
                  {Pagina === undefined ? <PlaceholderPage title={title} owner={owner} /> : <Pagina />}
                </RequiereAcceso>
              ),
            };
          }),
          { path: RUTA_GESTION_PEDIDO, element: <RequiereAcceso acceso={ACCESO_RUTAS[RUTAS.gestionPedidos]}><GestionPedidoDetallePage /></RequiereAcceso> },
          { path: RUTA_PRODUCTO, element: <RequiereAcceso acceso="publica"><ProductoPage /></RequiereAcceso> },
          // Checkout (C-19): solo clientes; fuera del mapa de navegación. La ruta de pago (C-20a) lleva a la página real de pago con tarjeta.
          { path: RUTA_FINALIZAR_COMPRA, element: <RequiereAcceso acceso={ACCESO_CLIENTE}><FinalizarCompraPage /></RequiereAcceso> },
          { path: RUTA_PEDIDO_CREADO, element: <RequiereAcceso acceso={ACCESO_CLIENTE}><PedidoCreadoPage /></RequiereAcceso> },
          { path: RUTA_PAGO_PEDIDO, element: <RequiereAcceso acceso={ACCESO_CLIENTE}><PagoPedidoPage /></RequiereAcceso> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { future: FUTURO_ROUTER });
