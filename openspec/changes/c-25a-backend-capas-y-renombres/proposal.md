# Proposal — C-25a `backend-capas-y-renombres`

## Why

La spec `[INT]` fija una arquitectura en capas (`Router → Service → UoW → Repository → Model`) y una estructura de módulos (`modules/{auth,refreshtokens,usuarios,direcciones,categorias,productos,pedidos,pagos,admin}`, `core/uow.py`) que el código no cumple (DT-25, reglas duras 1–4): seis routers abren la `Session` ellos mismos, `core/deps.py` depende de `modules/usuarios`, un repositorio importa de `schemas`, los services lanzan `HTTPException` (acoplados a FastAPI) y los nombres de módulos difieren de la spec. Además, la rúbrica pide tests con cobertura >60% (PA-16, bonus) y no existe una prueba del flujo completo compra→pago→entrega. Es el último change obligatorio de backend: conviene cerrarlo ahora, sin tocar el contrato HTTP que el frontend ya consume, y antes de `C-25b` (docs y entrega).

Observado en el código (`dev`, 2026-11-14, con C-12 implementado):

- `categorias`, `ingredientes`, `productos`, `unidades_medida`, `pagos` y `pedidos` (`router.py`) importan `sqlmodel.Session` y `get_session` para construir su service; el WebSocket de pedidos abre un `PedidoUnitOfWork` en el router. `direcciones_entrega`, `usuarios`, `pedidos` y `estadisticas` importan `unit_of_work` desde el router; `auth/router.py` importa el modelo `Usuario` y `UsuarioServiceDep` desde `usuarios/router.py` (sugerencia pendiente del verify de C-02).
- `core/deps.py` importa `UsuarioUnitOfWork`, `get_uow` y `Usuario` de `modules/usuarios`; `core/cloudinary/router.py` (rutas `/uploads`) depende de `core/deps.py`.
- `pedidos/repository.py` importa `FiltrosPedidos` de `pedidos/schemas.py`; `PedidoUnitOfWork.__init__` usa `Depends(get_session)` (FastAPI dentro de la UoW).
- 9 services (`core/service.py`, `auth`, `categorias`, `direcciones_entrega`, `ingredientes`, `pedidos`, `productos`, `unidades_medida`, `usuarios`) importan `fastapi.HTTPException` (C-11 creó `core/errors.AppError` y dejó la migración del resto a C-25a; PA-09).
- Módulos reales: 17 (`direcciones_entrega`, `detalles_pedido`, `estados_pedido`, `historiales_estado_pedido`, `formas_pago`, `estadisticas`, `ingredientes`, `unidades_medida`, `health`, … y `core/unit_of_work.py`).
- `pytest-cov` está en `requirements.txt` pero la cobertura no está configurada (bloque comentado en `pytest.ini`) y no hay umbral.

## What Changes

- **Capas (DT-25):** cada módulo con router gana `dependencies.py`, único lugar que conecta `SessionDep → UoW → Service` y expone alias `XServiceDep`; los routers solo importan schemas, services/alias y dependencias de autenticación. El WebSocket de pedidos verifica la propiedad a través del service. `UsuarioServiceDep` sale de `usuarios/router.py`.
- **`core/` sin dependencias de `modules/`:** las dependencias de autenticación/autorización (`get_current_user`, `get_current_active_user`, `get_current_roles`, `require_role`, `lector_privilegiado`, `AccessClaims`) pasan de `core/deps.py` a `modules/auth/dependencies.py`; el router de imágenes sale de `core/cloudinary/` hacia `modules/admin/` (el adaptador `core/cloudinary/service.py` queda en core).
- **Capas inferiores agnósticas de FastAPI:** los services lanzan `AppError` (mismo `status`, mismo `detail`, `code = HTTP_<status>` salvo los códigos de negocio ya definidos, mismos headers) en lugar de `HTTPException`; `PedidoUnitOfWork` deja de usar `Depends`; `FiltrosPedidos` pasa a un módulo neutral (`pedidos/filtros.py`).
- **Renombres a la estructura objetivo:** `core/unit_of_work.py` → `core/uow.py`; `direcciones_entrega` → `direcciones`; nuevo módulo `admin` (gestión de usuarios por ADMIN, estadísticas e imágenes); `detalles_pedido`, `estados_pedido` e `historiales_estado_pedido` se integran en `pedidos`; `formas_pago` se integra en `pagos`. Se conservan como extras `ingredientes`, `unidades_medida` y `health` (OQ-2).
- **Sin cambios de contrato:** las URLs, métodos, cuerpos y códigos HTTP quedan idénticos (lo garantiza un test de contrato de rutas tomado antes del primer movimiento). **Sin migración:** las tablas, `__tablename__` y la cabeza de Alembic no cambian.
- **Calidad:** tests de arquitectura (fronteras de import y estructura de módulos) que fallan hoy y quedan verdes; `.coveragerc` con umbral global 60% y medición por módulo (auth, pedidos, pagos, categorías, direcciones, ingredientes, productos, admin/estadísticas) completando tests donde falte; prueba end-to-end por API del flujo compra→pago→entrega (MercadoPago solo como doble del SDK).

**Fuera de alcance (con dueño):** WebSocket/KDS y rol `COCINA` (C-26/C-27, PA-07); decidir si `unidades_medida` y estadísticas se formalizan (PA-19); cambiar las firmas de constructor de los services que reciben `Session` para crear varias UoW (`PaymentService`, `BaseService`) más allá de lo necesario; rate limit global y Redis (C-28); documentación de entrega y video (C-25b); retiro de `GET /usuarios/me` (C-14).

## Capabilities

### New Capabilities
- `backend-architecture`: reglas verificables de la arquitectura del backend — dependencia unidireccional entre capas, routers sin acceso a datos, `core` independiente de `modules`, capas inferiores sin FastAPI, estructura de módulos de la spec, contrato HTTP invariante ante reorganizaciones, umbral de cobertura y prueba end-to-end del flujo de compra.

### Modified Capabilities
- (ninguna: el comportamiento HTTP observable no cambia; no se tocan los requisitos que modifica C-12 en `payment-api`, `backend-runtime`, `api-conventions`, `backend-config` ni `backend-db-migrations`).

## Impact

- **Código** (solo `backend/`): `app/core/{deps.py (se elimina), unit_of_work.py → uow.py, service.py, cloudinary/router.py (se mueve)}`; `app/modules/*/{router.py, dependencies.py (nuevo), service.py, unit_of_work.py}`; carpetas renombradas/fusionadas (`direcciones`, `admin`, `pedidos`, `pagos`); `app/main.py` (imports de routers); `app/db/seed.py` (imports de modelos).
- **Tests**: nuevos `tests/unit/test_arquitectura_capas.py`, `tests/unit/test_estructura_modulos.py`, `tests/integration/test_contrato_rutas.py`, `tests/integration/test_flujo_compra_pago_entrega.py`; actualización mecánica de imports y de los `monkeypatch.setattr("app....")` / `dependency_overrides` que apuntan a rutas movidas; tests extra donde la cobertura por módulo quede <60%.
- **Config**: `backend/.coveragerc` (nuevo); marker `e2e` en `pytest.ini`.
- **API / datos / env**: sin cambios (sin migración, sin variables nuevas).
- **Docs**: `knowledge-base/02` (módulos y tabla de capas), `08` (§Estructura de directorios, §Testing), `09` (DT-25 resuelta), `10` (PA-16 resuelta), `backend/README.md` (comando de cobertura).
