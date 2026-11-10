# Tasks — C-07 `datos-seed-y-catalogos`

> **Governance ALTO**: no se empieza ninguna tarea hasta que el usuario apruebe `proposal.md`, `design.md`, `specs/` y este archivo, incluidas las Open Questions de `design.md` (sus valores por defecto ya están aplicados acá).
> Strict TDD: cada comportamiento sigue RED → GREEN → TRIANGULATE → REFACTOR, y los tests se **ejecutan** en cada gate. Skills: `python-testing-patterns`, `tdd` (compact rules en `.atl/skill-registry.md`): AAA, nombres `test_<unidad>_<escenario>_<esperado>`, fixtures en `conftest.py`, literales independientes (códigos, órdenes y conteos escritos a mano en el test, **nunca** importados de las constantes del seed), probar por la interfaz pública (`seed(engine)`, `seed_catalogos(session)`, HTTP), sin mocks de colaboradores internos, un test → una implementación, sin aserciones triviales.
> Bases: los tests del seed corren sobre la base auxiliar `foodstore_migrations_test` con la fixture `migrations_db` (vacía antes y después de cada test; guardia `_test`): `upgrade_to_head` → preparar datos → `seed(migrations_db)` → consultar. Los tests HTTP usan `foodstore_test` (`client`/`session`). Prerrequisito: `docker compose up -d db` desde la raíz (puerto 5433); si no está, frenar y reportarlo. **Nunca** correr `python -m app.db.seed` ni `python -m app.db.reset` contra la base de desarrollo.
> Hard rules: sin build ni servidores (regla 13); sin commit ni push; sin secretos. **Sin variables de entorno nuevas** (design D6): no se crea `todoAMd/env-templates-C-07.md` y el agente no lee ni escribe archivos `.env*`. Sin migración nueva (D1): la cabeza sigue en `002`. Ningún archivo de `backend/app/modules/` cambia (D10).
> Estructura: código y comandos desde `backend/`. Referencias: decisiones D1..D12 de `design.md`; requisitos en `specs/backend-db-seed` y `specs/backend-db-migrations`.
> Rojos esperados: ninguno fuera del RED de cada tarea. Cualquier test existente que se rompa es una regresión: frenar y corregir.

## 0. Safety net

- [x] 0.1 (hecho: 338 passed, 0 failed) Correr `pytest` completo desde `backend/` antes de tocar nada y registrar el resultado. Verificar: 338 passed, 0 failed. Si algo falla, frenar y reportarlo como falla preexistente, sin corregirla.

## 1. Catálogos canónicos sobre base nueva (D2, D4; spec «Catálogo de roles», «Catálogo de estados de pedido», «Catálogo de formas de pago»)

- [x] 1.1 RED: crear `backend/tests/integration/test_seed.py` con un helper local `_migrar_y_sembrar(engine)` y el test de estados: sobre base recién migrada, `SELECT codigo, orden, es_terminal FROM estado_pedido ORDER BY orden` es exactamente `[("PENDIENTE",1,False),("CONFIRMADO",2,False),("EN_PREP",3,False),("EN_CAMINO",4,False),("ENTREGADO",5,True),("CANCELADO",6,True)]`. Ejecutar `pytest tests/integration/test_seed.py` → falla (faltan `EN_CAMINO` y `orden` 6).
- [x] 1.2 GREEN: en `backend/app/db/seed.py` declarar los catálogos como constantes tipadas (D2, D4) y sembrar `ESTADOS_PEDIDO` desde ellas. Ejecutar → verde.
- [x] 1.3 RED: test de formas de pago: sobre base recién migrada, `SELECT codigo, habilitado FROM forma_pago` es exactamente `{("MERCADOPAGO",True),("EFECTIVO",True),("TRANSFERENCIA",True)}` (sin `TARJETA`). Ejecutar → falla.
- [x] 1.4 GREEN: `FORMAS_PAGO` canónicas (D4, descripción de `MERCADOPAGO` «Mercado Pago»). Ejecutar → verde.
- [x] 1.5 TRIANGULATE: test de roles: exactamente `{"ADMIN","STOCK","PEDIDOS","CLIENT"}` con sus `nombre` («Administrador», «Gestor de Stock», «Gestor de Pedidos», «Cliente»); el test existente `test_seed_sobre_base_migrada_inserta_los_cuatro_roles_de_catalogo` sigue verde. Ejecutar `pytest tests/integration/test_seed.py tests/integration/test_seed_schema_check.py` → verde.
- [x] 1.6 REFACTOR: extraer `seed_catalogos(session: Session) -> None` (solo `add`/`flush`, sin `commit`) y la función genérica de reconciliación por clave (D2), con type hints. Ejecutar los mismos tests → verde.

