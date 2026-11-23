# Food Store — Frontend

React 18 + TypeScript 5 (`strict`, sin `any`) + Vite 5 + Tailwind CSS 3 + Zustand 4 + TanStack Query 5 + Axios + react-router-dom 6. Tests con Vitest, React Testing Library y MSW. Organizado en Feature-Sliced Design (FSD).

## Requisitos

- Node.js 24 (o 22.22 en adelante) y npm. Con Node 20 los tests no corren: jsdom 31 y jest-dom 7 piden Node 22 o superior.
- El backend (`backend/`) para usar datos reales; la suite de tests **no** lo necesita.

## Puesta en marcha

Desde `frontend/`:

```bash
cp .env.example .env     # una vez; .env no se versiona
npm install
npm run dev              # http://localhost:5173
```

Con Docker Compose, desde la raíz del repo (requiere `frontend/.env`, creado con el `cp` de arriba; si no existe, `docker compose config` falla):

```bash
docker compose up -d frontend
```

### Variables de entorno

Solo se leen variables `VITE_*`, de forma explícita y sin valores por defecto ocultos (módulo `src/shared/config/env.ts`). Si falta una obligatoria, la app falla al arrancar nombrándola.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_API_URL` | Sí | URL base del backend FastAPI, tal como la ve el navegador (`http://localhost:8000`). |

Las variables `VITE_*` van en `frontend/.env`, nunca en el `.env` de la raíz (que es solo de Docker Compose).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm test` | Corre toda la suite una vez (`vitest run`), sin backend ni red. |
| `npm run test:watch` | Tests en modo watch. |
| `npm run typecheck` | `tsc --noEmit` con `strict`. |
| `npm run lint` | ESLint (`@typescript-eslint/no-explicit-any` es error). |

Para correr un archivo: `npm test -- fsd` (filtra por nombre).

## Estructura (FSD) y mapeo con la estructura de la spec `[INT]`

`src/` usa las capas de FSD v2.1: `app`, `pages`, `entities` y `shared`. `features` y `widgets` se crean cuando un change tenga dos consumidores reales (`features/` llega con C-14). Un módulo solo importa de capas inferiores, nunca de otro slice de su misma capa, y entre capas solo por la API pública (`index.ts`) del slice o segmento. Alias: `@/` apunta a `src/`; `@design-system/` apunta a `../design-system/`.

```text
src/
  app/        providers/ (AppProviders, SesionGate), router/ (rutas, mapa con dueño, guards), layouts/app-shell/ (panel lateral), styles/
  pages/      un slice por pantalla: placeholder/, not-found/, error/, forbidden/, direcciones/ (C-15), catalogo/ y producto/ (C-16b), admin-productos/ (C-17b), admin-categorias/ y admin-ingredientes/ (C-17a; las demás de negocio llegan en C-14 y siguientes)
  entities/   session/ (operaciones y hooks de sesión), cart/ (cartStore), payment/ (paymentStore), direccion/ (C-15: contrato, consultas, mutaciones, TarjetaDireccion y SelectorDireccion)
  shared/     api/ (cliente HTTP, ApiError, QueryClient), auth/ (authStore), config/ (env, roles, rutas y acceso, marca),
              model/ (uiStore), lib/ (useMediaQuery, almacenamiento seguro), ui/ (Icon, PantallaCarga, botones, Campo, Dialogo)
  test/       setup de Vitest (MSW y reset de stores), msw/ (auth, direcciones), render-app, render-direcciones, router, query, axe (no es una capa de la app)
