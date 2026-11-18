# Tasks — C-15 `fe-direcciones`

> **Governance BAJO**: autonomía total si los tests pasan. Único gate: los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) antes de escribir código. OQ-1..OQ-4 de `design.md` se aplican con su valor por defecto salvo respuesta distinta del usuario (si OQ-1 cambia a «promover en backend», frenar y re-proponer).
> **Criterios de aceptación visual**: `mockups/direcciones-lista.html`, `direcciones-vacio.html`, `direcciones-form.html`, `direcciones-eliminar.html` y `selector-checkout.html` de este change.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Red simulada **solo** con MSW (`server.use` por test, `onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()` con `await`); QueryClient nuevo por test sin reintentos. Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; datos del servidor en TanStack Query; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear. Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` (lista, vacío, formulario con errores y edición, confirmación de eliminación, selector de checkout) con `mockup.css`/`mockup.js` copiados de C-13b, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/` con headless Edge, inspeccionar las capturas y registrar `Preview: rendered` en `design.md`.
- [x] 0.3 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`; registrar también las respuestas (o «por defecto») a OQ-1..OQ-4.

## 1. Red de seguridad y dependencias

- [x] 1.1 Safety net: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base (archivos/tests verdes al cierre de C-13b) en este archivo. Si algo falla, frenar y reportar como falla previa.
  - Línea base (cierre de C-13b): 34 archivos de test / 260 tests verdes; `typecheck` y `lint` limpios.
- [x] 1.2 Instalar `@tanstack/react-form` (última 1.x estable; verificar la API con context7: `useForm`, `form.Field`, `validators`, `setFieldMeta`) y `npm install -D axe-core`. Verificar que `package.json` las lista y que `npm test` sigue en la línea base.
- [x] 1.3 RED → GREEN helper de accesibilidad `src/test/axe.ts` (`esperarSinViolacionesA11y(contenedor)`, regla `color-contrast` desactivada): test que lo usa sobre un `<img>` sin `alt` → falla con la violación `image-alt`; sobre un `<button>Ok</button>` → pasa. Ejecutar → verde.
- [x] 1.4 `src/test/msw/direcciones.ts`: `direccionDto(datos)` y `handlersDirecciones(estado)` con estado en memoria que replica el backend (design D10: primera activa principal, principal primero y luego `id`, `page`/`size`/`pages`, 204 en `DELETE`, 404 para id inexistente, registro de cuerpos recibidos). Lo cubren los tests de los bloques 3 y 5 (no lleva tests propios).

## 2. Modelo de la entidad (spec `frontend-addresses`: «Selector de dirección para el pedido»)

- [x] 2.1 RED: `src/entities/direccion/__tests__/direccion-por-defecto.test.ts`: `[Casa (no principal, id 1), Trabajo (principal, id 2)]` → `2`. Ejecutar → falla.
- [x] 2.2 GREEN + TRIANGULATE: tipos `Direccion`/`DireccionDatos` y `direccionPorDefecto` en `entities/direccion/model/` + `index.ts`; casos: sin principal `[5, 9]` → `5`; lista vacía → `null`. Ejecutar → verde.

## 3. API y consultas (specs «Listado de direcciones propias», «Paginación», «Datos privados de la sesión»)

- [x] 3.1 RED: `src/entities/direccion/__tests__/direccion-queries.test.tsx` con `renderHook(useQuery(direccionQueries.lista({page:1,size:20})))`: el handler recibe `page=1&size=20` con `Authorization: Bearer A1` y los datos son el `Paginado` con «Casa» primero. Ejecutar → falla.
- [x] 3.2 GREEN: `entities/direccion/api/` (`listarDirecciones` con `apiClient`, `direccionQueries` según design D2, `placeholderData: keepPreviousData`). Ejecutar → verde.
- [x] 3.3 TRIANGULATE: `page: 2` → el handler recibe `page=2` y mientras carga la página 2 los datos siguen siendo los de la 1 (`isPlaceholderData` true); 503 → `error.code` `HTTP_503`; la clave empieza con `'direcciones'` y `esConsultaPrivada` la reconoce como privada. Ejecutar → verde.
- [x] 3.4 RED → GREEN + TRIANGULATE mutaciones (`useCrearDireccion`, `useActualizarDireccion`, `useMarcarPrincipal`, `useEliminarDireccion`, design D3): cada una llama a su ruta con el método y cuerpo exactos (`POST /direcciones/`, `PATCH /direcciones/7` con el objeto completo, `PATCH /direcciones/7/principal` sin cuerpo, `DELETE /direcciones/7`) y al terminar bien la consulta `['direcciones','lista',…]` queda invalidada (se vuelve a pedir: contador del handler = 2); un 404 rechaza con `ApiError` `HTTP_404`. Ejecutar → verde.

## 4. Notificaciones y diálogo globales (spec `frontend-feedback`)

- [x] 4.1 RED: `src/app/layouts/app-shell/__tests__/notificaciones.test.tsx`: tras `notificar({tipo:'success', titulo:'Dirección guardada'})` se ve el texto dentro de un `role="status"`. Ejecutar → falla.
- [x] 4.2 GREEN + TRIANGULATE: `Notificaciones` (design D8) montado en `ShellConSesion`; casos: `tipo: 'error'` → `role="alert"`; dos toasts y «Cerrar notificación» en el primero → queda solo el segundo; con timers falsos, a los 4999 ms sigue y a los 5000 ms desaparece. Ejecutar → verde.
- [x] 4.3 RED → GREEN `shared/ui/dialogo` (`Dialogo`): `role="dialog"`, `aria-modal`, nombre accesible = título, Tab desde el último botón vuelve al primero, Escape llama `onCerrar`, clic en el scrim llama `onCerrar`. Ejecutar → verde.
- [x] 4.4 RED → GREEN + TRIANGULATE `ConfirmacionGlobal` (design D8, OQ-2): con `pedirConfirmacion({titulo:'¿Eliminar Trabajo?', textoConfirmar:'Eliminar', variante:'peligro', onConfirmar})` → diálogo con ese nombre y foco en «Cancelar»; «Eliminar» con doble clic → `onConfirmar` 1 vez y diálogo cerrado; Escape → 0 llamadas y el foco vuelve al botón que lo abrió; «Cancelar» → 0 llamadas. Agregar `variante?: 'peligro' | 'normal'` a `ConfirmModal` en `uiStore` sin romper `ui-store-estado.test.ts`. axe sin violaciones con el diálogo abierto. Ejecutar → verde.

## 5. Página «Direcciones»: listado (specs «Listado…», «Estado vacío, carga y error…», «Paginación…», «Direcciones sin principal»)

- [x] 5.1 RED: `src/pages/direcciones/__tests__/direcciones-page.test.tsx` con `renderApp('/direcciones', { sesion: { roles: ['CLIENT'] } })` y el estado MSW con «Casa» (principal) y «Trabajo»: dos ítems en orden, «Casa» con la marca «Principal». Ejecutar → falla (hoy se ve la página provisoria).
- [x] 5.2 GREEN: `pages/direcciones` (página, listado, `TarjetaDireccion` en `entities/direccion/ui`) y `PAGINAS` en `routes.tsx` (design D9). Ejecutar → verde.
- [x] 5.3 TRIANGULATE: dirección sin opcionales → «Sin alias», línea 1 y ciudad sin separadores sueltos; página vacía → «Todavía no tenés direcciones» y «Agregar dirección»; carga demorada → indicador con `aria-busy`; 503 → mensaje + «Reintentar» → 200 → se ve la dirección; 25 direcciones → «Siguiente» pide `page=2&size=20` y muestra la 21; `pages` 1 → sin paginación; dos sin principal → aviso «Ninguna dirección es principal»; nombres accesibles «Editar Trabajo», «Eliminar Trabajo», «Marcar Trabajo como principal»; la principal no tiene «Marcar … como principal». axe sin violaciones con datos y vacío. Ejecutar → verde.
- [x] 5.4 TRIANGULATE (spec «Datos privados de la sesión»): Ana ve «Casa», cierra sesión, Luis inicia sesión (`abrirSesion`) con lista vacía → `/direcciones` pide de nuevo y no muestra «Casa». Ejecutar → verde.

## 6. Formulario: validación y normalización (specs «Validación del formulario», «Normalización de los datos enviados»)

- [x] 6.1 RED: `src/pages/direcciones/__tests__/validacion.test.ts`: `validarDireccion({linea1:'   ', ciudad:'', …})` → errores `linea1` «Ingresá la calle y el número» y `ciudad` «Ingresá la ciudad». Ejecutar → falla.
- [x] 6.2 GREEN + TRIANGULATE: validadores puros en `pages/direcciones/model/` (design D4); casos: alias de 51 → «Máximo 50 caracteres» y de 50 → válido; ciudad/provincia de 101 → error; código postal de 11 → «Máximo 10 caracteres» y de 10 → válido; valores válidos → sin errores. `aDireccionDatos`: « Casa » → «Casa», opcionales vacíos → `null`, `linea1`/`ciudad` siempre string (verificado también por tipo: asignar `null` no compila, comprobado con `// @ts-expect-error` en el test). Ejecutar → verde.