## 2. Reconciliación de bases existentes (D3; spec «Reconciliación de catálogos existentes», «Formas de pago fuera del catálogo deshabilitadas», «Habilitación de formas de pago existentes respetada», «Rol COCINA intacto»)

- [x] 2.1 RED: test «catálogo de estados viejo»: tras `upgrade_to_head`, insertar con SQL los 5 estados viejos (`CANCELADO` con `orden` 99), un usuario, una dirección y un pedido en `CANCELADO` con una fila de historial; correr `seed` → seis estados con los órdenes de la spec, `CANCELADO.orden == 6`, el pedido sigue en `CANCELADO` y su historial tiene las mismas filas. Ejecutar → falla (`orden` sigue en 99).
- [x] 2.2 GREEN: la reconciliación asigna solo los campos que difieren (`descripcion`, `orden`, `es_terminal` en estados; `nombre`, `descripcion` en roles; `descripcion` en formas de pago). Ejecutar → verde.
- [x] 2.3 RED: test «`TARJETA` con un pedido»: base con `TARJETA` habilitada y un pedido que la referencia; `seed` → `TARJETA` existe con `habilitado = false` y el pedido conserva `forma_pago_codigo = 'TARJETA'`. Ejecutar → falla.
- [x] 2.4 GREEN: deshabilitar las formas de pago fuera del catálogo, sin borrarlas (D3). Ejecutar → verde.
- [x] 2.5 TRIANGULATE: (a) base con `EFECTIVO` en `habilitado = false` → sigue en `false` tras el seed; (b) base con el rol `COCINA` asignado a un usuario → `COCINA` y la fila de `usuario_rol` siguen iguales; (c) un rol del catálogo con `descripcion` cambiada a mano vuelve a la de la spec. Ejecutar → verde.
- [x] 2.6 RED (HTTP, `tests/integration/test_pedidos.py`): con `client` y `session`, crear un pedido válido con `forma_pago_codigo = "TRANSFERENCIA"` → 201 (requiere que la fixture tenga el catálogo nuevo: falla hoy con 400 «Forma de pago no encontrada»). Ejecutar → falla.
- [x] 2.7 GREEN (D9): en `backend/tests/conftest.py::_create_test_admin` reemplazar las listas inline de roles, estados y formas de pago por `seed_catalogos(session)`; mantener el admin de tests `admin@foodstore.com/admin123` y el rol extra `COCINA`, y aclarar en el docstring que es la fixture, no el admin del seed. Ejecutar `pytest tests/integration/test_pedidos.py` → verde.
- [x] 2.8 TRIANGULATE (HTTP): insertar en `session` la forma `TARJETA` habilitada, llamar a `seed_catalogos(session)` y crear un pedido con `TARJETA` → 400 con detalle «Forma de pago no está habilitada» y ningún pedido nuevo en la base. Ejecutar → verde. Correr la suite completa → 338 + nuevos, 0 failed (confirma D10: nada se rompe con la fixture nueva).

## 3. Administrador inicial (D6; spec «Administrador inicial», «Usuarios existentes no se modifican»)

- [x] 3.1 RED: test sobre base recién migrada: existe un único usuario activo `admin@foodstore.com` con exactamente el rol `ADMIN`; `verify_password("Admin1234!", hash)` es verdadero y `verify_password("admin123", hash)` es falso. Ejecutar → falla.
- [x] 3.2 GREEN: constante `ADMIN_PASSWORD_DESARROLLO = "Admin1234!"` con comentario (credencial de desarrollo fijada por la spec, D6) y `seed_admin(session)`; actualizar el resumen impreso del seed. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: base con `admin@foodstore.com` ya creado con otro hash (y otra con el admin dado de baja lógica) → tras el seed el hash y los roles no cambian y hay una sola fila con ese email. Ejecutar → verde.

## 4. Datos de demostración idempotentes (D8; spec «Datos de demostración», «Bajas lógicas respetadas»)

- [x] 4.1 RED: test «dos corridas seguidas»: `seed` dos veces sobre base recién migrada → la segunda no lanza excepción. Ejecutar → falla con `IntegrityError` en `uq_categorias_nombre_activo` (confirma la contradicción de la KB, Open Questions 5).
- [x] 4.2 GREEN: `seed_demo(session)` busca cada registro por su clave natural (`email`, `simbolo`, `nombre`) incluyendo los dados de baja y crea las relaciones solo para las entidades que crea en esa corrida (D8). Ejecutar → verde.
- [x] 4.3 TRIANGULATE: (a) conteos tras una corrida: 3 usuarios de prueba con su rol (`cliente@` CLIENT, `pedidos@` PEDIDOS, `stock@` STOCK), 7 unidades, 6 categorías (3 con `parent_id`), 12 ingredientes, 6 productos, 9 filas en `producto_categoria` y 22 en `producto_ingrediente`; (b) dar de baja lógica «Hamburguesa Clásica» (`deleted_at`) y volver a correr el seed → no hay un producto activo con ese nombre. Ejecutar → verde.

