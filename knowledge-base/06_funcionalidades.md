# Funcionalidades

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Historias organizadas por épica (formato US-NNN). Derivadas de las fuentes; el backend actual ya implementa la mayor parte (las que son extras sin respaldo en la spec: Cloudinary, unidades de medida, KDS, rate limit general, se consideran *extras no especificados*, PA-19); las marcadas `[Pendiente-FE]` requieren frontend (no hay frontend todavía). Reglas en [05](05_reglas_de_negocio.md).

## Épica 1: Autenticación y cuenta

### US-001 — Registro de cliente
**Como** visitante **Quiero** crear una cuenta **Para** poder comprar.
**Criterios de aceptación**:
- [ ] Datos: nombre, apellido, email, contraseña (mín. 8), celular opcional
- [ ] Email duplicado se rechaza; se asigna rol CLIENT automáticamente
- [ ] Respuesta 201 con `UserResponse` (sin `password_hash`)
**Reglas**: RN-AU-02, RN-AU-07, RN-US-05

### US-002 — Inicio de sesión
**Como** usuario **Quiero** loguearme **Para** acceder a mi cuenta.
- [ ] Devuelve access + refresh token y `expires_in`; (código actual setea además cookie HttpOnly; el objetivo es Bearer, DT-11)
- [ ] 401 con credenciales inválidas; 429 al exceder rate limit con `Retry-After`
**Reglas**: RN-AU-01, RN-AU-03, RN-AU-08

### US-003 — Renovación transparente de sesión
**Como** usuario **Quiero** que mi sesión se renueve sola **Para** no re-loguearme cada 30 min.
- [ ] El interceptor Axios, ante 401, llama a `/auth/refresh`, actualiza el store y reintenta el request original `[Cubierto por C-13b]` (una sola renovación para los 401 concurrentes)
- [ ] El refresh token se rota en cada uso
**Reglas**: RN-AU-05

### US-004 — Cierre de sesión
- [ ] Invalida el refresh token y limpia cookie/store; responde 204 (frontend: `useCerrarSesion` deja la sesión anónima y descarta la caché privada, el carrito persiste; cubierto por C-13b; el botón «Cerrar todas las sesiones» es de C-14)
**Reglas**: RN-AU-06

### US-005 — Gestión de perfil propio
- [ ] `GET /auth/me` (lectura) + `PATCH /usuarios/me` (nombre, apellido, celular) sin poder modificar email ni roles; nombre y apellido obligatorios (422 si quedan vacíos o `null`). Frontend: `/mi-cuenta` (C-14)

## Épica 2: Direcciones de entrega

### US-006 — CRUD de direcciones
**Como** cliente **Quiero** guardar varias direcciones **Para** elegirlas al pedir.
- [ ] Crear/listar/ver/editar/eliminar solo propias; marcar una como principal; la primera queda principal
**Reglas**: RN-DI-01..04
**Frontend**: cubierto por C-15 (página `/direcciones` con listado, alta, edición, marcar principal y eliminación con confirmación, y `SelectorDireccion` para el checkout de C-19). «La primera queda principal» es una regla del backend (`POST /direcciones/`); el frontend solo muestra lo que devuelve el servidor. Al eliminar la principal el backend no promueve otra: la página avisa y el selector elige la primera (OQ-1 de C-15).

## Épica 3: Catálogo

### US-007 — Explorar catálogo
**Como** cliente/visitante **Quiero** ver productos con filtros **Para** encontrar qué comprar.
- [x] Frontend (C-16b): filtros en la URL (categoría con su subárbol, nombre con debounce de 300 ms, rango de precio, solo con stock), paginación de 12, detalle `/catalogo/:productoId` con categorías, ingredientes (con alérgenos) y stock; agregar al carrito (anónimo → `/ingresar` y vuelve al producto)
- [x] Backend (C-16a): `GET /productos/` filtra por `precio_min`/`precio_max` (extremos incluidos; `min > max` → 422) y `con_stock=true` (solo con stock); al filtrar por varias categorías o ingredientes cada producto aparece y se cuenta una sola vez
- [x] UI (C-16b): debounce, skeleton, estados vacíos y de error con «Reintentar»
**Reglas**: RN-PR-03, RN-PR-04

