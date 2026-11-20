# Design — C-23 `fe-admin-usuarios-roles`

## Context

Motivación y relevamiento del código en `proposal.md` (Why). Restricciones que dan forma al diseño:

- **Contrato de rutas congelado** (`backend/tests/integration/test_contrato_rutas.py`, C-25a D8): los cuatro endpoints de `/api/v1/admin/usuarios` (incluido el no-REST `POST /createUser`, documentado en KB/02) se conservan con el mismo método y path. Este change no agrega rutas.
- **Autoridad de roles = BD en cada pedido** (DD-24, C-08): quitar o agregar un rol rige desde el pedido siguiente; el claim `roles` del access solo informa a la UI. Por eso un cambio de roles no necesita cerrar sesiones.
- **Usuario desactivado** (C-02): `get_current_active_user` responde 404 «Cuenta de usuario desactivada» y el refresh responde 401, pero las filas de `sesion` siguen abiertas. `AuthService.revocar_sesiones_abiertas` existe y usa `SesionRepository.revocar_abiertas_de_usuario`; `ck_sesion_revoked_reason` solo admite `LOGOUT`, `LOGOUT_ALL`, `REUSO` (`refreshtokens/models.py:25`, migración `002`).
- **`usuario_rol`** tiene PK `(usuario_id, rol_codigo)`, `asignado_por_id`, `expires_at`, `created_at`. La relación `Usuario.roles` usa `link_model`, así que asignar `user.roles = [...]` crea filas **sin** `asignado_por_id` y una lista con códigos repetidos choca con la PK.
- **Frontend**: ruta, acceso (`ACCESO_RUTAS`) y sección del panel ya existen (C-13a/C-13b); patrón de pantalla admin de C-17a/C-17b (listado + formulario en la misma página alternando por `modo`, filtros en la URL, `DialogoBaja`, `Paginacion`, `EstadoVacio`/`EstadoError`, `lista-admin.css`); validaciones de persona y email de C-14 en `shared/lib`; `ROLES`/`NOMBRE_ROL` en `shared/config/roles.ts`.
- **Governance CRÍTICO**: la propuesta y las OQ se aprueban antes de escribir código; los specs de este change reflejan los **valores por defecto recomendados** de OQ-1..OQ-10 y se ajustan (con `/opsx:update`) si el usuario decide otra cosa.

## Goals / Non-Goals

**Goals:**
- Las protecciones de seguridad (último `ADMIN`, propia cuenta, cierre de sesiones en la baja) viven en el **backend**; la UI solo las anticipa (deshabilita/oculta) y explica los 409.
- Cero rutas nuevas y cero cambios de forma en las respuestas existentes (solo validaciones más estrictas y códigos de error nuevos).
- La pantalla reutiliza las piezas de C-14/C-17 sin duplicar validaciones ni estilos.

**Non-Goals:**
- Reactivación, listado de desactivados, cambio de email, reseteo de contraseña, búsqueda por texto, filtro por varios roles, vencimiento de roles (`expires_at`) y auditoría de cambios de roles (ver OQ-5..OQ-8).
- Cambiar el seed o el rol `COCINA` (PA-07).

## Decisions

### D1 — Protecciones en el service, con el actor explícito
`UsuarioService.update_user_by_admin(actor_id, user_id, data)` y `desactivar_usuario(actor_id, user_id)` reciben el id del `ADMIN` que actúa; el router lo obtiene de `get_current_active_user` (además de `require_role(["ADMIN"])` del router) y no decide nada (regla 2). Orden de verificación: 404 (usuario inexistente/desactivado) → validación de roles (422/400) → propia cuenta (`SELF_ACTION_NOT_ALLOWED`) → último `ADMIN` (`LAST_ADMIN`). Los dos códigos se agregan como errores de negocio 409 (`AppError` con `code`, mismo formato `{detail, code, field}` de `api-conventions`).
*Alternativa descartada:* validar en el router o solo en el frontend — rompe la regla 2 y un cliente directo saltearía la protección.

