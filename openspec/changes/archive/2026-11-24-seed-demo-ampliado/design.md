# Design — `seed-demo-ampliado`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/backend-db-seed` (catálogo y clientes) y `specs/demo-sales-seed` (ventas).

Estado actual relevante (observado en el código):

- `backend/app/db/seed.py` corre todo en **una transacción** (`seed_catalogos` → `seed_admin` → `seed_demo`), escribe con la `Session` directamente (no por repositorios/UoW) y es idempotente buscando cada registro por clave natural con `_obtener_o_crear` (incluye bajas lógicas; nunca modifica un existente). Las relaciones se crean solo junto con la entidad dueña. `_crear_usuario_si_falta` llama a `hash_password` (bcrypt, cost ≥ 12) por cada usuario.
- `USUARIOS_DEMO`, `ADMIN_EMAIL` y `ADMIN_PASSWORD_DESARROLLO` los importa `tests/unit/test_entrega_docs.py` (el README debe listar cada email, contraseña y rol de `USUARIOS_DEMO`).
- Los reportes (`PedidoRepository.ventas_por_periodo`, `resumen_ventas`, `pedidos_por_estado`, `ingresos_por_forma_pago`, `DetallePedidoRepository.productos_top`) filtran por **`pedidos.created_at` convertido a día UTC** y cuentan como venta `ESTADOS_VENDIDOS = {CONFIRMADO, EN_PREP, EN_CAMINO, ENTREGADO}` (`app/modules/pedidos/fsm.py`). Los listados (`/pedidos` con `desde`/`hasta`) también filtran por `created_at` UTC. El dashboard (`frontend/src/entities/estadistica/model/periodo.ts`) ofrece «Hoy», «7d» (hoy−6), «30d» (hoy−29), «Este mes» (desde el día 1) y rangos de hasta 366 días, con agrupación `day`/`week`/`month`.
- `PedidoService.crear_pedido` y `_transicionar` fijan `created_at` con el reloj actual (default de `aware_datetime_field`), descuentan stock al confirmar y validan con la FSM. No hay forma de crear por el service un pedido con fecha pasada.
- `Pago` exige `idempotency_key` único, `external_reference` único (UUID), `mp_order_id`/`mp_payment_id` únicos si no son nulos; estado local `aprobado` (`decision_webhook.ESTADO_APROBADO`).
- No hay triggers de BD sobre el historial (append-only lo garantiza la aplicación).

## Goals / Non-Goals

**Goals:**
- Un solo comando (`python -m app.db.seed`) deja una base lista para capturas y video, con datos en todos los períodos y filtros.
- Datos que respeten las reglas del dominio sin duplicarlas: la FSM y el costo de envío se toman del código de dominio.
- Tests estables (planificador puro con instante inyectado y semilla fija) y suite que no se vuelva lenta.

**Non-Goals:**
- Cambiar esquema, API, services o frontend.
- Simular la pasarela de MercadoPago o el webhook.
- Datos «realistas» en sentido estadístico (estacionalidad, ticket por cliente): alcanza con que se vean creíbles.
- Refrescar fechas de ventas ya sembradas (se recrea la base).

## Decisions

### D1. Planificador puro + escritor, en un módulo nuevo `app/db/ventas_demo.py`

El módulo tiene dos partes:

1. `planificar_ventas(ahora: datetime, productos: Sequence[ProductoVendible], clientes: Sequence[ClienteDemo], rng: random.Random) -> list[PedidoPlan]`: **función pura** (sin `Session`), que devuelve dataclasses congeladas (`PedidoPlan` con cliente, dirección, forma de pago, líneas, estado final y la lista de `TransicionPlan(desde, hacia, actor, motivo, cuando)`). Toda la lógica de fechas, mezcla y coherencia vive acá y se prueba con tests unitarios rápidos y un `ahora` fijo.
2. `sembrar_ventas(session: Session, ahora: datetime) -> int`: lee los productos de demo activos y los clientes, llama al planificador con `random.Random(SEMILLA_VENTAS)` y persiste los planes; devuelve cuántos pedidos creó.

`seed.py` solo orquesta. Alternativa descartada: meter todo en `seed.py` (ya tiene 300 líneas y mezclaría catálogo con generación); otra descartada: generar dentro del test con fixtures (no serviría para la demo).

### D2. Escritura con la `Session` directa, no por `PedidoService`/UoW

El seed es un script de datos de la capa `app/db`, igual que hoy (crea usuarios, productos y relaciones con la `Session`). Usar `PedidoService` no sirve: fija `created_at` con el reloj actual, descuenta stock al confirmar (D6) y exigiría simular actores y el webhook. Las reglas duras de capas aplican al flujo de requests (`models ← repository ← UoW ← services ← routers`); el seed no es una capa de ese flujo y no lo importa ningún service ni router.

