# Tasks — C-25a `backend-capas-y-renombres`

> **Governance MEDIO**: implementar con checkpoints; al cerrar cada bloque (A capas, B renombres, C calidad) reportar al usuario. No empezar hasta que el usuario apruebe los artefactos y responda (o acepte por defecto) OQ-1..OQ-6 de `design.md`.
> Strict TDD para un refactor: red de seguridad primero (suite completa + contrato de rutas + e2e de caracterización), luego cada regla de arquitectura se escribe RED justo antes del paso que la vuelve verde; después de **cada** movimiento/renombre la suite queda verde. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, comportamiento por interfaces públicas (HTTP o API del service), valores esperados escritos a mano, sin aserciones tautológicas, mocks solo en bordes (SDK de MercadoPago, Cloudinary).
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Sin migraciones ni cambios de `__tablename__` (D11); sin cambios de URL/cuerpo/código HTTP (D8). Sin shims: al mover, borrar el archivo viejo en el mismo paso y actualizar imports y `monkeypatch.setattr("app.…")`. No leer/escribir `.env*`, no levantar servidores, no commitear.
> **Rojos conocidos**: los 4 tests de `tests/unit/test_env_example.py` (tarea 2.4 de C-12, pendiente del usuario) se registran como preexistentes y no cuentan para «verde».

## 0. Red de seguridad

- [x] 0.1 Correr la suite completa y registrar total/passed/failed. Verificar que los únicos fallos son los 4 de `test_env_example.py`; cualquier otro fallo → frenar y reportarlo como preexistente.
- [x] 0.2 Medir cobertura actual con `python -m pytest --cov=app --cov-report=term` y registrar en `design.md` §Notas de implementación el total y el % de `auth`, `pedidos`, `pagos`, `categorias`, `direcciones_entrega`, `ingredientes`, `productos`, `estadisticas`. Si alguno está muy por debajo del 60% (<40%), avisar al usuario antes de seguir.
- [x] 0.3 Registrar en `design.md` §Open Questions la respuesta a OQ-1..OQ-6 con fecha. Verificar con `grep -n "OQ-[1-6]" openspec/changes/c-25a-backend-capas-y-renombres/design.md`.
- [x] 0.4 Contrato de rutas (D8): nuevo `tests/integration/test_contrato_rutas.py` con el conjunto literal `{(método, path)}` de HTTP y WebSocket de `create_app()` tomado del código actual (generarlo una vez con un script descartable y pegarlo a mano; sin `HEAD`/`OPTIONS` implícitos). Ejecutar → verde.
- [x] 0.5 e2e de caracterización (D9): declarar el marker `e2e` en `pytest.ini`; nuevo `tests/integration/test_flujo_compra_pago_entrega.py` que recorre por HTTP ADMIN crea catálogo → cliente se registra, inicia sesión, crea dirección y pedido `MERCADOPAGO` (2 unidades) → `POST /pagos/crear` aprobado (fixture `mp_sdk`) → webhook firmado → PEDIDOS: `EN_PREP`, `EN_CAMINO`, `ENTREGADO`. Asserts: estado final `ENTREGADO`, historial en orden `PENDIENTE, CONFIRMADO, EN_PREP, EN_CAMINO, ENTREGADO`, `GET /pagos/{pedido_id}` aprobado, stock = inicial − 2; repetir el webhook no vuelve a descontar. Ejecutar `pytest -m e2e` → verde.
- [x] 0.6 TRIANGULATE e2e: segundo caso del mismo archivo, pago rechazado → el pedido sigue `PENDIENTE`, sin descuento de stock y el cliente puede cancelarlo (`DELETE /pedidos/{id}`) → `CANCELADO`. Ejecutar → verde.

## Bloque A — Capas (DT-25)

## 1. Routers sin acceso a datos (D1, D5; spec `backend-architecture` «Los routers no acceden a datos»)

