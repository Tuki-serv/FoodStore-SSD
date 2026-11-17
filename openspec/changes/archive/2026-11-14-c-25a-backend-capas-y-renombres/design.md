# Design — C-25a `backend-capas-y-renombres`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/backend-architecture` (capacidad nueva; ninguna capacidad existente cambia su comportamiento).

Punto de partida en el código (`dev`, 2026-11-14, C-12 implementado y sin archivar):

- **Construcción de services**: seis routers definen `get_<x>_service(session: Session = Depends(get_session))` (`categorias`, `ingredientes`, `productos`, `unidades_medida`, `pagos`, `pedidos`); `usuarios` y `direcciones_entrega` lo hacen con `UsuarioUnitOfWork` + `get_uow`; `estadisticas` con `PedidoUnitOfWork = Depends()`, que funciona solo porque `PedidoUnitOfWork.__init__` declara `session: Session = Depends(get_session)`. `get_uow` (usuarios) y `get_auth_uow` (auth) viven en `unit_of_work.py` y usan `SessionDep`.
- **Constructores de services**: los de catálogo y direcciones heredan `BaseService(session, uow, repo_name, model)`; `PaymentService(session, construir_pedidos, pasarela)` abre varias `PagoUnitOfWork` por operación; `PedidoService(uow, al_confirmar)` se arma con `construir_pedido_service(session)`; `UsuarioService(uow)`, `EstadisticasService(uow)`, `AuthService(uow, intentos)`.
- **Tests acoplados a rutas internas**: `conftest.py` sobreescribe `get_session` (sigue siendo el único punto de inyección de la sesión); `test_pago_webhook_transaccion.py` sobreescribe `pagos.router.get_payment_service` y parchea `pagos.router.manager`; `test_rbac_matriz.py` parchea `app.core.cloudinary.router.subir_imagen/eliminar_imagen`; `test_categoria.py` parchea `categorias.service.eliminar_imagen`; ~20 archivos importan `app.core.deps`; `test_models_registry.py` descubre `*/models.py` por filesystem (robusto a fusiones); `schema_expectations.TABLAS_ESPERADAS` fija las 18 tablas.
- **Errores**: `core/errors.AppError(status_code, code, detail, field, headers)` + `app_error_handler` ya existen (C-11/C-12) y producen el mismo cuerpo que `http_exception_handler` cuando `code = f"HTTP_{status}"`.
- **Alembic**: `env.py` solo importa `core.config` y `core.database`; las migraciones no importan módulos de negocio; los modelos declaran `__tablename__` explícito → mover clases de archivo no cambia el esquema.
- **Cobertura**: `pytest-cov` instalado; sin `.coveragerc` ni umbral; cobertura actual desconocida (se mide en la tarea 0.2).

## Goals / Non-Goals

**Goals:** cumplir las reglas duras 1–4 con tests de arquitectura estáticos que lo demuestren; dejar la estructura de módulos de la spec; hacerlo en pasos chicos, cada uno con la suite verde, sin cambiar el contrato HTTP ni el esquema; cobertura >60% con umbral automático y una prueba e2e del flujo de compra.

**Non-Goals:** cambiar comportamiento, URLs, cuerpos o códigos HTTP (solo se mueven piezas); rediseñar los constructores de services que reciben `Session` para abrir varias UoW (`BaseService`, `PaymentService`: se permite que el service reciba la sesión, no el router); tocar WebSocket/KDS más allá de sacar la consulta del router; agregar migraciones.

## Decisions

**D1 — `dependencies.py` por módulo como raíz de composición.**
Cada módulo con router tiene `modules/<m>/dependencies.py`, único archivo del módulo que importa `SessionDep`/`get_session` y arma `UoW → Service`. Expone funciones `get_<x>_service` y alias `XServiceDep = Annotated[XService, Depends(get_<x>_service)]`. Los `get_uow`/`get_auth_uow` salen de `unit_of_work.py` hacia el `dependencies.py` de su módulo. Los routers importan solo `XServiceDep`, schemas y las dependencias de auth (D2). Para `PedidoUnitOfWork` se quita el `Depends(get_session)` del constructor (la UoW queda libre de FastAPI) y `admin/dependencies.py` arma `EstadisticasService(PedidoUnitOfWork(session))`. `UsuarioServiceDep` pasa a `usuarios/dependencies.py` (sugerencia del verify de C-02); `auth/router.py` lo importa de ahí.
*Alternativa descartada:* un único `app/api/dependencies.py` global (vuelve a acoplar todos los módulos en un archivo) o usar `app.dependency_overrides` desde `main.py` (inyección invisible, difícil de leer y de testear).

