# Proposal — C-23 `fe-admin-usuarios-roles`

> **Governance CRÍTICO (auth / RBAC).** Este change solo se propone: no se escribe código (ni tests, ni mockups) hasta que el usuario apruebe esta propuesta, responda (o acepte por defecto) OQ-1..OQ-10 de `design.md` y apruebe los mockups.

## Why

US-027 (Épica 7) y RN-US-01..03 piden que un `ADMIN` administre las cuentas del local: crear usuarios con uno o varios roles, listarlos paginados con filtro por rol, cambiarles los roles y desactivarlos (soft delete). Es la única forma de dar de alta a los gestores `STOCK` y `PEDIDOS` sin tocar la base a mano. En el frontend `/admin/usuarios` sigue siendo una **página provisoria** con dueño `C-23`, y el backend, aunque ya expone los endpoints, no protege contra operaciones que dejan al sistema sin administrador ni valida el filtro por rol como pide la spec.

Observado en el repo (`dev`, 2026-11-20):

- **Endpoints** (`backend/app/modules/admin/router.py:89-127`, todos con `require_role(["ADMIN"])`; contrato congelado en `tests/integration/test_contrato_rutas.py`): `POST /admin/usuarios/createUser` (`UserCreateAdmin` = `UserCreate` + `roles_codigos`, 201 `UserPublicAdminPanel` con `roles[{codigo,nombre}]`), `GET /admin/usuarios/` (`page`/`size`, `rol_codigo` opcional, solo activos, orden `created_at` ascendente, `PaginatedResponse`), `PATCH /admin/usuarios/{id}` (`UserUpdateAdmin`: `nombre`/`apellido`/`celular` + `roles_codigos` opcional que **reemplaza** la lista) y `DELETE /admin/usuarios/{id}` (204, `deleted_at`).
- **Service** (`backend/app/modules/usuarios/service.py`): código de rol inexistente → 400 en alta y edición; email duplicado entre activos → 409; email normalizado y nombre/apellido recortados (C-14). Un usuario desactivado ya no opera (`get_current_active_user` → 404) ni renueva (refresh → 401), pero **sus sesiones no se cierran**.
- **Huecos frente a la spec/KB**: `roles_codigos: []` crea o deja un usuario **sin roles**; códigos repetidos no se deduplican (riesgo de 500 por la PK de `usuario_rol`); `rol_codigo` desconocido en el listado devuelve una lista vacía en vez de 400 (RN-US-02); nada impide que un `ADMIN` se quite su propio rol `ADMIN`, se desactive a sí mismo o deje el sistema **sin ningún `ADMIN` activo**; `usuario_rol.asignado_por_id` nunca se completa; no hay orden de desempate (`id`) en el listado.
- **Frontend**: ruta `/admin/usuarios` con acceso `ADMIN` (`shared/config/routes.ts`), ítem «Usuarios» en el grupo «Administración» del panel lateral (DD-25) y página provisoria (`app/router/route-map.ts`). `shared/config/roles.ts` ya tiene `ROLES` y `NOMBRE_ROL`; hay piezas reutilizables de C-14/C-17 (`shared/lib/validacion-persona`, `formato-email`, `shared/ui/dialogo`, `dialogo-baja`, `paginacion`, `lista-admin`, `campo`). No existe `entities/usuario`.

## What Changes

