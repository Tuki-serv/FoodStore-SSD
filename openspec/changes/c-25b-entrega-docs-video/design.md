# Design — C-25b `entrega-docs-video`

## Context

Motivación y alcance: ver `proposal.md`. Este change es el **bloque B** del C-25b original; el bloque A (deuda heredada, código con TDD) se movió a `c-25b1-deuda-heredada` (OQ-9 resuelta: partición aprobada por el usuario 2026-11-21).

**Dependencia**: `c-25b1-deuda-heredada` debe estar **archivado** (y mergeado a `main`) antes de capturar pantallas, ejecutar el recorrido E2E con frontend y grabar el video, porque esa evidencia sale del código cerrado. La redacción del README, las plantillas y el checklist puede adelantarse y se revisa al final contra el código congelado.

Estado observado el 2026-11-21 (rama `dev`, tras `endurecimiento-pagos-webhook`):

- **Entrega**: README raíz desactualizado («Fase 1 en curso», «31 changes») y delega el arranque en `backend/README.md` y `frontend/README.md`. No existe `docs/entrega/`. El seed no crea pedidos de ejemplo, así que el dashboard (C-24) aparece vacío sin un flujo previo. Ya existe el E2E de API `backend/tests/integration/test_flujo_compra_pago_entrega.py` (C-25a) y la cobertura ≥ 60 % con umbral automático (PA-16 **resuelta** por C-25a: `backend/.coveragerc`, `fail_under = 60`).
- **Navegador**: en esta máquina Playwright MCP no tiene Chrome: C-22 capturó con Edge headless + `playwright-core` desde `file://` y contra el stack local.
- **Lo que deja C-25b1** (insumo de este change): perfil `prod` del frontend, Swagger completo, design system Revision 3, y la lista de diferidos (X1–X4: idempotencia, envío en retiro, filtros/UTC del gestor, escala de Tailwind) que aquí se documentan como limitaciones.
- **Reglas que condicionan**: no levantar dev server ni build por iniciativa propia (regla 13): las tareas que lo necesitan piden permiso o las hace el usuario; nunca commitear secretos (regla 10); nada de commits sin pedido.

## Goals / Non-Goals

**Goals:**
- Dejar el repo entregable: arranque desde el README en máquina limpia, plantillas de entorno, checklist de rúbrica con evidencia, capturas, guion del video.
- Separar con claridad lo que hace el agente de lo que hace el usuario.

**Non-Goals:**
- Cambios de código de la aplicación, de API o de esquema (→ `c-25b1-deuda-heredada`).
- Resolver PA-07 (COCINA/KDS/WebSocket) o PA-19 (extras): Fase 2.
- CI/CD o pipeline de deploy automatizado.

## Decisions

### D1 — Recorrido E2E con frontend: guion verificado + Playwright headless puntual (ver OQ-3)
Recomendado: **no** sumar `@playwright/test` al repo. El recorrido se escribe como guion verificable en `docs/entrega/recorrido-e2e.md` (pasos, cuenta, resultado esperado) y el agente lo ejecuta, **con permiso del usuario para levantar el stack**, con Edge headless + `playwright-core` (lo que ya funcionó en C-22), capturando las pantallas de CE-12 en el mismo recorrido. El tramo con tarjeta sandbox (CE-09: brick en iframe de MercadoPago + webhook por ngrok) lo ejecuta **el usuario**. El backend ya tiene el E2E de API automatizado (C-25a).

### D2 — Evidencia de entrega en `docs/entrega/`
`checklist-rubrica.md` (13 criterios + bonus + CE-01..CE-14, estado y evidencia), `recorrido-e2e.md`, `guion-video.md`, `metadatos.md` (PA-18 con `(TBD)`), `capturas/NN-<pantalla>-<viewport>.png`. El README raíz enlaza todo y pasa a ser la guía única de arranque (los README de `backend/` y `frontend/` quedan como detalle). Los datos para el dashboard salen del propio recorrido E2E (pedidos reales confirmados), no de un seed de pedidos (OQ-7).

### D3 — Plantillas de entorno verificadas por test
Un test compara las variables `${...}` de `docker-compose.yml` con el `.env.example` de la raíz; se extienden los tests existentes de `backend/.env.example` y `frontend/.env.example`. Placeholders no sensibles y un comentario por variable; las de MercadoPago dicen de dónde salen en el panel.

## UI Mockups