tests/architecture/   fronteras FSD y tokens de Tailwind (corren con `npm test`)
```

| `[INT]` (spec) | FSD en este repo |
|----------------|------------------|
| `app/` (providers, router, estilos) | `src/app/` (`providers/`, `router/`, `layouts/app-shell/`, `styles/`) |
| `pages/` | `src/pages/<slice>/` (uno por ruta) |
| `features/` | `src/features/<slice>/` (desde C-14) |
| `components/` | `src/shared/ui/` |
| `hooks/` | segmentos `api/` y `model/` de cada slice |
| `store/` (4 stores) | `uiStore` en `src/shared/model/`; `authStore` en `src/shared/auth/`; `cartStore` en `src/entities/cart/`; `paymentStore` en `src/entities/payment/` |
| `api/` | `src/shared/api/` |
| `types/` | segmento `model/` del slice; contratos HTTP en `shared/api` |

## Direcciones, notificaciones y confirmaciones (C-15)

- **Slices nuevos**: `src/entities/direccion/` (tipos `Direccion`/`DireccionDatos`, `direccionPorDefecto`, `nombreDireccion`, `direccionQueries`, hooks de mutación, `TarjetaDireccion`, `ResumenDireccion` y `SelectorDireccion` para el checkout de C-19), `src/pages/direcciones/` (página `/direcciones`: listado paginado, formulario, marcar principal y eliminar; `model/` con la validación y la normalización) y los componentes genéricos `src/shared/ui/campo/` (`Campo`: etiqueta + control + ayuda + error con `aria-invalid`/`aria-describedby`) y `src/shared/ui/dialogo/` (`Dialogo`: modal accesible con foco atrapado, Escape y scrim).
- **Claves de consulta**: `['direcciones']` (`direccionQueries.todas()`), `['direcciones', 'lista']` y `['direcciones', 'lista', { page, size }]`. Son privadas de la sesión: se descartan al cerrar o vencer la sesión. Todas las mutaciones invalidan `['direcciones']` (y también ante un 403/404, porque la dirección ya no existe).
- **Notificaciones**: `useUiStore.getState().notificar({ tipo: 'success' | 'error' | 'warning' | 'info', titulo, mensaje? })` desde cualquier pantalla; el host `Notificaciones` (`src/app/layouts/app-shell/`, montado en `ShellConSesion`) las dibuja (`role="alert"` en las de error, `role="status"` en el resto) y las descarta a los 5 s.
- **Confirmaciones**: `useUiStore.getState().pedirConfirmacion({ titulo, mensaje, textoConfirmar?, textoCancelar?, variante?: 'peligro' | 'normal', onConfirmar })`; `ConfirmacionGlobal` muestra el diálogo (foco inicial en «Cancelar», Escape/scrim cancelan, el foco vuelve al control que lo abrió). Con `variante: 'peligro'` el botón de confirmar es rojo.
- **Pantallas reales**: `PAGINAS` en `src/app/router/routes.tsx` asocia una ruta con su pantalla; las rutas sin entrada siguen con `PlaceholderPage`. Cada change visual agrega su línea.
- **Formularios**: `@tanstack/react-form` 1.x (la KB decía 0.x; la API base `useForm`/`form.Field`/`validators` es la misma). Los validadores son funciones puras que devuelven `undefined` si el valor es válido.
- **Accesibilidad en tests**: `esperarSinViolacionesA11y(contenedor)` de `src/test/axe.ts` (`axe-core`, con `color-contrast` desactivada porque jsdom no calcula estilos); se usa en páginas, formularios y diálogos.

## Catálogo público y detalle (C-16b)

- **Slices nuevos**: `src/entities/producto/` (tipos, `formatearPrecio`, `estadoStock`, `productoQueries`, `TarjetaProducto` con slot `accion`), `src/entities/categoria/` (`categoriaQueries.arbol`, `idsDelSubarbol`, `ArbolCategorias`), `src/features/agregar-al-carrito/` (`BotonAgregarAlCarrito`), `src/pages/catalogo/`, `src/pages/producto/`, `src/shared/ui/paginacion/` (`Paginacion`, reemplaza a la de direcciones) y `src/shared/lib/valor-diferido/` (`useValorDiferido`, debounce).
- **Claves de consulta**: `['productos', 'lista', filtros]`, `['productos', 'detalle', id]` y `['categorias', 'arbol']` (árbol con `staleTime` de 5 minutos).
- **Listas en query string**: el cliente Axios serializa los arrays repetidos (`categoria_ids=1&categoria_ids=2`) con `paramsSerializer: { indexes: null }`, como espera FastAPI.
- **Filtros en la URL**: `categoria`, `q`, `min`, `max`, `stock` y `page` (12 por página). Elegir una categoría envía todo su subárbol; `q` se escribe en la URL con un debounce de 300 ms. Cualquier cambio de filtro vuelve a la página 1.
- **Detalle**: `RUTA_PRODUCTO` (`/catalogo/:productoId`, pública) y `rutaProducto(id)` en `@/shared/config`. No es sección de navegación, así que no entra en `RUTAS` ni en `ACCESO_RUTAS`. «Volver al catálogo» recupera los filtros desde `state.volverA`.
- **Agregar al carrito**: con sesión suma al `cartStore` y avisa con un toast; sin sesión lleva a `/ingresar` con `state.desde` (`rutaRecordada`) y, tras el ingreso, vuelve al producto sin agregarlo.

## Tokens y estilos

La fuente visual es `design-system/tokens.css` (Revision 4): se importa tal cual desde `src/app/styles/index.css`, sin copiarlo. El tema de Tailwind (`tailwind.config.ts`) solo referencia esas variables con `var(--…)`; un test (`tests/architecture/tailwind-tokens.test.ts`) falla si aparece un valor literal o una variable inexistente. Para cambiar un color o espaciado, se edita `design-system/tokens.css`.

El CSS del panel lateral (`src/app/layouts/app-shell/app-shell.css`) es el aprobado en `design-system/components.html`. Las páginas usan utilidades de Tailwind; las piezas con reglas propias de los mockups aprobados (notificaciones, diálogo, campo, tarjeta/selector de dirección y página de direcciones) viven en un `.css` junto a su componente y se importan desde `src/app/styles/index.css`. Esas reglas no definen el tamaño de `svg.ico`: el tamaño lo da la clase del `<Icon>` (verify V-2).

### Lenguaje visual (revision-visual, Revision 4)

- **Fuentes**: autoalojadas (`@font-face` con `font-display: swap` apuntando a archivos locales; sin hosts remotos). Las familias salen de `--font-display` y `--font-sans`; `tests/architecture/styles-compile.test.ts` comprueba que cada archivo existe.
- **Movimiento**: tokens `--motion-*`/`--ease-*`; `:hover` solo dentro de `@media (hover: hover) and (pointer: fine)`; respuesta al presionar con `--press-scale`; entrada escalonada solo en el primer montaje (`usePrimerMontaje`, `--i` topado en 8). Con `prefers-reduced-motion: reduce` los tokens valen 0 y no hay escala ni transición.
- **Respaldo de imagen**: `ImagenProducto` sin foto (o si no carga) muestra la inicial del producto sobre un color de marca único, con `role="img"` y «Sin imagen de <nombre>». El seed no trae URLs externas.
- **Encabezado de página** (`shared/ui/encabezado-pagina`, `EncabezadoPagina`): banda con título, eyebrow, subtítulo, ruta, estado, metadatos, acciones, herramientas y filtros activos (chips quitables, «Limpiar filtros» con dos o más, conteo). Con `fijo` queda pegada arriba (`z-index: var(--z-page-header)`, bajo la barra superior en < 1024 px) y pasa a compacto (`data-stuck="true"`) cuando un `IntersectionObserver` sobre un centinela de alto 0 deja de intersectar. Publica su borde inferior en `--band-h` para que los encabezados de columnas de las listas (`.orow.ohead`, `.plist > .phead`, `.ilist > .ihead/.uhead`, `.th-fijos thead th`) queden fijos debajo. Es fijo en listados y en el detalle de gestión de pedido (con sus acciones); en detalle y formularios va sin fijar. `herramientasColapsables` oculta la barra de herramientas en mobile compacto.

### Build de producción (C-25b1)

- `npm run build` valida tipos (`tsc --noEmit`) y genera el sitio estático en `dist/` (requiere `VITE_API_URL`).
- `frontend/Dockerfile` tiene dos objetivos: `dev` (servidor de Vite, el que usa compose por defecto) y `prod` (nginx sirviendo `dist/` con fallback a `index.html`, para que `/mis-pedidos` funcione al recargar).
- Imagen de producción desde la raíz: `docker compose --profile prod up -d --build frontend-prod` (sitio en http://localhost:8080; `VITE_API_URL` se incrusta al construir, por defecto `http://localhost:8000`). `design-system/` llega como contexto adicional de build.

