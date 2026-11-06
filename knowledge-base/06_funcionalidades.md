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
- [ ] El interceptor Axios, ante 401, llama a `/auth/refresh`, actualiza el store y reintenta el request original `[Pendiente-FE]`
- [ ] El refresh token se rota en cada uso
**Reglas**: RN-AU-05

### US-004 — Cierre de sesión
- [ ] Invalida el refresh token y limpia cookie/store; responde 204
**Reglas**: RN-AU-06

### US-005 — Gestión de perfil propio
- [ ] `GET/PATCH /usuarios/me` sin poder modificar roles

## Épica 2: Direcciones de entrega

### US-006 — CRUD de direcciones
**Como** cliente **Quiero** guardar varias direcciones **Para** elegirlas al pedir.
- [ ] Crear/listar/ver/editar/eliminar solo propias; marcar una como principal; la primera queda principal
**Reglas**: RN-DI-01..04

## Épica 3: Catálogo

### US-007 — Explorar catálogo
**Como** cliente/visitante **Quiero** ver productos con filtros **Para** encontrar qué comprar.
- [ ] Filtros: categoría, nombre (búsqueda parcial), rango de precio, disponibilidad; paginación; detalle con categorías, ingredientes (con alérgenos) y stock
- [ ] UI: debounce, skeleton, estados vacíos `[Pendiente-FE]`
**Reglas**: RN-PR-03, RN-PR-04

### US-008 — Árbol de categorías
- [ ] `GET /categorias/arbol` devuelve el árbol completo; listado filtrable (`is_main`, `parent_id`, estado)

### US-009 — Gestión de categorías (ADMIN)
- [ ] Crear/editar/eliminar con validación de nombre único, anti-ciclos y re-asignación de hijas
**Reglas**: RN-CA-01..05

### US-010 — Gestión de productos (ADMIN/STOCK)
- [ ] Crear con precio, stock inicial, categorías e ingredientes; validar que existan; editar; soft delete; cambiar `disponible` (`PATCH /{id}/disponibilidad` en spec)
**Reglas**: RN-PR-01..06

### US-011 — Gestión de ingredientes y alérgenos
- [ ] CRUD de ingredientes con `es_alergeno` y unidad de medida; asociar a productos con `es_removible`, cantidad y unidad

### US-012 — Gestión de stock (STOCK)
- [ ] Actualizar `stock_cantidad` y `disponible`

### US-013 — Subida de imágenes (ADMIN)
- [ ] Subir/eliminar imágenes en Cloudinary; guardar `imagen_url` + `public_id`
**Reglas**: RN-PR-07

### US-014 — Unidades de medida (ADMIN)
- [ ] CRUD de unidades (peso, volumen, unidad, superficie)

## Épica 4: Carrito y Pedidos

### US-015 — Carrito persistente
- [ ] Agregar/quitar/cambiar cantidad/personalizar ítems; persiste en localStorage y sobrevive a refresh, cierre de navegador y logout/login (CE-14) `[Pendiente-FE]`
- [ ] Suscripción por slice a `cartStore` (rendimiento)

### US-016 — Personalizar producto
**Como** cliente **Quiero** excluir ingredientes removibles **Para** adaptar mi plato.
- [ ] `personalizacion` = IDs de ingredientes removidos; se guarda también el nombre en snapshot

### US-017 — Crear pedido (checkout)
- [ ] Seleccionar dirección (o retiro en local) y forma de pago; el pedido se crea en PENDIENTE en una sola transacción con snapshots e historial inicial
- [ ] Errores claros: producto no disponible, sin stock, forma de pago deshabilitada, líneas duplicadas
**Reglas**: RN-PE-06, RN-PE-09, RN-ST-01

### US-018 — Ver mis pedidos y seguimiento
- [ ] Listado paginado y detalle propio (ítems con snapshots, totales); timeline de estados con polling 30 s en spec o WebSocket `[Pendiente-FE]`

### US-019 — Cancelar mi pedido
- [ ] Solo en PENDIENTE/CONFIRMADO, con motivo obligatorio; restaura stock
**Reglas**: RN-PE-07, RN-PE-10, RN-ST-02

## Épica 5: Gestión operativa de pedidos

### US-020 — Avanzar estado (PEDIDOS/ADMIN)
- [ ] Transición validada por FSM y por rol; observación/motivo opcional; registra historial; notifica por WebSocket
**Reglas**: RN-PE-01..08

### US-021 — Ver todos los pedidos e historial
- [ ] Listado con nombre de cliente, filtros por estado/fecha (spec); historial ordenado por `created_at ASC`

### US-022 — Cancelar/eliminar pedidos (ADMIN/PEDIDOS)
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