## 5. Idempotencia y atomicidad (D5, D7; spec «Seed idempotente», «Seed atómico»)

- [x] 5.1 RED: test de foto: helper `_foto(engine) -> dict[str, list[tuple]]` que lee todas las columnas de `rol`, `estado_pedido`, `forma_pago`, `usuario`, `usuario_rol`, `unidades_medida`, `categorias`, `ingredientes`, `productos`, `producto_categoria`, `producto_ingrediente` ordenadas por PK; foto tras la primera corrida == foto tras la segunda. Repetir partiendo del catálogo viejo de 2.1 (reconciliar, fotografiar, correr otra vez, comparar). Ejecutar → si ya pasa, documentar en este archivo que el GREEN vino de 2.2/4.2 (sin código nuevo); si falla, corregir solo lo que cambie de más. **Nota 5.1: ambos tests pasaron al primer intento; el GREEN vino de 2.2/4.2 (sin código nuevo).**
- [x] 5.2 RED: test de atomicidad: tras `upgrade_to_head`, insertar una unidad activa «Kilogramo» con símbolo `KGX`; `seed` → lanza error de integridad y la base no tiene filas en `rol`, `estado_pedido`, `forma_pago` ni `usuario`, y `unidades_medida` tiene solo esa unidad. Ejecutar → falla (hoy los `commit` intermedios dejan catálogos y usuarios).
- [x] 5.3 GREEN: `seed()` con una sola sesión y transacción (`with Session(engine) as session, session.begin():`), sin `commit` intermedios (D7). Ejecutar `pytest tests/integration/test_seed.py tests/integration/test_seed_schema_check.py` → verde.
- [x] 5.4 REFACTOR: revisión de reglas duras sobre `seed.py` y `conftest.py`: sin bucles duplicados por entidad (una sola función de reconciliación), type hints en funciones públicas, sin imports desde `app/modules/*/service|router`, sin cambios en `backend/app/modules/` (`git diff --stat backend/app/modules` vacío) ni en `backend/alembic/` (`alembic heads` → `002`, solo contra una base `*_test`). Ejecutar la suite completa → 0 failed.

## 6. Documentación

- [x] 6.1 `knowledge-base/04_modelo_de_datos.md` §Seed data inicial: dejar una sola tabla con el contenido objetivo, ya implementado (estados con `EN_CAMINO`(4) y `CANCELADO`(6), formas `MERCADOPAGO/EFECTIVO/TRANSFERENCIA`, admin `Admin1234!`), las filas de deuda DT-03 (parte seed) y DT-23 marcadas como resueltas por C-07, la regla de `TARJETA` deshabilitada en bases viejas y la corrección de la nota DT-09 (la idempotencia real llega con C-07; antes fallaba la segunda corrida). Verificar con `grep -n "EN_CAMINO\|TARJETA\|Admin1234" knowledge-base/04_modelo_de_datos.md`.
- [x] 6.2 `knowledge-base/09_decisiones_y_supuestos.md`: DT-23 resuelta por C-07; DT-03 con la parte de seed resuelta por C-07 y la FSM pendiente de C-09. `knowledge-base/10_preguntas_abiertas.md`: IN-03 (catálogo con `EN_CAMINO` hecho en C-07; transiciones en C-09) e IN-16 (catálogo hecho; `TARJETA` deshabilitada). Verificar con `grep -n "C-07" knowledge-base/09_decisiones_y_supuestos.md knowledge-base/10_preguntas_abiertas.md`.
- [x] 6.3 `backend/README.md`: credenciales del seed (admin `Admin1234!`, usuarios de prueba), que el seed es idempotente y corrige catálogos viejos en el lugar, y el procedimiento para recrear la base y tener el admin nuevo (reset → `alembic upgrade head` → seed). Verificar con `grep -n "Admin1234" backend/README.md`.
- [x] 6.4 `CHANGES.md`: en `[C-09]` agregar «Punto de partida (C-07): el catálogo ya tiene `EN_CAMINO`(4) y `CANCELADO`(6); la fixture de tests usa `seed_catalogos`; `PATCH /estado` a `EN_CAMINO` responde 409 hasta que C-09 agregue las transiciones»; en `[C-12]` anotar que `TARJETA` quedó deshabilitada y que la tarjeta es un medio dentro de `MERCADOPAGO`. No marcar `[x]` en C-07 (lo hace el archive). Verificar con `grep -n "Punto de partida (C-07)" CHANGES.md`.

## 7. Verificación integral