### US-008 — Árbol de categorías
- [ ] `GET /categorias/arbol` devuelve el árbol completo; listado filtrable (`is_main`, `parent_id`, estado)
- [x] Frontend (C-16b): `ArbolCategorias` en el catálogo (filtro por categoría con todo su subárbol)

### US-009 — Gestión de categorías (ADMIN)
- [ ] Crear/editar/eliminar con validación de nombre único, anti-ciclos y re-asignación de hijas
- [x] Frontend (C-17a): `/admin/categorias` (ADMIN) con árbol editable, alta de categoría y subcategoría, edición con padres sin ciclos y baja validada (bloqueo con subcategorías o productos activos)
**Reglas**: RN-CA-01..05

### US-010 — Gestión de productos (ADMIN)
- [ ] Crear con precio, stock inicial, categorías e ingredientes; validar que existan; editar; soft delete; cambiar `disponible` (`PATCH /{id}/disponibilidad` con `{"disponible": bool}`, ADMIN y STOCK; ver US-012)
- [x] Frontend (C-17b): `/admin/productos` (ADMIN y STOCK) con listado paginado (incluye no disponibles), búsqueda, filtro por categoría y disponibilidad en la URL, formulario de alta/edición en un solo pedido (categorías con principal e ingredientes con cantidad, unidad y `es_removible`; la edición envía solo lo que cambió) y baja con confirmación
**Reglas**: RN-PR-01..06

### US-011 — Gestión de ingredientes y alérgenos
- [ ] CRUD de ingredientes con `es_alergeno` y unidad de medida; asociar a productos con `es_removible`, cantidad y unidad
- [x] Frontend (C-17a): `/admin/ingredientes` (ADMIN) con listado paginado, filtro de alérgenos en la URL, alta, edición y baja con aviso de los productos que lo usan (la asociación a productos se hace desde el formulario de producto, C-17b)

### US-012 — Gestión de stock (STOCK)
- [ ] Actualizar `stock_cantidad` con `PATCH /productos/{id}/stock` (`{"stock_cantidad": n}`, seteo absoluto, `n >= 0`) y `disponible` con `PATCH /productos/{id}/disponibilidad` (`{"disponible": bool}`); ambos idempotentes, ADMIN y STOCK
- [x] Frontend (C-17b): stock y disponibilidad se editan en la fila de `/admin/productos` (campo con «Guardar» e interruptor no optimista); el rol `STOCK` no ve alta, edición ni baja

### US-013 — Subida de imágenes (ADMIN)
- [ ] Subir/eliminar imágenes en Cloudinary; guardar `imagen_url` + `public_id`
**Reglas**: RN-PR-07

### US-014 — Unidades de medida (ADMIN)
- [ ] CRUD de unidades (peso, volumen, unidad, superficie)

## Épica 4: Carrito y Pedidos

### US-015 — Carrito persistente
- [x] Agregar/quitar/cambiar cantidad/personalizar ítems; persiste en localStorage y sobrevive a refresh, cierre de navegador y logout/login (CE-14) — página `/carrito` y contador en la navegación (C-18)
- [x] Suscripción por slice a `cartStore` (rendimiento): `ContadorCarrito` y la barra superior se suscriben solo a `selectTotalItems`

### US-016 — Personalizar producto
**Como** cliente **Quiero** excluir ingredientes removibles **Para** adaptar mi plato.
- [x] `personalizacion` = IDs de ingredientes removidos; se guarda también el nombre en snapshot (`personalizacionNombres`, C-18; casillas «Sin X» en el detalle del producto)

### US-017 — Crear pedido (checkout)
- [x] Seleccionar dirección (o retiro en local) y forma de pago; el pedido se crea en PENDIENTE en una sola transacción con snapshots e historial inicial (C-19: `/finalizar-compra` con un único `POST /pedidos/`; envío fijo `$ 50` y descuento `$ 0` según DD-10, `[PENDIENTE DE DECISIÓN: PA-11/PA-13]`)
- [x] Errores claros: producto no disponible, sin stock, forma de pago deshabilitada, líneas duplicadas (C-19: aviso «No pudimos crear el pedido» con el mensaje del servidor y la acción que corresponde; el frontend clasifica por el texto de `detail` porque el backend no da código estable, ver deuda en C-25b)
- [x] Crear el pedido solo verifica disponibilidad y stock; el stock se descuenta al confirmarse (DD-20) (C-19: el checkout y la confirmación lo explican; EFECTIVO/TRANSFERENCIA muestran los pasos de confirmación manual de DD-22 y MERCADOPAGO entrega al pago con tarjeta en `/finalizar-compra/pedido/:id/pago`, de C-20)
**Reglas**: RN-PE-06, RN-PE-09, RN-ST-00, RN-ST-01

