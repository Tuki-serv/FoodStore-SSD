# Design — C-07 `datos-seed-y-catalogos`

## Context

- Motivación y alcance: ver `proposal.md`. Requisitos: `specs/backend-db-seed/spec.md` (nueva) y el delta de `specs/backend-db-migrations/spec.md`.
- Estado del código relevante (leído el 2026-11-10, rama `dev`):
  - `backend/app/db/seed.py`: una función `seed(engine=None)` que llama a `ensure_schema_ready` (C-06) y hace **cinco `commit`** en distintos puntos. Busca por código/email antes de insertar roles, usuarios, estados, formas de pago y unidades, pero **crea categorías, ingredientes, productos y sus relaciones sin verificar nada**: una segunda corrida choca con `uq_categorias_nombre_activo` (índice único parcial de la `001`) y aborta. Las filas existentes nunca se corrigen (solo «insertar si falta»). Admin con `admin123`; estados sin `EN_CAMINO` y `CANCELADO.orden = 99`; formas `EFECTIVO`, `MERCADOPAGO` (`"Mercado Pago (QR/Transferencia)"`), `TARJETA`.
  - Catálogos con PK semántica `codigo` (`rol`, `estado_pedido`, `forma_pago`); `rol.nombre` con índice único `ix_rol_nombre`. `pedidos.forma_pago_codigo` y `pedidos.estado_codigo` (y `historial_estado_pedido.estado_desde/hacia`) son FK a esos códigos. `forma_pago.habilitado` existe y `PedidoService._validar_forma_pago` ya rechaza con 400 «Forma de pago no está habilitada».
  - Uso de los códigos en `backend/app/`: **ningún archivo referencia `TARJETA`, `EN_CAMINO` ni el `orden` de los estados** (`grep` sobre `app/`, excluido el seed). La FSM (`PedidoService.TRANSICIONES`) está hardcodeada con 5 estados; estadísticas agrupan por `forma_pago_codigo` sin listar códigos; pagos mapean `CONFIRMADO`/`EN_PREP`/`CANCELADO` a eventos.
  - Tests: `backend/tests/conftest.py::_create_test_admin` siembra **su propia copia** de catálogos dentro de la sesión de cada test (roles + `COCINA`, 5 estados con `CANCELADO = 99`, solo `EFECTIVO`) y el admin de tests `admin@foodstore.com/admin123`. `tests/integration/test_seed_schema_check.py` (3 tests sobre la base auxiliar `foodstore_migrations_test`, fixture `migrations_db`) cubre el chequeo de esquema y los 4 roles. Varios tests fijan la cabeza `"002"` como literal (`test_migrations.py`, `test_reset.py`, `test_seed_schema_check.py`). Suite actual: 338 passed.
- Restricciones: reglas duras de `CLAUDE.md` (capas, DRY, type hints, migración para todo cambio de esquema, sin secretos, la spec manda), configuración explícita sin defaults ocultos (C-01), fechas con `app/core/timestamps.py`, Strict TDD en apply, tests solo sobre bases `*_test`, nunca seedear ni resetear la base de desarrollo desde los tests, governance ALTO.

## Goals / Non-Goals

**Goals:**
- Que el contenido de los catálogos sea exactamente el de la spec en una base nueva, y que el seed lleve una base vieja a ese contenido sin perder pedidos.
- Idempotencia comprobable por test (comparación fila a fila entre dos corridas) y seed atómico.
- Una sola definición de los catálogos, usada por el seed y por la fixture de tests.

**Non-Goals:**
- Transiciones, permisos y alias de la FSM con `EN_CAMINO` (C-09). El catálogo tendrá `EN_CAMINO`, pero `TRANSICIONES` no lo incluye hasta C-09.
- Validar en código la lista de formas de pago de un pedido (sigue siendo «existe y está habilitada»).
- Ocultar o filtrar `TARJETA` en estadísticas o listados de pedidos viejos.
- Cambiar el admin de tests de `conftest.py` (`admin123`): es una fixture, no el seed.
- Guardias de entorno para el seed (ver Open Questions 3).

## Decisions

Cada decisión indica si **cambia** el comportamiento actual del código.