- [x] 1.1 RED: nuevo `tests/unit/test_arquitectura_capas.py` con el recolector de imports por `ast` (incluye imports dentro de funciones) y la regla R1 parametrizada por cada `app/modules/**/router.py`. Ejecutar → falla listando `categorias`, `ingredientes`, `productos`, `unidades_medida`, `pagos`, `pedidos`, `usuarios`, `direcciones_entrega`, `estadisticas` y `auth` con sus imports ofensores.
- [x] 1.2 GREEN catálogo: `dependencies.py` en `categorias`, `ingredientes`, `productos`, `unidades_medida` (`get_<x>_service(session: SessionDep)` + `XServiceDep`); los routers usan el alias. Ejecutar `pytest tests/unit/test_arquitectura_capas.py -k "categorias or ingredientes or productos or unidades_medida"` y `pytest tests/integration/test_categoria.py tests/integration/test_producto.py tests/integration/test_ingrediente.py tests/integration/test_unidad_medida.py tests/integration/test_catalogo_visibilidad.py tests/integration/test_producto_ingredientes.py tests/integration/test_contrato_rutas.py` → verde.
- [x] 1.3 GREEN usuarios/direcciones/auth: `usuarios/dependencies.py` (`get_uow` sale de `unit_of_work.py`, `UsuarioServiceDep` sale de `router.py`), `direcciones_entrega/dependencies.py`, `auth/dependencies.py` (por ahora solo `get_auth_uow`, `get_auth_service`, `get_registro_intentos_login`); `auth/router.py` deja de importar el modelo `Usuario` (tipa con `UserPublic`) y toma `UsuarioServiceDep` de `usuarios.dependencies`. Ejecutar `pytest tests/integration/test_auth*.py tests/integration/test_direccion_entrega.py tests/integration/test_rbac_matriz.py tests/integration/test_contrato_rutas.py` → verde.
- [x] 1.4 RED service: en `tests/integration/test_pedidos.py` (o archivo de WS existente), `PedidoService.puede_suscribirse` → `True` para el dueño, `False` para otro usuario, pedido inexistente o eliminado. Ejecutar → falla (no existe).
- [x] 1.5 GREEN pedidos/pagos/estadísticas: `PedidoService.puede_suscribirse`; `pedidos/dependencies.py` (`PedidoServiceDep` con `construir_pedido_service`), el WebSocket usa el service; `PedidoUnitOfWork` sin `Depends(get_session)`; `pagos/dependencies.py` (`get_payment_service` + `PaymentServiceDep`) y actualizar `test_pago_webhook_transaccion.py` (override desde `pagos.dependencies`); `estadisticas/dependencies.py`. Ejecutar `pytest tests/unit/test_arquitectura_capas.py tests/integration/test_pedidos*.py tests/integration/test_pago*.py tests/integration/test_estadisticas.py tests/integration/test_contrato_rutas.py` → verde (R1 completa).

## 2. `core` sin `modules` (D2; spec «El núcleo no depende de los módulos de negocio»)

- [x] 2.1 RED: regla R2 en `test_arquitectura_capas.py` para cada archivo de `app/core/**`. Ejecutar → falla con `core/deps.py` (y `core/cloudinary/router.py` vía `core.deps` una vez movido).
- [x] 2.2 GREEN: mover el contenido de `core/deps.py` a `modules/auth/dependencies.py` sin cambiar lógica; borrar `core/deps.py`; actualizar todos los importadores (`grep -rn "app.core.deps" app tests` sin resultados). Crear `modules/admin/` y mover `core/cloudinary/router.py` → `modules/admin/router.py` (`imagenes_router`, mismo prefijo `/uploads`), `main.py` lo monta desde ahí; actualizar `test_rbac_matriz.py` (`monkeypatch` de `subir_imagen`/`eliminar_imagen` al nuevo path). Ejecutar `pytest tests/unit/test_arquitectura_capas.py tests/unit/test_cloudinary_service.py tests/integration/test_rbac*.py tests/integration/test_optional_integrations.py tests/integration/test_contrato_rutas.py` → verde.

## 3. Capas inferiores sin FastAPI ni schemas (D3, D4; spec «Dependencia unidireccional» y «Capas inferiores independientes del framework web»)