## Tests

`npm test` ejecuta tests de componentes en jsdom (por lo que el usuario ve y hace: roles accesibles, texto, interacción) y los tests de arquitectura. La red se simula en el borde con **MSW** (`src/test/msw/server.ts`, iniciado en `src/test/setup.ts` con `onUnhandledRequest: 'error'`: un pedido sin handler hace fallar el test); cada test sobrescribe con `server.use(...)`. `renderApp(ruta, { sesion })` (`src/test/render-app.tsx`) monta el árbol real con sesión y router; los stores se reinician solos entre tests. jsdom no evalúa CSS ni media queries: el comportamiento desktop/mobile se prueba con un `matchMedia` simulado (`setViewport(ancho)` en `src/test/viewport.ts`); la apariencia se verifica contra los mockups.

## Cliente HTTP y errores (`src/shared/api/`)

Las pantallas nunca usan `axios` directo: importan `apiClient` (o las funciones de cada `api/`) desde `@/shared/api`. El cliente apunta a `VITE_API_URL` + `/api/v1` (se indica solo el path: `apiClient.get('/auth/me')`), envía las credenciales del navegador (la cookie HttpOnly del refresh viaja sola a `/api/v1/auth`) y agrega `Authorization: Bearer <access>` si hay access en el `authStore`.

