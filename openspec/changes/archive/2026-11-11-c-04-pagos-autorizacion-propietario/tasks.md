# Tasks — C-04 `pagos-autorizacion-propietario`

> **Governance CRÍTICO** (pagos/auth) — APROBADO por el usuario el 2026-11-11 con los defaults de OQ-1..OQ-3 (gate cumplido). Regla original: NO escribir código hasta que el usuario apruebe explícitamente `proposal.md`, `design.md` y las specs, y responda (o acepte por defecto) OQ-1..OQ-3 de `design.md`. Si una respuesta cambia los defaults, actualizar specs/design/tasks antes de aplicar.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por la interfaz HTTP (o la API pública de la primitiva), valores esperados escritos a mano, sin aserciones tautológicas, mocks solo en el borde del sistema (`app.modules.pagos.service.mercadopago.SDK`), nunca en services/repos internos.
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Capas `models ← repository ← unit of work ← services ← routers`; el router solo inyecta usuario/roles y delega; sin migraciones (D9): si algo parece necesitarla, frenar y consultar. No leer/escribir `.env*`, no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 (baseline: 1236 passed, 0 failed) Correr la suite completa y registrar total/passed/failed (último conocido tras C-11: 1236 passed). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.
- [x] 0.2 Registrar en `design.md` §Open Questions la respuesta del usuario a OQ-1..OQ-3 con fecha. Verificar con `grep -n "OQ-[1-3]" openspec/changes/c-04-pagos-autorizacion-propietario/design.md`.

## 1. Primitiva propietario-o-rol (D3)

- [x] 1.1 RED: en `tests/unit/test_permissions.py`, `puede_acceder_a_propio(propietario_id=7, usuario_id=7, roles=frozenset({"CLIENT"}), privilegiados={"ADMIN"})` → `True`; `(7, 8, {"CLIENT"}, {"ADMIN"})` → `False`. Ejecutar `pytest tests/unit/test_permissions.py` → falla (no existe la función).
- [x] 1.2 GREEN: `puede_acceder_a_propio` en `app/core/permissions.py` (pura, con type hints, apoyada en `tiene_algun_rol`). Ejecutar → verde.
- [x] 1.3 TRIANGULATE: `(7, 8, {"CLIENT", "ADMIN"}, {"ADMIN"})` → `True` (unión de roles); `(7, 8, {"PEDIDOS", "STOCK"}, {"ADMIN"})` → `False`; `(7, 8, frozenset(), {"ADMIN"})` → `False`. Ejecutar → verde.
- [x] 1.4 REFACTOR: `PedidoService._obtener_pedido_visible` usa `puede_acceder_a_propio(pedido.usuario_id, usuario_id, roles, self.ROLES_GESTORES)` sin cambiar comportamiento. Ejecutar `pytest tests/integration/test_pedidos_contrato.py tests/integration/test_pedidos_multirol.py tests/unit/test_permissions.py` → verde.

## 2. Autenticación de los endpoints de pagos (D2, D5; spec `payment-api` «exige autenticación»)

- [x] 2.1 RED: nuevo `tests/integration/test_pago_autorizacion.py`: anónimo `POST /api/v1/pagos/crear` con `{"pedido_id": pedido_db.id}` → 401 `HTTP_401`, sin filas nuevas en `pagos` y el mock del SDK sin llamar; anónimo `GET /api/v1/pagos/{pedido_db.id}` → 401 sin clave `estado`. Ejecutar → falla (hoy 503/200).
- [x] 2.2 GREEN: `pagos/router.py` inyecta `CurrentUser` (`get_current_active_user`) y `CurrentRoles` (`get_current_roles`) en `crear_pago` y `consultar_pago` y los pasa al service; `PaymentService.crear_pago(pedido_id, usuario_id, roles)` y `obtener_pago(pedido_id, usuario_id, roles)` aceptan los parámetros (todavía sin usarlos). Ejecutar → verde.
- [x] 2.3 TRIANGULATE: `Authorization: Bearer x.y.z` → 401 en ambos; anónimo con `pedido_id` 999999 → 401 (no 404); webhook sin token con tópico no soportado → 200 `ignored`; `GET /pagos/redirect/{id}/success` sin token con `FRONTEND_URL` definida (monkeypatch de `settings`) → redirección, no 401. Ejecutar → verde.
- [x] 2.4 Ajustar `tests/integration/test_optional_integrations.py`: los tests de `/pagos/crear` envían `user_auth_headers` (dueño de `pedido_db`) y siguen esperando 503 con la variable faltante y el SDK sin llamar. Ejecutar `pytest tests/integration/test_optional_integrations.py tests/integration/test_pago.py tests/integration/test_pago_webhook_fsm.py` → verde.

## 3. Propiedad del pedido en el service (D1, D3, D4; specs `payment-api`, `rbac-authorization`)

