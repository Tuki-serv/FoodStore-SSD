# Modelo de Datos

Esquema en **3FN** con cuatro patrones transversales: **Soft Delete** (`deleted_at TIMESTAMPTZ`), **Snapshot** (precio/nombre/personalización inmutables en pedidos), **Audit Trail append-only** (`HistorialEstadoPedido`) y **auditoría** (`created_at`, `updated_at`). Todas las fechas y horas del esquema son `TIMESTAMPTZ` y siempre UTC (la sesión de PostgreSQL se fija en UTC), no solo `deleted_at`. Nombres de columnas según `[INT]` (`[DESC]` usa `eliminado_en`, `creado_en`, `actualizado_en`; ver IN-01).

En el backend actual, el mixin `UniqueAuditableMixin` aporta `created_at/updated_at/deleted_at` y crea **índices únicos parciales** (`WHERE deleted_at IS NULL`) para los campos únicos (`nombre`, `email`; en `unidades_medida`, `nombre` y `simbolo`), de modo que un registro eliminado no bloquea reutilizar el valor. Tablas con soft delete: usuario, categorias, productos, ingredientes, unidades_medida, pedidos, direccion_entrega. Sin soft delete: detalle_pedido, historial_estado_pedido, pagos, sesion, refresh_token, catálogos.

## Dominios

1. **Identidad y Acceso**: Usuario, Rol, UsuarioRol, Sesion, RefreshToken, DireccionEntrega.
2. **Catálogo de Productos**: Categoria, Producto, Ingrediente, UnidadMedida (solo), ProductoCategoria, ProductoIngrediente, FormaPago.
3. **Ventas, Pagos y Trazabilidad**: EstadoPedido, Pedido, DetallePedido, HistorialEstadoPedido, Pago.

## ERD

```
Usuario 1──N UsuarioRol N──1 Rol            Usuario 1──N Sesion 1──N RefreshToken      Usuario 1──N DireccionEntrega
Usuario 1──N Pedido                         Pedido N──1 EstadoPedido       Pedido N──1 FormaPago
Pedido N──0..1 DireccionEntrega (SET NULL)  Pedido 1──N DetallePedido N──1 Producto
Pedido 1──N HistorialEstadoPedido (estado_desde?, estado_hacia → EstadoPedido; usuario_id? → Usuario)
Pedido 1──N Pago                             (varios intentos de pago por pedido)
Categoria 1──N Categoria (parent_id, auto-referencia)
Producto N──M Categoria      vía ProductoCategoria (es_principal)
Producto N──M Ingrediente    vía ProductoIngrediente (es_removible, cantidad, unidad_medida_id)
Ingrediente N──1 UnidadMedida ; Producto N──0..1 UnidadMedida (unidad_venta_id)  
```

## Entidades

### Dominio 1

**Usuario** (`usuario`): `id` BIGSERIAL PK; `nombre` VARCHAR(80); `apellido` VARCHAR(80) `[INT]`; `email` VARCHAR(254) único (parcial por soft delete), validar `EmailStr`; `celular` VARCHAR(20) opcional (`telefono` en `[DESC]`); `password_hash` **CHAR(60)** (bcrypt cost >= 12, nunca plaintext); auditoría + `deleted_at`. Relaciones: roles N:M, sesiones 1:N (C-02), direcciones 1:N.

**Rol** (`rol`): PK semántica `codigo` VARCHAR(20) (`ADMIN|STOCK|PEDIDOS|CLIENT`); `nombre` único; `descripcion`. (`[DESC]` usa id numérico 1..4: IN-02.)

**UsuarioRol** (`usuario_rol`): PK compuesta `(usuario_id, rol_codigo)`; `asignado_por_id` FK usuario opcional; `expires_at` opcional; `created_at`.

**Sesion** (`sesion`, C-02): `id` UUID v4 PK (es el claim `sid` del access token); `usuario_id` BIGINT FK `usuario.id` (indexado); `expires_at` TIMESTAMPTZ (login + 7 días, **fijo**: la rotación no lo extiende); `revoked_at` NULL = abierta; `revoked_reason` `LOGOUT|LOGOUT_ALL|REUSO` (NULL si abierta; CHECK de consistencia con `revoked_at`); `created_at`; `ip` VARCHAR(45) y `user_agent` solo para auditoría. Nunca se borra: se marca.