- [x] 3.1 RED: regla R3 (repository/unit_of_work/service/models) en `test_arquitectura_capas.py`. Ejecutar → falla con `pedidos/repository.py → pedidos.schemas`, los 9 services con `fastapi`, `usuarios/unit_of_work.py` y `auth/unit_of_work.py` con `app.core.database` (si quedó algo de 1.3).
- [x] 3.2 GREEN filtros: `pedidos/filtros.py` con `FiltrosPedidos`; repositorio, service y router la importan de ahí; `schemas.py` ya no la define. Ejecutar `pytest tests/integration/test_pedidos_contrato.py tests/integration/test_paginacion_listados.py` → verde.
- [x] 3.3 RED unidad: en `tests/unit/` (archivo de errores existente o nuevo `test_app_error.py`), `AppError.http(404, "x")` → `status_code` 404, `code` `HTTP_404`, `field` `None`; con `headers={"WWW-Authenticate": "Bearer"}` los conserva. Ejecutar → falla.
- [x] 3.4 GREEN: classmethod `AppError.http`; migrar `HTTPException` → `AppError.http(...)` en `core/service.py`, `categorias`, `ingredientes`, `unidades_medida`, `productos`, `direcciones_entrega`, `usuarios`, `pedidos` y `auth` (`RefreshRechazado` hereda de `AppError`), un service por vez corriendo sus tests de integración después de cada uno. Verificar `grep -rn "HTTPException" app/modules/*/service.py app/core/service.py` sin resultados.
- [x] 3.5 TRIANGULATE: login con credenciales incorrectas → 401 con `WWW-Authenticate: Bearer`, `code` `HTTP_401`; refresh rechazado → 401 y cookie borrada; `GET /api/v1/categorias/999999` → 404 `HTTP_404` con el mismo `detail`. Ejecutar `pytest tests/unit/test_arquitectura_capas.py tests/integration/test_auth*.py tests/integration/test_exception_handlers.py` → verde.
- [x] 3.6 Checkpoint bloque A: suite completa (solo los 4 rojos conocidos), `test_arquitectura_capas.py` completo verde, contrato de rutas verde; reportar al usuario. Docs: `knowledge-base/09` DT-25 → **RESUELTA por C-25a**; `knowledge-base/02` tabla de capas (Service lanza `AppError`, `dependencies.py` como composición, UoW en `core/uow.py` tras el bloque B). Verificar `grep -n "DT-25" knowledge-base/09_decisiones_y_supuestos.md`.

## Bloque B — Renombres a la estructura objetivo (D6)

## 4. Test de estructura y `core/uow.py`

- [x] 4.1 RED: nuevo `tests/unit/test_estructura_modulos.py`: carpetas de `app/modules` == `{auth, refreshtokens, usuarios, direcciones, categorias, productos, pedidos, pagos, admin, ingredientes, unidades_medida, health}` (según OQ-1/OQ-2); existe `core/uow.py`; no existen `core/unit_of_work.py` ni `core/deps.py`. Ejecutar → falla (lista sobrantes y faltantes).
- [x] 4.2 GREEN parcial: `core/unit_of_work.py` → `core/uow.py` (actualizar imports en app y `tests/unit/test_unit_of_work.py`). Verificar `grep -rn "core.unit_of_work" app tests` sin resultados; ejecutar `pytest tests/unit/test_unit_of_work.py tests/integration/test_session_isolation.py` y suite completa → verde salvo los asserts de carpetas de 4.1.

## 5. `direcciones` y `admin`

- [x] 5.1 `direcciones_entrega/` → `direcciones/` (models, repository, schemas, service, router, dependencies); actualizar `usuarios/unit_of_work.py`, `main.py`, `seed.py` y tests. Verificar `grep -rn "direcciones_entrega" app tests` sin resultados; ejecutar `pytest tests/integration/test_direccion_entrega.py tests/unit/test_models_registry.py tests/integration/test_migrations.py tests/integration/test_contrato_rutas.py` → verde.
- [x] 5.2 `admin_router` de `usuarios/router.py` → `admin/router.py` (mismo prefijo `/admin/usuarios`, usa `UsuarioServiceDep`); `estadisticas/{router,service,schemas,dependencies}` → `admin/` (`estadisticas_router`, `EstadisticasService`, mismo prefijo `/api/v1/estadisticas`); borrar `estadisticas/`. Verificar `grep -rn "modules.estadisticas" app tests` sin resultados; ejecutar `pytest tests/integration/test_estadisticas.py tests/integration/test_rbac_matriz.py tests/integration/test_contrato_rutas.py tests/unit/test_arquitectura_capas.py` → verde.

## 6. Fusiones en `pedidos` y `pagos` (OQ-1)