## 7. Formulario: alta y edición (specs «Alta de dirección», «Edición de dirección», «Errores del servidor en el formulario»)

- [x] 7.1 RED: en `direcciones-page.test.tsx`, usuario sin direcciones pulsa «Agregar dirección», completa «Calle y número» y «Ciudad», pulsa «Guardar dirección» → el handler recibe el cuerpo normalizado, el formulario se cierra, el listado muestra la dirección con «Principal» y se ve la notificación «Dirección guardada». Ejecutar → falla.
- [x] 7.2 GREEN: formulario con TanStack Form en `pages/direcciones/ui` usando `shared/ui/campo` (nuevo, con `aria-invalid`/`aria-describedby`), mutaciones del bloque 3 y foco al encabezado al abrir (design D4, D6). Ejecutar → verde.
- [x] 7.3 TRIANGULATE: «Guardar dirección» con obligatorios vacíos → dos errores y 0 pedidos; salir del código postal con 11 caracteres → error solo en ese campo; segunda dirección «Trabajo» → «Casa» sigue principal; 422 `VALIDATION_ERROR` `field: 'codigo_postal'` → mensaje junto al campo y valores conservados; sin respuesta (`HttpResponse.error()`) → alerta «No pudimos conectar con el servidor.» con el formulario abierto; el botón de guardar deshabilitado y con «Guardando…» mientras el `POST` demora; «Editar Trabajo» → campos con sus datos, cambiar ciudad a «Godoy Cruz» → `PATCH /direcciones/2` con el objeto completo y el listado la muestra; vaciar «Piso, depto.» en edición → `linea2: null`; «Cancelar» → 0 pedidos, listado intacto y foco en el botón que abrió el formulario. axe sin violaciones con el formulario con errores. Ejecutar → verde.

