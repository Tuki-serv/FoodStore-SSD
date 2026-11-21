# Design — C-25b1 `deuda-heredada`

## Context

Motivación y alcance: ver `proposal.md`. Este change es el **bloque A** del C-25b original, partido en dos (OQ-9 de C-25b: partición aprobada por el usuario 2026-11-21). El bloque B (README, plantillas de entorno, E2E con frontend, capturas, checklist, video) vive en `c-25b-entrega-docs-video` y **depende de que este change esté archivado**: las capturas y el video congelan el código final. Los ids de decisiones abiertas (OQ-x) conservan la numeración del design original para mantener la trazabilidad.

Estado observado el 2026-11-21 (rama `dev`, tras `endurecimiento-pagos-webhook`):

- **Backend**: `PedidoService.crear_pedido` (`backend/app/modules/pedidos/service.py`) guarda `data.direccion_id` sin validar dueño ni existencia (FK → 500 si no existe; dirección ajena aceptada), busca cada id de `personalizacion` con `uow.ingredientes.get_by_id` e ignora en silencio los que no existen, sin comprobar que sean removibles del producto, y lanza todos sus rechazos con `AppError.http(400|404, texto)` sin `code` de negocio. `ErrorCode` (`app/core/errors.py`) no tiene códigos de creación. `COSTO_ENVIO_FIJO = 50.00` se aplica siempre, como manda RN-PE-09/DD-10 (la KB fija hoy $50 también en retiro; el cambio está en PA-13, abierta). Migraciones hasta `006`. Ya existe el E2E de API `backend/tests/integration/test_flujo_compra_pago_entrega.py` (C-25a) y la cobertura ≥ 60 % con umbral automático (PA-16 resuelta por C-25a: `backend/.coveragerc`, `fail_under = 60`).
- **Direcciones**: `DireccionEntrega` tiene `es_principal`, `deleted_at` y `updated_at`; la regla «una sola principal» (RN-DI-01) solo la sostiene el service.
- **Frontend**: `clasificarErrorCreacion` (`entities/pedido/model/clasificar-error.ts`) clasifica por texto de `detail`. El drawer mobile (`app/layouts/app-shell/app-shell.tsx`) mueve el foco al abrir/cerrar pero no es diálogo modal (sin `role="dialog"`, `aria-modal`, trampa de foco ni `inert`; el scrim es `aria-hidden`). `index.html` evita el 404 con `<link rel="icon" href="data:,">` (sin ícono real). `package.json` no tiene script `build`; el `Dockerfile` es solo servidor de desarrollo. `tests/architecture/fsd-boundaries.test.ts` controla imports pero no exige `index.ts` en cada slice.
- **Design system**: Revision 2 aprobada, modo `system-and-mockups`. El sprite de `components.html` tiene solo los 17 íconos de navegación; `shared/ui/icon` usa 49: faltan 32 (`brujula`, `alerta`, `obra`, `candado`, `editar`, `basura`, `estrella`, `mas`, `tienda`, `buscar`, `filtros`, `menos`, `guardar`, `volver`, `plato`, `subcategoria`, `alergeno`, `reintentar`, `tarjeta`, `efectivo`, `transferencia`, `reloj`, `info`, `exito`, `moto`, `flecha`, `nota`, `calendario`, `ticket`, `tabla`, `grafico`, `vacio`). `.active-orchestrator-state.json` dice `revision: 1` mientras `design-system/README.md` dice `Revision: 2` (modo coincide: `system-and-mockups`). En esta máquina Playwright MCP no tiene Chrome: C-22 capturó con Edge headless + `playwright-core`.
- **Reglas que condicionan**: la spec (integrador v5.0 + KB) manda sobre el código; cambios de autorización son CRÍTICO (regla 11: OK del usuario antes de escribir código); toda alteración de esquema lleva migración Alembic; no levantar dev server ni build por iniciativa propia (regla 13): las tareas que lo necesitan piden permiso o las hace el usuario; nada de commits sin pedido.

## Goals / Non-Goals

**Goals:**
- Cerrar la deuda heredada que afecta a seguridad, integridad o a lo que se ve en el video, con TDD estricto.
- Dejar el código congelado (archivado y mergeado a `main`) antes de que `c-25b-entrega-docs-video` capture pantallas y se grabe el video.

