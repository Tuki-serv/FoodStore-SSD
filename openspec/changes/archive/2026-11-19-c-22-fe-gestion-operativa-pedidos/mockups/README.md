# Mockups — C-22 `fe-gestion-operativa-pedidos`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-19, by user) — con los ajustes registrados en `design.md` (en mobile la tarjeta «Acciones» del detalle va arriba).
- Preview: rendered (2026-11-19, headless Microsoft Edge + `playwright-core` desde `file://`, «reducir movimiento», viewports 1440x900 y 390x844). Playwright MCP no pudo abrir el navegador (busca Chrome, no instalado).
- Decisiones de base: OQ-1..OQ-8 con la propuesta por defecto (aprobadas por el usuario el 2026-11-19, ver `design.md`).

## Brief

- **Audiencia**: `PEDIDOS` (usuaria de ejemplo «Carla Ruiz», por defecto) y `ADMIN` («Laura Méndez», `?rol=admin`). Las mismas acciones para los dos; solo cambia el panel lateral (ADMIN suma el grupo «Administración»). `CLIENT` («Ana López», `?rol=client`) ve «No tenés acceso a esta sección» (pantalla 403 de C-13b) y su panel no tiene «Gestión de pedidos».
- **Tareas**: confirmar a mano pagos en efectivo/transferencia, avanzar cada pedido (Pasar a preparación → Despachar → Marcar entregado), cancelar con motivo, leer la entrega y el historial, enterarse de pedidos nuevos (polling 30 s + «Actualizar»).
- **Tamaños y breakpoints**: 1440x900 y 390x844. 1024 px: panel ↔ drawer, la lista pasa de grilla a tarjetas y el detalle a una columna (acciones e historial debajo, D9). 720 px: diálogos como hoja inferior, filtros en dos columnas, `kv` apilado.
- **Tokens y assets**: `design-system/tokens.css`, `brand.js`, logo provisional `design-system/assets/logo.svg` (TBD). Colores de estado `--state-*` (mismos `b-pendiente`…`b-cancelado` que `entities/pedido`).
- **Datos**: pedidos de ejemplo con productos del seed (precios del seed, envío fijo $ 50). #58 «Ana» `EFECTIVO` `PENDIENTE` por $ 3.850 con entrega en «Av. Siempre Viva 742, Springfield» y #57 «Bruno» `MERCADOPAGO` como en la spec.

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---|---|---|
| `gestion-pedidos.html` | Listado: filtros (Estado «Todos» + 6, Desde/Hasta, leyenda UTC, «Limpiar filtros»), «45 pedidos», «Actualizado a las HH:MM» + «Actualizar», filas con número/fecha, cliente, forma de pago, total, estado y **próxima acción** (o «Espera el pago en Mercado Pago» / «—»), «Mostrando 1–20 de 45» y paginación. | `?estado=filtros` (Pendiente + fechas, página 2 de 2) · `rango` (Desde > Hasta) · `carga` · `vacio` · `sin-resultados` · `error` · `aviso` (falló una actualización con datos previos) · `actualizando` («Actualizar» girando) · `avance` (fila #57 avanzada + toast) · `?rol=admin` · `?rol=client` · `?nav=drawer` |
| `gestion-pedido-detalle.html` | Detalle: «Volver a pedidos», «Pedido #N» + estado, fecha, marca de actualización; «Cliente y entrega» (cliente, forma de pago, dirección o «Retiro en el local», nota del cliente), «Productos» (con «Sin …») y totales; «Acciones» y «Historial» (línea de tiempo con autor, «Sistema», observaciones, cancelación resaltada). | `?estado=pendiente-efectivo` (defecto, #58) · `pendiente-mp` (#55, aviso MP) · `confirmado` (#57: retiro + nota + evento del Sistema) · `en-prep` (#54) · `en-camino` (#53, ADMIN, Sistema + observación) · `entregado` (#52) · `cancelado` (#51) · `carga` · `no-encontrado` · `historial-error` · `?id=NN` · `?rol=` |
| `dialogos.html` | Diálogos sobre el detalle del pedido correspondiente. | `?dialogo=confirmar-pago` (defecto) · `confirmar-pago-enviando` · `confirmar-pago-sin-stock` · `avance` · `despachar` · `entregar` · `transicion` · `conexion` · `cancelar` · `cancelar-sin-motivo` · `cancelar-sin-stock` · `cancelar-confirmado` · `exito` (toast tras el avance) |

Las anotaciones (franja amarilla y píldoras «Anotación») no son parte de la app.

## Cambios respecto del design system y de los mockups previos

- **Íconos nuevos, requieren revisión (TBD)**: `i-moto` (Despachar), `i-flecha` (transición en el diálogo), `i-nota` (nota del cliente), `i-calendario` (leyenda UTC). De C-19 se reusan `i-efectivo`, `i-transferencia`, `i-tarjeta`, `i-ok`, `i-reloj`.
- **Fila de pedido** (`.olist`/`.orow`): grilla con encabezado en versalitas (mismo lenguaje que `.plist` de C-17b); en mobile es tarjeta (número + estado arriba, cliente, pago + total, acción a lo ancho). El primario relleno se reserva para «Confirmar pago» (lo más urgente); los demás avances van como secundarios.
- **Línea de tiempo** (`.tl`): punto con el color del estado, autor en negrita o «Sistema» en color info, observación entre comillas, cancelación sobre `--color-danger-bg`.
- **Botón peligro contorneado** (`.btn-danger-outline`) para «Cancelar pedido» y «Cancelar por falta de stock»; el botón relleno de peligro queda para confirmar dentro del diálogo.
- **Aviso discreto de actualización fallida** (`.refresh-fail`, tokens de warning) sobre la lista sin vaciarla.
- **Botón secundario de los diálogos: «Volver»** (no «Cancelar» como dice D7) para no confundirlo con «Cancelar pedido».

## Capturas (`previews/`)

Cada una como `<nombre>-desktop.png` (1440x900) y `<nombre>-mobile.png` (390x844), 72 en total:
`gestion-pedidos-{datos,admin,filtros,rango,carga,vacio,sin-resultados,error,aviso,actualizando,avance,client}`,
`detalle-{pendiente-efectivo,pendiente-mp,confirmado,en-prep,en-camino,entregado,cancelado,carga,no-encontrado,historial-error,client}`,
`dialogo-{confirmar-pago,confirmar-pago-enviando,confirmar-pago-sin-stock,avance,despachar,entregar,transicion,conexion,cancelar,cancelar-sin-motivo,cancelar-sin-stock,cancelar-confirmado,exito}`.
`previews/full/` tiene la página completa de `gestion-pedidos-{datos,filtros}` y `detalle-{pendiente-efectivo,confirmado,en-camino}` en ambos tamaños.

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Panel abierto: `?nav=drawer`.
3. Re-render: `PWCORE=<ruta a playwright-core> node render.js "<ruta absoluta de esta carpeta>"` (Edge headless; también informa errores de consola, scroll horizontal y diálogos recortados).

## Fuentes

- `design-system/README.md` (Revision 2), `components.html`, `tokens.css`, `brand.md`
- Mockups aprobados de C-13b («Sin permiso»), C-17b (`mockup.css`/`mockup.js`, shell por rol, listas admin, diálogos, toasts) y C-19 (distintivos de estado, forma de pago, ítems con «Sin …»)
- `frontend/src/entities/pedido` (`etiquetaEstado`, `claseEstado`, `FORMAS_PAGO`), `shared/ui/paginacion`, `pages/forbidden`
- `proposal.md`, `design.md` (D1–D11, OQ-1..OQ-8) y specs `frontend-order-management` / `order-api` de este change
