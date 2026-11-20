# Design — C-24 `fe-dashboard-metricas`

## Context

Motivación y relevamiento del código en `proposal.md` (Why). Restricciones que dan forma al diseño:

- **Contrato de rutas congelado** (`backend/tests/integration/test_contrato_rutas.py`, C-25a D8) y **matriz RBAC** (`tests/support/rbac_matriz.py`): las cinco rutas `GET /api/v1/estadisticas/{ventas|productos-top|pedidos-por-estado|ingresos|resumen}` con `ADMIN` se conservan. Cambian parámetros, validaciones y forma de algunas respuestas (ningún consumidor: el frontend aún no las usa).
- **`api-conventions`**: los reportes de estadísticas no son listados de colección → **sin `page`/`size`** (requirement «Respuestas que no son listados de colección»). El ítem de CHANGES.md «ajustarlos al contrato (page/size, errores)» se resuelve así: reportes sin paginar, `limit` acotado solo en el ranking, y todos los errores en `{detail, code, field}` (422 `VALIDATION_ERROR` con `field`).
- **Sesión de PostgreSQL en UTC** (`core/database.py`: `-c timezone=UTC`): `date(created_at)` y `date_trunc` sobre `TIMESTAMPTZ` operan en UTC. Los filtros de fecha de C-22 (`GET /pedidos/?desde&hasta`) también son UTC.
- **Ventas sin `Pago`**: los pedidos `EFECTIVO`/`TRANSFERENCIA` se confirman a mano (DD-22, RN-PE-02) y no generan fila en `pagos`; un pedido `MERCADOPAGO` solo llega a `CONFIRMADO` por un pago aprobado (C-12). Por lo tanto **el estado del pedido** es la fuente de verdad de «vendido», no la tabla `pagos`.
- **Capas** (reglas 1-4): routers sin lógica; el service orquesta; las consultas viven en repositorios. Hoy las consultas están en `PedidoRepository`/`DetallePedidoRepository` y el `EstadisticasService` (módulo `admin`) usa `PedidoUnitOfWork`.
- **Frontend**: ruta, acceso `ADMIN` y sección del panel ya existen (C-13a/C-13b). C-22 dejó `etiquetaEstado`, `ESTADOS_PEDIDO`, `BadgeEstado`, clases `.b-<estado>` y `FORMAS_PAGO`/`EtiquetaFormaPago` en `entities/pedido`; `formatearPrecio` en `entities/producto`; `MarcaActualizacion`, `EstadoError`/`EstadoVacio`/`EsqueletoFilas` en `shared/ui`. `recharts` no está instalado. En jsdom `ResponsiveContainer` mide 0×0 y no dibuja.

## Goals / Non-Goals

**Goals:**
- Números correctos y verificables por test: una sola definición de venta usada por los cinco reportes.
- Respuestas «completas» (períodos y estados con 0, todas las formas de pago) para que el frontend no rellene huecos ni conozca el calendario.
- Dashboard accesible: cada gráfico tiene su tabla; los tests verifican datos por la tabla, no por el SVG.

**Non-Goals:**
- Zona horaria local (Argentina) para agrupar; comparativas contra el período anterior; exportación; métricas en tiempo real (WebSocket); caché del lado del servidor; índices nuevos (volumen de TPI).

## Decisions

### D1 — Predicado único de «pedido vendido» en el repositorio
`PedidoRepository` expone una expresión/consulta base `_vendidos_en(desde, hasta)` = `estado_codigo IN ('CONFIRMADO','EN_PREP','EN_CAMINO','ENTREGADO')` ∧ `deleted_at IS NULL` ∧ `date(created_at) BETWEEN desde AND hasta`, y la reutilizan `ventas_por_periodo`, `ingresos_por_forma_pago`, `resumen_ventas` y el ranking de `DetallePedidoRepository`. Los estados vendidos son una constante (`ESTADOS_VENDIDOS`) junto a la FSM (`pedidos/fsm.py`) para no duplicar el catálogo. Se **elimina el join con `Pago`** y la rama `settings.ENVIRONMENT == "test"` (SQLite) — los tests ya corren contra PostgreSQL real.
*Alternativas:* seguir exigiendo `Pago` aprobado (deja fuera efectivo/transferencia, contradice DD-22); sumar `Pago.transaction_amount` (no existe para pagos manuales y un pedido puede tener varios intentos); fecha de confirmación desde el historial (OQ-2: más precisa para «cuándo se vendió», pero complica todas las consultas con un join a `historial_estado_pedido`).