- **Renovación ante 401** (`renovacion.ts`): `POST /auth/refresh`, guarda el access nuevo y repite el pedido una sola vez. Los 401 concurrentes comparten **una** renovación (evita el reuso del refresh rotado). `/auth/login` y `/auth/refresh` no renuevan; `/auth/logout` sí. Si la renovación falla, la sesión queda anónima (`motivo: 'expirada'`).
- **Errores**: todo pedido fallido llega como `ApiError` (`status`, `code`, `detail`, `field`, `retryAfter`). Decidí por `code` (`INSUFFICIENT_STOCK`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `NETWORK_ERROR`, `HTTP_<status>`...), nunca por el texto de `detail`; usá `field` para marcar un campo (`mensajeDeCampo(error, 'email')`) y `retryAfter` (segundos, solo en 429) para el aviso de bloqueo de login. `esApiError(error)` acota el tipo; con TanStack Query `error` ya es `ApiError`.
- **Sesión**: el access vive **solo en memoria** (DD-27, `knowledge-base/09`); al recargar, `SesionGate` (`src/app/providers/sesion-gate.tsx`) rehidrata con `POST /auth/refresh` + `GET /auth/me` una sola vez y muestra `PantallaCarga` mientras tanto. Operaciones: `abrirSesion(access)` (la usa el login de C-14), `useCerrarSesion()`, `useSesion()` desde `@/entities/session`. Los roles de la interfaz salen de `GET /auth/me`.
- **Carrera logout/renovación**: la renovación solo aplica si el access vigente sigue siendo el que tenía el pedido al empezar (`renovarAccess(previo, nuevo)` en `authStore`); una respuesta de refresh tardía tras un logout o un login nuevo se descarta.
- **Logout con el backend caído**: la cookie HttpOnly del refresh sigue viva, porque el frontend no puede borrarla y solo el servidor puede invalidarla. El estado del cliente se limpia igual (sesión anónima, sin access en memoria).
- **Nota ngrok / `SameSite`**: si el frontend se sirve en otro dominio que el backend (por ejemplo un túnel de ngrok), `SameSite=lax` bloquea la cookie del refresh en los pedidos XHR cross-site. En ese caso el backend necesita `REFRESH_COOKIE_SAMESITE=none` y `REFRESH_COOKIE_SECURE=true` (ya validado por su `Settings`).

### Claves de consulta (TanStack Query)

Arrays jerárquicos con el **dominio primero**, definidos con `queryOptions` en el `api/` del slice dueño (por ejemplo `sesionQueries` en `src/entities/session/api/session-queries.ts`): `['sesion', 'rehidratar']`, `['productos', 'lista', filtros]`, `['productos', 'detalle', id]`, `['pedidos', 'lista', filtros]`, `['pedidos', 'detalle', id]`. Son **públicas** (sobreviven al cierre de sesión) las que empiezan con una de `CLAVES_PUBLICAS` (`productos`, `categorias`, `ingredientes`, `unidades-medida`); todo lo demás es privado y se descarta de la caché cuando la sesión pasa de `autenticada` a `anonima` (`esConsultaPrivada` en `src/shared/api/query-client.ts`). La caché no reintenta 4xx, reintenta una vez ante red o 5xx, y nunca reintenta mutaciones (`crearQueryClient`).

### Acceso por ruta

`ACCESO_RUTAS` (`src/shared/config/routes.ts`) es la única tabla de quién entra a cada ruta; la leen los guards (`src/app/router/requiere-acceso.tsx`) y la navegación (`src/app/layouts/app-shell/model/navigation.ts`). Es ayuda de UX: el backend autoriza cada pedido.

## Estado actual

- La app arranca verificando la sesión y muestra el panel lateral con la variante de los roles del usuario (o «sin sesión»: Catálogo, Ingresar, Registrarse) y páginas provisorias por ruta. Las rutas tienen guards por rol (anónimo → `/ingresar`, rol insuficiente → «Sin permiso»).
- Las páginas provisorias (todas menos `/direcciones`, `/catalogo` y `/catalogo/:productoId`) no piden ni muestran datos del backend.
- Cada ruta declara en `src/app/router/route-map.ts` el change que implementa su pantalla (`owner`).
- `/direcciones` ya es una pantalla real (C-15), y `/catalogo` y `/catalogo/:productoId` (C-16b): el resto de las rutas sigue con la página provisoria.

