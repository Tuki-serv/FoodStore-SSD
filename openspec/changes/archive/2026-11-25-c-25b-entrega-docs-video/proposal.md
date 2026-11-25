# Proposal — C-25b `entrega-docs-video`

## Why

Es el último change obligatorio del roadmap (GATE 7): el TPI se evalúa sobre 200 puntos con corrección escrita y **video obligatorio**, y la rúbrica penaliza un 30 % si el proyecto no corre siguiendo el README. Hoy el README raíz está desactualizado («Fase 1 en curso», 31 changes) y no hay checklist de entrega, capturas ni guion de video. La deuda heredada de C-13a, C-15, C-19 y C-22 que conviene cerrar antes de grabar se movió a `c-25b1-deuda-heredada` (partición aprobada por el usuario 2026-11-21); este change va **después** de que aquel se archive, porque el video y las capturas congelan el estado final.

## What Changes

- README raíz como guía única de arranque en máquina limpia (US-029): `docker compose up -d db` → `alembic upgrade head` → `python -m app.db.seed` → backend → frontend, credenciales de prueba, tests, cobertura (PA-16 ya resuelta), MercadoPago sandbox + ngrok, perfil `prod` del frontend (de C-25b1), limitaciones conocidas (DT-28, COCINA/KDS, fechas UTC, envío fijo, sin idempotencia) y enlace al video (CE-13).
- `.env.example` (raíz, backend y frontend) finales y verificados por test.
- Recorrido E2E del flujo completo con frontend (compra → pago → entrega) documentado como guion verificable; el pago con tarjeta sandbox (CE-09) lo ejecuta el usuario.
- `docs/entrega/`: checklist de la rúbrica de 200 pts y de CE-01..CE-14 con evidencia, capturas de 10+ pantallas, guion del video, metadatos de portada (PA-18).
- Verificación visual de todas las pantallas contra sus mockups aprobados y el design system Revision 3.
- Deploy opcional (PA-17), solo si el usuario lo decide.
- Tareas del usuario marcadas como tales: grabar y publicar el video, pagos sandbox, cuentas de deploy, repo público (CE-01, CE-14), completar metadatos (PA-18).

**Fuera de alcance**: todo el código de deuda heredada (validaciones de `POST /pedidos/`, migración `007`, drawer modal, tests FSD, imagen de producción, Swagger, design system Revision 3) → `c-25b1-deuda-heredada`. Diferidos que este change solo documenta como limitaciones: idempotencia de creación (C-19 R2), envío $0 en retiro (PA-13), filtros/zona horaria del gestor de pedidos (C-22), escala por defecto de Tailwind; COCINA/KDS/WebSocket (PA-07, C-26/C-27).

## Capabilities

### New Capabilities
- `project-delivery`: cómo se arranca el proyecto de forma reproducible desde el README y qué evidencia de entrega acompaña al repo (plantillas de entorno, compose, checklist de rúbrica, capturas, guion y enlace del video, metadatos).

### Modified Capabilities
_(ninguna: las capacidades modificadas del C-25b original pasaron a `c-25b1-deuda-heredada`)_

## Impact

- **Infra/docs**: `README.md` raíz, `.env.example` (raíz/backend/frontend) y sus tests, `docs/entrega/` (checklist, recorrido E2E, guion, metadatos, capturas), `knowledge-base/13_rubrica_y_entrega.md`, `knowledge-base/10_preguntas_abiertas.md` (PA-18), `CHANGES.md`.
- **Evidencia**: `openspec/changes/c-25b-entrega-docs-video/verify/` (verify visual).
- **Sin cambios** de código de la aplicación, de API ni de esquema.
- **Depende de** `c-25b1-deuda-heredada` archivado.