**D2 — Dependencias de auth en `modules/auth/dependencies.py`; `core/deps.py` desaparece.**
`AccessClaims`, `oauth2_scheme(_opcional)`, `get_access_claims`, `get_current_user`, `get_current_active_user`, `get_current_roles`, `require_role` y `lector_privilegiado` se mueven tal cual (misma lógica, misma autoridad de roles desde la BD, C-08). Las primitivas puras (`core/permissions.py`, `core/security.py`) quedan en core. Se actualizan los ~20 importadores (app y tests) sin shim de compatibilidad (OQ-3).
El router de imágenes (`core/cloudinary/router.py`, `/uploads`, solo ADMIN) se mueve a `modules/admin/` porque depende de `require_role`; `core/cloudinary/service.py` y `schemas.py` quedan en core como adaptador de infraestructura (lo usan los services de catálogo).
*Alternativa:* dejar `require_role` en core detrás de un `Protocol` de "cargador de usuario" resuelto por override en `main.py`: preserva el path de import pero introduce un registro global implícito; más complejo que mover.

**D3 — Errores de dominio en services, sin `HTTPException`.**
Cada `raise HTTPException(status_code=S, detail=D, headers=H)` de services (y de `core/service.py`) pasa a `raise AppError(S, f"HTTP_{S}", D, headers=H)` (o al `ErrorCode` de negocio si ya lo tenía). Para no repetir el formateo del código se agrega en `core/errors.py` un helper `AppError.http(status_code, detail, *, headers=None)` (classmethod). `RefreshRechazado` pasa a heredar de `AppError` (el router lo sigue capturando para borrar la cookie). El cuerpo resultante es idéntico (`{detail, code: HTTP_<S>, field: null}`), por eso los tests existentes son la red de seguridad.

**D4 — `FiltrosPedidos` en `pedidos/filtros.py`.** Dataclass sin Pydantic ni FastAPI; la importan el repositorio (filtrado), el service y el router (como `Depends()` de query params). `schemas.py` deja de definirla.

**D5 — WebSocket de pedidos sin consulta en el router.** `PedidoService.puede_suscribirse(pedido_id, usuario_id) -> bool` (pedido existente, no eliminado y propio) reemplaza el bloque `PedidoUnitOfWork(session)` del endpoint; el endpoint recibe `PedidoServiceDep`. La lectura del token por cookie y los códigos 1008 no cambian (dueño de WS: C-26).

**D6 — Estructura de módulos (OQ-1, OQ-2).**

| Hoy | Después |
|---|---|
| `core/unit_of_work.py` | `core/uow.py` |
| `core/deps.py` | `modules/auth/dependencies.py` |
| `core/cloudinary/router.py` | `modules/admin/router.py` (`imagenes_router`) |
| `direcciones_entrega/` | `direcciones/` |
| `usuarios/router.py::admin_router` | `admin/router.py::admin_router` |
| `estadisticas/{router,service,schemas}` | `admin/{router (estadisticas_router), service, schemas}` |
| `detalles_pedido/`, `estados_pedido/`, `historiales_estado_pedido/` | `pedidos/{models,repository,schemas}.py` (clases agregadas) |
| `formas_pago/` | `pagos/{models,repository,schemas}.py` |
| `ingredientes/`, `unidades_medida/`, `health/` | se conservan (extras) |

Las fusiones agregan clases a los archivos existentes del módulo destino (no subpaquetes): el agregado `Pedido` (detalle, estado, historial) y el de `Pago` (forma de pago) quedan juntos, como el catálogo de la spec. Los prefijos y `tags` de los routers no cambian (`/api/v1/admin/usuarios`, `/api/v1/estadisticas`, `/api/v1/uploads`, `/api/v1/direcciones`). `main.py` monta los mismos routers desde sus nuevas rutas.

