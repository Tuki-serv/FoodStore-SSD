# Mockups C-24 — Dashboard (fe-dashboard-metricas)

- Design system revision: 2 (`design-system/tokens.css`, `brand.js`, panel lateral DD-25; «Dashboard» activo, usuaria ADMIN de ejemplo «Ana Gómez»)
- Approval: approved (2026-11-20, by user)
- Preview: rendered (2026-11-20) con Microsoft Edge headless (playwright-core, file://), 1440x900 y 390x844 (emulación móvil). Capturas en `previews/<estado>-1440.png` y `previews/<estado>-390.png` (la ventana se alarga hasta la altura de la página).
- Fuentes: `design.md` (§UI Mockups, OQ-1..OQ-8 aceptadas con el default, D7–D9), `specs/frontend-admin-dashboard/spec.md` (textos), distintivos de estado y formas de pago de C-22, shell y `mockup.css`/`mockup.js` de C-23. Todo local, sin CDN: los gráficos son SVG en línea que imitan lo que dibujará recharts; los datos son de ejemplo y «hoy» queda fijo en 20/11/2026.

Cómo verlos: abrir `dashboard.html` en el navegador (file://) con el query string indicado; `?nav=collapsed|expanded|drawer` controla el panel lateral. Pasar el mouse sobre «Ventas por período» muestra el tooltip de cada punto.

## Pantallas y estados (`dashboard.html`)

| Pantalla / estado | URL | Capturas (`previews/`) |
|---|---|---|
| Dashboard con datos (últimos 30 días por día, 4 KPI, 4 gráficos, tooltip fijado) | `dashboard.html` | `dashboard-datos` |
| Atajo «Últimos 7 días» | `?periodo=7d` | `periodo-7d` |
| Atajo «Hoy» (un solo punto) | `?periodo=hoy` | `periodo-hoy` |
| Atajo «Este mes» | `?periodo=mes-actual` | `periodo-este-mes` |
| Rango personalizado 01/11–15/11 agrupado por Semana (rótulos «Sem. dd/mm») | `?periodo=semana` | `periodo-semana` |
| Rango personalizado 01/06–20/11 agrupado por Mes (rótulos «jun 2026») | `?periodo=mes` | `periodo-mes` |
| Rango inválido: «Desde» posterior a «Hasta» | `?error=invertido` | `rango-invertido` |
| Rango inválido: más de un año | `?error=largo` | `rango-largo` |
| Cargando (esqueletos en KPI y gráficos) | `?estado=cargando` | `cargando` |
| Período sin ventas (KPI en 0, vacíos por bloque, «Pedidos activos» sigue en 9) | `?estado=vacio` | `vacio` |
| Error en un bloque con «Reintentar» y los demás con datos | `?estado=error-bloque` | `error-bloque` |
| «Ver como tabla» abierto: productos / estados (con enlaces a la gestión) / ventas / pagos | `?estado=tabla&bloque=productos\|estados\|ventas\|pagos` | `tabla-productos`, `tabla-estados`, `tabla-ventas`, `tabla-pagos` |
| Actualizando (botón deshabilitado con spinner, datos visibles atenuados) | `?estado=actualizando` | `actualizando` |
| Panel colapsado (desktop) / drawer abierto (mobile) | `?nav=collapsed` / `?nav=drawer` | `panel-colapsado-1440` / `drawer-abierto-390` |

En mobile (390) el panel está cerrado (barra superior con menú) salvo en `drawer-abierto`.

## Decisiones de diseño a revisar (TBD hasta la aprobación)

- Layout: título + marca de actualización; tarjeta de período (atajos, agrupación, Desde/Hasta, «Fechas en UTC»); 4 KPI (2×2 en mobile); grilla 2×2 de gráficos (una columna en mobile).
- «Pedidos activos» es una tarjeta-enlace (borde verde, «Ver pedidos →») a `/gestion-pedidos`, con la aclaración «ahora, sin importar el período».
- Eje de importes abreviado («$ 20 mil», «$ 1,2 M») para que entre en mobile; tooltips y tablas con el importe completo. (TBD)
- Estados: barras verticales en desktop y horizontales en pantallas angostas, con el color de cada distintivo (`--state-*-fg`) y el nombre visible bajo/junto a la barra. Formas de pago: dona con `--color-primary` (Mercado Pago), `--color-accent` (efectivo) y `--color-info` (transferencia) + leyenda con importe y porcentaje (suma 100). No hay tokens nuevos ni bump de Revision.
- Top de productos: barras horizontales por cantidad, con el nombre arriba y los ingresos («facturado en el producto») a la derecha.
- «Ver como tabla» reemplaza el gráfico por su tabla equivalente (botón «Ver gráfico» para volver; solo ícono en mobile); la tabla de estados enlaza cada estado a `/gestion-pedidos?estado=…`.
- El input de fecha es texto de solo lectura con el formato dd/mm/aaaa para que la captura sea fiel; en la app es el control de fecha nativo.
- Iconos nuevos (mismo trazo; (TBD) sumarlos al sprite del design system al aprobar): reloj, tarjeta, efectivo, transferencia, calendario, ticket, flecha, tabla, gráfico, vacío.