### D2 — Último ADMIN serializado con un bloqueo sobre la fila del rol
Cuando una operación **puede reducir** la cantidad de `ADMIN` activos (quitar `ADMIN` a alguien o desactivar a un usuario que lo tiene), el service bloquea la fila `rol` `ADMIN` (`SELECT … FOR UPDATE` vía `RolRepository.bloquear(codigo)`) y recién entonces cuenta los `ADMIN` activos excluyendo al afectado (`UsuarioRepository.contar_activos_con_rol("ADMIN", excluir_id)`). Dos operaciones simultáneas se serializan: la segunda ve el resultado de la primera y responde `LAST_ADMIN` (o 403 si su autor ya perdió el rol antes de pasar `require_role`).
*Por qué:* con la protección de propia cuenta (D1), el último `ADMIN` solo puede perderse por concurrencia (A y B se quitan el rol mutuamente); el bloqueo de una sola fila es determinista y barato. *Alternativas:* `FOR UPDATE` sobre los usuarios `ADMIN` (más filas, re-chequeo de joins menos claro en READ COMMITTED), `pg_advisory_xact_lock` (funciona, pero es un mecanismo nuevo en el proyecto), aislamiento `SERIALIZABLE` (reintentos que el UoW no maneja).

### D3 — Roles gestionados explícitamente en `usuario_rol`
Un método `UsuarioRepository.reemplazar_roles(usuario, roles, asignado_por_id)` (o un `UsuarioRolRepository` sobre `BaseRepository`) calcula la diferencia: **conserva** las filas de roles que siguen (con su `asignado_por_id` y `created_at` originales), **borra** las de roles quitados e **inserta** las nuevas con `asignado_por_id` = actor. El alta usa el mismo camino. Así se completa `asignado_por_id` (OQ-9) y desaparece el choque con la PK.
*Alternativa:* seguir con `user.roles = [...]` y luego actualizar `asignado_por_id` — dos pasos, y reescribe la fecha de asignación de roles que no cambiaron.

### D4 — Validación de `roles_codigos` en el schema
`UserCreateAdmin.roles_codigos` y `UserUpdateAdmin.roles_codigos` (si viene) usan un tipo `CodigosRol` = lista con `min_length=1` y deduplicación que conserva el orden (validator). En la edición, `roles_codigos: null` explícito se rechaza con 422 (mismo criterio que `nombre`/`apellido` de C-14: omitir = no cambiar). Un código inexistente sigue siendo 400 en el service (RN-US-02). El listado valida `rol_codigo` contra `RolRepository.get_by_codigo` → 400.
*Alternativa:* `Literal["ADMIN","STOCK","PEDIDOS","CLIENT"]` — daría 422 en vez del 400 que pide RN-US-02 y duplicaría el catálogo de roles que vive en la BD.

### D5 — La baja cierra las sesiones con motivo `BAJA` (OQ-4)
`UsuarioUnitOfWork` suma `sesiones = SesionRepository(session)`; `desactivar_usuario` marca `deleted_at` y llama a `uow.sesiones.revocar_abiertas_de_usuario(user_id, "BAJA", utc_now())` en la **misma transacción**. Migración Alembic `006_sesion_motivo_baja` amplía `ck_sesion_revoked_reason` a `('LOGOUT','LOGOUT_ALL','REUSO','BAJA')` (upgrade y downgrade; el downgrade falla de forma explícita si hay filas `BAJA`, o las pasa a `LOGOUT_ALL` — se decide en apply y se documenta) y se actualiza el `CheckConstraint` del modelo para que el chequeo de esquema siga alineado.
*Por qué:* el acceso ya queda bloqueado, pero sin revocar, una futura reactivación (OQ-5) revivía sesiones de hasta 7 días; además deja rastro auditable. *Alternativa sin migración:* motivo `LOGOUT_ALL` — mezcla un cierre administrativo con uno pedido por el usuario.

### D6 — Orden estable del listado
`get_paged_users` ordena por `created_at, id` (el seed crea usuarios en el mismo instante en tests). Se mantiene ascendente (sin cambio de contrato). El listado y el conteo pasan a `BaseRepository.paginar` si la consulta con `rol_codigo` lo permite sin duplicar filas (el filtro por rol es por existencia: `EXISTS` / `join` sobre un solo código no duplica); si no, se conserva el par actual.

