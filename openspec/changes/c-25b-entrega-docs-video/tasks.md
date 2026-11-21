# Tasks — C-25b `entrega-docs-video`

Convenciones:
- Bloque B del C-25b original (partición aprobada por el usuario 2026-11-21): entrega (documentación, evidencia y tareas del usuario). La deuda heredada (código con TDD) está en `c-25b1-deuda-heredada`. **Dependencia**: las capturas, el recorrido E2E y el video (grupos 2, 3 y 5) se hacen sobre el código ya cerrado, es decir con `c-25b1-deuda-heredada` archivado; la redacción de documentación (grupos 1 y 4) puede adelantarse y se revisa al final.
- `[USUARIO]` = la hace el usuario, no el agente. `[GATE: …]` = no empezar hasta resolver lo indicado. `[OQ-x]`/`[PA-xx]` = tarea condicionada por esa decisión abierta (se escribe con la opción recomendada).
- Backend: comandos desde `backend/` (`pytest` contra `foodstore_test`). Frontend: desde `frontend/` (`npm test`, `npm run typecheck`, `npm run lint`). No levantar dev server ni build sin permiso (regla 13); no commitear.

## 1. Arranque reproducible y plantillas de entorno (US-029, CE-02..CE-07)

- [ ] 1.1 Test de plantillas: variables `${...}` de `docker-compose.yml` ⊆ `.env.example` raíz; extender los tests existentes de `backend/.env.example` y `frontend/.env.example` para cubrir todas las variables y comentarios de MercadoPago; verifica: escenarios «Plantillas de entorno completas» en verde
- [ ] 1.2 Revisar y completar los tres `.env.example` (placeholders no sensibles, comentario por variable, de dónde sale cada credencial de MercadoPago); verifica: tests de 7.1 en verde y ningún valor con forma de credencial real
- [ ] 1.3 Reescribir `README.md` raíz como guía única: requisitos, pasos en orden con directorio y resultado esperado (compose `db` → `pip install` → `alembic upgrade head` → `python -m app.db.seed` → `uvicorn` → `npm install` → `npm run dev`), credenciales del seed, tests y cobertura (PA-16 resuelta), MercadoPago sandbox + ngrok, perfil `prod`, estado del roadmap actualizado, limitaciones conocidas (DT-28, PA-07, UTC, envío fijo PA-13, sin idempotencia), enlaces a `docs/entrega/`; verifica: escenarios de `project-delivery` «Arranque reproducible», «Credenciales de prueba» y «Limitaciones conocidas», y un test/script que comprueba que los scripts y variables nombrados existen
- [ ] 1.4 [USUARIO] Prueba en máquina o carpeta limpia (clone nuevo) siguiendo solo el README; anotar fricciones; verifica: checklist CE-02..CE-07 marcado con fecha en `docs/entrega/checklist-rubrica.md` (evita la penalización del −30 %)

## 2. Recorrido E2E con frontend (compra → pago → entrega) [OQ-3]

- [ ] 2.1 Escribir `docs/entrega/recorrido-e2e.md`: pasos, cuenta, resultado esperado (efectivo hasta `ENTREGADO`; tarjeta sandbox `APRO` hasta `CONFIRMADO`; cancelación con motivo; dashboard con la venta); verifica: escenarios de `project-delivery` «Recorrido de punta a punta verificado» cubiertos paso a paso
- [ ] 2.2 [GATE: `c-25b1-deuda-heredada` archivado] [GATE: permiso del usuario para levantar el stack, regla 13] Ejecutar el tramo efectivo con Edge headless + `playwright-core` contra el stack local, registrando resultado, fecha y capturas; detener lo que se levantó; verifica: resultado anotado en `recorrido-e2e.md` con capturas
- [ ] 2.3 [USUARIO] Ejecutar el tramo con tarjeta sandbox (CE-09) con ngrok y el webhook configurado en el panel; verifica: pedido `CONFIRMADO` por «Sistema» anotado en `recorrido-e2e.md`

## 3. Capturas y verificación visual (CE-12)