### D1. Catálogos solo por el seed; sin migración de datos (decisión (a))
Los catálogos (roles, estados, formas de pago) se cargan y reconcilian **solo** desde `python -m app.db.seed`. No hay migración `003`: no hay ningún cambio de esquema (las columnas `orden`, `es_terminal`, `habilitado` ya existen) y la KB define el seed como obligatorio tras migrar (`knowledge-base/04` §Seed, CE-05).
- *Alternativa descartada — migración de datos `003` con `INSERT ... ON CONFLICT`/`UPDATE`*: daría catálogos a cualquier base migrada sin depender del seed, pero (1) mezcla datos con esquema y su `downgrade` tendría que borrar filas referenciadas por pedidos (o no hacer nada, rompiendo la reversibilidad que exige `backend-db-migrations`); (2) rompe tests existentes sin necesidad: la cabeza literal `"002"` en `test_migrations.py` (tres tests), `test_reset.py` y `test_seed_schema_check.py` (`esperada: 002`), y `test_detalle_pedido_guarda_y_lee_los_arrays_de_personalizacion_en_orden`, que inserta `PENDIENTE` y `EFECTIVO` después de `upgrade head` y chocaría con la PK; (3) dos fuentes de verdad para el mismo catálogo (migración y seed).
- *Alternativa descartada — migración que solo corrija datos viejos (`orden=99`, `TARJETA`)*: mismos costos, y las bases viejas son solo de desarrollo (el seed ya las corrige, D3).
- Cambio respecto del código: no (el seed ya era la fuente).

### D2. Catálogos declarados como datos, separados de la lógica
`seed.py` declara los catálogos como constantes tipadas (tuplas de registros inmutables, por ejemplo `ROLES`, `ESTADOS_PEDIDO`, `FORMAS_PAGO`, con los códigos, `orden`, `es_terminal`, nombres y descripciones) y los recorre con **una** función genérica de reconciliación por clave (`codigo` para catálogos, `email`/`nombre`/`simbolo` para el resto), en lugar de un bucle copiado por entidad (regla 5, DRY). La estructura pública queda:
- `seed_catalogos(session: Session) -> None`: roles, estados y formas de pago (D3, D4). Solo hace `add`/`flush`; no hace `commit`.
- `seed_admin(session)`, `seed_demo(session)`: admin (D6) y datos de demostración (D8).
- `seed(engine: Engine | None = None) -> None`: chequeo de esquema (C-06) + las tres funciones en una transacción (D7).
El seed sigue en `app/db/` usando `Session` directamente, como `migrations.py` y `reset.py`: es tooling de arranque, no una capa de negocio. *Alternativa descartada*: pasar por UoW/repositories/services. Los services aplican reglas de negocio y permisos que no corresponden a la carga inicial (por ejemplo, `PedidoService` no expone alta de catálogos) y obligaría a crear repositories/services de catálogo que la app no usa. Cambio respecto del código: sí (estructura interna; la interfaz `seed(engine)` y `python -m app.db.seed` no cambian).

### D3. Reconciliación de catálogos sobre bases existentes (decisión (b))
Para cada registro del catálogo: si no existe, se inserta; si existe, se comparan los campos del catálogo y **solo** se asignan los que difieren (así SQLAlchemy no emite `UPDATE` cuando no hay diferencias, lo que mantiene la idempotencia de D5).
- Roles: se reconcilian `nombre` y `descripcion`. `COCINA` (y cualquier otro rol fuera del catálogo) no se toca: ni se borra ni se modifica (DD-23).
- Estados: se reconcilian `descripcion`, `orden` y `es_terminal`. `CANCELADO.orden` pasa de 99 a 6; `EN_CAMINO`(4) se inserta. Los pedidos y el historial no se tocan: los códigos no cambian.
- Formas de pago: se reconcilia `descripcion`; `habilitado` se fija en `true` **solo al insertar**: en una fila existente no se cambia (es un interruptor operativo, «se puede deshabilitar sin borrar», `knowledge-base/04`).
- Formas de pago **fuera del catálogo** (`TARJETA`): se ponen en `habilitado = false` y no se borran. Hay pedidos que las referencian por FK (sin `ON DELETE CASCADE`: el borrado falla), y el historial de pedidos y las estadísticas de ingresos deben seguir leyendo esos pedidos. Así ningún pedido nuevo puede usarlas (400 en `_validar_forma_pago`). *Alternativas descartadas*: borrar `TARJETA` (falla por FK o exige reasignar pedidos); renombrar `TARJETA` a `TRANSFERENCIA` (cambiaría el significado histórico de los pedidos pagados con tarjeta); borrarla solo si no tiene pedidos (comportamiento condicional; ver Open Questions 1).
- Descripción de `MERCADOPAGO`: pasa a «Mercado Pago» (la actual, «Mercado Pago (QR/Transferencia)», se confunde con `TRANSFERENCIA`).
- Cambio respecto del código: **sí** (hoy el seed nunca corrige filas existentes ni deshabilita nada).