### D2 — Rellenar períodos con `generate_series`
`ventas_por_periodo(desde, hasta, agrupacion)` arma la serie en SQL: `generate_series(date_trunc(:g, :desde), date_trunc(:g, :hasta), '1 <g>')::date` con `LEFT JOIN` a las ventas agrupadas por `date_trunc(:g, created_at)::date`, devolviendo `fecha` (date), `total_ventas` (`COALESCE(sum, 0)`) y `cantidad_pedidos`. `week` usa el `date_trunc('week')` de PostgreSQL (lunes ISO). `agrupacion` es `Literal["day","week","month"]` en el router (422 automático con `field` `agrupacion`); el valor que llega al SQL ya está validado y el intervalo se toma de un mapa fijo.
*Alternativa:* rellenar en Python en el service — más código y otra fuente de error de calendario; o en el frontend — duplicaría la lógica en cada cliente.

### D3 — Estados y formas de pago completos desde los catálogos
`pedidos_por_estado` hace `estado_pedido LEFT JOIN pedidos` (filtrado por rango en la condición del join) ordenado por `estado_pedido.orden`, así salen los 6 estados con 0 y `CANCELADO` incluido. `ingresos_por_forma_pago` hace `forma_pago LEFT JOIN pedidos vendidos`, orden `total DESC, codigo`. Nada se hardcodea en el service.

### D4 — Ranking por producto, por cantidad
`DetallePedidoRepository.productos_top` agrupa por `detalle.producto_id` con `productos.nombre` actual (join a `productos`, incluye soft-deleted: fue una venta real), `SUM(cantidad)` y `SUM(subtotal_snapshot)`, orden `cantidad DESC, ingresos DESC, producto_id ASC`, `LIMIT :limit` con `limit: int = Query(5, ge=1, le=20)`. Los `ingresos` por producto son la suma de subtotales de línea: no coinciden con los ingresos del resumen (que usan `pedido.total`, con envío/descuento); el dashboard lo rotula como «facturado en el producto».
*Alternativas:* `nombre_snapshot` (refleja el nombre al momento de la venta, pero un producto renombrado aparecería partido si se agrupa por nombre; con `producto_id` el nombre actual es lo esperable); ordenar por ingresos (OQ-4).

### D5 — Resumen nuevo y validación del rango
`ResumenResponse = {ventas: int, ingresos: Decimal, ticket_promedio: Decimal, pedidos_activos: int}`; `ticket_promedio = (ingresos / ventas).quantize(Decimal("0.01"), ROUND_HALF_UP)` o `0.00`. `pedidos_activos` cuenta estados `CONFIRMADO`/`EN_PREP`/`EN_CAMINO` sin filtro de fecha (es una foto del momento, OQ-3). Los importes son `Decimal` con 2 decimales → JSON string ("4500.00"), igual que los totales de pedidos que el frontend ya maneja como `string`.
El rango se valida con una dependencia `RangoFechas` (`Annotated[..., Depends()]` en `admin/schemas.py` o `dependencies.py`) que recibe `desde`/`hasta` obligatorios y lanza un error de validación con `field` `desde` (invertido) o `hasta` (> 366 días) usando el mismo mecanismo que produce `VALIDATION_ERROR` (`RequestValidationError` con `loc` `("query", campo)`), para que el handler existente arme `{detail, code, field}`. La autorización (`require_role` a nivel router) se resuelve antes que los parámetros, como hoy.
*Alternativa:* validar en el service y lanzar `AppError` 400 — no respeta la convención 422 `VALIDATION_ERROR` de `api-conventions`.