- [ ] 3.1 [GATE: 2.2] Capturar ≥ 10 pantallas distintas a 1440x900 y 390x844 (catálogo, producto, carrito, checkout, pago, mis pedidos/detalle, gestión de pedidos, productos y stock, usuarios, dashboard, más 404/ingresar) en `docs/entrega/capturas/NN-<pantalla>-<viewport>.png`; verifica: escenario «Diez pantallas distintas» y enlaces desde el checklist
- [ ] 3.2 Verify visual: comparar cada pantalla con su mockup aprobado (16 carpetas `archive/*/mockups/`) y con design system Revision 3 (aprobada en `c-25b1-deuda-heredada`); reportar diferencias blocker/major/minor por pantalla y viewport, revisar consola y red; guardar en `openspec/changes/c-25b-entrega-docs-video/verify/`; verifica: informe con pantallas revisadas y no revisadas, `Visual verify:` registrado en design.md

## 4. Checklist de rúbrica, guion y metadatos

- [ ] 4.1 `docs/entrega/checklist-rubrica.md`: 13 criterios (200 pts), bonus (+10 tests, +10 deploy) y CE-01..CE-14 con estado (cumplido / parcial / pendiente del usuario) y evidencia (archivo, test, captura o minuto del video); verifica: escenario «Cobertura del checklist» (cada ítem una sola vez)
- [ ] 4.2 `docs/entrega/guion-video.md` de 5–10 min con cuenta por paso (registro/ingreso, catálogo, carrito, checkout, pago sandbox, seguimiento, avance hasta `ENTREGADO`, dashboard, Swagger, tests); verifica: escenario «Guion completo»
- [ ] 4.3 [PA-18] `docs/entrega/metadatos.md` con materia, carrera, equipo y docente en `(TBD)` visibles; verifica: escenario «Metadato sin confirmar»
- [ ] 4.4 [USUARIO] [PA-18] Informar materia, carrera, equipo y docente; verifica: los `(TBD)` reemplazados y PA-18 marcada resuelta en `knowledge-base/10_preguntas_abiertas.md`

## 5. Video y publicación — tareas del usuario

- [ ] 5.1 [USUARIO] Grabar el video siguiendo `guion-video.md` (5–10 min) y subirlo; verifica: enlace accesible sin sesión
- [ ] 5.2 Agregar el enlace del video al README (CE-13) cuando el usuario lo provea; verifica: escenario «Enlace presente»
- [ ] 5.3 [USUARIO] Repositorio público y verificado con sesión cerrada (CE-01, CE-14); verifica: el repo abre en una ventana privada y el checklist lo marca

## 6. Deploy opcional [PA-17 / OQ-1 — recomendado: no en este change]

- [ ] 6.1 [GATE: PA-17 = sí] Documentar el plan de deploy elegido (variables `REFRESH_COOKIE_SECURE=true`, `REFRESH_COOKIE_SAMESITE`, `CORS_ORIGINS`, URL del webhook en el panel, migraciones + seed en el entorno) en el README; si PA-17 = no, registrar «sin deploy» en el checklist; verifica: sección o fila presente
- [ ] 6.2 [USUARIO] [GATE: PA-17 = sí] Crear las cuentas y servicios en el proveedor y cargar los secretos (nunca en el repo); verifica: URL pública responde `/health` y el catálogo

## 7. Integración final

- [ ] 7.1 Actualizar `CHANGES.md` (estado de C-25b, ítems diferidos X1–X4 de `c-25b1-deuda-heredada` con destino) y `knowledge-base/13_rubrica_y_entrega.md` («Estado frente a la rúbrica» al día); verifica: ambos reflejan el estado final y los diferidos

## Workflow follow-up

- Verify del change (`openspec-verify`), incluido el verify visual del grupo 3.
- Archivar con `/opsx:archive` y marcar C-25b `[x]` en `CHANGES.md`.
- Commits y push solo a pedido del usuario, siguiendo el flujo `dev → main → dev` de `CLAUDE.md`.