**D7 — Tests de arquitectura estáticos con `ast`.**
`tests/unit/test_arquitectura_capas.py` parsea (sin importar) cada `.py` de `app/` y recolecta los módulos importados (`import x`, `from x import y`, incluidos imports diferidos dentro de funciones). Reglas, una función de test parametrizada por archivo:
- R1 routers (`modules/**/router.py`): prohibidos `sqlmodel`, `sqlalchemy`, `app.core.database`, `app.core.uow`/`unit_of_work`, `*.repository`, `*.unit_of_work`, `*.models`.
- R2 `app/core/**`: prohibido `app.modules`.
- R3 `repository.py`: prohibidos `*.schemas`, `*.service`, `*.router`, `fastapi`; `unit_of_work.py`: prohibidos `*.service`, `*.router`, `fastapi`, `app.core.database`; `service.py`: prohibidos `*.router`, `*.dependencies`, `fastapi`; `models.py`: prohibidos `*.repository`, `*.service`, `*.router`, `fastapi`.
`tests/unit/test_estructura_modulos.py`: conjunto de carpetas de `app/modules` = objetivo + extras; existe `core/uow.py`, no existe `core/unit_of_work.py` ni `core/deps.py`.
El mensaje de cada fallo lista archivo e import ofensor (diagnóstico útil en RED). Cada regla se escribe justo antes del bloque que la vuelve verde (TDD vertical), no todas al principio.
*Alternativa:* `import-linter` (dependencia nueva y config aparte) o tests que importan módulos y miran `sys.modules` (frágiles por imports transitivos).

**D8 — Contrato de rutas congelado.** Antes del primer movimiento, `tests/integration/test_contrato_rutas.py` fija como literal el conjunto `{(método, path)}` de `create_app().routes` (HTTP y WebSocket), generado una vez desde el código actual y pegado a mano en el test. Se ejecuta después de cada paso: cualquier diferencia rompe. Los tests existentes (RBAC por matriz, contrato de pedidos, pagos) cubren cuerpos y códigos.

**D9 — Prueba e2e del flujo.** `tests/integration/test_flujo_compra_pago_entrega.py` (marker nuevo `e2e`, declarado en `pytest.ini`): solo HTTP con `TestClient` + fixture `mp_sdk` (único doble: SDK de MercadoPago). Pasos: ADMIN crea categoría y producto con stock; cliente se registra, inicia sesión y crea dirección; `POST /pedidos` (`MERCADOPAGO`); `POST /pagos/crear` con token de tarjeta → aprobado; notificación por webhook firmada (idempotente); PEDIDOS avanza `EN_PREP` → `EN_CAMINO` → `ENTREGADO`; el cliente ve el pedido `ENTREGADO`, el historial en orden y `GET /pagos/{pedido_id}` aprobado; el stock bajó una vez. Es un test de caracterización: se escribe en la red de seguridad y pasa contra el código actual (no hay RED; documenta y protege el flujo durante los movimientos).

**D10 — Cobertura.** `backend/.coveragerc`: `[run] source = app` (se mide todo `app`, sin `omit`); `[report] fail_under = 60`, `show_missing = true`, `skip_covered = false`. Comando documentado: `python -m pytest --cov --cov-report=term-missing` (lee `.coveragerc`). No se agrega `--cov` a `addopts` (OQ-5): cada corrida de un test suelto seguiría midiendo y fallaría por umbral. El chequeo por módulo de la rúbrica se hace leyendo el informe (`--cov-report=term` agrupado por paquete); los módulos <60% reciben tests de comportamiento por la API (no tests para "pintar" líneas).

**D11 — Sin migración ni cambio de tablas.** Ningún `__tablename__` cambia; `test_migrations` («esquema == modelos») y `test_models_registry` son la verificación. Si algún paso pareciera exigir migración, frenar y consultar.

## Risks / Trade-offs

- [Imports circulares al fusionar modelos (`pedidos` ↔ `pagos` ↔ `usuarios`)] → las relaciones ya usan strings; mover por clase y correr `test_models_registry` (proceso limpio) y `test_migrations` tras cada fusión.
- [Tests que parchean por string (`monkeypatch.setattr("app.…")`) siguen pasando en silencio si el path viejo aún existe] → se borran las carpetas/archivos viejos en el mismo paso del movimiento (sin shims) y el test de estructura impide que reaparezcan; buscar `grep -rn "<path viejo>" app tests` como verificación de cada tarea.
- [Cambio sutil de cuerpo/headers al pasar de `HTTPException` a `AppError` (p. ej. `WWW-Authenticate`)] → `AppError` conserva `headers`; los tests de auth y RBAC lo cubren; tarea de triangulación específica para 401 de login.
- [Cobertura por debajo del 60% en algún módulo] → se mide en la red de seguridad (0.2); si el hueco es grande se informa al usuario con la lista antes de escribir tests (checkpoint).
- [Conflicto con C-12 (sin archivar) al mover `pagos/router.py` y `formas_pago`] → C-12 ya está commiteado en `dev`; este change parte de ese código; sus delta specs no se tocan. Si el usuario edita C-12 en paralelo, rebasar antes del bloque B.
- [Suite con 4 rojos conocidos (`test_env_example.py`, tarea 2.4 de C-12)] → se registran como preexistentes en la red de seguridad y se excluyen del criterio «verde» (no se tocan `.env*`).
- [Change grande para una sesión] → tres bloques independientes (A capas, B renombres, C calidad) con checkpoint al cerrar cada uno; se pueden aplicar en sesiones separadas.

