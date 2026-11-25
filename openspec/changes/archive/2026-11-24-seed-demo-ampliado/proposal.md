# Proposal — `seed-demo-ampliado` (ajuste extra post-roadmap `C-25b+`)

## Why

Para las capturas y el video de la entrega (C-25b) el catálogo de demostración se ve vacío (6 productos, la categoría «Postres» sin productos) y no hay **ninguna venta**: el dashboard de métricas (C-24) muestra sus estados vacíos, «Mis pedidos» y la gestión de pedidos arrancan sin historia y los filtros de fecha no tienen qué filtrar. Hoy, para mostrar algo, habría que hacer decenas de compras a mano y aun así todas caerían en el día de la grabación, sin cubrir los atajos «7 días», «30 días», «Este mes» ni las agrupaciones por semana y mes.

Este change agranda `python -m app.db.seed` para que, con el mismo comando de siempre, la base quede con un catálogo creíble, clientes de ejemplo y un año de ventas ya hechas, coherentes con las reglas del dominio y repartidas de modo que **cada atajo y cada agrupación del dashboard y cada filtro de fechas de los listados muestren datos**.

## What Changes

- **Catálogo de demostración ampliado** (recomendado, OQ-1): de 6 a **21 productos** y de 6 a **8 categorías** (nuevas raíz «Pizzas» y «Acompañamientos»; «Postres» deja de estar vacía), de 12 a **24 ingredientes** con alérgenos coherentes (masa y rebozados con gluten, lácteos, huevo). Precios en el orden de los actuales ($600–$2.700). Stock pensado para la demo en vivo: un producto con stock bajo y uno sin stock para mostrar las marcas del catálogo.
- **Clientes de ejemplo** (recomendado, OQ-2): **16 clientes** nuevos con rol `CLIENT`, emails `nombre.apellido@demo.foodstore.com`, todos con la misma contraseña de desarrollo `cliente123` y una dirección principal cada uno (Gran Mendoza). Van en una lista **separada** de `USUARIOS_DEMO` (que sigue siendo «una cuenta por rol» y la que exige el test del README); el README los menciona en una línea. `cliente@foodstore.com` también recibe historia (≈10 pedidos) para que «Mis pedidos» se vea poblado al ingresar con la cuenta de prueba.
- **Ventas históricas** (recomendado, OQ-3): **≈300 pedidos** en los últimos 365 días UTC respecto del momento de la corrida, más densos en las últimas semanas: pedidos **hoy**, todos los días de los últimos 7 y 30, y todos los meses calendario de los últimos 12 (con ventas en cada uno), para que «Hoy», «7 días», «30 días», «Este mes», un rango personalizado de hasta 366 días y las agrupaciones día/semana/mes tengan datos.
  - Mezcla de estados: ≈80 % `ENTREGADO`, ≈10 % `CANCELADO` (con motivo), y entre 8 y 12 pedidos **activos recientes** (`PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `EN_CAMINO`, todos de hoy o ayer) para operar en vivo desde la gestión de pedidos.
  - Mezcla de formas de pago: ≈50 % `MERCADOPAGO`, ≈30 % `EFECTIVO`, ≈20 % `TRANSFERENCIA`. Los pedidos `MERCADOPAGO` vendidos llevan un pago **aprobado** sembrado (identificadores con prefijo `SEED-`), sin llamar nunca a la API de MercadoPago.
  - Coherencia con el dominio: snapshots de nombre y precio, subtotal = Σ líneas, envío fijo $50, total = subtotal − descuento + envío; historial completo y append-only que recorre solo transiciones válidas de la FSM, con el actor que corresponde (cliente al crear, gestor o Sistema al confirmar según la forma de pago, gestor al despachar/entregar, cliente o gestor al cancelar) y marcas de tiempo crecientes; líneas sin productos repetidos y algunas con personalización (ingredientes removibles).
  - Stock final coherente: nunca negativo y suficiente para confirmar en vivo todos los pedidos `PENDIENTE` sembrados.
- **Idempotencia de las ventas**: las ventas de demostración se siembran **una sola vez** (si ya hay pedidos de los clientes de ejemplo, el bloque se omite entero); el resto del seed sigue igual de idempotente. Las fechas son relativas a la corrida: para «refrescarlas» se recrea la base (`python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed`), y el README lo dice.
- **Comando único**: `python -m app.db.seed` sigue siendo el único comando documentado y siembra todo; se agrega la opción `--sin-ventas` para una base con catálogo y usuarios pero sin historia (recomendado, OQ-4).
- **Generación determinística**: semilla fija del generador; con la misma fecha de corrida se obtienen exactamente los mismos pedidos.
- Sin cambios de esquema, de API ni de frontend.

## Capabilities

### New Capabilities
- `demo-sales-seed`: las ventas de demostración que siembra el seed — cobertura temporal respecto de la fecha de corrida (hoy, 7 y 30 días, mes en curso, cada uno de los últimos 12 meses), mezcla de estados y formas de pago, coherencia con el dominio (snapshots, totales, envío, historial válido según la FSM, pagos aprobados sin pasarela), stock resultante, siembra única, opción para omitirlas y determinismo.

### Modified Capabilities
- `backend-db-seed`: el requisito «Datos de demostración» cambia los conteos del catálogo (8 categorías, 24 ingredientes, 21 productos) y suma los clientes de ejemplo con su dirección principal; «Seed idempotente» extiende la igualdad entre corridas a direcciones, pedidos, detalles, historial y pagos.

## Impact

- **Código** (todo bajo `backend/`): `app/db/seed.py` (catálogo ampliado, clientes de ejemplo, orquestación y opción `--sin-ventas`); módulo nuevo `app/db/ventas_demo.py` con el planificador puro de ventas y su escritura. Reutiliza la FSM (`app/modules/pedidos/fsm.py`) y el costo de envío del dominio; no cambia ningún service, repository, router ni modelo.
- **Tests**: nuevos `tests/unit/test_ventas_demo.py` (planificador puro, fecha de corrida inyectada) y `tests/integration/test_seed_ventas.py` (seed real + `EstadisticasService`); se ajustan los conteos de `tests/integration/test_seed.py`. `tests/unit/test_entrega_docs.py` no cambia (los clientes de ejemplo no entran en `USUARIOS_DEMO`).
- **Base de datos**: sin migración (la cabeza sigue en `007`); son datos.
- **Documentación**: README raíz (qué siembra el seed, clientes de ejemplo, cómo refrescar fechas) y la nota del dashboard en `frontend/README.md` («hace falta algún pedido confirmado» deja de aplicar tras el seed).
- **Operación**: en una base de desarrollo ya sembrada, correr el seed agrega el catálogo nuevo, los clientes y las ventas (una vez). Tiempo del seed: algunos segundos más (≈300 pedidos en una transacción; el hash bcrypt de los clientes se calcula una sola vez).
- **Roadmap**: ajuste extra fuera de los changes planificados (no cuenta en los totales); conviene cerrarlo antes de las capturas del dashboard y del video de C-25b.
- **Governance**: MEDIO (datos de desarrollo; sin auth, pagos reales ni esquema). El usuario revisa estos artefactos y responde las OQ antes del apply.
