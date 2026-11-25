# Tasks — `seed-demo-ampliado` (ajuste extra `C-25b+`)

> **Governance MEDIO**: no se empieza ninguna tarea hasta que el usuario apruebe `proposal.md`, `design.md`, `specs/` y este archivo, y responda las OQ-1..OQ-5 de `design.md` (sus valores por defecto ya están aplicados acá). Decisiones no obvias durante el apply se informan antes de seguir.
> Strict TDD: cada comportamiento sigue RED → GREEN → TRIANGULATE → REFACTOR y los tests se **ejecutan** en cada gate. Skills: `python-testing-patterns`, `tdd` (compact rules en `.atl/skill-registry.md`): AAA, nombres `test_<unidad>_<escenario>_<esperado>`, literales escritos a mano en el test (conteos, códigos, fechas), **nunca** importados de las constantes del seed; probar por la interfaz pública (`planificar_ventas`, `seed(engine)`, `EstadisticasService`, `PedidoService`), sin mocks de colaboradores internos, sin aserciones triviales.
> Bases: los tests del seed corren sobre `foodstore_migrations_test` con la fixture `migrations_db` (`upgrade_to_head` → `seed(migrations_db)` → consultar). Prerrequisito: `docker compose up -d db` desde la raíz (puerto 5433); si no está, frenar y reportarlo. **Nunca** correr `python -m app.db.seed` ni `python -m app.db.reset` contra la base de desarrollo (eso lo hace el usuario, grupo 6).
> Hard rules: sin build ni servidores (regla 13); sin commit ni push (regla 14); sin migración (D2: solo datos); ningún archivo de `backend/app/modules/` ni de `frontend/src/` cambia. Código y comandos desde `backend/`. Referencias: D1..D11 de `design.md`; requisitos en `specs/backend-db-seed` y `specs/demo-sales-seed`.
> Rojos esperados: solo el RED de cada tarea y los conteos viejos de `test_seed.py` que se actualizan en 1.1. Cualquier otro test que se rompa es una regresión: frenar y corregir.

## 0. Safety net

- [x] 0.1 Correr `pytest` completo desde `backend/` antes de tocar nada y registrar el resultado (passed/failed/xfail y tiempo total). Verificar: 0 failed. Si algo falla, frenar y reportarlo como falla preexistente, sin corregirla.

## 1. Catálogo de demostración ampliado (D9; spec `backend-db-seed` «Datos de demostración»)

- [x] 1.1 RED: en `tests/integration/test_seed.py` actualizar `test_seed_sobre_base_nueva_crea_los_datos_de_demostracion_con_sus_relaciones` a 8 categorías, 24 ingredientes y 21 productos, y agregar `test_seed_sobre_base_nueva_deja_cada_categoria_raiz_de_demo_con_productos` (las 5 raíces con ≥ 1 producto activo) y un test de alérgenos (`Masa de Pizza`, `Muzzarella`, `Huevo` con `es_alergeno` verdadero; `Salsa de Tomate` falso). Ejecutar `pytest tests/integration/test_seed.py` → fallan.
- [x] 1.2 GREEN: ampliar `CATEGORIAS_DEMO`, `INGREDIENTES_DEMO` y `PRODUCTOS_DEMO` en `app/db/seed.py` según D9 (stock de «Cheesecake de Frutos Rojos» 4 y «Flan con Dulce de Leche» 0, D6). Ejecutar → verde; los tests de imágenes sin hosts externos, bajas lógicas e idempotencia siguen verdes.
- [x] 1.3 REFACTOR: si `PRODUCTOS_DEMO` crece de forma ilegible, agrupar por categoría con comentarios; sin cambiar datos. Ejecutar `pytest tests/integration/test_seed.py` → verde.

## 2. Clientes de ejemplo con dirección (D8; spec «Datos de demostración»)