## Administración de categorías e ingredientes (C-17a)

- **Slices nuevos**: `src/entities/ingrediente/` (contrato, `ingredienteQueries.lista`, mutaciones, `resumenUso`), `src/entities/unidad-medida/` (`unidadMedidaQueries.todas`, `etiquetaUnidad`), mutaciones y `padresPosibles`/`contarDescendientes` en `src/entities/categoria/`, `src/pages/admin-categorias/` y `src/pages/admin-ingredientes/` (rutas `/admin/categorias` y `/admin/ingredientes`, solo ADMIN), y los componentes compartidos `shared/ui/estados/` (esqueleto, vacío, error, aviso de datos desactualizados), `shared/ui/dialogo-baja/` y `shared/ui/lista-admin/` (solo CSS), más `shared/lib/texto-formulario.ts` y `shared/model/avisos.ts` (`avisarExito`, `avisarError`).
- **Invalidaciones**: toda mutación de categorías invalida `['categorias']` y `['productos']`; toda mutación de ingredientes invalida `['ingredientes']` y `['productos']` (el detalle público muestra la marca de alérgeno).
- **Ingredientes en la URL**: `alergeno` (`si`/`no`) y `page` (20 por página); cambiar el filtro vuelve a la página 1.
- **Unidad del ingrediente (C-17b)**: `Ingrediente.unidad_medida_id` es obligatorio en el frontend (la fila siempre muestra la unidad y la edición preelige la actual). Requiere que el backend de C-17b la exponga (`IngredienteRead.unidad_medida_id`, `PATCH` que la acepte).

## Carrito y personalización (C-18)

- **Página `/carrito`** (`src/pages/carrito/`: `CarritoPage`, `EntradaCarrito`, `ResumenCarrito`, `CarritoVacio`, `carrito.css`): solo con sesión; sin pedir nada al servidor (el carrito es estado de cliente). Cantidades con tope 99 por línea en la UI, «Quitar» sin confirmación (toast «Quitado del carrito»), «Vaciar carrito» con el diálogo global. Desde C-19 el resumen suma «Finalizar compra» (solo con rol `CLIENT`; el resto ve que solo las cuentas de cliente pueden hacer pedidos) y la nota del costo de envío fijo.
- **Personalización**: `SelectorPersonalizacion` (`src/features/agregar-al-carrito/`) en el detalle del producto, una casilla «Sin X» por ingrediente removible (`ingredientesRemovibles` de `entities/producto`). Las casillas se mantienen tras agregar.
- **Store**: `LineaCarrito.personalizacionNombres` (snapshot de nombres) y `agregar(producto, cantidad, excluidos: {id, nombre}[])`; persistencia v2 con `migrate` desde v1. Helpers puros: `subtotalLinea`, `textoPersonalizacion`.
- **Contador**: `ContadorCarrito` (`entities/cart/ui`) en el ítem «Carrito» del panel y en el botón de la barra superior mobile (solo con sesión); cuenta unidades.
- **Compartido**: `SelectorCantidad` ahora vive en `src/shared/ui/selector-cantidad/` (etiquetas parametrizables).

## Checkout y confirmación del pedido (C-19)