**RefreshToken** (`refresh_token`, C-02): `id`; `sesion_id` UUID FK `sesion.id` (indexado); `token_hash` CHAR(64) único (SHA-256 del valor opaco; el valor en claro nunca se guarda); `revoked_at` significa **«rotado»** (NULL = activo); `created_at`. Índice único parcial `uq_refresh_token_sesion_activo` (un solo activo por sesión). Los motivos de cierre viven en la sesión.

> **Desviación de la spec (C-02, D5):** la spec lista `usuario_id` y `expires_at` (7 días) en `refresh_token` y no prevé una tabla de sesión. Con vencimiento fijo por sesión, un `expires_at` y un `usuario_id` por refresh duplicarían el dato y abrirían la puerta a que diverjan; se movieron a `sesion`. El comportamiento normativo se conserva: el refresh sirve como máximo 7 días desde el login, se guarda hasheado y se revoca con `revoked_at` (RN-AU-01, 04, 05).

**DireccionEntrega** (`direccion_entrega`): `id`; `usuario_id` FK; `alias` VARCHAR(50) opcional; `linea1` TEXT NN; `linea2`; `ciudad` VARCHAR(100) NN; `provincia`; `codigo_postal` VARCHAR(10); `latitud`/`longitud` float (solo); `es_principal` BOOLEAN default false (solo una por usuario); auditoría + soft delete. (`[DESC]`: calle, número, piso, depto, referencia, `es_predeterminada` — IN-15.)

### Dominio 2

**Categoria** (`categorias`): `id`; `parent_id` FK auto-referencia NULL (`ON DELETE SET NULL` en spec); `nombre` VARCHAR(100) único entre activas; `descripcion`; `imagen_url`; `imagen_public_id` (Cloudinary); auditoría + soft delete. Jerarquía de profundidad arbitraria; el árbol se consulta con CTE recursiva (spec) — en el código actual el árbol se arma en Python (`/categorias/arbol`) y se bloquean ciclos.

**Producto** (`productos`): `id`; `nombre` VARCHAR(150) único entre activos; `descripcion`; `precio_base` DECIMAL(10,2) **CHECK >= 0**; `imagenes_url` VARCHAR[] y `imagenes_public_id` VARCHAR[] (paralelos) (spec: una URL); `stock_cantidad` INTEGER **CHECK >= 0** default 0; `disponible` BOOLEAN default true (toggle manual **independiente** del stock); `unidad_venta_id` FK unidades_medida; auditoría + soft delete.

**Ingrediente** (`ingredientes`): `id`; `nombre` único entre activos; `descripcion`; `es_alergeno` BOOLEAN default false; `imagen_url`/`imagen_public_id`; `unidad_medida_id` FK NN; auditoría + soft delete.

**UnidadMedida** (`unidades_medida`): `id`; `nombre` único entre activas; `simbolo` único entre activas; `tipo` (peso, volumen, unidad, superficie); auditoría + soft delete.

**ProductoCategoria** (`producto_categoria`): PK `(producto_id, categoria_id)`; `es_principal`; FK a producto `ON DELETE CASCADE`, a categoría `ON DELETE RESTRICT`.

**ProductoIngrediente** (`producto_ingrediente`): PK `(producto_id, ingrediente_id)`; `es_removible` BOOLEAN (habilita la personalización); `cantidad` NUMERIC(10,3) CHECK > 0 y `unidad_medida_id` FK.

**FormaPago** (`forma_pago`): PK semántica `codigo` VARCHAR(20); `descripcion` VARCHAR(80); `habilitado` BOOLEAN default true (se puede deshabilitar sin borrar).

### Dominio 3

**EstadoPedido** (`estado_pedido`): PK `codigo` VARCHAR(20); `descripcion`; `orden` INT; `es_terminal` BOOLEAN. Catálogo (seed). Ver estados y FSM en [05](05_reglas_de_negocio.md).

**Pedido** (`pedidos`): `id`; `usuario_id` FK NN; `direccion_id` FK `ON DELETE SET NULL` (NULL = retiro en local, válido `[INT]`); `estado_codigo` FK; `forma_pago_codigo` FK; `subtotal`, `descuento` (default 0), `costo_envio` (default **50.00**), `total` — todos NUMERIC(10,2) con CHECK >= 0; `notas` TEXT; auditoría + soft delete. `total = subtotal − descuento + costo_envio`, inmutable tras crear. (`[DESC]` agrega `direccion_snapshot` serializado — no existe en `[INT]`: IN-15.)