### D6 — Ubicación de las consultas y del service
Las consultas siguen en `pedidos/repository.py` (son agregados de `Pedido`/`DetallePedido` y el `PedidoUnitOfWork` ya las expone); se renombran sin el prefijo `get_` para distinguirlas del CRUD y se cubren con el predicado de D1. Se suma `EstadoPedidoRepository`/`FormaPago` vía el UoW para los catálogos si hace falta (ya existen en `pedidos`/`pagos`). `EstadisticasService` (módulo `admin`) mapea filas → schemas y calcula el ticket; el router solo declara parámetros. `main.py` incluye `estadisticas_router` con `prefix="/api/v1"` como el resto (el router queda con `prefix="/estadisticas"`), mismos paths.
*Alternativa:* un `EstadisticasRepository` propio en `admin/` — más archivos sin ganancia mientras solo haya un consumidor; queda como refactor posible en C-25b.

### D7 — Frontend: ubicación FSD
- `entities/estadistica/`: `model/estadistica.ts` (tipos `ResumenVentas`, `PuntoVentas`, `ProductoTop`, `PedidosEstado`, `IngresoFormaPago`, `Agrupacion`, `RangoEstadisticas`), `model/periodo.ts` (funciones puras en UTC: `rangoPorDefecto(hoy)`, `rangoAtajo(atajo, hoy)`, `validarRango`, `rotuloPeriodo(fecha, agrupacion)`), `model/importe-grafico.ts` (`aNumero` de un decimal string para los ejes de recharts, `porcentajes` con suma 100 por centavos enteros), `api/estadisticas-api.ts` (cinco fetchers con `apiClient`), `api/estadistica-queries.ts` (`estadisticaQueries.resumen(rango)`, `.ventas(rango, agrupacion)`, `.productosTop(rango)`, `.pedidosPorEstado(rango)`, `.ingresos(rango)` con `queryOptions`; claves `['estadisticas', <reporte>, params]`; `staleTime` 60 s; `placeholderData: keepPreviousData`). Sigue la convención del repo «un recurso del backend = una entidad» (C-22 `pedido`, C-23 `usuario`).
- `pages/admin-dashboard/`: `model/filtro.ts` (`leerPeriodo(searchParams, hoy)` y `aParametros`, con los parámetros inválidos → defecto), `ui/admin-dashboard-page.tsx`, `ui/selector-periodo.tsx`, `ui/tarjetas-kpi.tsx`, `ui/grafico-ventas.tsx` (área/línea), `ui/grafico-productos.tsx` (barras horizontales), `ui/grafico-estados.tsx` (barras), `ui/grafico-formas-pago.tsx` (dona + leyenda con %), `ui/bloque-grafico.tsx` (título, «Ver como tabla», esqueleto/vacío/error/Reintentar comunes a los cuatro gráficos — DRY), `ui/admin-dashboard.css`.
- Importa de `entities/pedido` (`etiquetaEstado`, `ESTADOS_PEDIDO`, `FORMAS_PAGO`), `entities/producto` (`formatearPrecio`) y `shared/*`. Sin `features/` (solo lectura) y sin Zustand (todo es server state; el período vive en la URL).
*Alternativa:* todo en `pages/admin-dashboard` (FSD «ante la duda, en pages») — se descarta por coherencia con C-22/C-23.

### D8 — recharts y colores del design system
`recharts` 2.x (versión exacta fijada en `package.json`, la de la KB). Los colores se pasan como `var(--color-…)` de `design-system/tokens.css` (SVG acepta variables CSS en `fill`/`stroke`): serie de ventas `--color-primary`; estados con los colores de los distintivos `.b-<estado>` de C-22 (se exponen como un mapa `COLOR_ESTADO` junto a `CLASES_ESTADO` en `entities/pedido`, sin duplicar valores: variables CSS nuevas en `pedido.css` si los distintivos usan valores literales); formas de pago con `--color-primary`/`--color-accent`/`--color-info`. Si un color nuevo hace falta en tokens, se decide en los mockups (sin bump de Revision salvo que se agregue un token compartido). Gráficos con `isAnimationActive` desactivado cuando `prefers-reduced-motion`. Los SVG de recharts llevan `aria-hidden`; la tabla equivalente es la fuente accesible (spec «Alternativa accesible»).

