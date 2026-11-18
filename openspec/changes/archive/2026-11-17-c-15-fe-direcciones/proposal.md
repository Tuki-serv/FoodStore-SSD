# Proposal — C-15 `fe-direcciones`

## Why

US-006 (Épica 2) pide que el cliente guarde varias direcciones de entrega, marque una como principal y las elija al pedir. El backend ya expone el CRUD completo (`/api/v1/direcciones`, C-11 dejó la paginación y el orden «principal primero»), pero en el frontend la ruta `/direcciones` muestra una página provisoria (dueño `C-15` en `route-map.ts`). C-19 (checkout, camino crítico) necesita un selector de dirección listo para usar, y la rúbrica evalúa el CRUD de direcciones y el uso de TanStack Query.

Observado en el repo (`dev`, 2026-11-17):

- `backend/app/modules/direcciones/router.py`: `POST /`, `GET /` (paginado), `GET /{id}`, `PATCH /{id}`, `PATCH /{id}/principal`, `DELETE /{id}` (204, *soft delete*), todos con Bearer y solo sobre direcciones propias (403 ante ajenas, 404 ante inexistentes o eliminadas).
- `DireccionService.crear_direccion_propia` marca principal la primera dirección activa; `marcar_como_principal` desmarca la anterior y es idempotente. **Eliminar la principal no promueve otra**: el usuario puede quedar con direcciones y ninguna principal (OQ-1).
- `DireccionCreate`/`DireccionUpdate` no exigen texto no vacío en `linea1` ni `ciudad` (un `""` pasa) y un `PATCH` con `linea1: null` intentaría escribir NULL en una columna NOT NULL. El frontend debe validar antes de enviar y nunca mandar `null` en los campos obligatorios.
- `frontend/package.json` no tiene `@tanstack/react-form` ni ninguna herramienta de accesibilidad automática (axe). `uiStore` ya tiene `toasts` y `confirmModal` pero nadie los dibuja (C-13b dejó solo el estado, «los dibuja el primer change que los use»).
- No hay índice único parcial sobre `es_principal` en la migración `001`: RN-DI-01 («solo una principal») la garantiza solo el service.

## What Changes

- **Entidad `direccion`** (`frontend/src/entities/direccion/`): tipos del contrato, llamadas HTTP con `apiClient`, consultas (`queryOptions`, claves `['direcciones', …]`), mutaciones (crear, editar, marcar principal, eliminar) que invalidan el listado, y el **selector de dirección** reutilizable para checkout (C-19), con opción «Retiro en el local».
- **Página «Direcciones»** (`frontend/src/pages/direcciones/`) en `/direcciones`, reemplazando la provisoria: listado con la principal destacada, acciones por dirección (editar, marcar principal, eliminar), estado vacío, carga y error, paginación si hay más de una página.
- **Formulario de dirección** (alta y edición) con TanStack Form: validación en el cliente según el contrato real (obligatorios no vacíos, largos máximos) y errores del servidor marcados en su campo.
- **Eliminación con confirmación**: diálogo que avisa cuando se elimina la principal; resultado informado con una notificación.
- **Notificaciones y diálogo de confirmación globales**: el shell dibuja la cola `toasts` y el `confirmModal` de `uiStore` (estado de C-13b), reutilizables por los changes siguientes.
- **Dependencias** (las instala apply): `@tanstack/react-form`; dev: `axe-core` para los chequeos de accesibilidad de la página y el formulario.
- **Docs al cerrar**: KB/06 US-006 cubierta, KB/08 estructura FSD, `frontend/README.md`, `CHANGES.md` (cierre de C-15 y «Punto de partida (C-15)» para C-19).

**Fuera de alcance (con dueño):** el paso de checkout que usa el selector, costo de envío y retiro en local (C-19, PA-13); `direccion_snapshot` en el pedido (IN-15/PA-13); latitud/longitud y mapas (no especificado); cualquier cambio de backend (ver OQ-1: se recomienda no tocarlo); direcciones de otros usuarios desde administración (no especificado).

## Capabilities

### New Capabilities
- `frontend-addresses`: gestión de las direcciones de entrega propias en el frontend — listado, alta, edición, principal, eliminación con confirmación y selector reutilizable para el checkout.
- `frontend-feedback`: notificaciones (toasts) y diálogo de confirmación visibles en toda la aplicación, alimentados por `uiStore`.

### Modified Capabilities
_(ninguna: `frontend-client-stores` ya define el estado de `toasts` y `confirmModal`; acá solo se dibuja. `frontend-route-guards` no cambia: `/direcciones` sigue con acceso `sesion`.)_

## Impact

- **Código nuevo** (`frontend/src/`): `entities/direccion/` (`model/`, `api/`, `ui/`, `index.ts`), `pages/direcciones/` (`ui/`, `index.ts`), `shared/ui/` (dialogo, notificaciones, campo de formulario), hosts de notificaciones y confirmación en `app/layouts/app-shell/`; handlers MSW de direcciones en `src/test/msw/direcciones.ts`.
- **Código modificado**: `app/router/routes.tsx` (la ruta `/direcciones` monta la página real), `app/layouts/app-shell/` (monta los hosts), `src/test/setup.ts` (matchers de axe), `package.json`.
- **Backend**: sin cambios (contrato verificado en `backend/app/modules/direcciones/`).
- **Docs**: `knowledge-base/06` (US-006), `knowledge-base/08` (árbol FSD), `frontend/README.md`, `CHANGES.md`.
- **Governance BAJO**: autonomía total si los tests pasan; el único gate es la aprobación de los mockups (`[UI-MOCKUP]`, política `system-and-mockups`).
