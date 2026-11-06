# Modelo de Datos

Esquema en **3FN** con cuatro patrones transversales: **Soft Delete** (`deleted_at TIMESTAMPTZ`), **Snapshot** (precio/nombre/personalización inmutables en pedidos), **Audit Trail append-only** (`HistorialEstadoPedido`) y **auditoría** (`created_at`, `updated_at`). Nombres de columnas según `[INT]` (`[DESC]` usa `eliminado_en`, `creado_en`, `actualizado_en`; ver IN-01).

En el backend actual, el mixin `UniqueAuditableMixin` aporta `created_at/updated_at/deleted_at` y crea **índices únicos parciales** (`WHERE deleted_at IS NULL`) para los campos únicos (`nombre`, `email`), de modo que un registro eliminado no bloquea reutilizar el valor. Tablas con soft delete: usuario, categorias, productos, ingredientes, unidades_medida, pedidos, direccion_entrega. Sin soft delete: detalle_pedido, historial_estado_pedido, pagos, refresh_token, catálogos.

## Dominios

1. **Identidad y Acceso**: Usuario, Rol, UsuarioRol, RefreshToken, DireccionEntrega.
2. **Catálogo de Productos**: Categoria, Producto, Ingrediente, UnidadMedida (solo), ProductoCategoria, ProductoIngrediente, FormaPago.
3. **Ventas, Pagos y Trazabilidad**: EstadoPedido, Pedido, DetallePedido, HistorialEstadoPedido, Pago.

## ERD