- [x] 2.1 RED: test `test_seed_sobre_base_nueva_crea_dieciseis_clientes_de_ejemplo_con_direccion_principal` (16 usuarios `@demo.foodstore.com` activos, exactamente rol `CLIENT`, una sola dirección activa y principal cada uno; `cliente123` verifica contra uno de ellos; `cliente@foodstore.com` con dirección principal). Ejecutar → falla.
- [x] 2.2 GREEN: tupla `CLIENTES_DEMO` (separada de `USUARIOS_DEMO`) y su siembra en `seed_demo`, con la dirección creada solo junto con el usuario; dirección principal de `cliente@foodstore.com` solo si se crea en esa corrida. Ejecutar → verde.
- [x] 2.3 TRIANGULATE: test «`cliente@foodstore.com` existente sin direcciones → sigue sin direcciones tras el seed» y «cliente de ejemplo existente dado de baja → no se recrea ni se le agrega dirección». Ejecutar → verde.
- [x] 2.4 REFACTOR (D8): `_crear_usuario_si_falta` recibe el hash ya calculado; el hash de `cliente123` para los clientes de ejemplo se calcula una sola vez y solo si falta crear alguno. Ejecutar `pytest tests/integration/test_seed.py tests/unit/test_entrega_docs.py` → verde (el test del README no cambia: `USUARIOS_DEMO` sigue igual).

## 3. Planificador puro de ventas (D1, D3, D4, D6; spec `demo-sales-seed`)

> Tests en `tests/unit/test_ventas_demo.py` con `ahora` fijo (`2026-11-23T15:00:00Z` salvo indicación), catálogo y clientes en memoria y `random.Random(<semilla escrita en el test>)`.

- [x] 3.1 RED: test de cobertura temporal: con el plan de `planificar_ventas`, hay ≥ 1 venta (estado final vendido) el día de `ahora`, ≥ 1 en cada uno de los 30 días que terminan en `ahora`, ≥ 10 en cada uno de los 11 meses anteriores, ninguna fecha > `ahora` ni < `ahora − 365 días`, y entre 250 y 350 pedidos. Ejecutar → falla (no existe `app/db/ventas_demo.py`).
- [x] 3.2 GREEN: crear `app/db/ventas_demo.py` con las dataclasses (`ProductoVendible`, `ClienteDemo`, `PedidoPlan`, `LineaPlan`, `TransicionPlan`) y `planificar_ventas` con la distribución de D3 (pisos por día y por mes por construcción). Ejecutar → verde.
- [x] 3.3 TRIANGULATE (bordes de fecha): `ahora` = `2026-11-23T00:00:30Z` (hoy con un pedido vendido y todo ≤ `ahora`), `2026-12-01T10:00:00Z` (mes en curso = hoy) y `2028-02-29T12:00:00Z`. Ejecutar → verde, generalizando si el piso o la compresión de tiempos fallan.
- [x] 3.4 RED → GREEN: mezcla de estados y activos (spec «Mezcla de estados con pedidos activos recientes»): 8–12 no terminales, ≥ 1 por cada estado activo, todos hoy o ayer; > 70 % `ENTREGADO`; ≥ 5 % `CANCELADO`; las tres formas de pago presentes en los últimos 30 días. Ejecutar → verde.
- [x] 3.5 RED → GREEN: historial (spec «Historial válido según la máquina de estados»): cada recorrido empieza en `None → PENDIENTE` con el dueño en la fecha de creación, cada transición está en `destinos_permitidos` (llamado desde el test con roles escritos a mano: `{"CLIENT"}`, `{"PEDIDOS"}`, `{"ADMIN"}` o el Sistema), termina en el estado final, tiempos estrictamente crecientes ≤ `ahora`, confirmación `MERCADOPAGO` sin usuario y `EFECTIVO`/`TRANSFERENCIA` con gestor, cancelaciones con motivo. Implementar validando cada paso con la FSM de dominio (D2): una transición inválida lanza. Ejecutar → verde.
- [x] 3.6 RED → GREEN: importes y líneas (spec «Importes y snapshots coherentes»): sin productos repetidos por pedido, cantidades ≥ 1, subtotal = Σ precio × cantidad, envío 50.00, descuento 0, total; personalización solo con ingredientes removibles y con nombres; al menos una línea personalizada. Envío y descuento tomados de `PedidoService.COSTO_ENVIO_FIJO`/`DESCUENTO_INICIAL` (el test usa los literales `Decimal("50.00")` y `Decimal("0.00")`). Ejecutar → verde.
- [x] 3.7 RED → GREEN: stock (D6): un producto con stock 0 nunca aparece en pendientes y, por producto, Σ cantidades en `PENDIENTE` ≤ stock; con un catálogo de stocks bajos escrito en el test, el planificador sigue cumpliéndolo. Ejecutar → verde.
- [x] 3.8 TRIANGULATE: determinismo: dos llamadas con `Random` de igual semilla y el mismo `ahora` → listas de planes iguales; con otra semilla → distintas. Ejecutar → verde.
- [x] 3.9 REFACTOR: extraer constantes de proporciones y franjas horarias, nombres claros, type hints en todo lo público; sin estado global mutable. Ejecutar `pytest tests/unit/test_ventas_demo.py` → verde.