### D4. Contenido exacto de los catálogos
| Catálogo | Contenido |
|---|---|
| Rol | `ADMIN` «Administrador», `STOCK` «Gestor de Stock», `PEDIDOS` «Gestor de Pedidos», `CLIENT` «Cliente» (descripciones actuales) |
| EstadoPedido | `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), `EN_CAMINO`(4), `ENTREGADO`(5, terminal), `CANCELADO`(6, terminal) |
| FormaPago | `MERCADOPAGO` «Mercado Pago», `EFECTIVO` «Pago en efectivo», `TRANSFERENCIA` «Transferencia bancaria»; habilitadas al crearse |
Fuente: `knowledge-base/04` §Seed (spec). Cambio respecto del código: **sí** (`EN_CAMINO`, `orden` de `CANCELADO`, `TRANSFERENCIA` en lugar de `TARJETA`).

### D5. Qué significa «idempotente» (decisión (c))
Definición verificable: sobre una base ya sembrada, una nueva corrida **termina sin error y no cambia ninguna fila** de las tablas que el seed escribe (`rol`, `estado_pedido`, `forma_pago`, `usuario`, `usuario_rol`, `unidades_medida`, `categorias`, `ingredientes`, `productos`, `producto_categoria`, `producto_ingrediente`), incluidas las columnas de auditoría (`created_at`, `updated_at`) y los hashes de contraseña. El test toma una «foto» de esas tablas (todas las columnas, ordenadas por PK) después de la primera corrida y la compara con la foto después de la segunda. Lo mismo vale tras reconciliar una base vieja: la corrida siguiente no cambia nada. Cambio respecto del código: **sí** (hoy la segunda corrida falla).

### D6. Contraseña del admin (decisión (d))
`Admin1234!` se declara como constante en `seed.py` (`ADMIN_PASSWORD_DESARROLLO`), con un comentario que la identifica como credencial de desarrollo fijada por la spec y documentada en la KB y en `backend/README.md`. No es un secreto: es público por definición (está en la spec y en la KB), igual que `cliente123` y compañía; la regla 10 se refiere a credenciales de servicios (MercadoPago, JWT, Cloudinary). Se guarda solo el hash bcrypt (`hash_password`, cost ≥ 12).
- Si `admin@foodstore.com` ya existe (activo o dado de baja), **no se modifica**: no se pisa la contraseña de nadie. En una base de desarrollo vieja el admin sigue con `admin123` hasta recrear la base (Migration Plan). Ver Open Questions 2.
- *Alternativa descartada — variable `SEED_ADMIN_PASSWORD` en `Settings`*: agregaría una variable obligatoria a los cuatro archivos `.env*` y a `Settings` para un valor que la spec fija; no aporta seguridad en desarrollo, y en producción la contraseña se cambia después del primer login de todas formas. Si se quisiera un seed apto para producción, la variable correcta sería otra decisión (Open Questions 3).
- Cambio respecto del código: **sí** (`admin123` → `Admin1234!` en bases nuevas).
- **Sin variables de entorno nuevas** en este change: no hace falta `todoAMd/env-templates-C-07.md` ni tocar archivos `.env*`.

### D7. Seed atómico
`seed()` abre una sola sesión y una sola transacción (`with Session(engine) as session, session.begin():`), llama a `seed_catalogos`, `seed_admin` y `seed_demo` (que solo hacen `add`/`flush`) y confirma al final. Cualquier excepción revierte todo. Los IDs necesarios para relaciones se obtienen con `flush`. Cambio respecto del código: **sí** (hoy hay cinco `commit` y una falla en los datos demo deja catálogos y usuarios ya confirmados).

### D8. Datos de demostración (decisión (e))
Hoy el seed siembra, además de catálogos y admin: 3 usuarios de prueba (`cliente@`/`cliente123` CLIENT, `pedidos@`/`pedidos123` PEDIDOS, `stock@`/`stock123` STOCK), 7 unidades de medida, 6 categorías (3 raíz + 3 subcategorías), 12 ingredientes (con `es_alergeno`) y 6 productos con sus relaciones `producto_categoria` y `producto_ingrediente`. **Se mantienen todos, con los mismos valores**: US-029 los admite («y demo»), sirven a la demo de la rúbrica y al frontend de Fase 1, y la KB ya los documenta como extra no especificado.
- Se vuelven idempotentes: cada registro se busca por su clave natural (`email` para usuarios, `simbolo` para unidades, `nombre` para categorías, ingredientes y productos) **incluyendo los dados de baja lógica**; si existe, no se crea ni se modifica. Así el seed no resucita lo que un admin dio de baja ni pisa lo que editó (los índices únicos son parciales, así que una búsqueda solo entre activos crearía un duplicado del borrado).
- Las relaciones (rol de cada usuario de prueba, subcategoría → padre, producto → categorías e ingredientes) se crean **solo cuando el seed crea la entidad dueña** en esa corrida; nunca se agregan a entidades preexistentes.
- *Alternativa descartada*: separar la demo detrás de un flag (`--sin-demo`) o de otra variable: no lo pide ninguna historia; queda como mejora futura.
- Cambio respecto del código: **sí** en idempotencia; no en contenido.

### D9. La fixture de tests usa el catálogo del seed
`tests/conftest.py::_create_test_admin` reemplaza sus listas de roles, estados y formas de pago por `seed_catalogos(session)` (sobre la sesión del test, dentro del savepoint) y mantiene el resto igual: el admin de tests `admin@foodstore.com/admin123` y el rol extra `COCINA` que agrega hoy (DD-23: no se toca; ningún test lo usa, ver Open Questions 4). Efecto en los tests: `CANCELADO.orden` 99 → 6, aparece `EN_CAMINO`, y aparecen `MERCADOPAGO` y `TRANSFERENCIA` además de `EFECTIVO`. Revisado: ningún test existente depende de que esas formas no existan ni del `orden` (los tests usan `EFECTIVO`, `PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `ENTREGADO`, `CANCELADO`). Sin esto C-09 tendría que tocar la fixture para tener `EN_CAMINO`, y habría dos copias del catálogo (regla 5). Cambio respecto del código: sí (solo tests).