**Sin duplicar reglas de negocio**: el planificador **consulta** el dominio en lugar de copiarlo:
- Cada transición planificada se valida con `destinos_permitidos(actor, origen, forma_pago)` de `app/modules/pedidos/fsm.py`; si una transición no está permitida, el planificador lanza (bug del seed, no dato inválido silencioso). Los códigos de estado, `ESTADOS_VENDIDOS`, `ACTOR_SISTEMA` y `Actor.usuario` también salen de ahí.
- El envío usa `PedidoService.COSTO_ENVIO_FIJO` y el descuento `PedidoService.DESCUENTO_INICIAL` (constantes de clase; importarlas no instancia nada).
- El estado local del pago aprobado usa `ESTADO_APROBADO` de `app/modules/pagos/decision_webhook.py`.

Fechas explícitas: se setean `created_at`/`updated_at` de `Pedido`, `created_at` de `DetallePedido` e `HistorialEstadoPedido`, y `created_at`/`updated_at` de `Pago` (todos con `tzinfo=UTC`).

### D3. Distribución temporal (cubre «Cobertura temporal» y «Métricas con datos»)

Con `hoy = ahora.date()` en UTC y la ventana `[primer día del mes hoy−11 meses, ahora]` (≤ 365 días):

| Tramo | Pedidos por día (rango sorteado) |
|-------|----------------------------------|
| Hoy | 4–6, con `created_at` en `[00:00 UTC, ahora)` |
| Días 1–6 atrás | 4–7 |
| Días 7–29 atrás | 2–3 |
| Días 30 en adelante | 0–1 por día con piso semanal (≈4 por semana) |

Total esperado ≈ 300 (rango del spec 250–350; el test lo verifica con la semilla fija). Garantías por construcción, no por azar: el primer pedido de cada día de los últimos 30 es una venta (`ENTREGADO`, o activo vendido si es hoy/ayer); cada mes completo anterior recibe un piso de 12 pedidos vendidos (si el sorteo dio menos, se completan). Las horas se sortean en franjas de almuerzo y cena (11–15 y 19–23 hora argentina, convertidas a UTC); para **hoy** se reescalan a `[00:00, ahora − 1 min]` y, si la corrida es apenas pasada la medianoche UTC, las transiciones se comprimen a segundos para que todo quede ≤ `ahora` (el pedido de hoy siempre tiene al menos `PENDIENTE → CONFIRMADO`).

### D4. Estados, formas de pago, actores e historial