- [x] 3.1 RED: en `test_pago_autorizacion.py`, un segundo cliente B (`usuario_con_roles(["CLIENT"])`) llama a `GET /api/v1/pagos/{pedido_db.id}` (pedido de A) → 403 `HTTP_403` sin clave `estado`; y a `POST /api/v1/pagos/crear` con MP configurado (monkeypatch de `settings` + mock del SDK) → 403, 0 filas en `pagos` del pedido y el SDK sin llamar. Ejecutar → falla (hoy 200/201).
- [x] 3.2 GREEN: `PagoUnitOfWork` expone `pedidos` (`PedidoRepository`); `PaymentService._obtener_pedido_autorizado(uow, pedido_id, usuario_id, roles)` con `AppError(404, "HTTP_404", "Pedido no encontrado")` (inexistente o `deleted_at`) y `AppError(403, "HTTP_403", "No tenés acceso a este pedido")` usando `puede_acceder_a_propio(..., ROLES_PRIVILEGIADOS_PAGOS)`; `crear_pago` y `obtener_pago` lo llaman primero. Se elimina `self._session.get(Pedido, ...)` y su `HTTPException(404)`. Ejecutar → verde.
- [x] 3.3 TRIANGULATE (propietario y ADMIN): A consulta su pedido sin pagos → 200 `estado` nulo; A con un `Pago` `pendiente` → 200 `estado` `pendiente`; A crea con MP configurado → 201 con `pago_id`, `preference_id`, `init_point` y 1 fila `pendiente`; `ADMIN` (`admin_auth_headers`) consulta el pedido de A → 200 y crea → 201 (según OQ-1). Ejecutar → verde.
- [x] 3.4 TRIANGULATE (otros roles e inexistente): `PEDIDOS` solo, `STOCK` solo y `PEDIDOS`+`STOCK` → 403 en ambos endpoints (según OQ-2); `CLIENT`+`ADMIN` sobre pedido ajeno → 200; a un `ADMIN` se le quita el rol en la BD y con el mismo token consulta un pedido ajeno → 403; `GET /pagos/999999` como `ADMIN` → 404 `HTTP_404`; `POST /crear` con `pedido_id` 999999 como cliente → 404; pedido con `deleted_at` → 404. Ejecutar → verde.
- [x] 3.5 TRIANGULATE (orden de verificaciones, D5): sin `MP_ACCESS_TOKEN`, el cliente B crea sobre el pedido de A → 403 (no 503); el dueño en las mismas condiciones → 503 nombrando `MP_ACCESS_TOKEN`. Ejecutar → verde.
- [x] 3.6 REFACTOR: el router no importa `Session` nuevo ni tiene lógica; `PaymentService` no usa `self._session.get(Pedido`. Verificar `grep -n "_session.get(Pedido" backend/app/modules/pagos/service.py` sin resultados y `pytest tests/integration/test_pago_autorizacion.py tests/integration/test_pago.py tests/integration/test_pago_webhook_fsm.py tests/integration/test_optional_integrations.py` → verde.

## 4. Matriz RBAC (D8)

- [x] 4.1 En `tests/support/rbac_matriz.py`: quitar de `EXCLUIDAS` las claves de `POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}`; agregar `Fila("POST", f"{P}/pagos/crear", AUTENTICADO, {"pedido_id": ID_INEXISTENTE})` y `Fila("GET", f"{P}/pagos/{{pedido_id}}", AUTENTICADO)` en una sección «Pagos». Webhook y redirect siguen excluidos. Ejecutar `pytest tests/integration/test_rbac_matriz.py` → verde (anónimo 401; cada perfil autenticado ni 401 ni 403).

## 5. Cierre

- [x] 5.1 Docs: `knowledge-base/03` (§Rutas públicas y fila «Pagos — crear / consultar»: DT-05 resuelta, propietario o `ADMIN`), `09` (DT-05 resuelta por C-04), `11` (§Riesgos conocidos: quitar «Endpoints de pago sin autenticación»). Verificar con `grep -n "DT-05" knowledge-base/03_actores_y_roles.md knowledge-base/09_decisiones_y_supuestos.md knowledge-base/11_pagos_mercadopago.md`.
- [x] 5.2 Revisión de capas, SOLID y DRY: la condición «propietario o rol» existe solo en `core/permissions.py` (`grep -rn "usuario_id != usuario_id" backend/app` sin resultados); `pagos/router.py` sin consultas ni reglas; type hints en las firmas públicas nuevas.
- [x] 5.3 Suite completa: 0 failed y passed ≥ baseline de 0.1 más los tests nuevos; registrar el número y la diferencia.

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-04-pagos-autorizacion-propietario` (marca `[x]` en CHANGES.md y agrega «Punto de partida (C-04)» en C-05, C-12 y C-20: endpoints de pagos autenticados, 401/403/404, propiedad en `PaymentService`).