### D7 — Frontend: ubicación FSD
- `entities/usuario/`: `model/usuario.ts` (tipos `UsuarioAdmin`, `DatosAltaUsuario`, `CambiosUsuario`, `FiltrosUsuarios`), `api/usuarios-api.ts` (`listarUsuarios`, `crearUsuario`, `actualizarUsuario`, `desactivarUsuario`), `api/usuario-queries.ts` (`usuarioQueries.lista(filtros)` con `queryOptions`, keys `['usuarios','lista',filtros]`, `placeholderData` para paginar) y `api/usuario-mutations.ts` (invalidan `['usuarios']`). Sigue el patrón de `entities/ingrediente` (un recurso del backend = una entidad).
- `pages/admin-usuarios/`: `model/filtro.ts` (`leerEstadoListado`, `aParametros`: `?rol=STOCK&page=2`, rol desconocido → «Todos»), `model/validacion.ts` (reusa `errorDeNombrePersona`, `errorDeCelular`, `esEmailValido`; contraseña ≥ 8; al menos un rol), `model/errores.ts` (`clasificarErrorUsuario`: 409 email → campo `email`; 422 `field` → campo; 409 `SELF_ACTION_NOT_ALLOWED`/`LAST_ADMIN` → mensaje propio; 400 → general; sin respuesta → conexión; 404 → `ya-no-activo`), `model/cambios.ts` (diff de campos para el `PATCH`), `ui/` (página, `ListaUsuarios`, `FiltroRol`, `FormularioUsuario`, `DialogoDesactivarUsuario`, CSS).
- Sin `features/`: un solo consumidor (FSD: ante la duda, en `pages`). Sin Zustand: todo es server state.
*Alternativa:* todo en `pages/admin-usuarios` — se descartó para seguir la convención del repo de API por entidad y dejar `entities/usuario` disponible si C-24 u otros lo necesitan.

### D8 — Formulario con TanStack Form, mismo componente para alta y edición
`FormularioUsuario` recibe `modo: alta | edición` y el usuario. En edición: email visible pero no editable, sin contraseña; los roles como `fieldset` de casillas con leyenda «Roles». Si el usuario editado es el de la sesión (`useSesion().usuario.id`), la casilla «Administrador» queda deshabilitada con la explicación (spec), y al guardar con éxito se refresca la sesión (`obtenerUsuarioActual` → `authStore`) para que el panel lateral refleje los roles nuevos. Patrón de página de C-17a: el formulario reemplaza al listado (`modo`), con foco devuelto al botón de origen al volver.

### D9 — Errores mostrados por `code`/`status`, no por texto
`clasificarErrorUsuario` usa `ApiError.status`, `code` y `field`. El texto del 409 de email duplicado del backend es `HTTP_409` sin `field` (C-14): se reconoce por status 409 en el alta (es el único 409 posible del alta). Los mensajes visibles: «Ya existe un usuario con ese email.», «No podés quitarte tu propio rol de administrador.» / «No podés desactivar tu propia cuenta.», «Tiene que quedar al menos un administrador activo.».

### D10 — Tests (Strict TDD)
- **Backend** (pytest contra PostgreSQL `foodstore_test`): `tests/integration/test_usuarios_admin.py` (alta multi-rol, `asignado_por_id`, roles vacíos/repetidos/inválidos, listado paginado y filtro, rol desconocido 400, edición, 404 de desactivado, propia cuenta, último `ADMIN`, baja con sesiones `BAJA`, email reutilizable), `tests/integration/test_usuarios_admin_concurrente.py` (dos `ADMIN` quitándose el rol mutuamente con `threading.Barrier`, mismo patrón que `test_pedidos_stock_concurrente.py`, sin la fixture `session`), y la migración `006` en `test_migrations.py`.
- **Frontend** (Vitest + RTL + MSW): `src/test/msw/usuarios.ts` (estado en memoria con filtro/paginación, 409/400/404/500 inyectables, registro de cuerpos), `src/test/render-usuarios.ts`; tests de modelo puro, de API/queries, de página (listado, filtro, alta, edición, propia cuenta, baja) y axe. Ajuste de los tests del router que hoy esperan la provisoria de `C-23`.