- **Administración de usuarios** (`/admin/usuarios`, solo `ADMIN`): listado paginado de usuarios activos (nombre y apellido, email, celular, roles como etiquetas), filtro por rol guardado en la URL («Todos» + los 4 roles), estados de carga/vacío/error; marca «Vos» en la fila del propio administrador.
- **Alta de usuario**: formulario con nombre, apellido, email, celular opcional, contraseña inicial (mín. 8) y selección **múltiple** de roles (al menos uno); errores por campo (422 `field`, 409 email duplicado → en el campo email, 400 rol inválido).
- **Edición**: datos personales (nombre, apellido, celular) y roles del usuario; el email no se edita (OQ-6). Si el administrador se edita a sí mismo, la sesión se refresca (`GET /auth/me`) para que el panel lateral refleje sus roles.
- **Desactivación**: diálogo de confirmación nombrando al usuario; la fila desaparece del listado.
- **Endurecimiento del backend (aditivo, mismas rutas)**: al menos un rol y deduplicación de `roles_codigos`; `rol_codigo` desconocido en el listado → 400; protección del último `ADMIN` activo y de la autodesactivación / autoquita del rol `ADMIN` (409 con `code` propio, OQ-1..OQ-3); la desactivación **cierra las sesiones abiertas** del usuario (OQ-4); `asignado_por_id` con el `ADMIN` que asigna el rol (OQ-9); desempate por `id` en el orden del listado. Si OQ-4 se aprueba con el motivo `BAJA`, **migración Alembic `006`** que amplía `ck_sesion_revoked_reason`.
- **Docs al cerrar**: KB/06 (US-027 marcada), KB/05 (RN-US-06/07 con las decisiones de OQ-1..OQ-4), `frontend/README.md`, `CHANGES.md` (cierre de C-23, «Punto de partida (C-23)» donde aplique).

**Fuera de alcance:** reactivar usuarios desactivados y listar desactivados (OQ-5); cambio de email o reseteo de contraseña por el administrador y contraseña generada/enviada por email (OQ-6, OQ-7); búsqueda por nombre/email y filtro por varios roles (OQ-8); vencimiento de roles (`usuario_rol.expires_at`); rol `COCINA` (PA-07, no se agrega ni se quita); auditoría de cambios de roles más allá de `asignado_por_id`.

## Capabilities

### New Capabilities
- `user-administration`: API de administración de usuarios para `ADMIN` — alta con varios roles, listado paginado con filtro por rol, edición de datos y roles, desactivación (soft delete) con cierre de sesiones, y las protecciones del último administrador y de la propia cuenta.
- `frontend-admin-users`: pantalla «Usuarios» del frontend para `ADMIN` — acceso, listado con filtro por rol y paginación, alta, edición de datos y roles, desactivación y manejo de errores.

### Modified Capabilities
- `frontend-app-shell`: `/admin/usuarios` deja de ser la página provisoria de ejemplo; la provisoria que queda es `/admin/dashboard` (dueño `C-24`).

## Impact

- **Backend modificado**: `modules/usuarios/schemas.py` (validación de `roles_codigos`: no vacío, sin repetidos), `service.py` (protecciones de último `ADMIN` y propia cuenta, filtro con rol inválido → 400, cierre de sesiones en la baja, `asignado_por_id`), `repository.py` (conteo de `ADMIN` activos con bloqueo, desempate por `id`), `unit_of_work.py` (repositorio de sesiones), `modules/admin/router.py` (pasa el usuario actual al service; sin lógica nueva en el router), `core/errors` (códigos `LAST_ADMIN`/`SELF_ACTION` si se aprueban). Migración `006` solo si OQ-4 = `BAJA`. Sin rutas nuevas (el contrato congelado de `test_contrato_rutas.py` no cambia).
- **Frontend nuevo**: `entities/usuario/` (tipos, API, `usuarioQueries`, mutaciones), `pages/admin-usuarios/` (página, lista, filtro, formulario de alta/edición, diálogo de baja, validación, CSS), `src/test/msw/usuarios.ts`, `src/test/render-usuarios.ts`.
- **Frontend modificado**: `app/router/routes.tsx` y `route-map.ts` (página real en `/admin/usuarios`; `DuenoRuta` sin `C-23`), tests del router que hoy esperan la provisoria de `C-23`, `app/styles/index.css`.
- **Paquetes**: ninguno nuevo. **Dependencias**: C-13b, C-08 (cerrados); reutiliza C-14 (validación de persona/email) y C-17 (piezas de lista admin y diálogos).
- **Governance CRÍTICO**: propuesta + OQ aprobadas por el usuario antes de cualquier código; gate de mockups aprobados (`[UI-MOCKUP]`, política `system-and-mockups`); checkpoint con el usuario al terminar el bloque de backend.
