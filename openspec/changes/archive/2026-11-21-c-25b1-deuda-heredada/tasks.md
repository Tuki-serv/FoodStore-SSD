# Tasks — C-25b1 `deuda-heredada`

Convenciones:
- Bloque A del C-25b original (partición aprobada por el usuario 2026-11-21): deuda heredada, código con TDD estricto (RED → GREEN → TRIANGULATE → REFACTOR; safety net antes de tocar archivos existentes). La entrega (docs, evidencia, video) está en `c-25b-entrega-docs-video`, que arranca cuando este change esté archivado.
- `[USUARIO]` = la hace el usuario, no el agente. `[GATE: …]` = no empezar hasta resolver lo indicado. `[OQ-x]`/`[PA-xx]` = tarea condicionada por esa decisión abierta (se escribe con la opción recomendada).
- Backend: comandos desde `backend/` (`pytest` contra `foodstore_test`). Frontend: desde `frontend/` (`npm test`, `npm run typecheck`, `npm run lint`). No levantar dev server ni build sin permiso (regla 13); no commitear.

## 1. Backend — rechazos de creación con código estable (C-19 R1, MEDIO)

- [x] 1.1 Safety net: correr `pytest tests/integration -k "pedido"` y la suite de `order-stock`; registrar N tests en verde (si falla alguno, parar y reportar pre-existente)
- [x] 1.2 RED/GREEN: agregar a `ErrorCode` `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `DUPLICATE_ITEM`, `PAYMENT_METHOD_UNAVAILABLE`, `ADDRESS_NOT_FOUND`, `INVALID_CUSTOMIZATION` y hacer que `crear_pedido` lance cada rechazo con su `code` y `field` posicional (`items.<i>.producto_id`, `forma_pago_codigo`) conservando el status; verifica: tests de integración nuevos por escenario de `order-api` «Rechazos de la creación…» y «Forma de pago inválida…» (incluye segunda línea → `items.1.producto_id` y duplicado → índice de la segunda línea)
- [x] 1.3 TRIANGULATE: stock insuficiente sumando dos líneas → `INSUFFICIENT_STOCK` 400 con el `field` de la primera línea de ese producto; forma de pago inexistente y deshabilitada; verifica: escenarios de `api-conventions` «Creación con producto inexistente» y «Creación sin stock» en verde y la suite de `order-stock` sigue en verde
- [x] 1.4 REFACTOR: extraer la construcción de `field` de línea a un helper sin duplicación; verifica: suite completa de backend en verde y cobertura ≥ 60 %

## 2. Backend — dirección propia y personalización válida (C-19 R3 CRÍTICO, R4 MEDIO)

- [x] 2.1 [GATE: OK explícito del usuario a D1 (gobernanza CRÍTICO, regla 11)] Presentar al usuario el cambio de autorización de D1 (404 `ADDRESS_NOT_FOUND`, sin revelar existencia) y registrar su OK en design.md; verifica: línea «Aprobado A1 (fecha, usuario)» en design.md
- [x] 2.2 RED/GREEN: método de repositorio de direcciones por id + dueño + activa (reutilizando `BaseRepository`, sin CRUD duplicado) y validación en `crear_pedido` antes de procesar productos; verifica: escenarios de `order-api` «La dirección del pedido pertenece al cliente» (ajena, inexistente → 404 y no 500, dada de baja, propia 201, retiro con `null` 201) y que no se crea pedido en los rechazos
- [x] 2.3 RED/GREEN: validar `personalizacion` ⊆ ingredientes removibles del producto (D2) y armar el snapshot desde ese conjunto; verifica: escenarios «La personalización solo quita ingredientes removibles…» (otro producto, no removible, inexistente → 400 `INVALID_CUSTOMIZATION` con `items.<i>.personalizacion`; válida → snapshot con el nombre)
- [x] 2.4 REFACTOR + regresión: correr la suite completa de backend, incluido `test_flujo_compra_pago_entrega.py`; verifica: todo en verde, cobertura ≥ 60 %, sin `Session` en routers (regla 2)

## 3. Backend — una sola principal en la base (C-15 R3, migración `007`)

- [x] 3.1 RED: test de migración que, sobre `foodstore_test` con un usuario con dos principales activas, aplica `007` y espera una sola (la de `updated_at` más reciente), y test de `downgrade`; verifica: falla por falta de la migración
- [x] 3.2 GREEN: migración `007` (saneamiento + `uq_direccion_principal_activa` parcial) y declaración del índice en el modelo; mostrar el SQL al usuario antes de aplicarlo a la base de desarrollo (D5); verifica: tests de 3.1 en verde y `alembic check`/autogenerate sin diferencias
- [x] 3.3 RED/GREEN: escenarios de `address-integrity` (inserción directa rechazada, principal dada de baja no bloquea, usuarios distintos) y carrera de `PATCH /direcciones/{id}/principal` traducida a 409 `DUPLICATE_VALUE` en vez de 500; verifica: tests de integración en verde
- [x] 3.4 Actualizar `knowledge-base/04_modelo_de_datos.md` y RN-DI-01 en `05_reglas_de_negocio.md` con la garantía en base; verifica: ambos archivos nombran el índice y la migración `007`

## 4. Backend — Swagger completo (US-030, CE-08)

- [x] 4.1 RED: test que recorre `/openapi.json` y falla por cada operación bajo `/api/v1` sin `summary` o `tags`, y test de respuestas de error de `POST /api/v1/pedidos/` y de seguridad Bearer (`GET /api/v1/pedidos` sí, `GET /api/v1/productos/` no); verifica: falla nombrando las operaciones incompletas
- [x] 4.2 GREEN: diccionario compartido de respuestas de error y `summary`/`tags`/`responses` en todos los routers; verifica: tests de 4.1 y escenario «Swagger UI disponible» (`GET /docs` 200) en verde

## 5. Frontend — clasificador por código, drawer modal y fundación (C-19, C-13a)

- [x] 5.1 Safety net: `npm test`, `npm run typecheck`, `npm run lint` en verde; registrar N tests
- [x] 5.2 RED/GREEN: `clasificarErrorCreacion` decide por `code` (incluye `ADDRESS_NOT_FOUND` → elegir otra entrega + invalidar la query de direcciones, `INVALID_CUSTOMIZATION` → «Revisar carrito», código desconocido → mensaje sin acción); handlers MSW con `code`; verifica: escenarios de `frontend-checkout` «Errores al crear el pedido», incluido «Mismo texto, otro código»
- [x] 5.3 RED/GREEN: drawer mobile como diálogo modal (D6): `role="dialog"`, `aria-modal`, nombre accesible, trampa Tab/Shift+Tab, `inert` en barra superior y `<main>`, nada de eso en desktop ni cerrado; verifica: escenarios de `frontend-app-shell` «Drawer mobile como diálogo modal» con `userEvent` + axe, y los tests existentes de cierre del drawer siguen en verde
- [x] 5.4 RED/GREEN: test de arquitectura que exige `index.ts` en cada slice de `pages`/`features`/`entities` y en cada segmento de `shared` (con fixture que falla nombrando la carpeta); verifica: escenarios de `frontend-foundation` «API pública por slice»
- [x] 5.5 RED/GREEN: test de `readConfig` que separa «valor vacío» de «URL inválida» (dos casos con mensajes distintos o ambos nombrando `VITE_API_URL`, sin que uno tape al otro); verifica: el test falla si se elimina cualquiera de las dos validaciones
- [x] 5.6 [GATE: OQ-8] Ajustar el título del 404 en mobile al mockup aprobado de C-13a (`not-found.html`, dos líneas a 390 px); verifica: comparación visual a 390x844 en el verify de este change y test de la página 404 en verde
- [x] 5.7 RED/GREEN: script `build` (`tsc --noEmit -p tsconfig.json && vite build`) y `Dockerfile` multi-stage `dev`/`prod` (nginx con fallback a `index.html`, `ARG VITE_API_URL`, contexto con `design-system/`), compose con `target: dev` en `frontend` y servicio `frontend-prod` en `profiles: ["prod"]` (D7); verifica: test estático que lee `package.json`, `Dockerfile` y `docker compose config` (escenarios «Imagen de producción del frontend»); el build real lo corre el usuario o el agente con permiso
- [x] 5.8 Refactor final del grupo: `npm test`, `npm run typecheck`, `npm run lint` en verde; actualizar `frontend/README.md` (build de producción, perfil `prod`); verifica: comandos en verde y sección presente

## 6. Design system Revision 3 — sprite y favicon (C-13a, C-15, C-22)

- [x] 6.1 [GATE: OQ-8] Sumar al sprite de `design-system/components.html` los 32 íconos de `shared/ui/icon` que faltan (mismos trazos) y `design-system/assets/favicon.svg` provisional derivado de `logo.svg`; subir `Revision: 3`, `Approval: pending` en `design-system/README.md`; verifica: un test (o script de verificación) compara los ids del sprite con las claves de `shared/ui/icon` y no hay faltantes
- [x] 6.2 Renderizar `components.html` a 390x844 y 1440x900 (Edge headless + `playwright-core` o Playwright MCP), guardar en `design-system/previews/`, inspeccionar y presentar capturas + enlace local al usuario; verifica: capturas presentes y mostradas
- [x] 6.3 [USUARIO] Revisar y aprobar la Revision 3 (sprite + favicon); verifica: `Approval: approved (<fecha>, by user)` en `design-system/README.md` y `revision: 3` reconciliado en `.active-orchestrator-state.json`
- [x] 6.4 Declarar el favicon en `frontend/index.html` desde el asset del design system (reemplaza `data:,`); verifica: escenario «Sin 404 de favicon» (test que lee `index.html` + consola limpia en el verify)

## 7. Integración final

- [x] 7.1 Suites completas: backend `pytest` (cobertura ≥ 60 %) y frontend `npm test`, `npm run typecheck`, `npm run lint`; verifica: todo en verde, números anotados en el resumen del change
- [x] 7.2 Actualizar `CHANGES.md` (estado de C-25b1, ítems diferidos X1–X4 con destino: limitaciones documentadas en C-25b); verifica: CHANGES.md refleja el estado final y los diferidos

## Workflow follow-up

- Verify del change (`openspec-verify`), incluido el verify visual puntual (404 mobile, drawer, favicon) descrito en `## UI Mockups` de design.md.
- Archivar con `/opsx:archive` y marcar C-25b1 `[x]` en `CHANGES.md`; recién entonces arranca `c-25b-entrega-docs-video`.
- Commits y push solo a pedido del usuario, siguiendo el flujo `dev → main → dev` de `CLAUDE.md`.

