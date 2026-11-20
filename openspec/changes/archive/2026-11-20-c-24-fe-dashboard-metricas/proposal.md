# Proposal — C-24 `fe-dashboard-metricas`

> **Governance BAJO** (reportes de solo lectura). `[UI-MOCKUP]`: política `system-and-mockups` del design system (Revision 2, aprobada): no se inicia `/opsx:apply` hasta que el usuario apruebe los mockups del dashboard. Las OQ de `design.md` se presentan junto con los mockups; los specs asumen el default recomendado de cada una.

## Why

US-028 (Épica 7) pide que el `ADMIN` vea cómo va el negocio: KPIs (ventas, ticket promedio, pedidos activos, ingresos), ventas por período, productos top, pedidos por estado e ingresos por forma de pago, graficados con recharts. Hoy `/admin/dashboard` es la **última página provisoria** del frontend (dueño `C-24`) y, aunque el backend expone `GET /api/v1/estadisticas/*`, sus números **no son confiables**: dejan afuera las ventas en efectivo y transferencia, el resumen repite el mismo total como «ventas de hoy» e «ingresos del mes», y la agrupación mensual rompe en el entorno de tests.

Observado en el repo (`dev`, 2026-11-20):

- **Endpoints** (`backend/app/modules/admin/router.py:130-155`, `require_role(["ADMIN"])`, rutas congeladas en `tests/integration/test_contrato_rutas.py` y en la matriz RBAC): `GET /estadisticas/ventas?desde&hasta&agrupacion=day` → `[{fecha, total_ventas, cantidad_pedidos}]`; `/productos-top?desde&hasta&limit=5` → `[{nombre, ingresos, cantidad_vendida}]`; `/pedidos-por-estado?desde&hasta` → `[{estado_codigo, cantidad}]`; `/ingresos?desde&hasta` → `[{forma_pago_codigo, total, cantidad}]`; `/resumen?desde&hasta` → `{ventas_hoy, ticket_promedio, pedidos_activos, ingresos_mes}`. Service en `modules/admin/service.py` sobre `PedidoUnitOfWork`; consultas en `pedidos/repository.py` (`get_ventas_periodo`, `get_pedidos_por_estado`, `get_ingresos_por_forma_pago`) y `DetallePedidoRepository.get_productos_top`.
- **Huecos frente a la spec/KB**:
  - Ventas, ingresos y top productos **exigen un `Pago` con `mp_status = "approved"`**: los pedidos `EFECTIVO`/`TRANSFERENCIA` (confirmados a mano, DD-22) no tienen `Pago` y **nunca cuentan**.
  - `resumen` devuelve `ventas_hoy` = `ingresos_mes` = total del rango; `pedidos_activos` cuenta `PENDIENTE` y depende del rango.
  - `pedidos-por-estado` **excluye `CANCELADO`** y omite los estados sin pedidos.
  - `agrupacion` es un `str` libre (un valor inválido → 500 de PostgreSQL) y hay una rama `if settings.ENVIRONMENT == "test"` con funciones de SQLite (`strftime`) que con PostgreSQL rompe `month`; `date_trunc` devuelve un timestamp, no una fecha; no hay relleno de períodos vacíos.
  - `limit` sin cota, `desde > hasta` aceptado, sin tope de rango; top productos agrupa por **nombre** (dos productos homónimos se suman) sin `producto_id` ni desempate.
  - Tests escasos (`tests/integration/test_estadisticas.py`: 5 casos, varios solo verifican la forma).
- **Frontend**: `RUTAS.adminDashboard = '/admin/dashboard'` con acceso `ADMIN` y sección «Dashboard» en el panel (DD-25); página provisoria (`app/router/route-map.ts`, `owner: 'C-24'`). **`recharts` no está instalado** (`frontend/package.json`). Reutilizables de C-22: `etiquetaEstado`, `ESTADOS_PEDIDO`, `BadgeEstado`, `FORMAS_PAGO`/`EtiquetaFormaPago`, `.badge`, íconos; de `shared`: `importe.ts`, `MarcaActualizacion`, `EstadoError`/`EstadoVacio`, `PantallaCarga`.

## What Changes