- **Rutas** (solo `CLIENT`, fuera de `RUTAS`/`ACCESO_RUTAS`: no son secciones de navegación; helpers en `shared/config/routes.ts`): `/finalizar-compra` (`FinalizarCompraPage`), `/finalizar-compra/pedido/:pedidoId` (`PedidoCreadoPage`) y `/finalizar-compra/pedido/:pedidoId/pago` (`PagoPedidoPage`, C-20a: pago con tarjeta).
- **Checkout** (`src/pages/finalizar-compra/`: página con TanStack Form, `PasoEntrega` sobre `SelectorDireccion`, `PasoFormaPago`, `CampoNotas`, `ResumenPedido`, `AvisoErrorPedido`, `armarPedido`): un único `POST /pedidos/`; botón «Creando pedido…» y campos deshabilitados mientras viaja (el backend no es idempotente). Al crear: navega a la confirmación (con `state.totalEstimado`), vacía el carrito y avisa con un toast. Ante un rechazo conserva carrito y elecciones; con el carrito vacío vuelve a `/carrito`.
- **Entidad `src/entities/pedido/`**: tipos del contrato, `FORMAS_PAGO` (catálogo local: el backend no lista formas de pago), `COSTO_ENVIO`/`DESCUENTO` (DD-10, `[PENDIENTE DE DECISIÓN: PA-11/PA-13]`; el envío se muestra también con retiro), `itemsDesdeCarrito`, `totalEstimado`, `clasificarErrorCreacion` (único lugar que decide por el texto de `detail`, excepción documentada a «decidir por `code`»), `pedidoQueries` (`todas()` = `['pedidos']`, `detalle(id)`), `useCrearPedido` (siembra `detalle(id)` e invalida `['pedidos']`), `BadgeEstado` y `EtiquetaFormaPago`.
- **Confirmación** (`src/pages/pedido-creado/`): lee el pedido de la caché sembrada al crear (sin GET extra) o, al recargar, de `GET /pedidos/{id}`; 404/403 → «No encontramos este pedido». EFECTIVO/TRANSFERENCIA: pasos de confirmación manual (DD-22), sin acción de pago; MERCADOPAGO `PENDIENTE`: «Pagar $ X con tarjeta». Aviso «Los precios se actualizaron» si el total del servidor difiere del estimado.
- **Compartido nuevo**: `shared/lib/importe.ts` (`aCentavos`, `formatearCentavos`, `sumarImportes`, usados por el carrito y el pedido), `useDireccionPorId` en `entities/direccion` y seis íconos (`tarjeta`, `efectivo`, `transferencia`, `reloj`, `info`, `exito`).
- **Tests**: `src/test/msw/pedidos.ts` (estado en memoria con respuesta de creación configurable) y `montarCheckout` en `src/test/render-checkout.ts`.

## Pago con tarjeta (C-20a)

- **Slices**: `src/pages/pago-pedido/` (`PagoPedidoPage`: decide la vista con `vistaPago` a partir del pedido y del último resultado en la caché), `src/features/pagar-con-tarjeta/` (`FormularioTarjeta`: **único** módulo que importa `@mercadopago/sdk-react`, versión exacta `1.1.0`; el brick `CardPayment` recibe los datos de la tarjeta y a Food Store solo llega el token) y `src/entities/payment/` (`pagoQueries.configuracion()` / `.estado(id)`, `useCrearPago`, `cuerpoDesdeBrick`, `vistaPago`, `motivoRechazo`, `clasificarErrorPago`, `montoDesdeTotal` y `paymentStore`).
- **Clave pública**: no hay variable `VITE_*`; el brick se inicializa con la que devuelve `GET /api/v1/pagos/config` (el backend la lee de `MP_PUBLIC_KEY`). **Sin `MP_PUBLIC_KEY` en el backend ese endpoint responde 503 y la página avisa que el pago con tarjeta no está disponible.** `POST /pagos/crear` además necesita `MP_ACCESS_TOKEN`, y el webhook `MP_WEBHOOK_SECRET` (ver `backend/README.md`). Sin credenciales reales en el repo.
- **Probar en sandbox** (con el backend, ngrok para el webhook y credenciales de **prueba** propias): el pagador debe ser un comprador de prueba distinto del usuario de Food Store (no se precarga el email). Con las tarjetas de prueba de Mercado Pago, el nombre del titular decide el resultado: `APRO` (aprobado), `FUND` (fondos insuficientes), `OTHE` (rechazo general) y `CONT` (queda pendiente: esta pantalla no se actualiza sola; el seguimiento es C-20b).
- **Tests**: el único `vi.mock` es el del SDK, con el doble `src/test/mp-sdk-doble.tsx` (botones «Simular pago», «Simular brick listo» y «Simular error del brick»); la red va por MSW (`src/test/msw/pagos.ts`) y `montarPago` en `src/test/render-pago.ts`.

## Gestión de pedidos (C-22)

- **Rutas** (solo `PEDIDOS`/`ADMIN`, con `RequiereAcceso`): `/gestion-pedidos` (listado) y `/gestion-pedidos/:pedidoId` (detalle). Slices: `src/pages/gestion-pedidos/` (listado, filtros en la URL, detalle), `src/features/cambiar-estado-pedido/` (diálogos de avance y de cancelación; los comparten el listado y el detalle) y `src/entities/pedido/` ampliada (`pedidoQueries.lista/historial`, `cambiarEstadoPedido`, `accionesGestion`, `clasificarErrorCambioEstado`, `LineaTiempoHistorial`, `EntregaDelPedido`).
- **Actualización**: polling cada 30 s solo con la pestaña visible (`refetchIntervalInBackground: false`), botón «Actualizar» y hora de la última actualización; no hay WebSocket (C-26/C-27).
- **Acciones**: la UI muestra solo lo que permite la FSM de gestión según estado y forma de pago (`transiciones.ts` es una copia de `backend/app/modules/pedidos/fsm.py`); el backend decide y los rechazos se clasifican por `code` (`INSUFFICIENT_STOCK` ofrece «Cancelar por falta de stock»; `INVALID_TRANSITION` vuelve a pedir el pedido). Cancelar exige motivo; no hay borrado de pedidos.
- **Contrato** (aditivo, sin migración): `GET /pedidos/{id}` suma `direccion` (también si se dio de baja después) y `GET /pedidos/{id}/historial` suma `usuario_nombre`.
- **Tests**: el doble de red es `src/test/msw/pedidos.ts` (estado en memoria con la FSM) y `montarGestion` en `src/test/render-gestion.ts`.