- [x] 6.1 `estados_pedido` → `pedidos` (modelo `EstadoPedido`, repositorio, schemas agregados a los archivos de `pedidos`); actualizar imports (`seed.py`, UoW, tests). Ejecutar `pytest tests/unit/test_models_registry.py tests/integration/test_migrations.py tests/integration/test_seed.py tests/integration/test_pedidos_fsm.py` → verde.
- [x] 6.2 `historiales_estado_pedido` → `pedidos` (idem). Ejecutar `pytest tests/unit/test_models_registry.py tests/integration/test_migrations.py tests/integration/test_historial_append_only.py tests/integration/test_pedidos*.py` → verde.
- [x] 6.3 `detalles_pedido` → `pedidos` (idem). Ejecutar `pytest tests/unit/test_models_registry.py tests/integration/test_migrations.py tests/integration/test_pedidos*.py tests/integration/test_stock_service.py` → verde.
- [x] 6.4 `formas_pago` → `pagos` (idem). Ejecutar `pytest tests/unit/test_models_registry.py tests/integration/test_migrations.py tests/integration/test_seed.py tests/integration/test_pago*.py` → verde.
- [x] 6.5 GREEN 4.1: `pytest tests/unit/test_estructura_modulos.py` → verde. Verificar `grep -rn "detalles_pedido\|estados_pedido\|historiales_estado_pedido\|formas_pago" app tests --include=*.py | grep "app\.modules\."` sin resultados (los nombres de tabla pueden seguir apareciendo).
- [x] 6.6 Checkpoint bloque B: suite completa (solo los 4 rojos conocidos), contrato de rutas idéntico, `test_migrations` sin diferencias, cabeza de Alembic sin cambios (`ls backend/alembic/versions`); reportar al usuario. Docs: `knowledge-base/08` §Estructura de directorios (árbol real = objetivo, con extras y `dependencies.py`), `knowledge-base/02` (módulos reales), `backend/README.md` si menciona rutas internas. Verificar `grep -rn "direcciones_entrega\|unit_of_work.py\|core/deps" knowledge-base/02_descripcion_general.md knowledge-base/08_arquitectura_propuesta.md` sin resultados.

## Bloque C — Calidad

## 7. Cobertura >60% (D10; spec «Cobertura mínima de tests»)

- [x] 7.1 `backend/.coveragerc` (`[run] source = app`; `[report] fail_under = 60`, `show_missing = true`). Ejecutar `python -m pytest --cov --cov-report=term` → la corrida informa el total y no falla por umbral (o falla, si el total es <60%: pasar a 7.2).
- [x] 7.2 Por cada módulo de la rúbrica (`auth`, `pedidos`, `pagos`, `categorias`, `direcciones`, `ingredientes`, `productos`, `admin` (estadísticas)) con <60%: agregar tests de comportamiento por la API para las ramas sin cubrir del informe (casos de error y permisos antes que caminos felices repetidos), uno por vez con RED→GREEN cuando cubran comportamiento faltante. Verificar que cada uno supera 60% en el informe.
- [x] 7.3 Docs: `knowledge-base/08` §Testing (comando de cobertura, umbral, marker `e2e`, tests de arquitectura y contrato), `knowledge-base/10` PA-16 → **RESUELTA** (>60% con umbral automático, alcance), `backend/README.md` (cómo correr cobertura y `-m e2e`). Verificar `grep -n "PA-16" knowledge-base/10_preguntas_abiertas.md`.

## 8. Cierre

- [x] 8.1 Revisión SOLID/DRY: ningún `dependencies.py` contiene lógica de negocio (solo armado); no quedan funciones `get_*_service` en routers (`grep -rn "def get_.*_service" app/modules/*/router.py` sin resultados); `grep -rn "Session" app/modules/*/router.py` sin resultados.
- [x] 8.2 Suite completa con cobertura: 0 failed salvo los 4 rojos conocidos, passed ≥ línea base de 0.1 + tests nuevos, cobertura total >60% y `-m e2e` verde; registrar números en `design.md` §Notas de implementación.

## 9. Correcciones de verify

- [x] 9.1 `Any` sin importar en `admin/router.py` + test AST `test_nombres_indefinidos.py` (RED→GREEN).
- [x] 9.2 Tests de WebSocket a nivel router (`test_pedidos_websocket.py`) y fix del `await manager.disconnect` síncrono.
- [x] 9.3 `_importados` resuelve imports relativos; `starlette` prohibido en capas inferiores.
- [x] 9.4 Desviación `deleted_at` en `puede_suscribirse` documentada en `design.md`.

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-25a-backend-capas-y-renombres` (crea `openspec/specs/backend-architecture/`, marca `[x]` C-25a en CHANGES.md y agrega «Punto de partida (C-25a)» en C-25b: estructura de módulos, comando de cobertura, e2e).
- C-12 sigue sin archivar: archivarlo antes o después no choca (este change no tiene deltas sobre sus capacidades).