### D10. Qué se rompe y ajuste mínimo
Análisis del impacto de agregar `EN_CAMINO`, cambiar `orden` y reemplazar `TARJETA`:
- **Código de la app**: nada se rompe; ningún archivo de `app/` referencia `TARJETA`, `EN_CAMINO` ni `orden`. Dos cambios observables, ambos deseados y sin test que los fije hoy:
  - `PATCH /pedidos/{id}/estado` con `estado_hacia = "EN_CAMINO"`: hoy responde 400 «Estado destino inválido» (el estado no existe); con el catálogo nuevo existe y responde 409 de transición inválida, porque `TRANSICIONES` no lo incluye. C-09 agrega las transiciones. **No se toca la FSM en C-07.**
  - Crear un pedido con `TARJETA` en una base reconciliada responde 400 «Forma de pago no está habilitada» (antes, 201).
- **Tests existentes**: ninguno se rompe. `test_seed_schema_check.py` sigue verde (los 4 roles se mantienen; la cabeza sigue en `002` porque no hay migración, D1). La fixture cambia por D9 sin afectar aserciones.
- **Ajuste mínimo**: ninguno en código de la app. Solo la fixture (D9) y los tests nuevos.

### D11. Tests
Nuevo `backend/tests/integration/test_seed.py`, sobre la base auxiliar `foodstore_migrations_test` (fixture `migrations_db` de `tests/integration/conftest.py`: vacía antes y después de cada test; guardia `_test`): cada test hace `upgrade_to_head`, prepara datos con SQL o modelos si hace falta, llama a `seed(migrations_db)` y verifica con consultas. Nunca contra la base de desarrollo. Los escenarios HTTP de la spec (pedido con `TRANSFERENCIA`, pedido con `TARJETA` deshabilitada) van en `tests/integration/test_pedidos.py` sobre `foodstore_test` con `client`/`session`, llamando a `seed_catalogos(session)` (la fixture ya lo hace, D9). Literales independientes (códigos, órdenes, conteos escritos a mano, no importados de las constantes del seed). La contraseña se comprueba con `verify_password` sobre el hash guardado (el login HTTP del admin de la base auxiliar no es alcanzable desde `client`, que usa `foodstore_test`).

