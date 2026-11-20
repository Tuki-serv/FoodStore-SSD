# Tasks — C-24 `fe-dashboard-metricas`

> **`[UI-MOCKUP]` — apply bloqueado**: no se inicia el bloque 1 (ni ningún código) hasta que el usuario apruebe los mockups del bloque 0 (`Approval: approved` en `design.md` y `mockups/README.md`) y responda (o acepte por defecto) OQ-1..OQ-8 de `design.md`.
> **Criterios de aceptación visual**: los HTML y capturas de `openspec/changes/c-24-fe-dashboard-metricas/mockups/` una vez aprobados; cada tarea de UI se cierra comparándola con el estado correspondiente del mockup.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso; tests por interfaces públicas (HTTP en backend; lo que ve el usuario en frontend, leyendo las tablas de los gráficos y no el SVG), MSW en la frontera de red, sin aserciones tautológicas (literales del spec). Backend: pytest contra PostgreSQL `foodstore_test` desde `backend/`. Frontend: `npm test`, `npm run typecheck`, `npm run lint` desde `frontend/`.
> **Hard rules**: capas `models ← repository ← uow ← services ← routers` (sin Session ni lógica en routers); sin migraciones (no cambia el esquema); FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; estadísticas = server state (TanStack Query), período en la URL, sin Zustand nuevo; sin build ni dev server por iniciativa propia; sin commits.

## 0. Gate previo (antes de apply)

