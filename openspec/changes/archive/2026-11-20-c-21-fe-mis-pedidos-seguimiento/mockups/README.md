# Mockups — C-21 `fe-mis-pedidos-seguimiento`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, headless Microsoft Edge + `playwright-core` desde `file://`, «reducir movimiento», viewports 1440x900 y 390x844). Playwright MCP no abre el navegador en esta máquina (busca Chrome). Revisión del 2026-11-19 por OQ-4: se re-renderizaron solo las capturas `mis-pedidos-*` (listado con filtro por estado), incluidas las nuevas `mis-pedidos-filtro` y `mis-pedidos-filtro-vacio`; sin errores de consola ni scroll horizontal.
- Decisiones de base: OQ-1..OQ-6 resueltas por el usuario el 2026-11-19 (`design.md` §Open Questions): todas por defecto salvo **OQ-4 → filtro por estado** en el listado. Falta aprobar estos mockups revisados.

## Brief

- **Audiencia**: el cliente («Ana López», rol `CLIENT`). Panel lateral del cliente: Catálogo · Carrito · **Mis pedidos** (activo) · Direcciones · Mi cuenta. Un `ADMIN`/`PEDIDOS` ve lo mismo con sus pedidos propios (`propios=true`, OQ-1).
- **Tareas**: encontrar un pedido, entender en qué paso está y qué falta (pago o confirmación del local), pagar o reintentar el pago con Mercado Pago, y cancelar mientras se pueda (PENDIENTE/CONFIRMADO) con un motivo.
- **Tamaños y breakpoints**: 1440x900 y 390x844. 1024 px: panel ↔ drawer, lista de grilla a tarjetas, detalle a una columna con el orden Seguimiento → «¿Cambiaste de idea?» → Entrega y pago → Productos → Historial (patrón de «Acciones arriba» aprobado en C-22). 720 px: los pasos del progreso van en vertical; el diálogo es hoja inferior.
- **Tokens y assets**: `design-system/tokens.css`, `brand.js`, logo provisional `design-system/assets/logo.svg` (TBD). Colores de estado `--state-*` y piezas aprobadas en C-19/C-20b/C-22 (distintivos, forma de pago, ítems «Sin …», línea de tiempo, fila «Pago», traspaso al pago, diálogo de cancelación, marca de actualización).
- **Datos**: pedidos de ejemplo con productos del seed (envío fijo $ 50, también en retiro: así lo devuelve hoy el backend, deuda registrada en C-25b). #58 `EFECTIVO` `PENDIENTE` por $ 3.850 con entrega en «Av. Siempre Viva 742, Springfield» y #41 `ENTREGADO`, como en la spec.

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---|---|---|
| `mis-pedidos.html` | Listado propio: filtro «Estado» (select nativo «Todos» + seis estados, como gestión de C-22 sin fechas; «Limpiar filtro» si hay uno activo; visible en todos los estados), «23 pedidos», «Actualizado a las HH:MM» + «Actualizar», filas con número, fecha y hora, marca «En curso», forma de pago, total, estado y «Ver detalle»; «Mostrando 1–10 de 23» y paginación. | (sin parámetro) datos · `?estado=pagina` (3 de 3) · `filtro` («Entregado», 12 pedidos, 1 de 2) · `filtro-vacio` («En camino»: «No tenés pedidos en ese estado» + «Limpiar filtro») · `carga` · `vacio` · `error` · `actualizando` · `aviso` · `?nav=drawer` |
| `mi-pedido-detalle.html` | Detalle: «Volver a mis pedidos», «Pedido #N» + estado, fecha, marca de actualización (no en terminados); **Seguimiento** (5 pasos + «qué sigue», o banda «Pedido cancelado» con el motivo; traspaso al pago de Mercado Pago), **Entrega y pago** (dirección o «Retiro en el local», forma de pago, fila «Pago» en MP, tu nota), **Productos** y totales; **¿Cambiaste de idea?** («Cancelar pedido» o por qué ya no se puede) e **Historial** («Vos» / «El local» / «Automático»). | `?estado=pendiente-efectivo` (defecto, #58) · `pendiente-mp` (#63, rechazado) · `pendiente-mp-sin-pago` · `confirmado-mp` (#57, retiro + nota) · `en-prep` (#54) · `en-camino` (#53) · `en-camino-retiro` (#50, «Listo para retirar») · `entregado` (#41) · `cancelado` (#44) · `carga` · `no-encontrado` · `error` · `historial-error` · `actualizando` · `aviso` · `?id=NN` |
| `dialogos.html` | Diálogo «Cancelar el pedido #N» sobre su detalle. | `?dialogo=cancelar` (defecto) · `cancelar-sin-motivo` · `cancelar-enviando` · `cancelar-mp` (CONFIRMADO + MP: aviso de reintegro) · `transicion` (409: el local ya lo pasó a preparación) · `conexion` · `exito` (toast + detalle cancelado) |

