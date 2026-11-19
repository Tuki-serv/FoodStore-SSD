# Proposal — C-19 `fe-checkout-pedido`

## Why

US-017 (Épica 4) pide que el cliente convierta su carrito en un pedido: elegir dónde lo recibe (o retiro en el local) y cómo paga, y crear el pedido `PENDIENTE` con errores claros. Hoy el carrito (C-18) existe pero **termina en un callejón sin salida**: `/carrito` no tiene botón para continuar, no hay pantalla de checkout ni forma de crear un pedido desde la UI. C-19 está en el camino crítico: C-20 (pago con tarjeta), C-21 (mis pedidos) y C-25b parten del pedido que crea este change.

Observado en el repo (`dev`, 2026-11-19):

- **Backend** `POST /api/v1/pedidos/` (solo rol `CLIENT`, 201 `PedidoDetalle`): body `{direccion_id?: int|null, forma_pago_codigo: str, notas?: str, items: [{producto_id, cantidad>=1, personalizacion?: int[]}] (min 1)}`. Respuesta: `id, estado_codigo ("PENDIENTE"), forma_pago_codigo, subtotal, descuento ("0.00"), costo_envio ("50.00"), total, notas, created_at, usuario_id, cliente_nombre, direccion_id, items[]` (con `nombre_snapshot`, `precio_snapshot`, `subtotal_snapshot`, `personalizacion_snapshot`). Toma el **precio vigente** del producto, no el del carrito.
- **Errores de creación** (`PedidoService.crear_pedido`): todos con código genérico `HTTP_400`/`HTTP_404` y solo el `detail` distingue el caso: «Forma de pago no encontrada», «Forma de pago no está habilitada», «No puede pedir dos veces el mismo producto con la misma personalización», «Producto no encontrado» (404), «Producto no disponible», «No hay stock suficiente». Ninguno indica **qué línea** falló. Validación de body → 422 `VALIDATION_ERROR`; rol distinto de `CLIENT` → 403.
- **Formas de pago**: tabla `forma_pago` sembrada con `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA` (todas habilitadas). **No hay endpoint** que las liste (`FormaPagoRead` existe pero ningún router lo usa).
- **Dirección**: el backend no valida que `direccion_id` exista ni que sea del usuario (FK a `direccion_entrega`; un id inexistente terminaría en error de integridad).
- **Frontend**: `useCartStore` (líneas con `productoId`, `cantidad`, `personalizacion` ids ordenados, `personalizacionNombres`, `precioUnitario`; `subtotalLinea`, `selectTotalPrecio`, `vaciar`); `SelectorDireccion` (`@/entities/direccion`) listo para el checkout; `ApiError` normalizado (`code`, `detail`, `field`; la regla del cliente es decidir por `code`, nunca por el texto); `useUiStore` (`notificar`, `pedirConfirmacion`); `usePaymentStore` (C-20) en memoria; **no existe** `entities/pedido`.

## What Changes