### D9 — Período en la URL y en UTC
`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&agrupacion=day|week|month`. «Hoy» se calcula con la fecha UTC (`new Date().toISOString().slice(0, 10)`), coherente con el backend y con los filtros de C-22; las funciones de `periodo.ts` reciben `hoy` como parámetro (tests deterministas, sin `vi.useFakeTimers` salvo en la página). Un rango inválido elegido en el formulario no se escribe en la URL (spec: sigue el último válido); uno inválido que llega por URL se reemplaza por el defecto.

### D10 — Tests (Strict TDD)
- **Backend** (pytest contra PostgreSQL `foodstore_test`, AAA, datos sembrados por fixtures existentes `normal_user`, `direccion_db`, `producto_db`): `tests/integration/test_estadisticas.py` reescrito por reporte — definición de venta (efectivo sin pago cuenta; pendiente/cancelado no), borde UTC, relleno de días/semanas/meses, agrupación inválida, homónimos y orden del ranking, `limit` fuera de rango, 6 estados con ceros, formas de pago con ceros y orden, resumen y ticket, pedidos activos fuera del rango, rango invertido/largo/faltante (422 `field`), 401/403. Un helper de test `crear_pedido(estado, forma_pago, total, created_at, lineas)` evita repetir el armado. `test_contrato_rutas.py` y la matriz RBAC no cambian (verde = paths intactos).
- **Frontend** (Vitest + RTL + MSW): modelo puro (`periodo`, `importe-grafico`, `filtro`) con casos de borde (fin de mes, semana ISO, rango de 366/367 días, porcentajes que suman 100); `estadisticas-api`/`queries` con MSW (`src/test/msw/estadisticas.ts`: respuestas por reporte, errores inyectables por endpoint, registro de query strings); página (`render-dashboard.ts`) verificando lo que ve el usuario por **las tablas** y las tarjetas, el período en la URL, error por bloque y Reintentar, «Actualizar», navegación a `/gestion-pedidos`, axe. Para que recharts dibuje en jsdom, `ResizeObserver` se stubbea en el setup del test de la página o los gráficos reciben un ancho fijo en test (`ResponsiveContainer` con `initialDimension`); no se asserta sobre el SVG.
- Router: `rutas-mis-pedidos.test.tsx` (hoy espera la provisoria de `C-24`) y `routes.test.tsx` (provisoria «una sección sin pantalla») se reapuntan: el componente `PlaceholderPage` se prueba directamente y el router verifica que ninguna ruta del mapa es provisoria.

## Risks / Trade-offs

- **R-1 — Cambio de forma de `/resumen` (BREAKING)** → no hay consumidores (el frontend aún no lo usa; los tests actuales solo miran claves); se documenta en KB/02 y KB/07 al cerrar.
- **R-2 — Fecha de referencia = creación del pedido** → un pedido creado el 31 y confirmado el 1 cuenta en el mes de creación (OQ-2). Aceptable para un TPI; documentado.
- **R-3 — UTC vs hora local** → una venta de las 22:00 en Argentina (UTC-3) cae en el día siguiente (OQ-1). Coherente con C-22; la UI lo aclara («Fechas en UTC»).
- **R-4 — recharts en jsdom** (dimensiones 0, `ResizeObserver` ausente) → los tests leen las tablas; stub de `ResizeObserver` local a esos tests. El render real se verifica en el visual verify.
- **R-5 — Peso del bundle** (+~100 KB gz de recharts) → solo lo carga la ruta del dashboard si se usa `React.lazy` para la página; se evalúa en apply (no cambia specs).
- **R-6 — Consultas sobre tablas sin índice por `created_at`** → volumen de TPI; rango máximo de 366 días acota el costo. Sin migración.
- **R-7 — Tests existentes** (`test_estadisticas.py`: `ventas_hoy`, pago `approved` obligatorio, `forma_pago_codigo == "EFECTIVO"` con pago aprobado) → se reescriben en el bloque de backend; el contrato de rutas y la matriz RBAC deben seguir verdes.