## 8. Principal y eliminación (specs «Marcar dirección principal», «Eliminación con confirmación», «Dirección que ya no existe»)

- [x] 8.1 RED: «Marcar Trabajo como principal» → `PATCH /direcciones/2/principal`, «Trabajo» pasa primera con «Principal», «Casa» sin marca y se ve «Dirección principal actualizada». Ejecutar → falla.
- [x] 8.2 GREEN + TRIANGULATE: acción con `isPending` por ítem (design D3); casos: el botón queda deshabilitado mientras el `PATCH` demora (un segundo clic no envía otro); 404 → notificación de error «Esa dirección ya no está disponible» y el listado se pide de nuevo (contador = 2); 403 → mismo resultado. Ejecutar → verde.
- [x] 8.3 RED → GREEN + TRIANGULATE eliminar: «Eliminar Trabajo» → diálogo con título `¿Eliminar «Trabajo»?`; «Eliminar» → 1 `DELETE /direcciones/2`, «Trabajo» desaparece, notificación «Dirección eliminada»; «Cancelar» → 0 `DELETE`; eliminar «Casa» (principal) con «Trabajo» presente → el mensaje dice que ninguna quedará como principal y, tras confirmar, la página muestra el aviso «Ninguna dirección es principal»; eliminar la única dirección de la página 2 → vuelve a la página 1. Ejecutar → verde.

## 9. Selector para checkout (specs «Selector de dirección para el pedido», «Selector sin direcciones», «Accesibilidad»)