## 4. Escritura de las ventas en el seed (D2, D5, D7, D10; spec `demo-sales-seed`)

> Tests en `tests/integration/test_seed_ventas.py` sobre `migrations_db`: `upgrade_to_head` → `seed(migrations_db)` → consultas SQL. El «instante de la corrida» se toma antes y después de llamar al seed.

- [x] 4.1 RED: test «ventas sobre base vacía»: entre 250 y 350 pedidos, todos de usuarios `CLIENT` sembrados, ≥ 8 de `cliente@foodstore.com`, cada uno con ≥ 1 detalle y ≥ 1 historial; ≥ 1 venta hoy y ninguna posterior al fin de la corrida. Ejecutar → falla.
- [x] 4.2 GREEN: `sembrar_ventas(session, ahora)` en `app/db/ventas_demo.py` (lee productos de demo activos y clientes, planifica con la semilla fija y persiste pedido → detalles → historial → pago con fechas explícitas UTC) y llamada desde `seed()` dentro de la misma transacción. Ejecutar → verde.
- [x] 4.3 TRIANGULATE (coherencia en la BD): por SQL, totales y snapshots de cada pedido; historial ordenado por `created_at, id` que empieza en `NULL → PENDIENTE`, termina en `estado_codigo` y crece estrictamente; `CANCELADO` con motivo. Ejecutar → verde.
- [x] 4.4 RED → GREEN: pagos (D5): cada `MERCADOPAGO` con `CONFIRMADO` en su historial tiene un único pago `aprobado` por el total con `mp_order_id`/`mp_payment_id` que empiezan con `SEED-`; ningún otro pedido tiene pagos. Correr el test con `MP_ACCESS_TOKEN` vacío por `monkeypatch` para cubrir «sin red». Ejecutar → verde.
- [x] 4.5 RED → GREEN: idempotencia (D7; spec «Ventas sembradas una sola vez» y «Seed idempotente»): dos corridas → la segunda no agrega pedidos, detalles, historial, pagos ni direcciones; extender `test_seed_dos_corridas_seguidas_dejan_las_tablas_identicas` a `direccion_entrega`, `pedidos`, `detalle_pedido`, `historial_estado_pedido` y `pagos`. Ejecutar → verde.
- [x] 4.6 RED → GREEN: opción sin ventas (D10): `seed(engine, con_ventas=False)` deja catálogo, usuarios y clientes sin pedidos; una corrida posterior con `con_ventas=True` siembra las ventas; con un pedido de un cliente de ejemplo insertado entre medio, la corrida posterior no agrega nada. Agregar `--sin-ventas` al `__main__` con `argparse` y un test que invoque el parseo (sin abrir procesos). Ejecutar → verde.
- [x] 4.7 RED → GREEN: stock en vivo: tras el seed, `PedidoService` (construido con `construir_pedido_service` sobre una `Session` de `migrations_db`) confirma como un usuario `PEDIDOS` cada `PENDIENTE` `EFECTIVO`/`TRANSFERENCIA` sin errores, y ningún `stock_cantidad` queda < 0. Ejecutar → verde.
- [x] 4.8 REFACTOR: resumen impreso del seed con las líneas de clientes de ejemplo y ventas («N pedidos de demostración» / «omitidas» / «ya existían»), solo ASCII/cp1252; los tests de salida cp1252 de `test_seed.py` siguen verdes. Ejecutar `pytest tests/integration/test_seed.py tests/integration/test_seed_ventas.py` → verde.