## 8. Correcciones del verify

- [x] 8.1 MAJOR 1: el favicon no se servía en desarrollo (`href` relativo fuera de la raíz de Vite → fallback de la SPA); ahora `src/main.tsx` importa `@design-system/assets/favicon.svg` y `aplicarFavicon` lo aplica al `<link id="favicon">`; verifica: `tests/architecture/favicon.test.ts` y `src/app/__tests__/favicon.test.ts`
- [x] 8.2 MAJOR 2: el drawer mobile perdía el foco al cerrar (`inert` se quitaba después del efecto de foco); `inert` pasa a `useLayoutEffect`; el panel es un único `div` estable (rol `complementary` ↔ `dialog`); verifica: tests con `focus()` que simula `inert` e identidad del nodo en `app-shell.test.tsx`
- [x] 8.3 MAJOR 3: el aviso `ADDRESS_NOT_FOUND` desaparecía y se saltaba a la principal en silencio; la preselección automática no borra el aviso, se apaga tras el rechazo y el envío vuelve a pedir la entrega; verifica: tests de `finalizar-compra-errores.test.tsx`
- [x] 8.4 MINOR 4: el escenario «Seguridad declarada» del spec delta `backend-runtime` usa `GET /api/v1/categorias/arbol`; verifica: `openspec validate c-25b1-deuda-heredada --strict`
- [x] 8.5 MINOR 5: `test_openapi_documentacion.py` afirma el 201 → `PedidoDetalle` y los errores con `ErrorRespuesta` de `POST /api/v1/pedidos/`; detectó que el 422 anunciaba `HTTPValidationError` y no el cuerpo común, corregido en `documentar_422_con_el_error_comun`
- [x] 8.7 MAJOR 3 (re-verify en navegador): tras el 404 se volvía a elegir la principal y el envío la usaba; la marca de «entrega rechazada» pasa a un ref síncrono que ignora toda preselección automática y bloquea el envío hasta una elección explícita (el estado solo apaga el selector); verifica: tests de `finalizar-compra-errores.test.tsx` (entrega preseleccionada que desaparece sin `act`, cambiar la forma de pago con el aviso activo, sin POST)
- [x] 8.6 Suites completas tras las correcciones (números en el resumen del change)
