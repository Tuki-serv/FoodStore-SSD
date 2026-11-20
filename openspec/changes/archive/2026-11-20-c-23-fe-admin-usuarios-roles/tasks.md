# Tasks — C-23 `fe-admin-usuarios-roles`

> **Governance CRÍTICO (auth / RBAC)**: no se escribe código (bloque 1 en adelante) hasta que el usuario apruebe la propuesta, responda (o acepte por defecto) OQ-1..OQ-10 de `design.md` y apruebe los mockups del bloque 0. Checkpoint obligatorio con el usuario al terminar el bloque 4 (backend) antes de empezar el frontend.
> **Criterios de aceptación visual**: los HTML de `mockups/` de este change una vez aprobados.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso; tests por interfaces públicas (HTTP en backend, lo que ve el usuario en frontend), MSW en la frontera de red, sin aserciones tautológicas. Backend: pytest contra PostgreSQL `foodstore_test` desde `backend/`. Frontend: `npm test`, `npm run typecheck`, `npm run lint` desde `frontend/`.
> **Hard rules**: capas `models ← repository ← uow ← services ← routers` (sin Session ni lógica en routers; extender `BaseRepository`); cambio de esquema solo con migración Alembic; FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; usuarios = server state (TanStack Query), sin Zustand nuevo; sin build ni dev server por iniciativa propia; sin commits.

## 0. Gate previo (antes de apply)