## Migration Plan

1. Backend primero (sin migraciones): corregir consultas y contrato, tests verdes. Rollback = revertir el commit.
2. Frontend: `npm install recharts@<2.x exacta>`, entidad, página, router.
3. Sin cambios de variables de entorno, seed ni esquema.

## Open Questions

**Resueltas el 2026-11-20 por el usuario: se aceptaron los defaults recomendados de OQ-1..OQ-8** (los specs ya los asumen; no hace falta `/opsx:update`).

| OQ | Pregunta | Default recomendado (decisión: aceptado, 2026-11-20, by user) |
|----|----------|---------------------|
| OQ-1 | ¿Zona horaria para «día»/«semana»/«mes»? | **UTC**, como los filtros de C-22 y la sesión de PostgreSQL; la UI lo aclara. Alternativa: `America/Argentina/Buenos_Aires` en backend y frontend. |
| OQ-2 | ¿Qué fecha ubica una venta en el tiempo? | **`created_at` del pedido**. Alternativa: fecha de la transición a `CONFIRMADO` (historial). |
| OQ-3 | ¿Qué es «pedidos activos»? | **Ahora** en `CONFIRMADO`, `EN_PREP` o `EN_CAMINO`, sin depender del período. Alternativas: incluir `PENDIENTE` (pendientes de pago/confirmación); o limitarlo al período. |
| OQ-4 | ¿Cómo se ordena el top de productos? | **Por cantidad vendida** (desempate por ingresos); top 5. Alternativa: por ingresos, o un selector en la UI. |
| OQ-5 | ¿Qué estados cuentan como venta/ingreso? | **`CONFIRMADO`, `EN_PREP`, `EN_CAMINO`, `ENTREGADO`**, cualquier forma de pago. Alternativa: solo `ENTREGADO` (ingreso «realizado»). |
| OQ-6 | ¿Período por defecto y atajos? | **Últimos 30 días por día**; atajos Hoy / 7 días / 30 días / Este mes + personalizado; tope 366 días. |
| OQ-7 | ¿Se elimina `PlaceholderPage` y el campo `owner` al no quedar rutas provisorias? | **No**: se conservan para los changes de Fase 2 (C-26..C-28); solo se quita `C-24` de `DuenoRuta`. |
| OQ-8 | ¿Actualización automática (polling)? | **No**: «Actualizar» manual y `staleTime` de 60 s. Alternativa: refetch cada 60 s como la gestión de pedidos. |

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-20)
- Mockups: `openspec/changes/c-24-fe-dashboard-metricas/mockups/` (`dashboard.html` con `?estado=`, `?periodo=`, `?error=`; ver `mockups/README.md`)
- Approval: approved (2026-11-20, by user)
- Preview: rendered (2026-11-20, mockups/previews/)
- Visual verify: passed (2026-11-20; minors aceptados: nombre a la izquierda en top productos, error KPI a ancho completo, botón «Ver gráfico»)

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844, con el panel lateral de `ADMIN` y «Dashboard» activo):

| Pantalla / estado | Notas |
|---|---|
| Dashboard con datos (período por defecto, 4 KPI, 4 gráficos) | grilla 2×2 de gráficos en desktop, una columna en mobile |
| Selector de período: atajo elegido, rango personalizado, agrupación Semana/Mes | aclaración «Fechas en UTC» |
| Rango inválido (invertido / mayor a un año) | error junto a las fechas |
| Cargando (esqueletos en KPI y gráficos) | |
| Período sin ventas (KPI en 0, vacíos por bloque) | |
| Error en un bloque con «Reintentar» y los demás con datos | |
| «Ver como tabla» abierto en un gráfico | tabla equivalente |
| Actualizando (marca de actualización en curso) | reutiliza `MarcaActualizacion` |