## Migration Plan

Refactor interno: no hay despliegue ni datos que migrar. Rollback = revertir los commits del change (el esquema y las URLs no cambian, así que no hay compatibilidad hacia atrás que cuidar). El frontend no se entera.

## Open Questions

- **OQ-1 — ¿Fusionar los módulos auxiliares en `pedidos` y `pagos`?** Por defecto: sí (`detalles_pedido`, `estados_pedido`, `historiales_estado_pedido` → `pedidos`; `formas_pago` → `pagos`), como clases en los archivos del módulo destino. Alternativa: dejarlos como subpaquetes (`pedidos/detalles/…`) o no tocarlos y documentarlos como extras.
- **OQ-2 — ¿Qué pasa con `ingredientes`, `unidades_medida` y `health`?** Por defecto: se conservan como módulos extra (la spec tiene el recurso `/ingredientes`; `unidades_medida` depende de PA-19). Alternativa: fusionar `ingredientes` y `unidades_medida` en `productos`.
- **OQ-3 — ¿Shim de compatibilidad para `app.core.deps` y `app.core.unit_of_work`?** Por defecto: no (se actualizan todos los imports; un shim mantendría a `core` importando `modules`). Alternativa: reexportar con `DeprecationWarning` durante un change.
- **OQ-4 — ¿Dónde vive el router de imágenes?** Por defecto: `modules/admin/` (es solo ADMIN). Alternativa: módulo propio `modules/uploads/` (extra adicional).
- **OQ-5 — ¿Cobertura en cada corrida?** Por defecto: no; umbral en `.coveragerc` y comando explícito `pytest --cov`. Alternativa: `--cov --cov-fail-under=60` en `addopts` (más lento y rompe corridas parciales).
- **OQ-6 — ¿Migrar también el `HTTPException` de `core/service.py`?** Por defecto: sí, junto con los services de módulos (PA-09 lo asignaba a C-28; son dos líneas del mismo patrón). Alternativa: dejarlo para C-28.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-14

## Notas de implementación

### Respuesta a las Open Questions
OQ-1..OQ-6: aceptados los defaults (2026-11-14, por el usuario).

### Red de seguridad (tareas 0.1 y 0.2, 2026-11-14)
- Línea base de la suite completa: **1424 tests, 1420 passed, 4 failed** (los 4 conocidos de `tests/unit/test_env_example.py`, pendientes de la tarea 2.4 de C-12). Sin otros fallos.
- Cobertura base de `app` (`--cov=app`): **91 %** total (3491 stmts, 305 sin cubrir). Por módulo de la rúbrica: `pedidos` 82,4 %; `productos` 83,6 %; `categorias` 88,2 %; `estadisticas` 93,8 %; `pagos` 95,8 %; `ingredientes` 95,7 %; `direcciones_entrega` 98,7 %; `auth` 100 %. Ninguno está por debajo del 40 % ni del 60 %.
- Tests de red de seguridad nuevos: `tests/integration/test_contrato_rutas.py` (2) y `tests/integration/test_flujo_compra_pago_entrega.py` (2, marker `e2e`).

### Bloque A (capas) — cierre (2026-11-14)
- Suite completa tras el bloque A: 1523 tests; 1517 passed y 6 failed en la corrida completa: los 4 conocidos de `test_env_example.py`, 1 flaky de tiempo (`test_limitador_por_clave::test_retry_after_...`, pasa en re-corrida) y 1 test propio con orden de roles no determinista (corregido y re-corrido en verde).
- `PedidoService.rol_para_cocina(usuario_id)` (no previsto en D5): el WebSocket `/pedidos/cocina/ws` también consultaba `UsuarioUnitOfWork` en el router; se movió al service igual que `puede_suscribirse`.
- Cambio observable mínimo: al migrar el 401 de login a `AppError`, la respuesta ahora incluye `WWW-Authenticate: Bearer` (antes `custom_http_exception_handler` descartaba los headers de `HTTPException`); cuerpo y status no cambian. Lo cubre `test_errores_de_dominio.py`.
- `core/cloudinary/service.py` (adaptador de infraestructura, fuera del alcance de la spec) sigue lanzando `HTTPException`.