### US-018 — Ver mis pedidos y seguimiento
- [ ] Listado paginado y detalle propio (ítems con snapshots, totales); timeline de estados con polling 30 s en spec o WebSocket `[Pendiente-FE]`

### US-019 — Cancelar mi pedido
- [ ] Solo en PENDIENTE/CONFIRMADO, con motivo obligatorio; devuelve el stock solo si estaba CONFIRMADO (DD-20)
**Reglas**: RN-PE-07, RN-PE-10, RN-ST-02

## Épica 5: Gestión operativa de pedidos

### US-020 — Avanzar estado (PEDIDOS/ADMIN)
- [x] Transición validada por FSM y por rol; observación/motivo opcional; registra historial; la vista se actualiza por polling cada 30 s con la pestaña visible (C-22; el WebSocket queda para C-26/C-27)
- [x] Confirmación manual PENDIENTE→CONFIRMADO solo para `EFECTIVO`/`TRANSFERENCIA` (DD-22), con el rechazo por stock mostrado en el diálogo; EN_CAMINO lo despachan ADMIN y PEDIDOS (DD-23)
**Reglas**: RN-PE-01..08

### US-021 — Ver todos los pedidos e historial
- [x] Listado con nombre de cliente, filtros por estado/fecha (spec); historial ordenado por `created_at ASC` con el nombre de quien hizo cada cambio (C-22: `/gestion-pedidos` y `/gestion-pedidos/:pedidoId`)

### US-022 — Cancelar/eliminar pedidos (ADMIN/PEDIDOS)
- [x] Cancelar con motivo obligatorio desde PENDIENTE, CONFIRMADO y EN_PREP (C-22). No hay borrado de pedidos por API: «cancelar con motivo» es la única baja (OQ-4 de C-22)
**Reglas**: RN-PE-11, RN-PE-12

### US-023 — Pantalla de cocina (KDS)
- [ ] Lista de pedidos CONFIRMADO/EN_PREP y actualizaciones en vivo por WebSocket (rol COCINA/ADMIN/PEDIDOS)
Ver [12](12_tiempo_real_websocket.md)

## Épica 6: Pagos

### US-024 — Pagar con MercadoPago
- [ ] Iniciar pago de un pedido PENDIENTE; el cliente paga con tarjeta/Rapipago/Pago Fácil/cuenta MP; los datos de tarjeta no pasan por el backend
- [ ] Reintentar tras rechazo
**Reglas**: RN-PA-01, RN-PA-05

### US-025 — Confirmación automática por webhook
- [ ] Webhook IPN consulta el pago en MP, actualiza `Pago` y, si `approved`, confirma el pedido
**Reglas**: RN-PA-02..04, RN-PE-02

### US-026 — Consultar estado de pago
- [ ] `GET /pagos/{pedido_id}` devuelve estado local y `mp_status_detail` al cliente

Detalle en [11](11_pagos_mercadopago.md).

## Épica 7: Administración y métricas

### US-027 — Gestión de usuarios y roles (ADMIN)
- [ ] Crear usuario con roles, listar paginado con filtro por rol, actualizar roles, desactivar (soft delete)
**Reglas**: RN-US-01..03

### US-028 — Dashboard de métricas (ADMIN)
- [ ] KPIs: ventas, ticket promedio, pedidos activos, ingresos; ventas por período (`day`...), productos top, pedidos por estado, ingresos por forma de pago; gráficos recharts `[Pendiente-FE]`

## Épica 8: Plataforma y calidad

### US-029 — Seed y arranque reproducible
- [ ] `seed.py` idempotente carga roles, estados, formas de pago, admin (y demo) — CE-05

### US-030 — Documentación y pruebas
- [ ] Swagger en `/docs`; README con setup; `.env.example`; tests pytest (auth, pedidos, pago, categorías, direcciones, ingredientes, productos, rate limit, estadísticas) — bonus +10

### US-031 — Rate limiting general
- [ ] Token bucket por IP; headers `X-RateLimit-*`; 429 con `Retry-After`