```
Usuario 1──N UsuarioRol N──1 Rol            Usuario 1──N RefreshToken      Usuario 1──N DireccionEntrega
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

**Usuario** (`usuario`): `id` BIGSERIAL PK; `nombre` VARCHAR(80); `apellido` VARCHAR(80) `[INT]`; `email` VARCHAR(254) único (parcial por soft delete), validar `EmailStr`; `celular` VARCHAR(20) opcional (`telefono` en `[DESC]`); `password_hash` **CHAR(60)** (bcrypt cost >= 12, nunca plaintext); auditoría + `deleted_at`. Relaciones: roles N:M, refresh_tokens 1:N, direcciones 1:N.

**Rol** (`rol`): PK semántica `codigo` VARCHAR(20) (`ADMIN|STOCK|PEDIDOS|CLIENT`); `nombre` único; `descripcion`. (`[DESC]` usa id numérico 1..4: IN-02.)

**UsuarioRol** (`usuario_rol`): PK compuesta `(usuario_id, rol_codigo)`; `asignado_por_id` FK usuario opcional; `expires_at` opcional; `created_at`.

**RefreshToken** (`refresh_token`): `id`; `usuario_id` FK; `token_hash` CHAR(64) único (SHA-256 del token; el token en claro nunca se guarda); `expires_at` (7 días); `revoked_at` NULL = activo; `created_at`. (Comportamiento real de logout/rotación en el código actual: ver 05 y IN-08.)

**DireccionEntrega** (`direccion_entrega`): `id`; `usuario_id` FK; `alias` VARCHAR(50) opcional; `linea1` TEXT NN; `linea2`; `ciudad` VARCHAR(100) NN; `provincia`; `codigo_postal` VARCHAR(10); `latitud`/`longitud` float (solo); `es_principal` BOOLEAN default false (solo una por usuario); auditoría + soft delete. (`[DESC]`: calle, número, piso, depto, referencia, `es_predeterminada` — IN-15.)

### Dominio 2

**Categoria** (`categorias`): `id`; `parent_id` FK auto-referencia NULL (`ON DELETE SET NULL` en spec); `nombre` VARCHAR(100) único entre activas; `descripcion`; `imagen_url`; `imagen_public_id` (Cloudinary); auditoría + soft delete. Jerarquía de profundidad arbitraria; el árbol se consulta con CTE recursiva (spec) — en el código actual el árbol se arma en Python (`/categorias/arbol`) y se bloquean ciclos.

**Producto** (`productos`): `id`; `nombre` VARCHAR(150) único entre activos; `descripcion`; `precio_base` DECIMAL(10,2) **CHECK >= 0**; `imagenes_url` VARCHAR[] y `imagenes_public_id` VARCHAR[] (paralelos) (spec: una URL); `stock_cantidad` INTEGER **CHECK >= 0** default 0; `disponible` BOOLEAN default true (toggle manual **independiente** del stock); `unidad_venta_id` FK unidades_medida; auditoría + soft delete.

**Ingrediente** (`ingredientes`): `id`; `nombre` único entre activos; `descripcion`; `es_alergeno` BOOLEAN default false; `imagen_url`/`imagen_public_id`; `unidad_medida_id` FK NN; auditoría + soft delete.

**UnidadMedida** (`unidades_medida`): `id`; `nombre` único; `simbolo` único; `tipo` (peso, volumen, unidad, superficie); auditoría.

**ProductoCategoria** (`producto_categoria`): PK `(producto_id, categoria_id)`; `es_principal`; FK a producto `ON DELETE CASCADE`, a categoría `ON DELETE RESTRICT`.

**ProductoIngrediente** (`producto_ingrediente`): PK `(producto_id, ingrediente_id)`; `es_removible` BOOLEAN (habilita la personalización); `cantidad` NUMERIC(10,3) CHECK > 0 y `unidad_medida_id` FK.

**FormaPago** (`forma_pago`): PK semántica `codigo` VARCHAR(20); `descripcion` VARCHAR(80); `habilitado` BOOLEAN default true (se puede deshabilitar sin borrar).

### Dominio 3

**EstadoPedido** (`estado_pedido`): PK `codigo` VARCHAR(20); `descripcion`; `orden` INT; `es_terminal` BOOLEAN. Catálogo (seed). Ver estados y FSM en [05](05_reglas_de_negocio.md).

**Pedido** (`pedidos`): `id`; `usuario_id` FK NN; `direccion_id` FK `ON DELETE SET NULL` (NULL = retiro en local, válido `[INT]`); `estado_codigo` FK; `forma_pago_codigo` FK; `subtotal`, `descuento` (default 0), `costo_envio` (default **50.00**), `total` — todos NUMERIC(10,2) con CHECK >= 0; `notas` TEXT; auditoría + soft delete. `total = subtotal − descuento + costo_envio`, inmutable tras crear. (`[DESC]` agrega `direccion_snapshot` serializado — no existe en `[INT]`: IN-15.)

**DetallePedido** (`detalle_pedido`): `id`; `pedido_id` FK `ON DELETE CASCADE`; `producto_id` FK `ON DELETE RESTRICT`; `cantidad` SMALLINT CHECK >= 1; `nombre_snapshot` VARCHAR(200); `precio_snapshot` NUMERIC(10,2) >= 0; `subtotal_snapshot` NUMERIC(10,2) >= 0; `personalizacion` **INTEGER[]** (IDs de ingredientes removidos); `personalizacion_snapshot` VARCHAR[] (nombres de esos ingredientes); `created_at`. Todos los snapshots son inmutables.

**HistorialEstadoPedido** (`historial_estado_pedido`): `id`; `pedido_id` FK `ON DELETE CASCADE`; `estado_desde` FK NULL (**NULL = transición inicial**); `estado_hacia` FK NN; `usuario_id` FK NULL (NULL = Sistema); `motivo` TEXT; `created_at` NN. **Append-only**: sin `updated_at`, ningún UPDATE/DELETE.

**Pago** (`pagos`): `id`; `pedido_id` FK; `estado` VARCHAR(20) local (`pendiente|aprobado|rechazado`); `mp_preference_id`, `mp_init_point` (Checkout Pro); `mp_payment_id` BIGINT único NULL; `mp_merchant_order_id` BIGINT; `mp_status` VARCHAR(30); `mp_status_detail` VARCHAR(100); `external_reference` VARCHAR(100) (UUID del pedido en spec; **id numérico del pedido** en el código actual; único NN en spec, nullable sin unicidad en el código actual); `idempotency_key` VARCHAR(100) único NN (UUID generado por backend); `transaction_amount` NUMERIC(10,2); `payment_method_id`; auditoría. Relación Pedido→Pago **1:N** (reintentos).

## Seed data inicial

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Obligatorio tras migrar; sin él la app no funciona. **Objetivo:** `python -m app.db.seed` (`backend/app/db/seed.py`, CE-05). Las filas "(`seed.py` real)" son el código actual y constituyen deuda (DT-03, DT-23):

| Entidad | Registros |
|---------|-----------|
| Rol | `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT` (descripciones: acceso total / actualiza stock y disponible / avanza estados / opera solo sus datos). `COCINA` **no** está sembrado (correcto según spec; ver DT-02) |
| EstadoPedido (spec) | `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), `EN_CAMINO`(4), `ENTREGADO`(5, terminal), `CANCELADO`(6, terminal) |
| EstadoPedido (`seed.py` real, **deuda DT-03**) | `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), `ENTREGADO`(5, terminal), `CANCELADO`(99, terminal) — **sin `EN_CAMINO`** (IN-03) |
| FormaPago (spec) | `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA`, todas habilitadas |
| FormaPago (`seed.py` real, **deuda DT-23**) | `EFECTIVO`, `MERCADOPAGO`, `TARJETA` |
| Usuario admin | `admin@foodstore.com` con rol ADMIN. Objetivo: `Admin1234!` (cambiar en producción); código actual (deuda DT-23): `admin123` |
| Usuarios de prueba (`seed.py`, extra no especificado) | `cliente@foodstore.com/cliente123`, `pedidos@foodstore.com/pedidos123`, `stock@foodstore.com/stock123` |
| Datos demo (`seed.py`, extra no especificado) | 7 unidades de medida (kg, g, L, mL, u, doc, m²); categorías Hamburguesas/Bebidas/Postres + subcategorías Veganas, Sin TACC, Gaseosas; 12 ingredientes (alérgenos: Pan Brioche, Queso Cheddar, Mayonesa); 6 productos (Clásica 1500, BBQ Bacon 1900, Vegana 1800, Sin TACC 1700, Coca-Cola 800, Limonada 700) con relaciones y `es_removible` |

> **Deuda técnica (DT-09):** el `seed.py` actual crea las tablas con `SQLModel.metadata.create_all` (no depende de Alembic; el objetivo es migrar con `alembic upgrade head` y luego sembrar) y es idempotente (verifica existencia antes de insertar). `reset.py` ejecuta `DROP TABLE ... CASCADE` de todo el esquema.