**Non-Goals:**
- Documentación y evidencia de entrega (README, `.env.example`, checklist, capturas, guion, video): `c-25b-entrega-docs-video`.
- Resolver PA-07 (COCINA/KDS/WebSocket) o PA-19 (extras): Fase 2.
- Rediseñar pantallas: solo se ajustan a mockups ya aprobados.
- Cambiar los status HTTP de error existentes (solo se agregan `code`/`field`).

## Gobernanza

- **Aprobado A1 (2026-11-21, usuario)**: `direccion_id` debe pertenecer al usuario que crea el pedido; si no, 404 `ADDRESS_NOT_FOUND` (D1).
- **Decisiones del usuario (2026-11-21)**: OQ-4/PA-13 mantener $50 fijo; OQ-10 idempotencia diferida; OQ-5/OQ-6 según recomendación (sin trabajo); OQ-8 sin mockups nuevos.

- **CRÍTICO — A1** (autorización de `direccion_id`): el agente presenta D1 y **espera OK explícito del usuario antes de escribir código** (regla 11). Se registra aquí como «Aprobado A1 (fecha, usuario)». Hasta entonces el grupo 2 no arranca (tarea 2.1).
- **ALTO — migración `007`** (toca datos de usuarios): el agente muestra el SQL de upgrade/downgrade antes de aplicarla a una base con datos (la de desarrollo); en `foodstore_test` se prueba libremente.
- **Visual del design system — Revision 3** (sprite + favicon): requiere revisión y aprobación del usuario (tarea 6.3); sin ella no se declara el favicon (6.4).
- **MEDIO** — A2, A3; **BAJO** — A5..A9, A11: implementación con checkpoints.

## Deuda heredada — alcance

| # | Origen | Ítem | Gobernanza | Alcance | Mockup / visual |
|---|---|---|---|---|---|
| A1 | C-19 R3 | `POST /pedidos/` valida `direccion_id` (existe, activa, del usuario) | **CRÍTICO** (autorización / IDOR: hoy un cliente puede asociar la dirección de otro y verla en el detalle) | **En alcance**, con OK explícito del usuario antes de escribir código | No visual |
| A2 | C-19 R4 | Ids de `personalizacion` = ingredientes removibles del producto | MEDIO (integridad de snapshot) | En alcance | No visual |
| A3 | C-19 R1 | `code`/`field` estables en rechazos de creación + clasificador por `code` | MEDIO (contrato API aditivo) | En alcance | No visual (mismos avisos; el de dirección reutiliza el patrón aprobado de C-19) |
| A4 | C-15 R3 | Índice único parcial de principal + migración `007` | BAJO (según CHANGES) — la migración toca datos de usuarios: se trata como **ALTO** (ver D5) | En alcance | No visual |
| A5 | C-13a | Drawer mobile modal (`role`, `aria-modal`, trampa de foco, `inert`) | BAJO | En alcance | No cambia la apariencia: sin mockup |
| A6 | C-13a | Test que exige `index.ts` por slice/segmento | BAJO | En alcance | No visual |
| A7 | C-13a | Test de `readConfig` que distinga vacío de URL inválida | BAJO | En alcance | No visual |
| A8 | C-13a | Título del 404 en mobile en una línea vs. dos del mockup | BAJO | En alcance: ajustar a `openspec/changes/archive/2026-11-15-c-13a-fe-foundation-scaffold/mockups/not-found.html` | Visual, ya cubierto por mockup aprobado: sin mockup nuevo |
| A9 | C-13a | Imagen de producción del frontend + script `build` | BAJO | En alcance | No visual |
| A10 | C-13a, C-15, C-22 | Sprite de `components.html` con los 32 íconos faltantes + favicon | BAJO, **visual del design system** | En alcance: **Revision 3** con revisión y aprobación del usuario | Revisión del foundation (no mockup de change) |
| A11 | US-030 | Swagger con `summary`/`tags`/errores en todas las operaciones | BAJO | En alcance | No visual |
| X1 | C-19 R2 | Idempotencia de creación de pedidos | MEDIO-ALTO | **Diferido** (OQ-10): requiere columna + migración + cabecera `Idempotency-Key` + cambio del frontend; el riesgo real (un `PENDIENTE` duplicado tras timeout) se mitiga cancelando y no afecta stock (no se descuenta al crear). Se documenta como limitación en C-25b | — |
| X2 | C-22 R1 | Envío $0 en retiro | MEDIO | **Bloqueado por PA-13** (OQ-4): la KB/spec vigente (RN-PE-09, DD-10, `frontend-checkout`) dice $50 fijo; cambiarlo sin decisión violaría «la spec manda» | — |
| X3 | C-22 R2, R6, OQ-7 | Fechas locales, multi-estado, búsqueda por cliente/número | MEDIO | **Diferido**: mejora funcional fuera de la rúbrica; la leyenda «UTC» ya lo explica; se documenta en C-25b | — |
| X4 | C-13a | Quitar la escala por defecto de Tailwind | BAJO pero de alto impacto visual | **Diferido** (OQ-6): tocaría todas las pantallas aprobadas justo antes de capturar | — |
| X5 | C-15 OQ-1 | Promover otra principal al eliminar la principal | BAJO | **Sin trabajo**: el usuario aprobó el valor por defecto (no promover) el 2026-11-17 (OQ-5) | — |
| X6 | C-19 OQ-2/OQ-5 | Endpoint de formas de pago, datos bancarios | — | **Sin trabajo**: resueltos por defecto por el usuario (2026-11-19) | — |
| X7 | C-22 | COCINA/KDS/WebSocket | — | Fase 2 (PA-07, C-26/C-27) | — |