- [x] 0.1 Presentar al usuario OQ-1..OQ-8 (`design.md` §Open Questions) y registrar en `design.md` la respuesta (o «por defecto») de cada una; si alguna difiere del default, actualizar specs/design/tasks con `/opsx:update`. Verificación: tabla de OQ con la decisión anotada.
- [x] 0.2 Crear `mockups/` con los estados de `design.md` §UI Mockups (p. ej. `dashboard.html?estado=datos|cargando|vacio|error-bloque|tabla|actualizando&periodo=…`, `dashboard-periodo.html?error=invertido|largo`), importando `design-system/tokens.css` y `brand.js`, reutilizando `mockup.css`/`mockup.js` de changes anteriores, con datos de ejemplo verosímiles y los colores de estados/formas de pago de D8; `mockups/README.md` con `Approval: pending`. Verificación: archivos presentes y listados en el README.
- [x] 0.3 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas (legibilidad de ejes, sin scroll horizontal en mobile, contraste), corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes.
- [x] 0.4 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`; enlazar las capturas aprobadas como criterio de aceptación. Verificación: ambos archivos con la aprobación. **Sin esto no se inicia el bloque 1.**

## 1. Red de seguridad

- [x] 1.1 Backend: `pytest tests/integration/test_estadisticas.py tests/integration/test_contrato_rutas.py tests/integration/test_rbac_matriz.py tests/integration/test_pedidos*.py tests/integration/test_pago*.py tests/integration/test_flujo_compra_pago_entrega.py`; anotar la línea base. Si algo falla, frenar y reportarlo como falla previa.
- [x] 1.2 Frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base. Si algo falla, frenar y reportarlo.

## 2. Backend: definición de venta y resumen (spec `sales-metrics`, design D1, D5)

- [x] 2.1 RED: reescribir `tests/integration/test_estadisticas.py` con un helper `crear_pedido(estado, forma_pago, total, created_at, lineas=())` y los casos del resumen: pedido `EFECTIVO` `CONFIRMADO` sin pago → `ventas` 1, `ingresos` "1500.00"; `PENDIENTE` + `CANCELADO` solos → 0 y "0.00"; ventas 1000/1500/2000 → `ticket_promedio` "1500.00"; `EN_PREP` de ayer + `PENDIENTE` y `ENTREGADO` de hoy → `pedidos_activos` 1. Ejecutar → falla (claves y definición viejas).
- [x] 2.2 GREEN: constante `ESTADOS_VENDIDOS`/`ESTADOS_ACTIVOS` junto a la FSM; predicado común de pedido vendido en `PedidoRepository` (sin join a `Pago`, sin la rama `ENVIRONMENT == "test"`); `resumen_ventas` y `contar_activos`; `ResumenResponse` nuevo y cálculo del ticket (`ROUND_HALF_UP`) en `EstadisticasService`. Ejecutar → verde.
- [x] 2.3 TRIANGULATE: pedido `MERCADOPAGO` `CONFIRMADO` con pago aprobado cuenta una vez aunque tenga además un intento rechazado; sin ventas → ticket "0.00"; ticket con decimales periódicos (100/3 → "33.33"). Ejecutar → verde. REFACTOR (nombres sin `get_`, router sin lógica).

## 3. Backend: rango, agrupación y serie de ventas (spec `sales-metrics`, design D2, D5)

- [x] 3.1 RED: rango invertido → 422 `VALIDATION_ERROR` `field` `desde`; 367 días → 422 `field` `hasta`; 366 días → 200; falta `hasta` → 422 `field` `hasta`, en los cinco endpoints (parametrizado). Ejecutar → falla.
- [x] 3.2 GREEN: dependencia `RangoFechas` con el error de validación del handler existente; aplicada en los cinco endpoints. Ejecutar → verde.
- [x] 3.3 RED: serie por día del 2026-11-09 al 11 con una venta el 10 → 3 elementos con ceros; borde UTC (01:30 UTC del 10 cuenta el 10); mensual 2026-10-15..2026-11-15 con ventas el 31/10 y el 02/11 → `2026-10-01` y `2026-11-01`; semanal arranca en lunes; `agrupacion=year` → 422 `field` `agrupacion`. Ejecutar → falla.
- [x] 3.4 GREEN: `ventas_por_periodo` con `generate_series` + `LEFT JOIN` y `fecha` como `date`; `agrupacion: Literal["day","week","month"]`. Ejecutar → verde. TRIANGULATE: rango de un solo día, mes que cruza año (diciembre→enero). REFACTOR.

## 4. Backend: ranking, estados y formas de pago (spec `sales-metrics`, design D3, D4)

- [x] 4.1 RED: 8 «Empanada» (2400) y 5 «Pizza» (5000) → Empanada primero; dos productos «Tarta» homónimos → dos elementos con `producto_id` distintos; producto solo en pedido `CANCELADO` no aparece; `limit=21` y `limit=0` → 422 `field` `limit`; respuesta con `producto_id`, `nombre`, `cantidad_vendida`, `ingresos`. Ejecutar → falla.
- [x] 4.2 GREEN: `productos_top` agrupado por `producto_id` con el orden y desempate de D4; `limit` 1..20 por defecto 5; `ProductoTopItem` con `producto_id`. Ejecutar → verde.
- [x] 4.3 RED: pedidos por estado con 2 `PENDIENTE` + 1 `CANCELADO` → 6 elementos en el orden de la FSM con ceros; ingresos por forma de pago con `EFECTIVO` 1500 y dos `MERCADOPAGO` de 500 → `EFECTIVO`, `MERCADOPAGO`, `TRANSFERENCIA` "0.00"/0 en ese orden. Ejecutar → falla.
- [x] 4.4 GREEN: `pedidos_por_estado` desde `estado_pedido LEFT JOIN pedidos` (orden `orden`), `ingresos_por_forma_pago` desde `forma_pago LEFT JOIN` vendidos. Ejecutar → verde. TRIANGULATE: rango sin pedidos → 6 ceros y 3 formas en 0 (orden por código).
- [x] 4.5 RBAC y cierre del backend: `CLIENT`+`PEDIDOS` → 403 `HTTP_403` y sin token y sin parámetros → 401 `HTTP_401` (autorización antes que validación); `main.py` incluye el router con `prefix="/api/v1"` y el router queda con `/estadisticas`; `test_contrato_rutas.py` y `test_rbac_matriz.py` sin cambios y verdes; suite de 1.1 verde. Docs: `knowledge-base/07_flujos_principales.md` §Dashboard y `knowledge-base/02_descripcion_general.md` (contrato y definición de venta), `knowledge-base/05_reglas_de_negocio.md` (regla de venta, nueva RN). Verificación: suite verde y docs coherentes con el spec.

## 5. Frontend: dependencia y entidad `estadistica` (spec `frontend-admin-dashboard`, design D7, D9)

- [x] 5.1 Instalar `recharts` 2.x con versión exacta (`npm install recharts@<2.x> --save-exact` desde `frontend/`, con OK del usuario si el entorno lo pide). Verificación: aparece en `package.json` y `npm run typecheck` sigue verde.
- [x] 5.2 RED → GREEN + TRIANGULATE `entities/estadistica/model/periodo.ts` (hoy 2026-11-20: defecto `2026-10-22..2026-11-20`; «7 días» `2026-11-14..`; «Este mes» `2026-11-01..`; «Hoy»; `validarRango` invertido/366/367 días; `rotuloPeriodo`: `10/11`, «Sem. 09/11», «nov 2026») y `model/importe-grafico.ts` (`aNumero("1500.50")` → 1500.5; `porcentajes` 1500/500 → 75/25 y suma 100 con redondeos, todo cero → ceros). Ejecutar → verde.
- [x] 5.3 `src/test/msw/estadisticas.ts`: handlers de los cinco reportes con datos por defecto, override por endpoint (datos, vacío, 500, red) y registro de query strings; `src/test/render-dashboard.ts`. Verificación: test de humo del handler pasa.
- [x] 5.4 RED → GREEN + TRIANGULATE `estadisticas-api.ts` + `estadisticaQueries` (query strings exactos: `?desde=…&hasta=…`, serie con `agrupacion`, ranking con `limit=5`; claves `['estadisticas', reporte, params]`; error 500 propagado como `ApiError`). Tipos en `model/estadistica.ts`, `index.ts` público. Ejecutar → verde; typecheck verde.

## 6. Frontend: ruta y acceso (spec `frontend-admin-dashboard`, delta `frontend-app-shell`)

- [x] 6.1 RED: `src/app/router/__tests__/rutas-admin-dashboard.test.tsx` — `CLIENT`+`ADMIN` en `/admin/dashboard` ve «Dashboard» y las tarjetas (no la provisoria); `CLIENT`+`PEDIDOS` → acceso denegado sin ningún `GET /estadisticas/*` en MSW; anónimo → `/ingresar` con la ruta recordada; ninguna ruta del mapa muestra la provisoria. Ejecutar → falla.
- [x] 6.2 GREEN: `AdminDashboardPage` mínima en `pages/admin-dashboard`, registrada en `PAGINAS` de `routes.tsx`; `DuenoRuta` sin `C-24`; reapuntar `rutas-mis-pedidos.test.tsx` y `routes.test.tsx` (la provisoria se prueba con `PlaceholderPage` directo, OQ-7); corregir el comentario obsoleto de `RUTA_PAGO_PEDIDO` en `shared/config/routes.ts`. Ejecutar → verde.

## 7. Frontend: período y tarjetas KPI (spec `frontend-admin-dashboard`; mockup «con datos», «período», «rango inválido»)

- [x] 7.1 RED → GREEN + TRIANGULATE `pages/admin-dashboard/model/filtro.ts`: URL sin parámetros → defecto; `?desde&hasta&agrupacion=week` respetados; `agrupacion=year` o fecha inválida → defecto; `aParametros` sin rastro de defectos. Ejecutar → verde.
- [x] 7.2 RED: página con resumen `3`/"4500.00"/"1500.00"/`2` → tarjetas «3», «$ 4.500», «$ 1.500», «2» y la aclaración de «Pedidos activos»; elegir «Este mes» → URL `desde=2026-11-01&hasta=2026-11-20` y MSW recibe los cinco reportes con ese rango (`vi.useFakeTimers` con 2026-11-20 UTC). Ejecutar → falla.
- [x] 7.3 GREEN: `SelectorPeriodo` (atajos, rango, agrupación; aclaración «Fechas en UTC») y `TarjetasKpi` con `formatearPrecio`; CSS del dashboard importado en `app/styles/index.css` (lo verifica `styles-compile`). Ejecutar → verde y comparar con el mockup aprobado.
- [x] 7.4 TRIANGULATE: rango invertido → «La fecha "Desde" no puede ser posterior a "Hasta"» sin pedidos nuevos; > 366 días → «El período no puede superar un año»; URL con `agrupacion=week` → «Semana» elegida; «Pedidos activos» navega a `/gestion-pedidos`. Ejecutar → verde.

## 8. Frontend: gráficos y alternativa accesible (spec `frontend-admin-dashboard`, design D8; mockup «con datos», «tabla»)

- [x] 8.1 RED: «Ver como tabla» en «Productos más vendidos» muestra columnas «Producto», «Cantidad», «Ingresos» con las filas de MSW; la tabla de ventas por día rotula `09/11`, `10/11`, `11/11`; la de estados muestra «En preparación» 3 en el orden de la FSM; la de formas de pago «Efectivo» 75 % y «Tarjeta (Mercado Pago)» 25 %. Ejecutar → falla.
- [x] 8.2 GREEN: `BloqueGrafico` (título, «Ver como tabla», tabla asociada, gráfico `aria-hidden`) y los cuatro gráficos recharts con colores de tokens (`COLOR_ESTADO` expuesto desde `entities/pedido` sin duplicar valores) y animación desactivada con `prefers-reduced-motion`; stub de `ResizeObserver` en los tests de la página. Ejecutar → verde y comparar con el mockup aprobado.
- [x] 8.3 TRIANGULATE: agrupación «Mes» rotula «nov 2026»; activar «Pendiente» en la tabla de estados navega a `/gestion-pedidos?estado=PENDIENTE`; un estado desconocido se muestra con su código; axe sin violaciones con datos y con una tabla abierta. Ejecutar → verde.

## 9. Frontend: carga, vacío, error y actualización (spec `frontend-admin-dashboard`; mockups «cargando», «vacío», «error en bloque», «actualizando»)

- [x] 9.1 RED: `productos-top` 500 y el resto 200 → solo ese bloque muestra error con «Reintentar» y los demás sus datos; Reintentar con 200 → datos (MSW registra un solo pedido nuevo, al ranking). Ejecutar → falla.
- [x] 9.2 GREEN: estados por bloque en `BloqueGrafico`/`TarjetasKpi` con `EsqueletoFilas`/`EstadoVacio`/`EstadoError` de `shared/ui`; `refetch` por bloque. Ejecutar → verde.
- [x] 9.3 TRIANGULATE: período sin ventas → «Sin ventas en este período» en serie, productos y formas de pago, tarjetas en 0 y «$ 0»; esqueletos mientras cargan; «Actualizar» vuelve a pedir los cinco reportes y la `MarcaActualizacion` cambia al terminar; volver a un período ya visto muestra sus datos sin esqueleto. axe sin violaciones en vacío y error. Ejecutar → verde.

## 10. Cierre

- [x] 10.1 Integración: backend suite completa verde contra la línea base de 1.1; frontend `npm test`, `npm run typecheck`, `npm run lint` verdes y `tests/architecture` (`fsd-boundaries`, `styles-compile`) en cero violaciones.
- [x] 10.2 Revisión SOLID/DRY del diff: un solo predicado de venta en el backend, sin lógica en el router, `BloqueGrafico` compartido por los cuatro gráficos, etiquetas de estado/forma de pago y formato de importes reutilizados de `entities/pedido`/`entities/producto`, sin `any`. Anotar la revisión en este archivo.
- [x] 10.3 Docs: `knowledge-base/06_funcionalidades.md` (US-028 marcada), `knowledge-base/09_decisiones_y_supuestos.md` (decisiones de OQ-1..OQ-5 si se aceptan, como DD nueva), `frontend/README.md` (pantalla «Dashboard» y `recharts`), `CHANGES.md` (cierre de C-24 y «Punto de partida (C-24)» en C-25b si aplica). Verificación: archivos actualizados y coherentes con los specs.

## Workflow follow-up

- Verify visual (`design.md` §UI Mockups paso 12): backend real + Vite con permiso del usuario, comparar dashboard con datos, vacío, error por bloque y tabla con los mockups aprobados a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-24-fe-dashboard-metricas` y marcar `[x]` en `CHANGES.md`.

### Revisión SOLID/DRY (10.2)

- Un solo predicado de venta (`condiciones_vendido` + `ESTADOS_VENDIDOS` en `pedidos/fsm.py`) lo usan resumen, top de productos e ingresos por forma de pago; la serie temporal (`ventas_por_periodo`) usa SQL con `generate_series` y repite el filtro con la misma constante `ESTADOS_VENDIDOS` (observación menor, no se unificó: requiere el `LEFT JOIN` sobre la serie).
- Router sin `Session` ni lógica: solo `RangoFechasDep` (validación en `dependencies.py`) y delegación al service; capas `models <- repository <- uow <- service <- router` sin imports hacia arriba.
- Frontend: sin `any`; `BloqueGrafico` compartido por los cuatro gráficos (carga/vacío/error/tabla); estilos de gráfico en `estilo-grafico.ts`; etiquetas y colores de estado desde `entities/pedido`, importes con `formatearPrecio` de `entities/producto`; `tests/architecture` en verde.
- Corrección del cierre: `validarRango` contaba la diferencia simple de días (aceptaba 367 días inclusivos); ahora es inclusivo como el backend (2026-01-01..2027-01-01 válido, ..2027-01-02 «largo»).

### Seguimiento del verify (2026-11-20)

- a11y mobile: el botón «Ver como tabla»/«Ver gráfico» lleva `aria-label` con su texto visible (el CSS oculta el `.lbl` en 390 con recorte visualmente oculto, sin `display:none`) y mide 44x44 en mobile; test en `admin-dashboard-graficos.test.tsx`.
- Fechas en 390: `padding` y `gap` ajustados para ver `22/10/2026` completo.
- «Ver como tabla»: borde del mockup (`!border !border-border`; la utilidad `border-transparent` ganaba a la capa `components`).
- «Actualizar» a ancho completo en mobile (`.refresh button{flex:1 1 100%}`; la regla anterior solo ensanchaba el contenedor).
- Recapturas en `mockups/verify/` (dashboard-datos 1440/390, tabla-ventas 390).