## 5. Métricas con datos en cada período (spec «Métricas con datos en cada período del dashboard»)

- [x] 5.1 RED → GREEN: en `test_seed_ventas.py`, con `EstadisticasService(PedidoUnitOfWork(...))` sobre la base sembrada y rangos calculados en el test (hoy UTC; hoy−6; hoy−29; día 1 del mes): `resumen` con `ventas > 0` e `ingresos > 0` en los cuatro. Si falla, el arreglo va en el planificador (grupo 3), nunca en el service. Ejecutar → verde.
- [x] 5.2 TRIANGULATE: `ventas_por_periodo(hoy−365, hoy, "month")` con ventas > 0 en cada uno de los 12 meses que terminan en el mes en curso; con `"week"` y `"day"` sobre 30 días, sin períodos vacíos en los últimos 30 días; `productos_top` de 30 días con ≥ 5 productos; `pedidos_por_estado` de 30 días con `ENTREGADO` y `CANCELADO` > 0; `ingresos_por_forma_pago` de 30 días con las tres formas > 0. Ejecutar → verde.
- [x] 5.3 Suite completa: `pytest` desde `backend/` → 0 failed; comparar el tiempo total con el de 0.1. Si creció más de ~30 s, pasar `con_ventas=False` en los tests de `test_seed.py` ajenos a las ventas (D10) y volver a correr. Registrar el resultado y la cobertura de `app/db/ventas_demo.py` (`pytest --cov=app.db`).

## 6. Documentación y prueba manual

- [x] 6.1 README raíz: en el paso del seed y en «Credenciales de prueba», una línea con los 16 clientes de ejemplo (`@demo.foodstore.com`, contraseña `cliente123`), qué siembra el seed (catálogo, clientes, ≈300 ventas de 12 meses, `--sin-ventas`) y que las fechas son relativas a la primera corrida (regenerar con reset + `alembic upgrade head` + seed). En `frontend/README.md`, actualizar la nota del dashboard («hace falta algún pedido confirmado»). Verificar: `pytest tests/unit/test_entrega_docs.py` → verde.
- [x] 6.2 (usuario) Sobre la base de desarrollo: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed`; abrir el dashboard y probar «Hoy», «7 días», «30 días», «Este mes» y un rango de 12 meses con agrupación por mes; revisar «Mis pedidos» con `cliente@foodstore.com` y la gestión de pedidos con `pedidos@foodstore.com` (filtros de fecha y pedidos activos). Verificar: el usuario confirma que todos muestran datos. — Hecho (2026-11-24): el usuario lo verificó con todas las cuentas; la base tiene 302 pedidos repartidos en los 12 meses (dic-2025..nov-2026).

## Workflow follow-up

- Verify (`openspec-verify`) contra `specs/` y `design.md`.
- Archivar (`/opsx:archive seed-demo-ampliado`): sincroniza `backend-db-seed` (modificada) y crea `demo-sales-seed`; marcar `C-25b+` como cerrado en `CHANGES.md`.
- Después: capturas del dashboard y video de C-25b con la base recién sembrada.
