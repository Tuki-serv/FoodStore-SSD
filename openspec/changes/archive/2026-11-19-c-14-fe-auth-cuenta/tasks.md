# Tasks — C-14 `fe-auth-cuenta`

> **Governance CRÍTICO** (auth) + **HIGH** (migración `005` sobre datos de usuarios): no se escribe código (ni tests) hasta que el usuario apruebe explícitamente esta propuesta (OQ-1..OQ-5 ya resueltas como DU-1..DU-5 el 2026-11-19; faltan OQ-6/OQ-7 de `design.md`), **y** hasta que los mockups del bloque 0 estén aprobados (`design.md` §UI Mockups con `Approval: approved`). Si una decisión cambia, actualizar specs/design/tasks antes de apply.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`; backend `python-testing-patterns`): cada tarea de comportamiento es RED (test que falla, ejecutado) → GREEN (mínimo código, ejecutado) → TRIANGULATE (otro caso con datos distintos) → REFACTOR (suite verde tras cada paso). Red simulada solo con MSW (`server.use` por test, `onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Consultas por rol/etiqueta, `userEvent.setup()` con `await`, QueryClient nuevo por test sin reintentos. Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo; TS `strict` sin `any`; datos del servidor en TanStack Query, sesión en `authStore`; no leer ni escribir `.env*`; no correr `npm run dev`, `vite build` ni servidores por iniciativa propia (regla 13); no commitear. Comandos de frontend desde `frontend/`, de backend desde `backend/`.

## 0. Gate de mockups (antes de apply)