### D12. `seed.py` y fechas
Las entidades con auditoría ya toman `created_at`/`updated_at` de `app/core/timestamps.py` vía mixins; el seed no asigna fechas a mano. No hay FK nuevas (la regla BIGINT hacia `usuario.id` no aplica).

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-10
- Mockups: N/A

## Risks / Trade-offs

- [Bases de desarrollo viejas mantienen el admin con `admin123`] → Documentado en `backend/README.md` y en el resumen que imprime el seed; la forma limpia es recrear la base (Migration Plan). Ver Open Questions 2.
- [`TARJETA` queda en la tabla, deshabilitada] → Los listados que muestren el catálogo completo (no existe endpoint hoy) deberán filtrar por `habilitado`. Las estadísticas de ingresos siguen mostrando pedidos viejos con `TARJETA`, que es lo correcto históricamente.
- [El seed corrige `nombre`/`descripcion` de roles y estados editados a mano] → Son catálogos de la spec, no datos operativos; `habilitado` sí se respeta (D3).
- [El admin de tests (`admin123`) difiere del admin del seed (`Admin1234!`)] → Son cosas distintas (fixture vs seed); se aclara en el docstring de la fixture. Unificarlos obligaría a tocar todos los helpers de login sin beneficio.
- [Una búsqueda por nombre que incluye dados de baja puede encontrar varias filas con el mismo nombre (una activa y varias borradas)] → Basta con que exista alguna para no crear; se usa `.first()` sobre la consulta.
- [`EN_CAMINO` existe en el catálogo pero la FSM no lo usa hasta C-09] → Ventana corta (C-09 sigue en el camino crítico); el comportamiento es un 409 explícito (D10).

## Migration Plan

1. Sin migración ni variables nuevas. Tras el merge, en desarrollo: `alembic upgrade head` (sigue en `002`) y `python -m app.db.seed` desde `backend/`. El seed corrige los catálogos en el lugar y agrega los datos que falten.
2. Para tener el admin con `Admin1234!` en una base vieja: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed` (se pierden los datos, que en desarrollo son los del seed).
3. Rollback: revertir el código. Las filas que el seed agregó o corrigió (`EN_CAMINO`, `TRANSFERENCIA`, `orden` 6, `TARJETA` deshabilitada) son compatibles con el código anterior; para volver a habilitar `TARJETA`, `UPDATE forma_pago SET habilitado = true WHERE codigo = 'TARJETA'`.

## Open Questions

Ninguna bloquea el apply: cada una tiene un valor por defecto ya aplicado en specs y tasks. Se reportan para que el usuario las confirme en la revisión (governance ALTO).
1. **`TARJETA` sin pedidos: ¿deshabilitar o borrar?** Por defecto, deshabilitar siempre (D3), aunque ningún pedido la use. Borrarla cuando no tiene referencias dejaría el catálogo «exacto» también en bases viejas, a cambio de un comportamiento condicional.
2. **Admin existente con `admin123`.** Por defecto el seed no pisa contraseñas (D6). La alternativa (forzar `Admin1234!` en el usuario `admin@foodstore.com` existente) cambiaría la contraseña de un usuario real si el seed se corriera sobre una base con datos.
3. **Seed en `ENVIRONMENT=production`.** Hoy, y después de C-07, el seed crea en cualquier entorno el admin con una contraseña pública y usuarios de prueba con contraseñas débiles (`stock123`). La KB dice «cambiar en producción», pero nada lo obliga. Opciones para un change posterior (o para C-25, cierre): que en producción el seed siembre solo catálogos, o que exija la contraseña del admin por variable. Queda fuera de C-07.
4. **`COCINA` en la fixture de tests.** `conftest.py` crea hoy el rol `COCINA` aunque ningún test lo usa; por DD-23 se mantiene sin cambios. Se resolverá con C-26/C-27.
5. **Contradicción en la KB a corregir en este change**: `knowledge-base/04` (nota DT-09) afirma que el seed «es idempotente (verifica existencia antes de insertar)», pero el código actual no verifica categorías, ingredientes ni productos y la segunda corrida falla. La tarea de documentación corrige la nota.