- [x] 0.1 Presentar al usuario OQ-1..OQ-10 (`design.md` §Open Questions) y registrar en `design.md` la respuesta (o «por defecto») de cada una; si alguna difiere del default, actualizar specs/design/tasks con `/opsx:update` antes de seguir. Verificación: tabla de OQ con la decisión anotada.
- [x] 0.2 Crear `mockups/` con las pantallas y estados de `design.md` §UI Mockups (p. ej. `usuarios.html?estado=…&rol=…`, `usuario-form.html?modo=alta|edicion|propia&error=…`, `usuario-desactivar.html?estado=…`), importando `design-system/tokens.css` y `brand.js`, reutilizando `mockup.css`/`mockup.js` de C-17a, y `mockups/README.md` con `Approval: pending`. Verificación: archivos presentes y listados en el README.
- [x] 0.3 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes.
- [x] 0.4 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`; enlazar las capturas aprobadas como criterio de aceptación. Verificación: ambos archivos con la aprobación. **Sin esto no se inicia el bloque 1.**

## 1. Red de seguridad

- [x] 1.1 Backend: `pytest tests/integration/test_auth.py tests/integration/test_auth_refresh.py tests/integration/test_rbac_autoridad.py tests/integration/test_rbac_matriz.py tests/integration/test_usuarios_validacion.py tests/integration/test_producto_inventario.py tests/integration/test_contrato_rutas.py tests/integration/test_migrations.py`; anotar la línea base. Si algo falla, frenar y reportarlo como falla previa.
- [x] 1.2 Frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base. Si algo falla, frenar y reportarlo.

## 2. Backend: alta y edición con roles válidos (spec `user-administration`, design D3, D4)

- [x] 2.1 RED: `tests/integration/test_usuarios_admin.py` — un `ADMIN` crea a «Carla» con `["PEDIDOS","STOCK"]` → 201 con esos dos roles; `roles_codigos: []` → 422 `VALIDATION_ERROR` `field` `roles_codigos` sin crear; `["STOCK","STOCK"]` → 201 con un único `STOCK`. Ejecutar → fallan los dos últimos.
- [x] 2.2 GREEN: tipo `CodigosRol` (lista no vacía, deduplicada en orden) en `usuarios/schemas.py` para `UserCreateAdmin` y `UserUpdateAdmin` (y `null` explícito rechazado en la edición). Ejecutar → verde.
- [x] 2.3 RED: la asignación de cada rol en el alta registra `asignado_por_id` = id del `ADMIN` (consulta a `usuario_rol` en el test); en la edición, un rol que se conserva mantiene su `asignado_por_id`/`created_at` y uno nuevo registra al actor. Ejecutar → falla.
- [x] 2.4 GREEN: `reemplazar_roles(usuario, roles, asignado_por_id)` en el repositorio (sobre `BaseRepository`, design D3); el service recibe `actor_id` y lo usa en alta y edición; el router obtiene el actor con `get_current_active_user` sin agregar lógica. Ejecutar → verde.
- [x] 2.5 TRIANGULATE: rol inexistente (`["CLIENT","COCINA"]`) en alta y edición → 400 sin cambios; edición solo de `celular` conserva roles; edición de usuario desactivado → 404; reemplazo `["CLIENT"]` a un `CLIENT`+`STOCK` y su siguiente `PATCH /productos/{id}/stock` → 403. Ejecutar → verde. REFACTOR + suite de 1.1 verde (ajustar tests previos solo si usaban entradas ahora inválidas, documentándolo).

## 3. Backend: listado y filtro por rol (spec `user-administration`, design D6)

- [x] 3.1 RED: 25 usuarios activos + 1 desactivado → `page=2&size=20` da 5 ítems, `total` 25, `pages` 2, sin el desactivado; `?rol_codigo=COCINA` → 400. Ejecutar → falla el 400.
- [x] 3.2 GREEN: validación de `rol_codigo` en `get_all_users` (400 si no existe) y orden `created_at, id`. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: «Carla» con `PEDIDOS`+`STOCK` filtrada por `STOCK` aparece una vez con los dos roles y `total` la cuenta una vez; filtro sin coincidencias → `items` vacío y `total` 0; usuarios con igual `created_at` salen ordenados por `id`. Ejecutar → verde. REFACTOR (usar `BaseRepository.paginar` si no duplica filas).

## 4. Backend: baja con cierre de sesiones y protecciones (spec `user-administration`, design D1, D2, D5)

- [x] 4.1 RED: desactivar a un usuario con dos sesiones abiertas → 204, ambas `revoked_reason` `BAJA`, renovar con cualquiera → 401; doble desactivación → 404; email del desactivado reutilizable en un alta nueva → 201. Ejecutar → falla el motivo `BAJA`.
- [x] 4.2 GREEN: migración `alembic/versions/006_sesion_motivo_baja.py` (amplía `ck_sesion_revoked_reason`; upgrade/downgrade, design D5) + `CheckConstraint` del modelo en `refreshtokens/models.py`; `SesionRepository` en `UsuarioUnitOfWork`; `desactivar_usuario` revoca en la misma transacción. Test en `test_migrations.py` de upgrade/downgrade. Ejecutar → verde. *(Si OQ-4 se decidió `LOGOUT_ALL`, sin migración y el test espera ese motivo.)*
- [x] 4.3 RED: un `ADMIN` se desactiva a sí mismo → 409 `SELF_ACTION_NOT_ALLOWED` y sigue activo; se envía `["CLIENT"]` para sí mismo → 409 igual y conserva `ADMIN`; `["ADMIN","STOCK"]` para sí mismo → 200. Ejecutar → falla.
- [x] 4.4 GREEN: verificación de propia cuenta en el service (orden de D1) y código de negocio `SELF_ACTION_NOT_ALLOWED` con el formato `{detail, code, field}`. Ejecutar → verde.
- [x] 4.5 RED: `tests/integration/test_usuarios_admin_concurrente.py` — con solo dos `ADMIN` A y B, A quita el rol `ADMIN` a B y B a A al mismo tiempo (`threading.Barrier`, sesiones propias, sin la fixture `session`) → una respuesta 200, la otra 409 `LAST_ADMIN` o 403, y queda exactamente un `ADMIN` activo. Ejecutar → falla (sin bloqueo quedan cero).
- [x] 4.6 GREEN: `RolRepository.bloquear("ADMIN")` (`FOR UPDATE`) + `contar_activos_con_rol("ADMIN", excluir_id)` y error `LAST_ADMIN` solo cuando la operación puede reducir los `ADMIN` activos (design D2). Ejecutar → verde, repetido 5 veces sin flakes.
- [x] 4.7 TRIANGULATE: con tres `ADMIN`, desactivar a uno → 204 y quedan dos; quitar `ADMIN` a otro `ADMIN` cuando quedan dos → 200; operaciones que no tocan `ADMIN` no toman el bloqueo (desactivar a un `CLIENT` con otra transacción reteniendo el bloqueo no espera). Matriz: `STOCK`/`PEDIDOS`/`CLIENT` → 403 en los cuatro endpoints, sin token → 401. Ejecutar → verde.
- [x] 4.8 REFACTOR + cierre del backend: suite de 1.1 verde, `test_contrato_rutas.py` sin cambios, revisión de capas (router sin lógica). Documentar en `knowledge-base/05_reglas_de_negocio.md` RN-US-06 (propia cuenta), RN-US-07 (último `ADMIN`) y la baja con sesiones `BAJA`; en `knowledge-base/04_modelo_de_datos.md` el motivo `BAJA` y `asignado_por_id`. Verificación: docs actualizadas y suite verde. **Checkpoint con el usuario.**

## 5. Entidad `usuario` (spec `frontend-admin-users`, design D7)

- [x] 5.1 `src/test/msw/usuarios.ts`: estado en memoria de usuarios (con roles), `GET /admin/usuarios/` con `rol_codigo`/`page`/`size` aplicados, `POST /createUser`, `PATCH /:id`, `DELETE /:id`, errores inyectables (409 email, 409 `SELF_ACTION_NOT_ALLOWED`/`LAST_ADMIN`, 400, 404, 500, red) y registro de cuerpos; `src/test/render-usuarios.ts`. Verificación: un test de humo del handler pasa.
- [x] 5.2 RED → GREEN + TRIANGULATE `listarUsuarios`/`usuarioQueries.lista(filtros)` (params sin claves vacías: `{rol:'STOCK',page:2}` → `?rol_codigo=STOCK&page=2&size=20`; sin rol → sin `rol_codigo`), `crearUsuario`, `actualizarUsuario`, `desactivarUsuario` y mutaciones que invalidan `['usuarios']`. Tipos en `entities/usuario/model/usuario.ts`, `index.ts` público. Ejecutar → verde; typecheck verde.

## 6. Rutas y acceso

- [x] 6.1 RED: `src/app/router/__tests__/rutas-admin-usuarios.test.tsx` — `CLIENT`+`ADMIN` en `/admin/usuarios` ve «Usuarios» y «Nuevo usuario» (no la provisoria); `CLIENT`+`PEDIDOS` → acceso denegado sin `GET /admin/usuarios/` en MSW; anónimo → `/ingresar` con la ruta recordada. Ejecutar → falla.
- [x] 6.2 GREEN: página real en `app/router/routes.tsx` con `RequiereAcceso`; `route-map.ts` sin `C-23` en `DuenoRuta`; reapuntar a `/admin/dashboard` (`C-24`) los tests que esperaban la provisoria de `C-23` (`routes.test.tsx`, `rutas-mis-pedidos.test.tsx`, `route-map.test.ts`, `guards.test.tsx` si aplica) según el delta de `frontend-app-shell`. Ejecutar → verde.

## 7. Listado y filtro (spec `frontend-admin-users`)

- [x] 7.1 RED → GREEN + TRIANGULATE `pages/admin-usuarios/model/filtro.ts`: `?rol=STOCK&page=2` → `{rol:'STOCK',page:2}`; `?rol=COCINA` → «Todos»; `page` < 1 o inválida → 1; `aParametros` sin rastro de defectos. Ejecutar → verde.
- [x] 7.2 RED: `pages/admin-usuarios/__tests__/admin-usuarios-page.test.tsx` — «Carla Gómez» con «Gestor de pedidos» y «Gestor de stock», celular vacío → «—», fila propia con «Vos» y sin «Desactivar». Ejecutar → falla.
- [x] 7.3 GREEN: `AdminUsuariosPage`, `ListaUsuarios` (tabla desktop / tarjetas mobile según mockup), CSS e import en `app/styles/index.css` (lo verifica `styles-compile`). Ejecutar → verde.
- [x] 7.4 TRIANGULATE: elegir «Gestor de stock» → MSW recibe `rol_codigo=STOCK&page=1` y la URL guarda `rol=STOCK`; paginación con 25 usuarios; esqueleto; «No hay usuarios con ese rol» + «Ver todos»; 500 → «Reintentar» que vuelve a pedir; última página vacía tras una baja → vuelve a la última existente. Ejecutar → verde.

## 8. Alta y edición (spec `frontend-admin-users`, design D8, D9)

- [x] 8.1 RED → GREEN + TRIANGULATE `model/validacion.ts` (reusa `errorDeNombrePersona`, `errorDeCelular`, `esEmailValido`; contraseña < 8 → error; ningún rol → «Elegí al menos un rol.») y `model/cambios.ts` (solo campos cambiados; roles como lista completa; sin cambios → nada). Ejecutar → verde.
- [x] 8.2 RED → GREEN + TRIANGULATE `model/errores.ts` `clasificarErrorUsuario`: 409 en alta → campo `email`; 422 `field` → ese campo; 409 `SELF_ACTION_NOT_ALLOWED` y `LAST_ADMIN` → sus mensajes; 400 → general; sin respuesta → conexión; 404 → `ya-no-activo`. Ejecutar → verde.
- [x] 8.3 RED: alta de «Carla» con dos roles → MSW recibe `POST /createUser` con `roles_codigos` `["PEDIDOS","STOCK"]`, aviso «Usuario creado» y la fila aparece sin recargar. Ejecutar → falla.
- [x] 8.4 GREEN: `FormularioUsuario` con TanStack Form (modo alta/edición, `fieldset` «Roles»), integrado en la página con el patrón de `modo` de C-17a y foco devuelto al volver. Ejecutar → verde.
- [x] 8.5 TRIANGULATE: datos inválidos y sin roles → ningún `POST`; 409 email → «Ya existe un usuario con ese email.» conservando datos; red → alerta de conexión; edición de «Carla» quitando «Gestor de stock» → `PATCH` solo con `roles_codigos` `["PEDIDOS"]` y «Usuario actualizado»; edición sin email ni contraseña editables. Ejecutar → verde.
- [x] 8.6 RED → GREEN + TRIANGULATE edición propia: casilla «Administrador» deshabilitada con «No podés quitarte tu propio rol de administrador»; al sumarse «Gestor de stock» y guardar → se vuelve a pedir `GET /auth/me` y la sesión tiene los roles nuevos; 409 `LAST_ADMIN` → «Tiene que quedar al menos un administrador activo.» conservando lo elegido. Ejecutar → verde.

## 9. Desactivación (spec `frontend-admin-users`)

- [x] 9.1 RED: «Desactivar Carla Gómez» abre el diálogo con nombre, email y aviso de cierre de sesiones; confirmar → MSW recibe `DELETE /admin/usuarios/<id>`, «Usuario desactivado» y la fila desaparece. Ejecutar → falla.
- [x] 9.2 GREEN: `DialogoDesactivarUsuario` sobre `DialogoBaja`. Ejecutar → verde.
- [x] 9.3 TRIANGULATE: 404 → «ya no estaba activo» y el listado se vuelve a pedir; 500/red → error dentro del diálogo; Escape → foco al botón «Desactivar Carla Gómez»; tras eliminar, foco al título. Ejecutar → verde.
- [x] 9.4 axe sin violaciones en el listado con datos, el formulario de alta con errores y el diálogo de desactivación. Ejecutar → verde.

## 10. Cierre

- [x] 10.1 Integración: backend suite completa verde contra la línea base de 1.1; frontend `npm test`, `npm run typecheck`, `npm run lint` verdes y `tests/architecture` (`fsd-boundaries`, `styles-compile`) en cero violaciones.
- [x] 10.2 Revisión SOLID/DRY y de seguridad del diff: protecciones solo en el service, un único clasificador de errores, validaciones de persona/email reutilizadas, `Dialogo`/`DialogoBaja`/`Paginacion`/estados reutilizados, sin `any`. Anotar la revisión en este archivo.

  Revisión 10.2 (apply):
  - Protecciones (propia cuenta, último ADMIN) solo en el service del backend; la UI solo las refleja (casilla propia bloqueada, sin «Desactivar» en la fila propia) y traduce los 409 por código, nunca por el texto de `detail`.
  - Un único clasificador de errores (`model/errores.ts`, `clasificarErrorUsuario`) para alta, edición y baja; validaciones de persona/email reutilizadas de `shared`; contraseña sin `trim` y fuera de claves de caché y de logs.
  - Reutilizados `Dialogo`/`DialogoBaja` (extendido con `etiquetaConfirmar`, `etiquetaPendiente`, `cuerpo`), `Paginacion`, `EstadoVacio`/`EstadoError`/`EsqueletoFilas`/`AvisoDesactualizado`, `Campo`; CSS `.seg`/`.ilist` movido a `shared/ui/lista-admin` (DRY con Ingredientes).
  - FSD: sin imports cruzados entre entities (`useRefrescarSesion` vive en `entities/session`, la página compone ambas); query key `['usuarios']` privada de la entidad; sin `any`; mapas de clases Tailwind literales.
- [x] 10.3 Docs: `knowledge-base/06_funcionalidades.md` (US-027 marcada), `knowledge-base/03_actores_y_roles.md` (protecciones del `ADMIN`), `knowledge-base/09_decisiones_y_supuestos.md` (deuda R-5 si se acepta OQ-7), `frontend/README.md` (pantalla «Usuarios» y recuperación con el seed), `CHANGES.md` (cierre de C-23 y «Punto de partida (C-23)» en C-24/C-25b si aplica). Verificación: archivos actualizados y coherentes con los specs.

## Workflow follow-up

- Verify visual (`design.md` §UI Mockups paso 12): backend real + Vite con permiso del usuario, comparar listado, formulario y diálogo con los mockups a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-23-fe-admin-usuarios-roles` y marcar `[x]` en `CHANGES.md`.