## Decisions

### D1 — Validación de la dirección dentro de la misma transacción de creación
`crear_pedido` busca la dirección por id **y** `usuario_id` dentro del `uow` y sin baja lógica; si no aparece, `AppError(404, ADDRESS_NOT_FOUND, field="direccion_id")`. Se valida antes de tocar productos para fallar rápido.
*Por qué 404 y no 403*: un 403 confirmaría que el id existe para otro usuario (enumeración). RN-DI-03 usa 403 en `/direcciones/{id}` porque allí el recurso es la dirección; aquí es un dato de entrada del pedido. *Alternativa*: 403 con el texto de RN-DI-03 — descartada por la fuga de existencia. Consulta nueva en el repositorio de direcciones (método genérico por id + dueño, sin duplicar CRUD; regla 3).

### D2 — Personalización validada contra los ingredientes del producto
Por línea, se obtienen los ingredientes removibles del producto (una consulta por producto, vía repositorio de `producto_ingrediente`) y se exige `set(personalizacion) ⊆ removibles`. El snapshot de nombres sale de ese mismo conjunto (deja de ignorar ids inexistentes). *Alternativa*: validar en el schema — imposible sin base.

### D3 — `field` posicional en vez de ampliar el formato de error
El formato único `{detail, code, field}` (api-conventions) no se amplía: la línea afectada se indica con `field = "items.<índice>.producto_id"` (o `.personalizacion`), el índice de la línea en el request. El frontend mapea índice → línea del carrito porque envía las líneas en el orden del carrito. *Alternativa*: sumar `producto_id` al cuerpo — rompe el formato único y exige cambiar el handler global.