**DetallePedido** (`detalle_pedido`): `id`; `pedido_id` FK `ON DELETE CASCADE`; `producto_id` FK `ON DELETE RESTRICT`; `cantidad` SMALLINT CHECK >= 1; `nombre_snapshot` VARCHAR(200); `precio_snapshot` NUMERIC(10,2) >= 0; `subtotal_snapshot` NUMERIC(10,2) >= 0; `personalizacion` **INTEGER[]** (IDs de ingredientes removidos); `personalizacion_snapshot` VARCHAR[] (nombres de esos ingredientes); `created_at`. Todos los snapshots son inmutables.

**HistorialEstadoPedido** (`historial_estado_pedido`): `id`; `pedido_id` FK `ON DELETE CASCADE`; `estado_desde` FK NULL (**NULL = transición inicial**); `estado_hacia` FK NN; `usuario_id` FK NULL (NULL = Sistema); `motivo` TEXT; `created_at` NN. **Append-only**: sin `updated_at`, ningún UPDATE/DELETE.

**Pago** (`pagos`): `id`; `pedido_id` FK; `estado` VARCHAR(20) local (`pendiente|aprobado|rechazado`); `mp_preference_id`, `mp_init_point` (Checkout Pro); `mp_payment_id` BIGINT único NULL; `mp_merchant_order_id` BIGINT; `mp_status` VARCHAR(30); `mp_status_detail` VARCHAR(100); `external_reference` VARCHAR(100) (UUID del pedido en spec; **id numérico del pedido** en el código actual; único NN en spec, nullable sin unicidad en el código actual: deuda **DT-26**, la corrige C-12); `idempotency_key` VARCHAR(100) único NN (UUID generado por backend); `transaction_amount` NUMERIC(10,2); `payment_method_id`; auditoría. Relación Pedido→Pago **1:N** (reintentos).

## Seed data inicial

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Obligatorio tras migrar; sin él la app no funciona. `python -m app.db.seed` (`backend/app/db/seed.py`, CE-05) deja la base con este contenido (implementado en C-07; resuelve la parte de seed de DT-03 y DT-23):

| Entidad | Registros |
|---------|-----------|
| Rol | `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT` (descripciones: acceso total / actualiza stock y disponible / avanza estados / opera solo sus datos). `COCINA` **no** se siembra y el seed no lo toca si existe (DD-23) |
| EstadoPedido | `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), `EN_CAMINO`(4), `ENTREGADO`(5, terminal), `CANCELADO`(6, terminal). La FSM con `EN_CAMINO` llega en C-09 |
| FormaPago | `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA`, todas habilitadas al crearse. `TARJETA` no se siembra: la tarjeta es un medio dentro de `MERCADOPAGO` |
| Usuario admin | `admin@foodstore.com` con rol ADMIN y contraseña `Admin1234!` (credencial de desarrollo; cambiar en producción) |
| Usuarios de prueba (extra no especificado) | `cliente@foodstore.com/cliente123`, `pedidos@foodstore.com/pedidos123`, `stock@foodstore.com/stock123` |
| Datos demo (extra no especificado) | 7 unidades de medida (kg, g, L, mL, u, doc, m²); categorías Hamburguesas/Bebidas/Postres + subcategorías Veganas, Sin TACC, Gaseosas; 12 ingredientes (alérgenos: Pan Brioche, Queso Cheddar, Mayonesa); 6 productos (Clásica 1500, BBQ Bacon 1900, Vegana 1800, Sin TACC 1700, Coca-Cola 800, Limonada 700) con relaciones y `es_removible` |

**Reconciliación sobre bases existentes (C-07):** el seed lleva los catálogos a estos valores en el lugar (por ejemplo `CANCELADO.orden` 99 → 6, agrega `EN_CAMINO`) sin tocar pedidos ni historial. Una forma de pago fuera del catálogo (`TARJETA`) queda con `habilitado = false` y no se borra (hay pedidos que la referencian); el `habilitado` de las formas del catálogo no se modifica. Un usuario existente (por ejemplo un admin con `admin123`) no se modifica: para tener `Admin1234!` hay que recrear la base.

> **DT-09 (resuelta en C-06; idempotencia real en C-07):** el `seed.py` exige el esquema migrado (`alembic upgrade head`; si no, falla con ese mensaje y no crea tablas). Hasta C-06 la nota decía que era idempotente, pero no lo era: la segunda corrida fallaba al duplicar categorías, ingredientes y productos. Desde C-07 es idempotente (comparación fila a fila entre dos corridas), respeta las bajas lógicas y corre en una sola transacción (si falla, no queda nada a medias). `reset.py` borra por reflexión todas las tablas, incluida `alembic_version`.