### Bloque C (calidad) — cierre (2026-11-14)
- `backend/.coveragerc` creado (`source = app`, `fail_under = 60`, `show_missing = true`); el umbral NO está en `addopts` (OQ-5).
- Suite completa con `pytest --cov --cov-report=term`: **1517 tests, 1513 passed, 4 failed** (los 4 conocidos de `test_env_example.py`). Cobertura total **91,41 %**; el gate informa «Required test coverage of 60.0% reached».
- Cobertura por módulo de la rúbrica (stmts agregados): `auth` 98,3 %; `direcciones` 98,7 %; `ingredientes` 95,7 %; `pagos` 95,9 %; `admin` 95,1 %; `categorias` 88,3 %; `pedidos` 85,7 %; `productos` 83,7 %. Todos >60 %: la tarea 7.2 no requirió tests nuevos.
- Revisión SOLID/DRY: los `dependencies.py` de módulos solo arman el service (7 líneas); `auth/dependencies.py` (211 líneas) contiene la autenticación/autorización HTTP (JWT, roles), no lógica de negocio. Sin `get_*_service` en routers ni `Session` en routers; sin `HTTPException` en services (salvo el adaptador `core/cloudinary/service.py`, ya anotado). `backend/alembic/versions` sin cambios (001, 002, 003).

### Verificación (2026-11-14, revisor independiente)
- Veredicto: **PASS WITH WARNINGS**. `openspec validate --strict` válido; 34/34 tareas marcadas verificadas en código.
- Suite completa con cobertura: 1517 tests, 1513 passed, 4 failed (los 4 conocidos de `test_env_example.py`); cobertura total 91,41 %, gate de 60 % alcanzado. `pytest tests/unit/test_app_error.py --cov` falla con «Required test coverage of 60.0% not reached» (el umbral corta).
- Contrato de rutas: el literal de `test_contrato_rutas.py` coincide con las 69 rutas de `create_app()` del árbol `HEAD` (verificado extrayendo `HEAD`). `__tablename__` idénticos a `HEAD`; `alembic/versions` sin cambios.
- WARNING (corregir antes de archivar): `modules/admin/router.py` usa `Any` (líneas 101, 113, 119) sin importarlo. Solo funciona en Python 3.14 (anotaciones diferidas); el `Dockerfile` usa `python:3.11-slim` y fallaría con `NameError` al importar. Además hay dos `from typing import` duplicados (líneas 15 y 18).
- WARNING: el escenario «WebSocket de pedidos → cierre 1008» solo tiene tests a nivel service (`TestSuscripcionTiempoReal`); no hay ningún `websocket_connect` que ejercite el router.
- SUGGESTION: `puede_suscribirse` ahora rechaza pedidos con `deleted_at` (antes no se chequeaba) — cambio observable menor no documentado; `_importados` ignora imports relativos (`from .repository import`) y `starlette` no está prohibido en capas inferiores.

### Desviaciones adicionales documentadas (2026-11-14)
- `PedidoService.puede_suscribirse` exige además `deleted_at is None`: un pedido eliminado (soft delete) ya no admite suscripción al canal en tiempo real. El router original no lo chequeaba; es un cambio observable menor y deliberado.

### Correcciones de verify (2026-11-14)
- Hallazgo 1 (`Any` sin importar en `modules/admin/router.py`): corregido (import agregado y los dos `from typing import` unificados). Causa raíz: el venv local es Python 3.14 (anotaciones diferidas), que oculta el `NameError` que sí ocurre en la imagen `python:3.11-slim`. Nuevo test `tests/unit/test_nombres_indefinidos.py` (AST sobre todo `app/`; RED en `admin/router.py`, GREEN tras el fix).
- Hallazgo 2 (WebSocket 1008 sin test de router): agregado `tests/integration/test_pedidos_websocket.py` (8 tests con `websocket_connect`: sin cookie, token inválido, no dueño, pedido inexistente → 1008; dueño y usuario de cocina se conectan; cliente sin rol de gestión → 1008). Descubrió un bug previo (también en `HEAD`): el router hacía `await manager.disconnect(...)` sobre un método síncrono, lo que lanzaba `TypeError` al desconectarse el cliente; se quitó el `await` (4 sitios en `pedidos/router.py`).
- Hallazgo 3 (`_importados` ignoraba imports relativos): ahora se resuelven a módulos absolutos según el paquete del archivo (con tests del recolector) y `starlette` queda prohibido en repository/uow/service/models junto a `fastapi`; sin ofensores reales.
- Hallazgo 4 (desviación no documentada): registrada arriba.
