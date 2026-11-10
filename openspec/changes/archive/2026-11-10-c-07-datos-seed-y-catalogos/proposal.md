# Proposal — C-07 `datos-seed-y-catalogos`

## Why

El seed (`backend/app/db/seed.py`) siembra catálogos que no son los de la spec (integrador v5.0, DD-16/DD-17): a `estado_pedido` le falta `EN_CAMINO` y `CANCELADO` tiene `orden = 99` (deuda DT-03, parte seed; IN-03), `forma_pago` trae `TARJETA` en lugar de `TRANSFERENCIA` y el admin se crea con `admin123` en lugar de `Admin1234!` (deuda DT-23; IN-16). Además, aunque la KB lo da por idempotente (nota de DT-09 en `knowledge-base/04`), solo verifica existencia para roles, usuarios, estados, formas de pago y unidades: las categorías, ingredientes y productos de demostración se insertan siempre, así que **una segunda corrida falla** contra el índice único `uq_categorias_nombre_activo`. Sobre una base que ya tiene los datos viejos, el seed tampoco corrige nada: solo inserta lo que falta.

C-09 (FSM de 6 estados) necesita `EN_CAMINO` en el catálogo, y C-09/C-12 necesitan `TRANSFERENCIA` (confirmación manual de `EFECTIVO`/`TRANSFERENCIA`, DD-22). Por eso C-07 va en el camino crítico, justo después de C-06.

## What Changes

- **Catálogos canónicos de la spec**, cargados por el seed (sin migración nueva):
  - Roles: `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`. `COCINA` no se siembra ni se borra si existe (DD-23).
  - Estados de pedido: `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), **`EN_CAMINO`(4)**, `ENTREGADO`(5, terminal), `CANCELADO`(**6**, terminal).
  - Formas de pago: `MERCADOPAGO`, `EFECTIVO`, **`TRANSFERENCIA`**, habilitadas al crearse.
- **Reconciliación de bases existentes**: el seed corrige las filas de catálogo que ya existen con valores viejos (`CANCELADO.orden = 99` pasa a `6`, descripciones) y agrega las que faltan. `TARJETA` **no se borra** (pedidos existentes la referencian por FK): se **deshabilita**, así ningún pedido nuevo puede usarla. **BREAKING** (API, solo en bases de desarrollo con datos viejos): crear un pedido con `forma_pago_codigo = "TARJETA"` pasa a responder 400 «Forma de pago no está habilitada».
- **Admin inicial con `Admin1234!`** (valor fijado por la spec; credencial de desarrollo documentada, no un secreto). Un admin que ya existe no se modifica: en una base de desarrollo vieja sigue con `admin123` hasta que se recree la base (reset → `alembic upgrade head` → seed).
- **Idempotencia real y verificable**: correr el seed dos veces deja la base exactamente igual que después de la primera corrida, sin errores. Los datos de demostración se insertan solo si no existen (incluidos los dados de baja lógica, para no resucitar lo que un admin borró).
- **Seed atómico**: toda la corrida es una sola transacción; si algo falla, no queda nada a medias.
- **Datos de demostración se mantienen**: usuarios de prueba (`cliente@`, `pedidos@`, `stock@foodstore.com`), unidades de medida, categorías, ingredientes y productos, como hoy.
- **Una sola fuente de los catálogos**: la fixture de tests (`backend/tests/conftest.py`) deja de definir su propia copia de roles/estados/formas de pago (hoy con `CANCELADO = 99` y solo `EFECTIVO`) y usa la función de catálogos del seed. El admin de tests (`admin123`) no cambia.
- **Documentación**: `knowledge-base/04`, `09` (DT-03 parte seed, DT-23), `10` (IN-03, IN-16), `CHANGES.md` y `backend/README.md` (credenciales y cómo re-sembrar).

Fuera de alcance: las transiciones de la FSM con `EN_CAMINO` y los permisos por rol y forma de pago (C-09); el descuento de stock (C-10); el rol `COCINA`, el KDS y el WebSocket (Fase 2, DD-23); el flujo de pago con tarjeta (`CardPayment`, C-12: la tarjeta es un medio dentro de `MERCADOPAGO`, no una forma de pago propia). No hay cambios de esquema ni variables de entorno nuevas.

## Capabilities

### New Capabilities
- `backend-db-seed`: qué datos iniciales siembra `python -m app.db.seed` y cómo se comporta. Cubre los catálogos canónicos (roles, estados de pedido con orden y terminales, formas de pago), la reconciliación de catálogos existentes (orden y descripciones corregidos, formas de pago fuera del catálogo deshabilitadas sin borrarse, `COCINA` intacto), el admin inicial, los usuarios y datos de demostración, la idempotencia y la atomicidad.

### Modified Capabilities
- `backend-db-migrations`: el requisito «El seed exige el esquema al día» cambia su escenario «Base migrada» («inserta los datos de catálogo como hasta ahora») para remitir a los catálogos canónicos de `backend-db-seed`.

## Impact

- **Código** (todo bajo `backend/`): `app/db/seed.py` se reorganiza (catálogos como datos declarados + funciones `seed_catalogos`, admin, demo; una transacción). `tests/conftest.py` usa `seed_catalogos`. Nuevo `tests/integration/test_seed.py`. Ningún service, repository ni router cambia: el código actual no referencia `TARJETA` ni `EN_CAMINO` ni el `orden` de los estados.
- **Base de datos**: sin migración nueva (la cabeza sigue en `002`); los catálogos son datos, no esquema.
- **Operación**: en bases de desarrollo viejas, `python -m app.db.seed` corrige los catálogos en el lugar. Para tener el admin con `Admin1234!`, recrear la base (`python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed`).
- **Configuración**: ninguna variable nueva; no se tocan archivos `.env*`.
- **Roadmap**: desbloquea C-09 (EN_CAMINO en catálogo, conftest con catálogo canónico) junto con C-08.
- **Governance**: ALTO. El usuario revisa estos artefactos antes del apply.