- Design system revision: 3 (aprobada en `c-25b1-deuda-heredada`; si al empezar sigue en 2, se usa la vigente y se anota)
- Decision: no (no UI) (2026-11-21) — este change no crea ni modifica pantallas; solo captura y verifica las existentes.
- Mockups: los aprobados de cada change archivado (16 carpetas `openspec/changes/archive/*/mockups/`), referencia del verify visual (OQ-8).
- Approval: n/a (sin mockups nuevos)
- Preview: n/a
- Visual verify: pendiente — todas las pantallas contra sus mockups, capturas en `openspec/changes/c-25b-entrega-docs-video/verify/`.

## Risks / Trade-offs

- **[R1] Capturas y video quedan desactualizados si se cambia código después** → este change va al final, tras archivar `c-25b1-deuda-heredada`; el checklist registra el commit capturado.
- **[R2] MercadoPago sandbox no notifica** (visto con `CONT`) → el guion prevé reintento y, para el video, un pago `APRO` que ya funcionó en sandbox.
- **[R3] El README no funciona en máquina limpia (−30 %)** → tarea del usuario de prueba en máquina/carpeta limpia siguiendo solo el README, antes de entregar.
- **[R4] Metadatos inventados** → `(TBD)` visibles hasta que el usuario los confirme (PA-18).
- **[Trade-off] Diferidos de C-25b1** (idempotencia, envío en retiro, filtros, escala de Tailwind) → documentados como limitaciones en el README y en el checklist.

## Migration Plan

1. Esperar a que `c-25b1-deuda-heredada` esté archivado y mergeado (código congelado). Los grupos 1 y 4 pueden redactarse antes.
2. Recorrido E2E, capturas y verify visual sobre el código congelado.
3. Tareas del usuario (prueba en máquina limpia, pago sandbox, video, repo público, metadatos).
4. Sin cambios de esquema ni de API: no hay rollback de datos.

## Open Questions

> PA-16 **ya está resuelta** (C-25a: cobertura > 60 % con `fail_under = 60`); en este change solo se documenta en el README y el checklist. OQ-4, OQ-5, OQ-6 y OQ-10 pasaron a `c-25b1-deuda-heredada` (se conserva la numeración original).

- **OQ-1 / PA-17 — ¿Deploy para el bonus de +10?** Opciones: (a) no hacer deploy; (b) Render (web service backend + static site frontend + PostgreSQL administrado); (c) Railway; (d) Fly.io. Requiere cuentas (usuario), `REFRESH_COOKIE_SECURE=true`, `REFRESH_COOKIE_SAMESITE=none` si front y back quedan en dominios distintos, `CORS_ORIGINS` con la URL pública, webhook de MercadoPago apuntando a la URL pública (deja de necesitar ngrok) y correr migraciones + seed en el entorno. **Recomendación: (a) dentro de este change** y, si sobra tiempo tras el video, un change chico aparte con (b) Render, porque su plan gratuito cubre los tres componentes y la imagen `prod` de C-25b1 ya sirve. Tareas afectadas: grupo 6 (marcadas `[PA-17]`).
- **OQ-2 / PA-18 — Metadatos de portada.** Materia, carrera, equipo y docente: no se pueden inferir. **Recomendación**: el usuario los informa; mientras tanto `(TBD)` visibles. Tareas afectadas: 4.3, 4.4 `[PA-18]`.
- **OQ-3 — Forma del E2E con frontend.** (a) Guion verificado + ejecución puntual con `playwright-core`/Edge headless (sin dependencia nueva) y tarjeta sandbox a cargo del usuario; (b) suite `@playwright/test` versionada en `frontend/e2e/` (camino efectivo automatizado; MP manual). **Recomendación: (a)**: menor costo, reutiliza lo que ya funcionó en C-22, captura las 10 pantallas en el mismo recorrido; el E2E automatizado de la lógica ya existe a nivel API. Tareas afectadas: grupo 2.
- **OQ-7 — Datos para dashboard y capturas.** (a) generarlos con el recorrido E2E; (b) sumar pedidos de demostración al seed (cambia la spec `backend-db-seed`, con historial y pagos coherentes). **Recomendación: (a)**.
- **OQ-8 — Mockups de referencia.** Confirmar que el verify visual compara contra los mockups aprobados de los changes archivados y la Revision 3 del design system (aprobada en C-25b1), sin mockups nuevos.
- **OQ-9 — Partición. Resuelta:** partición aprobada por el usuario 2026-11-21 → `c-25b1-deuda-heredada` (bloque A, código) + este change (bloque B, entrega).