## Mis pedidos (C-21)

- **Rutas** (cualquier sesión): `/mis-pedidos` (listado) y `/mis-pedidos/:pedidoId` (detalle; `rutaMiPedido(id)`). Slice `src/pages/mis-pedidos/` (listado con filtro `?estado=&page=`, tamaño de página 10; detalle con progreso, pago, entrega, ítems e historial). El listado pide `GET /pedidos?propios=true`.
- **Actualización**: polling cada 30 s solo con la pestaña visible y mientras el pedido no esté terminado; botón «Actualizar» (`MarcaActualizacion`, ahora en `shared/ui`); sin WebSocket (C-26/C-27).
- **Cancelar**: `CancelarMiPedido` de `features/cambiar-estado-pedido` (mismo diálogo que la gestión con `destinatario="cliente"`, `DELETE /pedidos/{id}` con motivo obligatorio en la UI).
- **Pago**: `vistaPagoDelPedido` (`entities/payment`) decide traspaso, reintento o en confirmación; lo usan la confirmación y el detalle.
- **Tests**: `src/test/msw/pedidos.ts` (incluye `DELETE` y `propios`) y `montarMisPedidos` en `src/test/render-mis-pedidos.ts`.

## Usuarios y roles (C-23)

- **Ruta** (solo `ADMIN`, con `RequiereAcceso`): `/admin/usuarios` (`AdminUsuariosPage`). Slices: `src/pages/admin-usuarios/` (`ui/`: página, `ListaUsuarios`, `FiltroRol`, `FormularioUsuario` para alta y edición, `DialogoDesactivarUsuario`; `model/`: filtro de URL `?rol=&page=`, validación, diff de edición `cambiosUsuario`, `clasificarErrorUsuario`) y `src/entities/usuario/` (`usuarioQueries.lista`, `useCrearUsuario`, `useActualizarUsuario`, `useDesactivarUsuario`; la clave `['usuarios', …]` es **privada**: se descarta al cerrar sesión).
- **Comportamiento**: listado paginado (20) con filtro por un rol (rol desconocido en la URL = «Todos»); alta con varios roles («Cliente» viene marcado; los códigos viajan ordenados alfabéticamente); edición solo con los campos cambiados (email y contraseña no se editan); baja con confirmación. La fila y el formulario del propio administrador llevan «Vos», sin «Desactivar» y con la casilla «Administrador» bloqueada; al guardarse a sí mismo se refresca la sesión (`useRefrescarSesion` de `entities/session`, `GET /auth/me`) para que el panel lateral refleje los roles.
- **Protecciones**: viven en el backend (409 `SELF_ACTION_NOT_ALLOWED` y `LAST_ADMIN`, baja con sesiones cerradas con motivo `BAJA`); la UI solo las anticipa y muestra sus mensajes por `code`, no por el texto de `detail`.
- **Recuperación sin administrador**: si por un error operativo no quedara ningún `ADMIN` activo, se recupera desde `backend/` con `python -m app.db.seed` (idempotente; recrea el administrador inicial del seed).
- **Compartido nuevo**: `DialogoBaja` acepta `etiquetaConfirmar`, `etiquetaPendiente` y `cuerpo`; los estilos `.seg`/`.ilist` pasaron a `shared/ui/lista-admin`.
- **Tests**: `src/test/msw/usuarios.ts` (estado en memoria con filtro por rol, paginación y registro de pedidos) y `montarUsuarios` en `src/test/render-usuarios.ts`.

## Dashboard de métricas (C-24)