- [x] 9.1 RED: `src/entities/direccion/__tests__/selector-direccion.test.tsx` con un contenedor de prueba controlado: sin elección previa y «Trabajo» principal → `onCambiar(2)` una vez y el radio «Trabajo» marcado; el grupo tiene la leyenda «¿Dónde lo recibís?». Ejecutar → falla.
- [x] 9.2 GREEN: `SelectorDireccion` (design D7) exportado por `@/entities/direccion`. Ejecutar → verde.
- [x] 9.3 TRIANGULATE: sin principal → elige la primera; «Retiro en el local» → `onCambiar(null)`; `permitirRetiro={false}` → sin esa opción; vacío → «No tenés direcciones guardadas» + enlace a `/direcciones` (y `onCambiar(null)` solo si hay retiro); `valor` con un id que ya no existe → se preselecciona por defecto; con `valor` ya elegido no llama a `onCambiar` al cargar; flechas del teclado cambian la opción; 503 → «No pudimos cargar tus direcciones» + «Reintentar»; axe sin violaciones. Ejecutar → verde.

## 10. Fronteras FSD

- [x] 10.1 RED → GREEN: fixtures en `tests/architecture/fixtures/` — válido `pages/x/ui/a.tsx → @/entities/direccion`; inválidos `entities/direccion/ui/a.tsx → @/pages/direcciones` (capa superior) y `pages/a/… → @/pages/direcciones` (cross-import); lista literal de violaciones esperadas. `npm test -- fsd` → verde, y «`src/` real sin violaciones» sigue verde con `entities/direccion`, `pages/direcciones`, `shared/ui/{campo,dialogo}`.

## 11. Documentación

- [x] 11.1 `frontend/README.md`: slices nuevos (`entities/direccion`, `pages/direcciones`, `shared/ui/campo`, `shared/ui/dialogo`), hosts de notificaciones/confirmación (cómo usar `notificar` y `pedirConfirmacion`, `variante`), claves `['direcciones', …]`, `PAGINAS` en `routes.tsx`, versión de TanStack Form y helper de axe. Verificar con `ls` que cada path citado existe.
- [x] 11.2 `knowledge-base/06_funcionalidades.md` US-006: marcar la parte de frontend como cubierta por C-15 (y la regla «la primera queda principal» como del backend). `knowledge-base/08_arquitectura_propuesta.md`: árbol real con `entities/direccion` y `pages/direcciones`. Verificar con `grep -n "C-15" knowledge-base/06_funcionalidades.md knowledge-base/08_arquitectura_propuesta.md`.
- [x] 11.3 `CHANGES.md`: C-19 recibe «Punto de partida (C-15)» (`SelectorDireccion` de `@/entities/direccion` con `valor`/`onCambiar`/`permitirRetiro`, preselección de la principal, `direccionQueries`, notificaciones con `notificar` y confirmación con `pedirConfirmacion`; eliminar la principal no promueve otra, OQ-1) y C-25b la deuda sugerida del índice único parcial de `es_principal` (R3). Verificar con `grep -n "Punto de partida (C-15)" CHANGES.md`.

## 12. Verificación final

- [x] 12.1 `npm test`, `npm run typecheck`, `npm run lint` verdes; comparar con la línea base de 1.1 (más tests, ninguno perdido); `git diff --stat backend/` vacío; `git status` sin `node_modules`, `coverage` ni `.env`.
- [x] 12.2 `openspec validate c-15-fe-direcciones --strict` → válido; cada escenario de `frontend-addresses` y `frontend-feedback` tiene al menos un test (tabla escenario → test en `design.md` §Notas de implementación).
- [x] 12.3 Revisión SOLID/DRY: un solo lugar para el contrato de direcciones, la invalidación y la normalización; sin `any` ni `as unknown as` nuevos. Anotar desvíos en `design.md`.

## Workflow follow-up

- Verify (`openspec-verify`): comparar `/direcciones` (lista, vacío, formulario con errores, edición, confirmación) contra los mockups aprobados a 1440x900 y 390x844 con el backend real y un `CLIENT` del seed; revisar consola y red (un `GET` por pantalla, `PATCH`/`DELETE` exactos); el selector se verifica visualmente en C-19 (acá solo por tests). Capturas en `mockups/verify/`; registrar `Visual verify` en `design.md`.
- Archive (`/opsx:archive`) tras el OK del usuario; marcar `[x]` C-15 en `CHANGES.md`.