Las anotaciones (franja amarilla y píldoras «Anotación») no son parte de la app.

## Cambios respecto del design system y de los mockups previos

- **Progreso del pedido** (`.steps`, nuevo): cinco pasos horizontales en desktop (cumplidos con tilde sobre `--color-primary`, actual con anillo `--color-primary-soft`), verticales en mobile (las etiquetas no entran en cinco columnas de 65 px). Debajo, la línea «qué sigue» (`.next`). Pedido cancelado: banda `.cancel-band` sobre `--color-danger-bg` con el motivo.
- **Filtro por estado** (`.mp-filters`, OQ-4): la tarjeta `.gp-filters` aprobada en C-22 con un solo campo (240 px en desktop, ancho completo en mobile) y «Limpiar filtro» al lado/debajo; el vacío con filtro usa el ícono de búsqueda y «Limpiar filtro» en vez de «Ver catálogo».
- **Marca «En curso»** (`.live`) en las filas no terminadas (punto que late; estático con «reducir movimiento»).
- **Tarjeta «¿Cambiaste de idea?»** en lugar de «Acciones»: el cliente tiene una sola acción posible; cuando ya no se puede cancelar explica por qué con el ícono de candado.
- **Autor del historial para el cliente**: «Vos» y «El local» en negrita, «Automático» en color info (mismo estilo que «Sistema» en C-22).
- **Botón principal del diálogo durante el envío**: «Cancelando…» (en gestión dice «Guardando…»).
- Sin íconos nuevos: se reusan los del sprite de C-22 (`i-guardar` como tilde de paso cumplido, `i-candado`, `i-reloj`, `i-tarjeta`, `i-tienda`, `i-nota`).

## Capturas (`previews/`)

Cada una como `<nombre>-desktop.png` (1440x900) y `<nombre>-mobile.png` (390x844), 62 en total:
`mis-pedidos-{datos,pagina,filtro,filtro-vacio,carga,vacio,error,actualizando,aviso}`,
`detalle-{pendiente-efectivo,pendiente-mp,pendiente-mp-sin-pago,confirmado-mp,en-prep,en-camino,en-camino-retiro,entregado,cancelado,carga,no-encontrado,error,historial-error,actualizando,aviso}`,
`dialogo-{cancelar,cancelar-sin-motivo,cancelar-enviando,cancelar-mp,transicion,conexion,exito}`.
`previews/full/` tiene la página completa de `mis-pedidos-datos` y `detalle-{pendiente-efectivo,pendiente-mp,confirmado-mp,en-prep,cancelado}` en ambos tamaños.

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Panel abierto: `?nav=drawer`.
3. Re-render: `PWCORE=<ruta a playwright-core> node render.js "<ruta absoluta de esta carpeta>" [regex]` (Edge headless; informa errores de consola, scroll horizontal, elementos que se salen y diálogos recortados).

## Fuentes

- `design-system/README.md` (Revision 2), `tokens.css`, `brand.md`
- Mockups aprobados de C-22 (`mockup.css`, `mockup.js`, `gestion.css` copiados sin cambios: shell, lista, detalle, línea de tiempo, diálogos, toasts), C-19 y C-20b (fila «Pago», traspaso al pago, «No encontramos este pedido»)
- `frontend/src/entities/pedido`, `entities/payment`, `pages/pedido-creado`, `pages/gestion-pedidos`
- `proposal.md`, `design.md` (D1–D10, OQ-1..OQ-6) y specs `frontend-my-orders` / `order-api` / `frontend-app-shell` de este change