- **Ruta** (solo `ADMIN`, con `RequiereAcceso`): `/admin/dashboard` (`AdminDashboardPage`); ya no es provisoria (`DuenoRuta` conserva `'C-24'` como dueño de la ruta). Slices: `src/pages/admin-dashboard/` (`ui/`: página, `SelectorPeriodo`, `TarjetasKpi`, `BloqueGrafico` común y los cuatro gráficos recharts —ventas, productos, estados, formas de pago—, `TablaDatos`; `model/`: período en la URL `?desde=&hasta=&agrupacion=`) y `src/entities/estadistica/` (`estadisticaQueries`, tipos, `validarRango`, atajos de período, formato de importes).
- **Comportamiento**: período por defecto = últimos 30 días por día (atajos Hoy / 7 días / 30 días / Este mes y fechas personalizadas; fechas UTC, `desde`/`hasta` inclusivos, máximo 366 días validado igual que en el backend). Cinco consultas independientes (`GET /estadisticas/resumen|ventas|productos-top|pedidos-por-estado|ingresos`): cada bloque tiene su propio esqueleto, vacío y error con «Reintentar». «Actualizar» vuelve a pedir los cinco; sin polling (`staleTime` de 60 s). Cada gráfico es decorativo (`aria-hidden`) y tiene su alternativa «Ver como tabla».
- **Clave de caché**: `['estadisticas', reporte, parámetros]` es **privada** (se descarta al cerrar sesión). Los importes llegan como texto decimal y se formatean con `formatearPrecio` de `entities/producto`; estados y formas de pago reutilizan `entities/pedido`.
- **Tests**: `src/test/msw/estadisticas.ts` (estado en memoria y registro de pedidos) y `montarDashboard` en `src/test/render-dashboard.ts` (stub de `ResizeObserver` para recharts en jsdom).

## Productos y stock (C-17b)

- **Slices**: `src/pages/admin-productos/` (`ui/`: página, filtros, lista, fila con stock e interruptor, formulario, secciones de categorías e ingredientes, diálogo de baja; `model/`: permisos por rol, validación, diff de edición, filtros de URL) y, en `src/entities/producto/api/`, `producto-gestion-api.ts`, `productoGestionQueries` y `producto-mutations.ts`.
- **Claves de caché**: `['productos-gestion', 'lista' | 'detalle', …]` es un dominio **privado** (incluye productos no disponibles; se descarta al cerrar sesión). Toda mutación invalida `['productos-gestion']` y `['productos']`; stock y disponibilidad además escriben la respuesta del servidor en la fila.
- **URL**: `?q=&categoria=<id>&disponible=si|no&page=`; la búsqueda se aplica al enviar.
- **Permisos**: `accionesProductos(roles)`; `STOCK` solo ve stock e interruptor (el servidor sigue siendo la autoridad).
- **Tests**: `src/test/msw/admin-productos.ts` (estado en memoria, registro de pedidos) y `montarAdminProductos` en `src/test/render-admin.ts`.

## Ingreso, registro y cuenta (C-14)

- **Rutas**: `/ingresar` (`IngresarPage`), `/registrarse` (`RegistrarsePage`) y `/mi-cuenta` (`MiCuentaPage`, cualquier usuario con sesión), en `PAGINAS` de `src/app/router/routes.tsx`. Las dos primeras son rutas solo para visitantes: tras iniciar sesión, el guard lleva a la ruta recordada o a `/catalogo`.
- **Sesión** (`src/entities/session/`): `useIniciarSesion` (login como formulario OAuth2 + `abrirSesion`), `useRegistrarse` (registro y login automático; si el login falla devuelve `cuentaCreadaSinSesion` y la pantalla lleva a `/ingresar` con el email precargado), `useActualizarPerfil` (`PATCH /usuarios/me`, conserva los roles de la sesión) y `useCerrarTodasLasSesiones` (`POST /auth/logout-all`, deja la sesión `anonima` responda lo que responda el backend). Las llamadas HTTP están en `src/shared/api/auth.ts`.
- **Páginas** (`src/pages/ingresar|registrarse|mi-cuenta/`): TanStack Form, `model/` con validadores y mapeo de errores por `status`/`code`/`field` (nunca por el texto de `detail`); «Repetir contraseña» solo se valida en el navegador. El bloqueo por 429 deshabilita «Ingresar» según `Retry-After`. Compartido nuevo: `TarjetaAuth` (`shared/ui`), `NOMBRE_ROL`/`nombreDeRol` (`shared/config/roles.ts`), `esEmailValido` y validadores de nombre/celular (`shared/lib`).
- **Tests**: `handlerLogin`, `handlerRegister`, `handlerPatchPerfil` y `handlerLogoutAll` en `src/test/msw/auth.ts` (registran cuerpo, tipo de contenido y `Authorization`).