## Risks / Trade-offs

- **R-1 — Bloqueo del sistema sin administradores** (concurrencia o bug en la verificación) → D2 + test concurrente; el seed sigue creando el admin inicial (recuperación manual documentada en `frontend/README.md`/KB: `python -m app.db.seed`).
- **R-2 — Escalada de privilegios desde la UI** (un `ADMIN` crea otro `ADMIN`) → es comportamiento esperado de RN-US-02; queda registrado `asignado_por_id`. Solo `ADMIN` llega a estos endpoints (403 a los demás, test de matriz).
- **R-3 — Migración `006` sobre un CHECK existente** → upgrade/downgrade probados en `test_migrations.py`; el modelo y la migración cambian juntos para que el chequeo de esquema no diverja.
- **R-4 — Roles cacheados en la UI**: el panel lateral de un usuario afectado no cambia hasta que su sesión se rehidrata o renueva; el backend ya lo rechaza en el pedido siguiente (DD-24). Para el propio administrador se refresca la sesión al guardar (D8).
- **R-5 — Contraseña inicial elegida por el admin** (OQ-7) → la conoce el administrador; se recomienda que el usuario la cambie, pero no hay cambio de contraseña en el alcance (deuda para la entrega: anotar en KB/09 si se acepta).
- **R-6 — Tests del router existentes** dependen de la provisoria de `C-23` (`routes.test.tsx`, `rutas-mis-pedidos.test.tsx`, `route-map.test.ts`) → se reapuntan a `/admin/dashboard` (`C-24`) en el mismo bloque.
- **R-7 — Endurecer validaciones rompe tests existentes** que crean usuarios con `roles_codigos` arbitrarios (`test_producto_inventario.py`, `test_rbac_autoridad.py`, `test_auth.py`) → red de seguridad al inicio; ninguno usa listas vacías hoy (verificar en apply).

## Migration Plan

1. Migración `006` (solo si OQ-4 = `BAJA`): `alembic upgrade head` en desarrollo y en `foodstore_test` (los tests la aplican por sesión). Rollback: `alembic downgrade 005` (ver D5 sobre filas `BAJA`).
2. Backend antes que frontend: las validaciones nuevas son más estrictas pero compatibles con el frontend actual (que no usa estos endpoints).
3. Sin cambios de variables de entorno ni de seed.

## Open Questions

Decisiones del usuario (Governance CRÍTICO). Los specs asumen el **default recomendado**; si se elige otra opción, se actualizan specs y tareas antes de apply.

**Decisión (2026-11-20, by user): OQ-1..OQ-10 aceptadas con el default recomendado.** OQ-4 = motivo `BAJA` con migración `006`.