- [x] 7.1 Suite completa desde `backend/`: `pytest` → 0 failed; registrar el total (338 de base + nuevos) y compararlo con 0.1. **Resultado: 357 passed, 0 failed (338 + 19 nuevos: 17 en `test_seed.py`, 2 en `test_pedidos.py`); cobertura total 85 %, `app/db/seed.py` 96 %.**
- [x] 7.2 `openspec validate "c-07-datos-seed-y-catalogos" --strict` → válido; recorrer cada escenario de `specs/backend-db-seed` y `specs/backend-db-migrations` y anotar acá el test que lo cubre, sin escenarios huérfanos.

### Notas de implementación (apply)

- Desvío menor (D8): el seed de demo usa tablas de datos (`USUARIOS_DEMO`, `CATEGORIAS_DEMO`, `INGREDIENTES_DEMO`, `PRODUCTOS_DEMO`) y un helper genérico `_obtener_o_crear` en lugar de variables sueltas por entidad; los valores no cambiaron. `seed_admin` y los usuarios de prueba comparten `_crear_usuario_si_falta`.
- La conversión a una sola transacción (5.3) se hizo después de 4.2, que conservó los `commit` intermedios hasta el RED de 5.2.
- Mapa escenario → test (7.2):
  - Roles sobre base vacía → `test_seed_sobre_base_nueva_deja_exactamente_los_cuatro_roles_con_su_nombre` y `test_seed_sobre_base_migrada_inserta_los_cuatro_roles_de_catalogo`.
  - Base con COCINA asignado → `test_seed_no_toca_el_rol_cocina_ni_su_asignacion`.
  - Estados sobre base vacía / EN_CAMINO disponible → `test_seed_sobre_base_nueva_deja_los_seis_estados_con_su_orden_y_terminales`.
  - Formas de pago sobre base vacía → `test_seed_sobre_base_nueva_deja_solo_las_tres_formas_de_pago_habilitadas`.
  - Pedido con TRANSFERENCIA → `test_pedidos.py::TestCrearPedido::test_crear_pedido_con_transferencia_del_catalogo_del_seed`.
  - Forma de pago del catálogo deshabilitada → `test_seed_respeta_efectivo_deshabilitado`.
  - Base con catálogo de estados viejo / Pedidos existentes conservan su estado → `test_seed_sobre_catalogo_de_estados_viejo_lo_reconcilia_y_conserva_pedidos_e_historial` (y `test_seed_corrige_la_descripcion_de_un_rol_del_catalogo_editada_a_mano` para roles).
  - Base con TARJETA y un pedido → `test_seed_sobre_tarjeta_habilitada_con_un_pedido_la_deshabilita_sin_borrarla`.
  - Pedido nuevo con TARJETA rechazado → `test_pedidos.py::TestCrearPedido::test_crear_pedido_con_tarjeta_deshabilitada_por_el_seed_responde_400_y_no_crea_pedido`.
  - Admin sembrado con la contraseña de la spec / La contraseña vieja no sirve → `test_seed_sobre_base_nueva_crea_el_admin_con_rol_admin_y_la_contrasena_de_la_spec`.
  - Admin existente con otra contraseña → `test_seed_con_admin_existente_no_cambia_su_hash_ni_sus_roles_y_no_crea_otro` y `test_seed_con_admin_dado_de_baja_no_crea_otro_ni_lo_modifica`.
  - Demo sobre base vacía → `test_seed_sobre_base_nueva_crea_los_datos_de_demostracion_con_sus_relaciones`.
  - Producto de demo dado de baja → `test_seed_no_recrea_un_producto_de_demo_dado_de_baja`.
  - Dos corridas seguidas → `test_seed_dos_corridas_seguidas_la_segunda_termina_sin_error` y `test_seed_dos_corridas_seguidas_dejan_las_tablas_identicas`.
  - Corrida sobre base reconciliada → `test_seed_sobre_base_reconciliada_la_corrida_siguiente_no_cambia_ninguna_fila`.
  - Falla a mitad de la corrida → `test_seed_que_falla_a_mitad_de_corrida_deja_la_base_como_estaba`.
  - backend-db-migrations «Base sin migrar» → `test_seed_schema_check.py::test_seed_sobre_base_sin_migrar_...` (y «version vieja»); «Base migrada» → los tests de contenido de `test_seed.py`.

## Workflow follow-up

- Verificación (`openspec-verify`) contra specs, design y tasks.
- Commit y push solo cuando el usuario lo pida (conventional commits, sin atribución de IA; `engram sync` antes del push).
- `/opsx:archive` y marcar `[x]` en `CHANGES.md`.
- Re-sembrar la base de desarrollo (lo hace el usuario a mano): `python -m app.db.seed` desde `backend/`, o reset → `alembic upgrade head` → seed para tener el admin con `Admin1234!`.