- **CTA en el carrito**: el resumen de `/carrito` suma «Finalizar compra» (solo para `CLIENT`; otros roles ven un aviso de que solo las cuentas de cliente hacen pedidos) y la nota de envío pasa a mostrar el costo de envío fijo.
- **Pantalla «Finalizar compra»** (`/finalizar-compra`, solo `CLIENT`): (1) entrega con `SelectorDireccion` (dirección o «Retiro en el local»), (2) forma de pago (Mercado Pago con tarjeta, Efectivo, Transferencia; sin preselección), (3) notas opcionales; resumen lateral con las líneas del carrito (personalización incluida), subtotal, costo de envío `$ 50` y descuento `$ 0` (DD-10), total estimado y botón «Confirmar pedido». Explica que el stock se verifica pero no se reserva (DD-20) y, al elegir Efectivo/Transferencia, que la confirmación es manual (DD-22). Con el carrito vacío vuelve a `/carrito`.
- **Creación del pedido**: `POST /pedidos/` con las líneas del carrito; botón deshabilitado y «Creando pedido…» mientras viaja; al terminar bien se **vacía el carrito** y se navega a la confirmación.
- **Errores**: banner «No pudimos crear el pedido» con el `detail` del backend y acciones según el caso (volver al carrito para revisar productos; elegir otra forma de pago; reintentar ante falla de red); el carrito **no** se vacía. Ver design D6 y OQ-1 (códigos estables en el backend).
- **Confirmación** (`/finalizar-compra/pedido/:pedidoId`): «Pedido #N recibido», estado `PENDIENTE`, totales reales del servidor (con aviso si difieren del estimado), entrega y forma de pago. Variante **Efectivo/Transferencia**: explica que el local confirma el pago a mano y los pasos siguientes; sin formulario de tarjeta. Variante **Mercado Pago**: «Pagar $ X con tarjeta» que lleva al **punto de traspaso** `/finalizar-compra/pedido/:pedidoId/pago` (página provisoria con dueño `C-20`).
- **Nueva entidad `pedido`** en el frontend: tipos del contrato, `crearPedido`, `pedidoQueries.detalle(id)` (`GET /pedidos/{id}`, para recargar la confirmación), mutación `useCrearPedido`, catálogo local de formas de pago y la constante de envío/descuento de DD-10 marcadas `[PENDIENTE DE DECISIÓN: PA-11]` / `[PENDIENTE DE DECISIÓN: PA-13]`.
- **Docs al cerrar**: KB/06 (US-017), `frontend/README.md`, `CHANGES.md` (cierre de C-19 y «Punto de partida (C-19)» en C-20 y C-21).

**Fuera de alcance (con dueño):** formulario de tarjeta, `POST /pagos/crear` y pantallas de resultado del pago (C-20); listado/detalle de mis pedidos y cancelación (C-21); confirmación manual por ADMIN/PEDIDOS (C-22); alta de direcciones dentro del checkout (se enlaza a `/direcciones`, C-15); reglas reales de envío y descuento (PA-11/PA-13); cambios de backend (códigos de error estables, endpoint de formas de pago, validación de `direccion_id` y de la personalización R4) salvo que el usuario elija lo contrario en OQ-1/OQ-2.

## Capabilities

### New Capabilities
- `frontend-checkout`: flujo de finalizar compra en el frontend — acceso, elección de entrega y forma de pago, resumen con envío/descuento, creación del pedido, manejo de errores, confirmación según forma de pago y punto de traspaso al pago con tarjeta.

### Modified Capabilities
- `frontend-cart`: la página del carrito suma la acción «Finalizar compra» para clientes y la nota del resumen menciona el costo de envío.

## Impact

- **Código nuevo** (`frontend/src/`): `entities/pedido/` (`model/` tipos, formas de pago, constantes DD-10; `api/` `pedidos-api.ts`, `pedido-queries.ts`, `pedido-mutations.ts`; `index.ts`), `pages/finalizar-compra/` (`ui/` página, pasos, resumen, banner de error; `model/` armado del body y textos de error; `finalizar-compra.css`), `pages/pedido-creado/` (confirmación), handlers MSW `test/msw/pedidos.ts` y helper de render.
- **Código modificado**: `shared/config/routes.ts` (rutas de checkout y helpers, fuera de `RUTAS` como `RUTA_PRODUCTO`), `app/router/routes.tsx` (tres rutas nuevas; la de pago provisoria con dueño `C-20`), `app/router/route-map.ts` (`DuenoRuta` suma `C-20`), `pages/carrito/ui/resumen-carrito.tsx` (CTA), `app/styles/index.css` (imports CSS).
- **Backend**: ninguno por defecto (ver OQ-1/OQ-2). **Paquetes**: ninguno nuevo. **Dependencias de changes**: C-18, C-15, C-10, C-11 (cerrados).
- **Governance MEDIO**: implementar con checkpoints; gate de mockups aprobados antes de `/opsx:apply` (`[UI-MOCKUP]`, política `system-and-mockups`).