| OQ | Pregunta | Default recomendado |
|----|----------|---------------------|
| OQ-1 | ¿Un `ADMIN` puede desactivarse a sí mismo? | **No**: 409 `SELF_ACTION_NOT_ALLOWED`; la UI no ofrece «Desactivar» en su fila. |
| OQ-2 | ¿Un `ADMIN` puede quitarse su propio rol `ADMIN`? | **No** (mismo 409); sí puede editar sus datos y sumarse/quitarse otros roles. |
| OQ-3 | ¿Protección del último `ADMIN` activo? | **Sí**: ninguna operación deja 0 `ADMIN` activos (409 `LAST_ADMIN`, serializado con bloqueo, D2). |
| OQ-4 | ¿La desactivación cierra las sesiones abiertas? | **Sí**, con motivo nuevo `BAJA` (migración `006`). Alternativa sin migración: `LOGOUT_ALL`. |
| OQ-5 | ¿Reactivar usuarios / ver desactivados? | **No** en C-23 (US-027 no lo pide; el email queda libre para una cuenta nueva, RN-US-03). |
| OQ-6 | ¿El admin puede cambiar el email de un usuario? | **No** (no está en `UserUpdateAdmin`; evita chocar con la unicidad parcial y con la identidad de login). |
| OQ-7 | ¿Contraseña inicial: la escribe el admin o se genera? | **La escribe el admin** (mín. 8, contrato actual). Generada/enviada por email queda fuera (no hay servicio de email). |
| OQ-8 | Semántica del filtro por rol con multi-rol | **Un solo `rol_codigo` = «tiene ese rol entre los suyos»**, cada usuario aparece una vez con todos sus roles; rol desconocido → 400 (RN-US-02). Sin búsqueda por texto. |
| OQ-9 | ¿Se registra quién asignó cada rol (`asignado_por_id`)? | **Sí**, en alta y edición (D3); se conservan los datos de asignación de roles que no cambian. |
| OQ-10 | ¿Qué roles se pueden asignar y es obligatorio `CLIENT`? | **Los 4 de la spec** (`COCINA` no está sembrado → 400); **al menos uno**, `CLIENT` no obligatorio (el panel deriva secciones de la unión de roles, DD-25). |

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-20)
- Mockups: `openspec/changes/c-23-fe-admin-usuarios-roles/mockups/`
- Approval: approved (2026-11-20, by user) — criterio de aceptación: capturas en `mockups/previews/` (21 estados × 1440/390)
- Preview: rendered (2026-11-20, mockups/previews/)
- Visual verify: passed with differences (2026-11-20) — backend real + Vite, navegador integrado, ADMIN del seed. Revisados en desktop (~1440): listado «Todos» (fila «Vos» sin «Desactivar»), filtro `?rol=ADMIN` («1 usuario con el rol Administrador»), edición propia (casilla «Administrador» bloqueada con candado), alta con errores de validación, diálogo «Desactivar» (cancelado, sin baja real). Mobile (375): tarjetas y filtro segmentado en dos filas, sin scroll horizontal. Red: `/auth/refresh`, `/auth/me` y `/admin/usuarios/` 200; los únicos errores de consola son 401 previos al refresh (flujo normal de C-13b). Sin capturas guardadas en `mockups/verify/` (inspección en el panel del navegador).
  - minor (corregido 2026-11-20): la lista de efectos del diálogo «Desactivar» iba sin viñetas → `list-style:disc` en `.modal .effects`.
  - minor (corregido 2026-11-20): «Desactivando…» sin spinner → `DialogoBaja` dibuja `.spin` (aria-hidden) en curso; la regla `.spin` se definió en `shared/ui/dialogo/dialogo.css` y también da estilo al spinner de `MarcaActualizacion`, que usaba la clase sin regla CSS. Test en `dialogo-baja.test.tsx`.
  - minor (corregido 2026-11-20): mensajes de error de campo en `text-xs` → `.form-usuario .err` en `text-sm`, solo en este formulario (el resto de la app sigue el `.err` del design system).
  - Las correcciones se validaron con tests (frontend 1723/1723, typecheck y lint limpios), sin nueva inspección en el navegador.
  - No revisados en navegador (cubiertos por tests de integración): estados cargando/vacío/error, 409 `LAST_ADMIN`/`SELF_ACTION_NOT_ALLOWED`, email repetido, baja real y avisos (toasts).

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844, con el panel lateral de `ADMIN` y «Usuarios» activo):

| Pantalla / estado | Notas |
|---|---|
| Listado con datos (varios roles por usuario, celular vacío, fila propia «Vos» sin «Desactivar») | tabla en desktop, tarjetas en mobile |
| Listado filtrado por rol + paginación | filtro con «Todos» y los 4 roles |
| Listado cargando (esqueleto), vacío con filtro («No hay usuarios con ese rol» + «Ver todos»), error con «Reintentar» | |
| Formulario de alta vacío y con errores (campos, «Elegí al menos un rol.», email repetido) | contraseña inicial con requisito visible |
| Formulario de edición de otro usuario (email no editable, sin contraseña) | |
| Formulario de edición propia (casilla «Administrador» deshabilitada con explicación) | |
| Formulario con alerta `LAST_ADMIN` y con error de conexión | |
| Diálogo «Desactivar» en reposo, enviando, con error y con «ya no estaba activo» | aviso de cierre de sesiones |
| Aviso (toast) «Usuario creado» / «Usuario actualizado» / «Usuario desactivado» | |