### D4 — Status HTTP conservados, `code` nuevos en `ErrorCode`
Se agregan `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `DUPLICATE_ITEM`, `PAYMENT_METHOD_UNAVAILABLE`, `ADDRESS_NOT_FOUND`, `INVALID_CUSTOMIZATION` y se reutiliza `INSUFFICIENT_STOCK` (400 en creación, 409 en confirmación). Conservar los status evita romper `order-stock` y los tests existentes; el frontend pasa a ramificar por `code`. `clasificarErrorCreacion` mantiene el fallback por status (5xx/red → «Reintentar»; código desconocido → mensaje sin acción).

### D5 — Índice único parcial con saneamiento previo en la migración `007`
`CREATE UNIQUE INDEX uq_direccion_principal_activa ON direccion_entrega (usuario_id) WHERE es_principal AND deleted_at IS NULL`. Antes de crearlo, la migración desmarca las principales activas duplicadas dejando la de `updated_at` más reciente (desempate por `id`). `downgrade` solo elimina el índice. El modelo SQLModel declara el índice (`Index(..., postgresql_where=...)`) para que autogenerate no lo revierta. En el service, `marcar_principal` desmarca la anterior y marca la nueva en la misma transacción; una `IntegrityError` por carrera se traduce a 409 `DUPLICATE_VALUE` con `field="es_principal"` (no 500). Se trata la migración como **ALTO** (toca datos de usuarios): el agente muestra el SQL antes de aplicarla a una base con datos.

### D6 — Drawer modal sin dependencias nuevas
`role="dialog"`, `aria-modal="true"` y `aria-label="Menú"` en el `<aside>` solo cuando `drawerAbierto`; atributo `inert` en la barra superior y en `<main>` mientras está abierto; trampa de foco con un manejador de `keydown` Tab/Shift+Tab que recorre los enfocables del panel (reutilizando la lógica del `shared/ui/dialogo` si es extraíble a `shared/lib`, sin duplicar; regla 5). *Alternativa*: `focus-trap-react` — dependencia nueva para un caso que ya resolvió el diálogo propio.

### D7 — Imagen de producción multi-stage
`frontend/Dockerfile` con stages `dev` (actual, el que usa compose: `target: dev`) y `prod` (`node` → `npm run build` con `ARG VITE_API_URL` → `nginx:alpine` con `try_files $uri /index.html`). El build necesita `design-system/` (fuera del contexto `./frontend`): el stage `prod` se construye con contexto en la raíz o con `additional_contexts` de compose (`design-system=./design-system`). Se agrega un servicio/perfil `frontend-prod` en compose (`profiles: ["prod"]`), sin tocar el servicio `frontend` por defecto. Script `build`: `tsc --noEmit -p tsconfig.json && vite build`. **Correr el build** (regla 13) lo hace el usuario o el agente con permiso explícito; el test estático lee `package.json` y `Dockerfile`.

### D8 — Swagger verificado por test sobre `/openapi.json`
Un test recorre todas las operaciones bajo `/api/v1` y exige `summary` y `tags`; otro comprueba los `responses` de error de las operaciones del contrato crítico (pedidos, pagos, auth). Las respuestas de error comunes se declaran con un diccionario compartido (`app/core/` o `utils/`) que los routers reutilizan, para no repetir bloques (regla 5).

### D9 — Design system Revision 3
Se suman al sprite de `components.html` los 32 íconos que usa `shared/ui/icon` (mismos trazos, copiados del componente para que ambos coincidan) y un `assets/favicon.svg` derivado del `logo.svg` provisional, marcado como provisional. Se sube `Revision: 3`, `Approval: pending`, se re-renderizan las previews (390x844, 1440x900) y se pide aprobación. No cambia ninguna pantalla existente (los íconos ya están en la app), así que no hay mockups afectados que rerenderizar. Se reconcilia `.active-orchestrator-state.json` (`revision`) con el README al aprobarse.

## UI Mockups

- Design system revision: 3 (A10; aprobada por el usuario el 2026-11-21)
- Decision: provided (2026-11-21) — **confirmado por el usuario el 2026-11-21 (OQ-8: sin mockups nuevos)**. El change no crea pantallas ni cambia layouts: A8 se ajusta al mockup ya aprobado de C-13a (`openspec/changes/archive/2026-11-15-c-13a-fe-foundation-scaffold/mockups/not-found.html`); A3 reutiliza el aviso aprobado de C-19; A5 no altera la apariencia; A10 se revisa como revisión del foundation (Revision 3), no como mockup de change.
- Mockups: `not-found.html` de C-13a (A8) y el aviso de error de creación de C-19 (A3), ambos archivados y aprobados.
- Approval: approved (2026-11-21, by user) para «sin mockup nuevo»; Revision 3 del design system: approved (2026-11-21, by user)
- Preview: pendiente (previews de Revision 3 en `design-system/previews/`)
- Visual verify: passed (2026-11-21) — tras las correcciones del verify (r2/r3); capturas en `mockups/verify/` (sufijo -r2/-r3). Pendiente solo de ojo humano: la transición de slide del drawer (el panel oculto del navegador no avanza transiciones).
- Re-verify r2 (2026-11-21): favicon OK (image/svg+xml, sin errores), drawer OK (foco vuelve a «Abrir menú» con botón y Escape, nodo preservado, roles complementary/dialog); checkout MAJOR 3 NO resuelto en navegador real: tras ADDRESS_NOT_FOUND el aviso queda, pero la principal vuelve a quedar seleccionada (checked) y «Confirmar pedido» sin elegir crea el pedido (#61) en vez de pedir «Elegí dónde lo recibís.»; elegir una dirección explícita sí oculta el aviso. `Visual verify` sigue en `differences`.
- Re-verify r3 (2026-11-21): checkout OK en navegador real con servidores nuevos. ADDRESS_NOT_FOUND (dirección elegida por el usuario y variante preseleccionada automáticamente): aviso visible, ningún radio marcado, «Confirmar pedido» sin elegir muestra «Elegí dónde lo recibís.» y no envía POST (solo 1 POST, el 404, por escenario); elegir una dirección explícita oculta el aviso.

## Risks / Trade-offs

- **[R1] A1 rompe clientes que mandaban direcciones ajenas** → no hay cliente legítimo que lo haga; el frontend solo ofrece direcciones propias. Test de regresión del checkout.
- **[R2] Migración `007` falla sobre datos inconsistentes** → saneamiento previo en la misma migración; test de migración sobre base con duplicados; `downgrade` probado.
- **[R3] `inert` sin soporte en jsdom** → los tests verifican el atributo y el orden de foco; el comportamiento real se comprueba en el verify con navegador.
- **[R4] El build de producción no encuentra `design-system/`** → contexto de build explícito (D7); lo valida el usuario o el agente con permiso al correr `docker compose --profile prod build`.
- **[R5] Cambios de código después de C-25b dejan capturas y video desactualizados** → este change se archiva y mergea antes de empezar C-25b.
- **[Trade-off] X1–X4 diferidos** (idempotencia, envío en retiro, filtros, escala de Tailwind) → se documentan como limitaciones en el README y el checklist (C-25b).

## Migration Plan

1. Grupos 1–6 con TDD; la migración `007` se prueba en `foodstore_test` (upgrade sobre datos con duplicados, downgrade).
2. En la base de desarrollo: `alembic upgrade head` (el agente muestra el SQL; lo corre el usuario o el agente con OK).
3. Verify, archivo y merge a `main` de este change; recién entonces arranca `c-25b-entrega-docs-video`.
4. Rollback: `alembic downgrade -1` elimina el índice; los cambios de API son aditivos (`code`/`field`), el frontend sigue mostrando el mensaje del servidor.

## Open Questions

> Numeración heredada del design original de C-25b. OQ-1 (PA-17), OQ-2 (PA-18), OQ-3 y OQ-7 quedaron en `c-25b-entrega-docs-video`; OQ-9 (partición) está resuelta: partición aprobada por el usuario 2026-11-21.

- **Gate A1 — OK al cambio de autorización (D1).** Gobernanza CRÍTICO: sin el OK explícito del usuario no se escribe código del grupo 2. **Debe decidirse antes de `/opsx:apply`** (o, como mínimo, antes del grupo 2).
- **OQ-4 / PA-13 — ¿Retiro en el local cobra envío?** Hoy la spec dice $50 fijo. (a) mantener (spec vigente) y documentar; (b) decidir $0 en retiro: entonces se suma a este change (service + `frontend-checkout` «Costo de envío» + tests). **Recomendación: (a)** salvo decisión explícita del PO/usuario, porque cambiarlo modifica una regla de negocio y dos specs a último momento. Si se elige (b), debe decidirse **antes de `/opsx:apply`** para sumar specs y tareas.
- **OQ-5 — C-15 OQ-1 (promover principal al eliminar).** **Recomendación**: mantener lo aprobado el 2026-11-17 (no promover); sin trabajo.
- **OQ-6 — Escala por defecto de Tailwind.** (a) dejarla y documentar; (b) restringir el tema a los tokens. **Recomendación: (a)**: (b) obliga a revisar todas las pantallas aprobadas justo antes de capturar.
- **OQ-8 — Mockups y Revision 3.** Confirmar que el change no necesita mockups nuevos (ver `## UI Mockups`) y aprobar la Revision 3 del design system cuando se presente. Por la política `system-and-mockups`, la confirmación de «sin mockup nuevo» **debe darse antes de `/opsx:apply`**; la aprobación de Revision 3 se da durante el apply (6.3) y sin ella no se aplican A8 (5.6) ni A10 (6.1, 6.4).
- **OQ-10 — Idempotencia de creación (C-19 R2).** **Recomendación: diferir** y documentar (ver X1). Si el usuario la quiere ahora: columna `idempotency_key` única en `pedidos` (migración), cabecera `Idempotency-Key` y reenvío de la misma clave en «Reintentar»; en ese caso debe decidirse **antes de `/opsx:apply`**.
