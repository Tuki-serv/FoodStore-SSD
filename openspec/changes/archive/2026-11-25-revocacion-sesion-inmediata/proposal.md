# Proposal — `revocacion-sesion-inmediata` (ajuste extra post-roadmap)

## Why

El 2026-11-24 el usuario abrió la misma cuenta de cliente en tres navegadores y usó «Cerrar todas las sesiones» desde uno: solo ese navegador salió. Los otros dos siguieron navegando **y pudieron confirmar pedidos** hasta recargar la página. La causa es de diseño: el backend valida el access (firma, `exp`, `type`, `sub`, `sid`) sin mirar si la sesión del `sid` sigue abierta, y `logout` / `logout-all` solo bloquean la renovación. Un access de una sesión cerrada sigue autenticando hasta su `exp` (hasta 30 minutos), tal como lo dicen hoy RN-AU-06 y la spec `auth-session` («Validar el access no SHALL requerir que la sesión esté abierta»). Para el usuario «cerrar todas las sesiones» tiene que significar que los otros dispositivos dejan de operar **ya**, así que se decide cambiar esa regla.

Además, aunque el backend rechace el access, una pantalla que no hace pedidos al backend (el carrito vive en Zustand) no se entera hasta la próxima llamada: el frontend necesita revalidar la sesión al navegar y al volver a la pestaña.

## What Changes

- **Backend — sesión abierta en cada pedido autenticado** (**BREAKING** respecto de RN-AU-06 vigente): toda ruta que autentica con `Authorization: Bearer` SHALL verificar además que la sesión del `sid` existe, pertenece al `sub`, no está cerrada (`revoked_at` nulo) y no venció. Si no, 401 con el mismo cuerpo y header que un access inválido. Una lectura por clave primaria de `sesion` por pedido; sin cambios de esquema ni migración.
- **Logout idempotente**: `POST /auth/logout` sigue respondiendo 204 y borrando la cookie aunque la sesión del access ya esté cerrada (solo valida firma/claims, no la sesión). `POST /auth/logout-all` sí exige sesión abierta: un access de una sesión ya cerrada no puede cerrar las sesiones abiertas después.
- **Lecturas públicas con header** (`lector_privilegiado`): un access de una sesión cerrada se trata como un access inválido → 401 (misma regla que hoy para access vencido o de usuario dado de baja), no como anónimo.
- **Usuario dado de baja**: como la baja ya cierra sus sesiones con motivo `BAJA`, su access pasa a recibir 401 (sesión cerrada) en vez del 404 «Cuenta de usuario desactivada»; el 404 queda como defensa si `deleted_at` existiera sin sesiones cerradas.
- **Frontend — revalidación liviana de la sesión**: con la sesión `autenticada`, al cambiar de ruta y al volver la pestaña a primer plano (`visibilitychange` / `focus`) se pide `GET /auth/me` a través de TanStack Query con un intervalo mínimo de 15 s (deduplicado: nunca más de un pedido en vuelo ni más de uno cada 15 s). Si el backend responde 401 y la renovación falla, el flujo existente (`renovacion.ts` → `expirarSesion`) deja la sesión `anonima` y las rutas protegidas llevan a «Ingresar» recordando la ruta. Errores de red o 5xx no cierran la sesión. Al revalidar con éxito se actualizan los datos del usuario (roles) en el store.
- **Frontend — consultas públicas tras el vencimiento**: cuando la sesión vence (`expirada`), las consultas públicas que quedaron en error por el 401 se vuelven a pedir como anónimo.
- **Tests de apoyo**: el helper de tests `bearer_de_usuario` (access «sin estado» con `sid` aleatorio, usado por ~50 tests) pasa a crear una fila `sesion` abierta real.
- **KB**: RN-AU-06 (05), RBAC/404 de baja (03), seguridad (08) y DD-27 (09) dejan de decir que el access «no se invalida / no es revocable antes de `exp`».
- **CHANGES.md**: entrada `[C-25b+]` de ajuste extra; no cuenta en los totales.
- Fuera de alcance: WebSocket de pedidos (`/pedidos/ws`, autentica por cookie `access_token`; C-27, Fase 2), polling periódico sin interacción, cambio de duración del access.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `auth-session`: MODIFIED «El access token viaja por Authorization Bearer» (se exige sesión abierta y vigente del `sid`, del mismo `sub`), MODIFIED «Logout cierra la sesión actual» (idempotente también con la sesión ya cerrada, sin exigir sesión abierta), MODIFIED «Logout en todos los dispositivos» (exige sesión abierta), REMOVED «Cerrar la sesión no invalida los access ya emitidos», ADDED «Cerrar la sesión invalida sus access» (logout, logout-all, reuso y baja cortan el access en el pedido siguiente, incluido crear pedidos).
- `catalog-visibility`: MODIFIED «Un access inválido en una lectura pública es un error» (incluye el access de una sesión cerrada o vencida).
- `frontend-session`: ADDED «Revalidación de la sesión al navegar y al volver a la pestaña» y MODIFIED «Sesión perdida por vencimiento» (las consultas públicas en error se vuelven a pedir como anónimo).

## Impact

- **Backend**: `backend/app/modules/auth/dependencies.py` (`get_access_claims`, `lector_privilegiado`, nueva dependencia de claims sin sesión para logout), `backend/app/modules/auth/service.py` (consulta de sesión abierta), `backend/app/modules/auth/router.py` (logout usa la dependencia sin sesión); `backend/app/modules/refreshtokens/repository.py` solo si hace falta un método (se prefiere `get_by_id` heredado). Tests: `tests/support/auth_helpers.py`, `tests/integration/test_auth.py`, `test_auth_logout.py`, nuevo `test_auth_revocacion.py`, `test_catalogo_visibilidad.py`.
- **Frontend**: `frontend/src/entities/session/` (consulta y hook de revalidación), `frontend/src/app/layouts/app-shell/shell-con-sesion.tsx` (monta la revalidación con la ruta), `frontend/src/app/providers/sesion-gate.tsx` (limpieza de la consulta y refetch de públicas al vencer).
- **API**: mismo contrato de respuestas; cambia cuándo se devuelve 401. Sin cambios de esquema ni migración Alembic.
- **Costo**: una lectura por PK (`sesion.id`, UUID) por pedido autenticado; en el frontend, como máximo un `GET /auth/me` cada 15 s por pestaña y solo ante navegación o foco.
- **Governance**: CRÍTICO (auth). Requiere OK del usuario sobre estos artefactos antes de `/opsx:apply`.