- **Dashboard de métricas** (`/admin/dashboard`, solo `ADMIN`): selector de período (atajos «Hoy», «7 días», «30 días», «Este mes» y rango personalizado) y agrupación (día/semana/mes) guardados en la URL; cuatro tarjetas KPI (ventas, ingresos, ticket promedio, pedidos activos); gráficos recharts de ventas por período, top productos, pedidos por estado e ingresos por forma de pago, cada uno con su alternativa en tabla accesible; estados de carga, vacío y error por bloque; «Actualizar» con marca de última actualización. «Pedidos activos» y cada estado enlazan a `/gestion-pedidos` filtrado (C-22).
- **Contrato de estadísticas corregido** (mismas 5 rutas, mismo RBAC; reportes sin paginar según `api-conventions`):
  - Una **venta** es un pedido confirmado y no cancelado (`CONFIRMADO`, `EN_PREP`, `EN_CAMINO`, `ENTREGADO`), **cualquiera sea la forma de pago**; fecha de referencia `created_at` en UTC (OQ-1, OQ-2).
  - `ventas`: `agrupacion` ∈ `day|week|month` (otro → 422), fechas de inicio de período y **períodos vacíos rellenados con 0**.
  - `productos-top`: agrupa por `producto_id`, devuelve `producto_id`, `nombre`, `cantidad_vendida`, `ingresos`; `limit` 1..20 (por defecto 5); orden por cantidad y desempate estable (OQ-4).
  - `pedidos-por-estado`: los 6 estados en el orden de la FSM, **incluido `CANCELADO`**, con 0 los que no tienen pedidos.
  - `ingresos`: las formas de pago del catálogo con su total y cantidad (0 si no hubo ventas).
  - `resumen` **BREAKING (sin consumidores)**: `{ventas, ingresos, ticket_promedio, pedidos_activos}`; ventas/ingresos/ticket del rango y `pedidos_activos` = pedidos **ahora** en `CONFIRMADO`/`EN_PREP`/`EN_CAMINO` (OQ-3).
  - Validación: `desde` ≤ `hasta` y rango ≤ 366 días (422 `VALIDATION_ERROR` con `field`); errores en el formato `{detail, code, field}`.
  - Se elimina la rama de SQLite y se consolidan las consultas con un predicado común de «pedido vendido» (DRY).
- **Frontend**: dependencia nueva `recharts` 2.x (stack de la KB); `entities/estadistica` (tipos, API, `estadisticaQueries`); `pages/admin-dashboard`; la ruta deja de ser provisoria.
- **Docs al cerrar**: KB/06 (US-028 marcada), KB/02 y KB/07 §Dashboard (contrato nuevo y definición de venta), `frontend/README.md`, `CHANGES.md` (cierre de C-24).

**Fuera de alcance:** exportar a CSV/PDF; comparación contra el período anterior; métricas de stock, clientes o cocina (PA-07); actualización en vivo por WebSocket; zona horaria configurable; quitar el mecanismo de páginas provisorias (OQ-7).

## Capabilities

### New Capabilities
- `sales-metrics`: API de estadísticas de ventas para `ADMIN` — definición de venta, resumen de KPIs, serie de ventas por período, ranking de productos, pedidos por estado e ingresos por forma de pago, con validación de rango y agrupación.
- `frontend-admin-dashboard`: pantalla «Dashboard» del frontend para `ADMIN` — acceso, selector de período en la URL, tarjetas KPI, gráficos con alternativa accesible, estados de carga/vacío/error y actualización.

### Modified Capabilities
- `frontend-app-shell`: `/admin/dashboard` deja de ser provisoria; no queda ninguna ruta del mapa con página provisoria.

## Impact

- **Backend modificado**: `modules/admin/schemas.py` (respuestas nuevas, `Agrupacion` literal, parámetros de rango validados), `modules/admin/service.py` (resumen correcto, relleno de períodos y estados), `modules/admin/router.py` (parámetros validados; sin lógica), `modules/pedidos/repository.py` (consultas de métricas sin `Pago`, sin la rama de SQLite, predicado común), `main.py` (prefijo `/api/v1` al incluir el router, como los demás; mismos paths). Sin migraciones ni rutas nuevas. Tests: `tests/integration/test_estadisticas.py` reescrito y ampliado.
- **Frontend nuevo**: `entities/estadistica/`, `pages/admin-dashboard/`, `src/test/msw/estadisticas.ts`, `src/test/render-dashboard.ts`.
- **Frontend modificado**: `package.json` (+`recharts`), `app/router/routes.tsx` y `route-map.ts` (página real; `DuenoRuta` sin `C-24`), tests del router que esperan la provisoria de `C-24`, `shared/config/routes.ts` (comentario obsoleto de `RUTA_PAGO_PEDIDO`), `app/styles/index.css`.
- **Dependencias**: C-22 (cerrado). Sin cambios de variables de entorno, seed ni esquema.