- **Forma de pago** por pedido: `MERCADOPAGO` 50 %, `EFECTIVO` 30 %, `TRANSFERENCIA` 20 %.
- **Estado final**: pedidos de hace 2 días o más → `ENTREGADO` (~89 %) o `CANCELADO` (~11 %). Pedidos de hoy y ayer → se reservan entre 8 y 12 activos con al menos uno por estado (`PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `EN_CAMINO`); el resto, `ENTREGADO`.
- **Recorrido** (cada paso validado con la FSM, D2): `NULL→PENDIENTE` (dueño, motivo «Pedido creado», como `crear_pedido`) → `CONFIRMADO` (Sistema con «Pago aprobado por MercadoPago» si `MERCADOPAGO`; `pedidos@foodstore.com` si `EFECTIVO`/`TRANSFERENCIA`) → `EN_PREP` → `EN_CAMINO` → `ENTREGADO` (gestor). Gestor = `pedidos@foodstore.com` (~80 %) o `admin@foodstore.com`.
- **Cancelaciones**: desde `PENDIENTE` por el cliente («Me equivoqué de dirección», «Ya no lo necesito») o por el gestor; desde `CONFIRMADO`/`EN_PREP` por el gestor («Sin repartidor disponible», «Cliente no responde»). Un `MERCADOPAGO` cancelado lo cancela el cliente desde `PENDIENTE` (nunca se pagó).
- **Tiempos**: confirmación +2–10 min, preparación +5–15, despacho +15–30, entrega +15–40, estrictamente crecientes. `updated_at` del pedido = última transición.
- **Líneas**: 1–4 productos distintos por pedido, cantidad 1–3 (bebidas y acompañamientos hasta 4), con pesos de popularidad (hamburguesas y papas más vendidas, para que «Productos más vendidos» tenga un ranking claro). ~10 % de las líneas de productos con ingredientes removibles llevan personalización (1 ingrediente removible, nombre en el snapshot).
- **Dirección**: la principal del cliente; ~15 % sin dirección (retiro). El envío sigue siendo $50 fijo (spec vigente; PA-13 sigue abierta).

### D5. Pagos `MERCADOPAGO` sin pasarela

Por cada pedido `MERCADOPAGO` cuyo recorrido pasa por `CONFIRMADO`: un `Pago` con `estado = "aprobado"`, `mp_status = "processed"`, `mp_status_detail = "accredited"`, `mp_order_id = "SEED-ORD-<n>"`, `mp_payment_id = "SEED-PAY-<n>"`, `idempotency_key = "seed-demo-<n>"`, `external_reference` = UUID derivado del `rng` (determinístico), `transaction_amount = total`, `payment_method_id` ∈ {`visa`, `master`, `amex`} y `created_at` = 1 minuto antes de la confirmación. Nada importa `pasarela_mp` ni el SDK.

### D6. Stock: las ventas históricas no lo tocan

El stock del catálogo de demo es el **declarado** en `PRODUCTOS_DEMO` (el «stock actual» que se quiere mostrar). Reconstruir el stock histórico no aporta a la demo y obligaría a stocks iniciales de miles de unidades. Los pedidos activos sembrados en `CONFIRMADO`/`EN_PREP`/`EN_CAMINO` se consideran ya descontados (si se cancelan en vivo, `StockService.devolver` suma: nunca negativo). Para los `PENDIENTE`, el planificador solo usa productos con stock ≥ lo pedido por todos los pendientes (se verifica al final y lanza si no). Stocks declarados: 20–100 en general; **«Cheesecake de Frutos Rojos» con 4** (marca de stock bajo) y **«Flan con Dulce de Leche» con 0** (marca «Sin stock»; aparece en ventas viejas, nunca en pendientes). Ver OQ-1.

### D7. Idempotencia: marcador «hay pedidos de clientes de ejemplo»

`sembrar_ventas` no hace nada si existe **algún pedido** (incluido dado de baja) de un usuario cuyo email está en `CLIENTES_DEMO`. Se eligió este marcador porque no requiere columna nueva (sin migración) y porque, si un cliente de ejemplo ya compró en vivo, sembrar historia «alrededor» de esa compra mezclaría datos. `cliente@foodstore.com` no sirve de marcador (puede tener compras manuales de antes del change). El README documenta: para regenerar fechas, `python -m app.db.reset` → `alembic upgrade head` → `python -m app.db.seed`.

### D8. Clientes de ejemplo y costo del hash

`CLIENTES_DEMO` es una tupla **separada** de `USUARIOS_DEMO` (`(email, nombre, apellido, celular, dirección)`): `USUARIOS_DEMO` sigue siendo «una cuenta por rol» y el test del README no cambia. Los 16 comparten la contraseña de desarrollo `cliente123`; su hash bcrypt se calcula **una sola vez por corrida y solo si falta crear alguno** (`_crear_usuario_si_falta` recibe el hash ya calculado). Sin esto, 16 hashes con cost 12 sumarían ~4 s por corrida y ~25 corridas en `test_seed.py`. Emails `nombre.apellido@demo.foodstore.com`; celulares `2615xxxxxx`; direcciones en Ciudad de Mendoza, Godoy Cruz, Guaymallén, Las Heras, Maipú y Luján de Cuyo (provincia Mendoza, código postal de cada departamento), sin coordenadas. `cliente@foodstore.com` recibe una dirección principal solo si el seed lo crea en esa corrida.

### D9. Catálogo ampliado

Nuevas categorías raíz «Pizzas» y «Acompañamientos». Productos nuevos (15): Hamburguesas: «Doble Cheddar», «Burger Crispy Chicken»; Pizzas: «Pizza Muzzarella», «Pizza Napolitana», «Pizza Fugazzeta»; Acompañamientos: «Papas Fritas», «Papas Cheddar y Bacon», «Aros de Cebolla», «Nuggets x6»; Postres: «Brownie con Helado», «Flan con Dulce de Leche», «Cheesecake de Frutos Rojos»; Bebidas: «Sprite 500ml» (+ Gaseosas), «Agua Mineral 500ml», «Café con Leche». Ingredientes nuevos (12): «Masa de Pizza» (alérgeno), «Muzzarella» (alérgeno), «Salsa de Tomate», «Orégano», «Ajo», «Cebolla», «Pollo Rebozado» (alérgeno), «Papas», «Huevo» (alérgeno), «Dulce de Leche» (alérgeno), «Chocolate» (alérgeno), «Queso Crema» (alérgeno). Precios $600–$2.700. Todos idempotentes con `_obtener_o_crear` como hoy, sin imágenes externas.

### D10. Opción `--sin-ventas` y firma de `seed`

`seed(engine: Engine | None = None, *, con_ventas: bool = True) -> None`; el `__main__` acepta `--sin-ventas` (parseo con `argparse`). El resumen impreso suma la línea de ventas («N pedidos de demostración» u «omitidas»/«ya existían») y los clientes de ejemplo, en ASCII/cp1252 como exige el spec vigente. Los tests de `test_seed.py` que no tratan de ventas siguen llamando `seed(engine)` (cubren el camino real); si la suite se vuelve lenta (D11), los que no las necesiten pasan `con_ventas=False`.

### D11. Tests

- `tests/unit/test_ventas_demo.py`: el planificador con `ahora` fijo (incluidos bordes: 00:00:30 UTC, día 1 del mes, 29 de febrero) y catálogo/clientes en memoria: cobertura por día y por mes, mezcla de estados, activos hoy/ayer, transiciones aceptadas por la FSM, tiempos crecientes ≤ `ahora`, importes, sin productos repetidos, pendientes dentro del stock, determinismo (dos llamadas con el mismo `rng` sembrado → planes iguales).
- `tests/integration/test_seed_ventas.py` (base `migrations_db`): el seed real; conteos, cobertura, coherencia en la BD, pagos, idempotencia, `--sin-ventas`, y `EstadisticasService` (con `PedidoUnitOfWork` sobre la base sembrada) no vacío para los cuatro atajos, la serie mensual de 366 días y los desgloses de 30 días; confirmación en vivo de los `PENDIENTE` por `PedidoService` sin stock negativo.
- Literales en los tests (conteos, fechas, códigos), nunca importados de las constantes del seed (convención de C-07).

## UI Mockups

- Design system revision: 4 (sin cambios)
- Decision: no (no UI) — 2026-11-23. Solo datos de desarrollo del backend; no cambia ninguna pantalla, componente ni estilo.
- Mockups: —
- Approval: —
- Preview: —
- Visual verify: —

## Risks / Trade-offs

- [Las fechas envejecen: una base sembrada hace un mes ya no tiene ventas «hoy»] → documentado en el README; regenerar con reset + migrate + seed antes de grabar.
- [Suite más lenta: ≈300 pedidos (~2.500 filas) por cada corrida del seed en `test_seed.py`] → hash único (D8), `flush` por pedido sin `refresh`; medir en el apply y, si suma más de ~30 s, usar `con_ventas=False` en los tests ajenos a las ventas.
- [Stock declarado e historia no cuadran contablemente] → decisión explícita (D6); el spec lo dice.
- [Un borde horario (corrida 00:00–00:05 UTC) deja «hoy» con pocos minutos] → compresión de tiempos (D3) y test unitario del borde.
- [La zona horaria: el dashboard y los filtros son UTC, la demo se graba en Argentina (UTC−3)] → entre las 21:00 y las 24:00 hora local «hoy» UTC ya es mañana; limitación conocida (C-22 R2/OQ-7), el README ya la documenta.
- [Bases de desarrollo viejas con productos de demo editados o dados de baja] → el escritor usa solo productos activos con su precio vigente; si falta un producto, el planificador trabaja con los que hay.

## Migration Plan

Sin migración. Para ver los datos en una base de desarrollo existente: `python -m app.db.seed` (agrega catálogo, clientes y ventas una vez). Para fechas frescas o volver atrás: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed` (o `--sin-ventas`).

## Open Questions

Resueltas por el usuario el 2026-11-23 (se mantienen los valores por defecto ya aplicados en el spec y las tareas).

- **OQ-1 [RESUELTA 2026-11-23: se mantienen Cheesecake con stock 4 y Flan con stock 0] Volumen y contenido del catálogo**: 21 productos / 8 categorías / 24 ingredientes, con un producto en stock bajo (4) y uno sin stock (0). ¿Va así, o preferís menos productos o sin el producto agotado?
- **OQ-2 [RESUELTA: por defecto, 16 clientes nombre.apellido@demo.foodstore.com, lista CLIENTES_DEMO separada, una linea en el README] Clientes de ejemplo**: 16 clientes `@demo.foodstore.com` con la contraseña compartida `cliente123`, fuera de `USUARIOS_DEMO` (una línea en el README, sin tabla). ¿Otro dominio o cantidad?
- **OQ-3 [RESUELTA: volumenes como propuestos] Volumen de ventas**: ≈300 pedidos en 12 meses, 8–12 activos hoy/ayer, ≈80 % entregados, ≈10 % cancelados, MP 50 % / efectivo 30 % / transferencia 20 %. ¿Ajustás alguna proporción?
- **OQ-4 [RESUELTA: ventas por defecto, --sin-ventas las omite] Ventas siempre o con opción**: el comando de siempre siembra las ventas y `--sin-ventas` las omite. ¿O preferís lo inverso (ventas solo con `--con-ventas`)?
- **OQ-5 [RESUELTA: cliente@foodstore.com con ~10 pedidos incluido uno activo] Historia de `cliente@foodstore.com`**: ≈10 pedidos propios (incluido al menos uno activo para mostrar el seguimiento). ¿Lo querés con historia o limpio para hacer la compra del video desde cero?