- [x] 0.1 Crear `mockups/` con `ingresar.html` (estados: vacío, errores, credenciales, bloqueo, enviando, cuenta-creada), `registrarse.html` (vacío con «Repetir contraseña», errores — contraseñas distintas, nombre/apellido vacíos —, email-duplicado, enviando), `mi-cuenta.html` (datos, guardado, error de validación, diálogo cerrar todas), importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificar que cada archivo abre localmente sin recursos remotos.
- [x] 0.2 Renderizar cada mockup y estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas y registrar `Preview: rendered` en `design.md`.
- [x] 0.3 Mostrar mockups y capturas al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`, junto con las respuestas a OQ-6/OQ-7.

## 1. Red de seguridad

- [x] 1.1 Frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base (archivos/tests verdes) en este archivo. Si algo falla, frenar y reportarlo como falla previa.
  - Línea base (2026-11-19): 107 archivos / 986 tests verdes; typecheck y lint sin errores.
- [x] 1.2 Backend: `pytest` completo contra `foodstore_test`; anotar la línea base. Si algo falla, frenar y reportarlo.
  - Línea base (2026-11-19): 1706 tests, 1705 verdes; `tests/unit/test_limitador_por_clave.py::test_retry_after_es_el_tiempo_hasta_que_vence_el_fallo_mas_antiguo` falló una vez bajo carga concurrente y pasa aislado (intermitente de temporización, falla previa ajena al change).
- [x] 1.3 Ampliar `src/test/msw/auth.ts` con `handlerLogin`, `handlerRegister`, `handlerPatchPerfil`, `handlerLogoutAll` (respuesta configurable, registro de cuerpos, `Content-Type` y `Authorization` recibidos). Lo cubren los tests de los bloques 3–7 (sin tests propios); `npm test` sigue en la línea base.

## 2. Backend: retiro de `GET /usuarios/me` (spec `user-profile`; OQ-2)

- [x] 2.1 RED: en `backend/tests/integration/test_auth.py`, test `GET /api/v1/usuarios/me` autenticado → 405, y `PATCH /usuarios/me` con `{"roles_codigos":["ADMIN"],"email":"otro@example.com"}` → 200 con email y roles sin cambiar. Ejecutar → el 405 falla (hoy 200).
- [x] 2.2 GREEN: quitar `read_user_me` de `usuarios/router.py`; mover el test de perfil existente a `GET /auth/me`; `test_exception_handlers.py` usa `GET /auth/me` para el 401 sin token; quitar la fila `GET` de `test_contrato_rutas.py` y la de `rbac_matriz.py` (dueño «C-14/C-25a (retiro)»). Ejecutar `pytest` completo → verde y mismo total ± los tests movidos.
- [x] 2.3 TRIANGULATE: `PATCH /usuarios/me` con `{"nombre":"Analía"}` → 200 y `apellido` intacto; sin token → 401. Ejecutar → verde.

## 2b. Backend: nombre y apellido obligatorios (specs `user-registration` «Nombre y apellido obligatorios en el alta», `user-profile` «Nombre y apellido válidos en el perfil»; DU-3, design D12)

- [x] 2b.1 RED: en `test_auth.py`, `POST /auth/register` con `nombre: "   "` → 422 `VALIDATION_ERROR` `field` `nombre` y 0 usuarios nuevos; `PATCH /usuarios/me` con `{"nombre": null}` → 422 `field` `nombre` (hoy 500). Ejecutar → fallan.
- [x] 2b.2 GREEN: `NombrePersona` (`StringConstraints(strip_whitespace=True, min_length=1, max_length=80)`) en `UserCreate`/`UserUpdateClient` y `field_validator` que rechaza `None` explícito en `nombre`/`apellido` del `PATCH`. Ejecutar → verde.
- [x] 2b.3 TRIANGULATE: register `apellido: ""` → 422 `field` `apellido`; register `" Ana "`/`" Gómez "` → 201 recortados; `PATCH {"apellido":"   "}` → 422 y apellido intacto; `PATCH {"nombre":"  Analía  "}` → 200 `Analía`; `PATCH {"celular": null}` → 200 celular nulo; alta ADMIN (`UserCreateAdmin`) con nombre vacío → 422. `pytest` completo → verde.

## 2c. Backend: email normalizado (specs `user-registration` «Email normalizado en el alta», `auth-session` «Login con email insensible a mayúsculas», `backend-db-migrations` «La migración 005…»; DU-4, design D13)

> Dominio HIGH (datos de usuarios): no empezar sin el OK a OQ-6/OQ-7.

- [x] 2c.1 RED unit: `tests/unit/test_normalizar_email.py`: `normalizar_email(" Ana@Example.COM ")` → `"ana@example.com"`; ya normalizado → igual. Ejecutar → falla.
- [x] 2c.2 GREEN: `normalizar_email` en `app/core/` (función pura). Ejecutar → verde.
- [x] 2c.3 RED integración: register ` Nueva@Example.COM ` → 201 `nueva@example.com`; login con `username` ` Ana@Example.com ` de un usuario `ana@example.com` → 200. Ejecutar → fallan.
- [x] 2c.4 GREEN: `field_validator("email", mode="before")` en `UserCreate` y normalización del argumento en `UsuarioRepository.get_by_email`. Ejecutar → verde.
- [x] 2c.5 TRIANGULATE: register `NUEVA@example.com` con `nueva@example.com` activo → 409; login `ANA@EXAMPLE.COM` con contraseña mala → 401 «Credenciales incorrectas» sin sesión; alta ADMIN con mayúsculas → email guardado en minúsculas; `test_auth_login_timing.py` y `test_rate_limit.py` siguen verdes. Ejecutar → verde.
- [x] 2c.6 RED migración (en `test_migrations.py`, fixture `migrations_db`): tras `upgrade head` la versión es `005` y existe `ck_usuario_email_normalizado`; insertar `Ana@x.com` directo → `IntegrityError` con ese nombre. Ejecutar → falla.
- [x] 2c.7 GREEN: `backend/alembic/versions/005_email_normalizado.py` (pre-chequeo de colisiones activas que aborta listando email/ids, `UPDATE` de todas las filas, `CHECK`; downgrade que quita el `CHECK`) y `CheckConstraint` en `Usuario.__table_args__`. Actualizar `"004"` → `"005"` en `test_migrations.py`, `test_reset.py`, `tests/unit/test_alembic_config.py` y la lista de `tests/support/schema_expectations.py` si corresponde. Ejecutar → verde.
- [x] 2c.8 TRIANGULATE migración: base en `004` con `Ana@X.com` activo y ` Beto@x.com` dado de baja → upgrade normaliza ambos; `Juan@x.com` y `juan@x.com` activos → upgrade falla mencionando el email y los dos ids, versión sigue `004` y datos intactos; activo `juan@x.com` + baja `Juan@x.com` → upgrade OK; `downgrade 004` quita el CHECK y conserva minúsculas; ida y vuelta sin diferencias con los modelos. `pytest` completo → verde (incluye `test_seed.py`: el seed ya usa minúsculas).

## 3. Capa API y mutaciones de sesión (specs «Ingreso…», «Registro…», «Edición del perfil», «Cerrar todas las sesiones»)

- [x] 3.1 RED: `src/entities/session/__tests__/iniciar-sesion.test.tsx`: `useIniciarSesion` con ` ana@example.com ` / `secreta123` → el handler recibe `username=ana%40example.com&password=secreta123` como `application/x-www-form-urlencoded` y la sesión queda `autenticada` con `A1`. Ejecutar → falla.
- [x] 3.2 GREEN: `iniciarSesionRemota` en `shared/api/auth.ts` (design D2) y `useIniciarSesion` en `entities/session` (design D1). Ejecutar → verde.
- [x] 3.3 TRIANGULATE: 401 → rechaza con `ApiError` `HTTP_401`, sesión `anonima` y 0 pedidos a `/auth/refresh`; 429 con `Retry-After: 840` → `retryAfter` 840; login 200 y `/auth/me` 404 → sesión `anonima` sin access. Ejecutar → verde.
- [x] 3.4 RED → GREEN + TRIANGULATE `useRegistrarse` (design D5, DU-1): 201 + login 200 → sesión `autenticada`, el cuerpo del register es el JSON exacto de la spec (`celular: null`, sin «Repetir contraseña») y el login usa el mismo email y contraseña; 409 → `ApiError` `HTTP_409` y 0 pedidos de login; 201 + login 429 → resultado `cuentaCreadaSinSesion` con el email devuelto por el registro. Ejecutar → verde.
- [x] 3.5 RED → GREEN + TRIANGULATE `useActualizarPerfil` (design D6): sesión `ADMIN` + `PATCH` 200 `{nombre:'Analía'}` → `usuario.nombre` `Analía` y roles `['ADMIN']`; 503 → rechaza y la sesión no cambia. Ejecutar → verde.
- [x] 3.6 RED → GREEN + TRIANGULATE `useCerrarTodasLasSesiones` (design D8): 204 → `POST /auth/logout-all` con `Bearer A1`, sesión `anonima` motivo `logout`; sin respuesta → sesión `anonima` igual. Ejecutar → verde.

## 4. Página «Ingresar» (specs «Ingreso…», «Validación del formulario de ingreso», «Credenciales incorrectas», «Bloqueo…», «Fallo de red…», «Envío único…», «Accesibilidad…»)

- [x] 4.1 RED: `src/pages/ingresar/__tests__/validacion.test.ts`: `validarIngreso({email:'', password:''})` → «Ingresá tu email» y «Ingresá tu contraseña». Ejecutar → falla.
- [x] 4.2 GREEN + TRIANGULATE validadores en `pages/ingresar/model/`: `ana@` → «Ingresá un email válido»; valores válidos → sin errores. Mapeo de errores (design D3): 401 → alerta y limpiar contraseña; 429 con 840 → «…14 minutos» y `bloqueoHasta`; 429 sin `retryAfter` → aviso sin bloqueo; `NETWORK_ERROR` → `detail`. Ejecutar → verde.
- [x] 4.3 RED: `src/pages/ingresar/__tests__/ingresar-page.test.tsx` con `renderApp('/ingresar')`: completar y pulsar «Ingresar» → URL `/catalogo` y la navegación muestra «Mi cuenta». Ejecutar → falla (hoy página provisoria).
- [x] 4.4 GREEN: `pages/ingresar` con TanStack Form y `shared/ui/campo`; `PAGINAS` en `routes.tsx` (design D9). Ejecutar → verde.
- [x] 4.5 TRIANGULATE: vuelta a `/direcciones` cuando la ruta recordada es esa; enviar vacío → dos errores y 0 pedidos; 401 → alerta, email conservado, contraseña vacía; 404 en `/auth/me` → alerta genérica y formulario visible; sin respuesta → «No pudimos conectar con el servidor.»; login demorado + doble clic → 1 solo `POST` y «Ingresando…» deshabilitado; con `state.cuentaCreada` → aviso «Tu cuenta se creó. Ingresá para continuar.» y email precargado; enlace «Registrate» → `/registrarse`; `autocomplete` `email`/`current-password`; axe sin violaciones vacío y con errores. Ejecutar → verde.
- [x] 4.6 TRIANGULATE bloqueo con timers falsos (design D4): 429 `Retry-After: 840` → aviso con 14 minutos y botón deshabilitado; a los 839 s sigue deshabilitado, a los 840 s habilitado; 429 sin cabecera → aviso y botón habilitado. Ejecutar → verde.

## 5. Página «Registrarse» (specs «Registro…», «Sesión iniciada tras registrarse», «Validación del formulario de registro», «Email ya registrado», «Errores de validación del servidor», «Accesibilidad…»)

- [x] 5.1 RED: `src/pages/registrarse/__tests__/validacion.test.ts`: contraseña de 7 → «Usá al menos 8 caracteres». Ejecutar → falla.
- [x] 5.2 GREEN + TRIANGULATE validadores y normalización (design D7): 8 caracteres → válida; «Repetir contraseña» distinta → «Las contraseñas no coinciden» e igual → sin error (DU-5); nombre de 81 → «Máximo 80 caracteres» y de 80 válido; nombre «   » → «Ingresá tu nombre»; apellido vacío → «Ingresá tu apellido»; celular de 21 → error y de 20 válido; `aDatosRegistro`: trim, celular vacío → `null`, sin `confirmacion`. Ejecutar → verde.
- [x] 5.3 RED: `src/pages/registrarse/__tests__/registrarse-page.test.tsx` con `renderApp('/registrarse')`: completar y «Crear cuenta» con register 201 + login 200 → URL `/catalogo` y sesión `CLIENT`. Ejecutar → falla.
- [x] 5.4 GREEN: `pages/registrarse` + `PAGINAS`. Ejecutar → verde.
- [x] 5.5 TRIANGULATE: cuerpo enviado exacto; 409 `field: null` → mensaje en email con `aria-invalid="true"`, enlace «Ingresar» y nombre conservado; 422 `field:'email'` → `detail` junto al email; 422 `field:'body'` → alerta general; register 201 + login 429 → `/ingresar` con email precargado, contraseña vacía y aviso «Tu cuenta se creó. Ingresá para continuar.»; contraseñas distintas → error en «Repetir contraseña» y 0 pedidos; 422 `field:'nombre'` → `detail` junto al nombre; enviar vacío → errores y 0 pedidos; doble clic → 1 `POST /auth/register`; `autocomplete` `given-name`/`family-name`/`email`/`tel`/`new-password`; axe sin violaciones con errores. Ejecutar → verde.

## 6. Página «Mi cuenta» (specs «Perfil propio», «Edición del perfil», «Errores de validación del servidor», «Cerrar todas las sesiones», «Accesibilidad…»)

- [x] 6.1 RED: `src/pages/mi-cuenta/__tests__/mi-cuenta-page.test.tsx` con `renderApp('/mi-cuenta', {sesion:{roles:['CLIENT']}})`: se ven «Ana», «Gómez», «ana@example.com» sin campo editable de email y el rol «Cliente»; ningún pedido a `/usuarios/me`. Ejecutar → falla.
- [x] 6.2 GREEN: `NOMBRE_ROL` en `shared/config/roles.ts` (design D1), `pages/mi-cuenta` + `PAGINAS`. Ejecutar → verde.
- [x] 6.3 TRIANGULATE perfil: usuario con `['ADMIN','STOCK']` → «Administrador» y «Gestor de stock»; validadores (apellido vacío → «Ingresá tu apellido» y 0 pedidos; celular de 21 → error); cambiar nombre a « Analía » → `PATCH` con `{"nombre":"Analía","apellido":"Gómez","celular":null}`, el panel lateral muestra «Analía», roles conservados y toast «Datos guardados»; 503 → alerta, valores conservados, sesión sin cambios; 422 `field:'celular'` → mensaje en el campo; doble clic → 1 `PATCH`. Ejecutar → verde.
- [x] 6.4 RED → GREEN + TRIANGULATE «Cerrar todas las sesiones» (design D8): confirmar con 204 → `POST /auth/logout-all` con `Bearer A1`, URL `/catalogo`, navegación sin «Mi cuenta»; «Cancelar» → 0 pedidos y sesión `autenticada`; sin respuesta → sesión `anonima` y `/catalogo`; axe sin violaciones con la página y con el diálogo abierto. Ejecutar → verde.

## 7. Integración y documentación

- [x] 7.1 Verificar que `route-map.test.ts`, `routes.test.tsx` y `guards.test.tsx` siguen verdes sin la página provisoria en las tres rutas (ajustar solo aserciones que dependían del placeholder de C-14, dejando constancia). `npm test`, `npm run typecheck`, `npm run lint` → verdes y sin violaciones de límites FSD; `pytest` → verde.
- [x] 7.2 Docs — desajustes ya detectados en la propuesta:
  - `CHANGES.md` (entrada C-14): el «401/409/429» del login es incorrecto — **no existe 409 en el login**; el 409 es del registro (email duplicado). Corregirlo; además cierre de C-14 y «Punto de partida (C-14)» para C-21/C-23 (schemas endurecidos y email normalizado que hereda el alta ADMIN).
  - `knowledge-base/02_descripcion_general.md` (tabla de endpoints, filas Auth y Usuarios) y `knowledge-base/03_actores_y_roles.md` (fila «Perfil propio (`/usuarios/me`)»): todavía listan `GET /usuarios/me` y dicen que `GET /auth/me` es «solo spec»; pasar a `GET /auth/me` (lectura) + `PATCH /usuarios/me` (edición).
  - `knowledge-base/07_flujos_principales.md` (flujo de login, paso 2): describe el login como JSON `{email,password}` con el form como deuda; el contrato vigente es form OAuth2 `username`/`password` (`application/x-www-form-urlencoded`). Agregar que el email se normaliza a minúsculas (DU-4) y el auto-login tras registrarse (DU-1).
  - `knowledge-base/06_funcionalidades.md` (US-001/002/004/005 cubiertas; `GET/PATCH /usuarios/me` → `GET /auth/me` + `PATCH /usuarios/me`), `knowledge-base/04_modelo_de_datos.md` (`usuario.email` normalizado con `ck_usuario_email_normalizado`), `knowledge-base/09` y `10` donde mencionen `/usuarios/me` como vigente, `frontend/README.md` (pantallas de cuenta).
  - Verificar con grep que no queda `GET /usuarios/me` como vigente en `knowledge-base/` ni en `CHANGES.md`.
- [x] 7.3 Registrar en `design.md` la sección «Notas de implementación» con la tabla escenario → test y los desvíos, y verificar que cada escenario de `specs/` tiene al menos un test.

## 8. Correcciones del verify (2026-11-19)

- [x] 8.1 RED → GREEN + TRIANGULATE: `backend/tests/integration/test_rate_limit.py::TestRetryAfterExpuestoPorCors` (429 cross-origin y respuesta normal exponen `Retry-After`; origen no permitido sin `Allow-Origin`) → `expose_headers=["Retry-After"]` en `CORSMiddleware` (`backend/app/main.py`).
- [x] 8.2 Enlaces en texto subrayados como en los mockups (`shared/ui/tarjeta-auth/tarjeta-auth.css`; estilo puro, sin test).
- [x] 8.3 Re-verificación visual del 429 y del subrayado (capturas `mockups/verify/*-fix-*.png`).

## 9. «Cerrar sesión» en Mi cuenta (pedido del usuario 2026-11-19; requirement «Cerrar sesión desde Mi cuenta»)

- [x] 9.1 Mockup revisado (`mockups/mi-cuenta.html`: botón neutro «Cerrar sesión» + «Cerrar todas las sesiones» en la tarjeta «Sesiones», capturas re-renderizadas): aprobado por el usuario el 2026-11-19 (`Approval: approved`).
- [x] 9.2 RED: en `pages/mi-cuenta/__tests__/mi-cuenta-page.test.tsx`, `CLIENT` en `/mi-cuenta` pulsa «Cerrar sesión» → falla (el botón no existe). Ejecutar → rojo.
- [x] 9.3 GREEN: botón «Cerrar sesión» en la tarjeta «Sesiones» de `pages/mi-cuenta` usando `useCerrarSesion` (sin diálogo), copy «Cerrá la sesión en este dispositivo o en todos tus dispositivos. Un acceso ya abierto en otro dispositivo puede seguir activo hasta 30 minutos.» y estilos con tokens existentes. Ejecutar → verde.
- [x] 9.4 TRIANGULATE: `POST /auth/logout` con `Bearer A1`, 0 pedidos a `logout-all`, sin diálogo, URL `/catalogo` y sin «Mi cuenta» en la navegación; sin respuesta del backend → sesión `anonima` y `/catalogo`; doble clic → 1 `POST /auth/logout`; «Cerrar todas las sesiones» sigue pidiendo confirmación; axe sin violaciones. Ejecutar → verde; `typecheck` y `lint` sin errores.

## Workflow follow-up

- Verify (`openspec-verify`) con verificación visual contra los mockups aprobados (registrar `Visual verify:` en `design.md`).
- Archivar con `/opsx:archive` y marcar C-14 `[x]` en `CHANGES.md`; commits solo a pedido del usuario siguiendo el flujo `dev → main → dev`.
