# Design — C-15 `fe-direcciones`

## Context

Motivación y estado observado: ver `proposal.md` (Why). Restricciones que condicionan el diseño:

- **Frontend base (C-13a + C-13b)**: FSD v2.1 (`app` → `pages` → `entities` → `shared`; `features`/`widgets` a demanda) verificado por `tests/architecture/fsd-boundaries.test.ts`; `apiClient`, `ApiError` (`status`, `code`, `detail`, `field`), `mensajeDeCampo` y `Paginado<T>` en `@/shared/api`; `Register.defaultError = ApiError`; claves de consulta con el dominio primero y limpieza de toda clave privada (no listada en `CLAVES_PUBLICAS`) al pasar de `autenticada` a `anonima`; `uiStore` con `toasts` (`notificar`, `descartarToast`) y `confirmModal` (`pedirConfirmacion`, `cerrarConfirmacion`; `onConfirmar: () => void`) sin renderizar; `/direcciones` con acceso `sesion` y página provisoria (dueño `C-15` en `route-map.ts`); MSW con `onUnhandledRequest: 'error'` y `renderApp(ruta, { sesion })`.
- **Dependencias faltantes**: `@tanstack/react-form` (ningún change lo instaló todavía; C-14 lo necesita también: el primero que se aplique lo agrega) y una herramienta de accesibilidad automática.
- **Reglas duras**: TS estricto sin `any`; servidor en TanStack Query, Zustand solo cliente; no levantar servidores; TDD estricto; la KB manda sobre el código.

### Contrato real del backend (`backend/app/modules/direcciones/`, verificado 2026-11-17)

Todas las rutas bajo `/api/v1/direcciones`, con `Authorization: Bearer` (`get_current_active_user`) y solo sobre direcciones del usuario autenticado. Cualquier rol con sesión puede usarlas.

| Método y ruta | Cuerpo | Respuesta | Errores |
|---------------|--------|-----------|---------|
| `GET /direcciones/?page=&size=` | — | 200 `Paginado<DireccionRead>`; `page` ≥ 1 (defecto 1), `size` 1..100 (defecto 20); solo activas, **principal primero y luego `id` ascendente** | 401; 422 `VALIDATION_ERROR` (`field` `page`/`size`) |
| `POST /direcciones/` | `DireccionCreate` | 201 `DireccionRead`; `es_principal` = no había ninguna activa | 401; 422 |
| `GET /direcciones/{id}` | — | 200 `DireccionRead` | 403 `HTTP_403` (ajena), 404 `HTTP_404` (inexistente o eliminada) |
| `PATCH /direcciones/{id}` | `DireccionUpdate` (parcial, `exclude_unset`) | 200 `DireccionRead` | 403, 404, 422 |
| `PATCH /direcciones/{id}/principal` | sin cuerpo | 200 `DireccionRead`; desmarca la anterior; idempotente si ya era principal | 403, 404 |
| `DELETE /direcciones/{id}` | — | 204; *soft delete* (`deleted_at`); los pedidos conservan `direccion_id` (el `SET NULL` de RN-DI-04 solo aplica a borrado físico) | 403, 404 |

- `DireccionRead`: `{id, usuario_id, alias, linea1, linea2, ciudad, provincia, codigo_postal, es_principal}` (`alias`, `linea2`, `provincia`, `codigo_postal` pueden ser `null`). No expone `latitud`/`longitud` ni fechas.
- `DireccionCreate`: `linea1` (str, obligatorio, sin largo mínimo), `ciudad` (str ≤ 100, obligatorio), `alias` ≤ 50, `linea2`, `provincia` ≤ 100, `codigo_postal` ≤ 10 (opcionales).
- `DireccionUpdate`: los mismos campos, todos opcionales. Un `null` explícito se escribe tal cual: en `linea1`/`ciudad` (NOT NULL) terminaría en 500.
- Errores con la forma única `{detail, code, field}`; en 422 `field` es el último elemento de `loc` del primer error (p. ej. `codigo_postal`).
- **Eliminar la principal no promueve otra**: el usuario puede quedar con direcciones activas y ninguna principal; la siguiente que cree tampoco será principal (solo lo es la primera cuando no hay activas). Ver OQ-1.
- RN-DI-01 («solo una principal») la garantiza el service; no hay índice único parcial en `001_esquema_inicial.py` (R3).

**KB ↔ backend**: RN-DI-01..03 coinciden con el código (403 ante ajenas con el texto de RN-DI-03; principal automática e idempotente). Diferencias: (a) la KB no dice qué pasa al eliminar la principal (el backend no reasigna: OQ-1); (b) RN-DI-04 habla de `SET NULL` al eliminar, pero el borrado es lógico y el pedido conserva la referencia (no afecta a C-15; queda para C-19/IN-15); (c) el modelo `[DESC]` (calle, número, piso, referencia, IN-15) no es normativo: se usa el `[INT]`/código (`linea1`, `linea2`, …).

## Goals / Non-Goals

**Goals:**
- Un único lugar del frontend que conoce el contrato de direcciones (tipos, llamadas, claves, invalidación), consumido por la página y por el selector de C-19.
- Formulario que nunca envía algo que el backend acepte mal (vacíos, `null` en obligatorios).
- Notificaciones y diálogo de confirmación dibujados una vez para toda la app.
- Todo probado sin backend (MSW en el borde), con chequeo automático de accesibilidad.

**Non-Goals:**
- Actualizaciones optimistas (ver D5).
- Rutas propias para el formulario (`/direcciones/nueva`, `/direcciones/:id/editar`): ver D6.
- Uso del selector dentro del checkout, costo de envío y retiro (C-19).
- Cambios de backend.

## Decisions

### D1 — Ubicación FSD

| Pieza | Ubicación | Por qué |
|-------|-----------|---------|
| Tipos `Direccion`, `DireccionDatos` (cuerpo de alta/edición) y `direccionPorDefecto(direcciones)` (pura) | `src/entities/direccion/model/` | Dominio «dirección» con dos consumidores: la página (C-15) y el checkout (C-19) |
| Llamadas HTTP (`listarDirecciones`, `crearDireccion`, `actualizarDireccion`, `marcarDireccionPrincipal`, `eliminarDireccion`), `direccionQueries` y hooks de mutación (`useCrearDireccion`, `useActualizarDireccion`, `useMarcarPrincipal`, `useEliminarDireccion`) | `src/entities/direccion/api/` | CRUD de la entidad: la skill FSD lo admite en el `api/` de la entidad; la invalidación de `['direcciones']` queda en un solo lugar |
| `SelectorDireccion` | `src/entities/direccion/ui/` | UI de la entidad que reusa C-19 (`pages/checkout` importa `@/entities/direccion`); una página no puede importar otra página |
| `TarjetaDireccion` (presentación de una dirección: alias, líneas, marca «Principal») | `src/entities/direccion/ui/` | La usan el listado y, en compacto, el selector |
| Página, listado, estados vacío/error, formulario y su validación/normalización (`validarDireccion`, `aDireccionDatos`) | `src/pages/direcciones/` (`ui/`, `model/`) | Un solo consumidor hoy: «empezar simple». Si C-19 decide crear direcciones desde el checkout, el formulario se extrae a `features/editar-direccion` (2 consumidores) |
| `Campo` (label + control + ayuda + error con `aria-describedby`/`aria-invalid`) | `src/shared/ui/campo/` | UI genérica sin dominio; C-14 la reutiliza en login/registro/perfil |
| `Dialogo` (modal accesible: `role="dialog"`, `aria-modal`, foco atrapado, Escape, scrim) | `src/shared/ui/dialogo/` | Genérico; lo usa el host de confirmación |
| Hosts `Notificaciones` y `ConfirmacionGlobal` (leen `uiStore`) | `src/app/layouts/app-shell/` | Montados una vez junto al shell; `app` compone y puede leer `shared/model` |
| Handlers MSW de direcciones (`direccionDto`, `handlersDirecciones(estado)`) | `src/test/msw/direcciones.ts` | Fuera de las capas, como `auth.ts` |

*Alternativas descartadas*: (a) todo en `pages/direcciones`: C-19 no podría importar el selector (cross-import entre páginas); (b) `features/direcciones` para las mutaciones: un solo consumidor y la skill desaconseja features prematuras; (c) el selector en `shared/ui`: tendría dominio («dirección», consulta propia).

### D2 — Consultas y claves

```ts
export const direccionQueries = {
  todas: () => ['direcciones'] as const,
  listas: () => ['direcciones', 'lista'] as const,
  lista: (params: { page: number; size: number }) =>
    queryOptions({
      queryKey: ['direcciones', 'lista', params] as const,
      queryFn: () => listarDirecciones(params),
      placeholderData: keepPreviousData,
    }),
};
```

- `staleTime`: el de la app (30 s). Clave privada (no está en `CLAVES_PUBLICAS`): `SesionGate` la descarta al cerrar o vencer la sesión (spec «Datos privados de la sesión»), sin código nuevo.
- Página: `size` 20 (`TAMANO_PAGINA`), `page` desde el parámetro `?page=` de la URL (validado: entero ≥ 1, si no 1). Selector: `{ page: 1, size: 100 }` (`MAX_SIZE` del backend; ver R2).
- Sin consulta de detalle: el formulario de edición parte del ítem del listado ya cargado (no hace falta `GET /{id}`).

### D3 — Mutaciones

- Las cuatro mutaciones invalidan `direccionQueries.todas()` en `onSuccess` (el orden y la principal los decide el servidor).
- `useMarcarPrincipal` y `useEliminarDireccion` exponen `variables` para deshabilitar solo el botón de esa dirección mientras `isPending`.
- 403/404 en editar, principal o eliminar (`code` `HTTP_403`/`HTTP_404`) → `notificar({ tipo: 'error', titulo: 'Esa dirección ya no está disponible' })` + invalidar. Otros errores → notificación «No pudimos completar la acción» con el `detail` (ya genérico en 5xx).
- Éxitos → notificación `success`: «Dirección guardada», «Dirección principal actualizada», «Dirección eliminada».
- Si al eliminar la página actual queda vacía y `page > 1`, la página vuelve a `page - 1` (derivado de la respuesta: `items` vacío con `page > pages`).

### D4 — Formulario (TanStack Form)

- `useForm({ defaultValues, onSubmit })` con valores string (`''` para vacíos); `form.Field` por campo con `validators: { onBlur, onSubmit }` que llaman a validadores puros de `pages/direcciones/model/validacion.ts` (devuelven `undefined` si es válido). Error visible si `field.state.meta.isTouched` o tras un intento de envío.
- Reglas (spec «Validación del formulario»): `linea1` obligatorio («Ingresá la calle y el número»); `ciudad` obligatorio («Ingresá la ciudad») y ≤ 100; `alias` ≤ 50; `provincia` ≤ 100; `codigo_postal` ≤ 10 («Máximo N caracteres»); todo medido tras `trim()`. Sin formato de código postal (el backend no lo define; ver OQ-3). `linea2` sin límite (TEXT).
- `aDireccionDatos(valores)`: recorta, opcionales vacíos → `null`, obligatorios siempre string. Alta: `POST` con el objeto completo. Edición: `PATCH` con el objeto **completo** (los opcionales vaciados viajan como `null` y así se borran; los obligatorios nunca son `null`).
- Envío: `onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}`; el botón de guardar («Guardar dirección» en alta, «Guardar cambios» en edición, como el mockup) queda deshabilitado mientras la mutación está pendiente («Guardando…»).
- Errores del servidor: `VALIDATION_ERROR` con `field` de un campo del formulario → se asigna como error de ese campo (`setFieldMeta(... errorMap.onServer)`); cualquier otro → alerta general dentro del formulario (`role="alert"`) con `detail`.
- Etiquetas: «Alias (opcional)» con ayuda «Ej.: Casa, Trabajo», «Calle y número», «Piso, depto. (opcional)», «Ciudad», «Provincia (opcional)», «Código postal (opcional)».

### D5 — Sin actualizaciones optimistas

Marcar principal reordena el listado en el servidor (principal primero) y puede mover ítems entre páginas; replicarlo en caché duplica la regla del backend (DRY) y el volumen es mínimo. Se usa `isPending` por botón e invalidación. *Alternativa*: optimista con `cancelQueries`/snapshot/rollback para la marca «Principal» sin reordenar; se descarta porque el orden visible quedaría inconsistente hasta el refetch.

### D6 — Formulario en la misma página, sin rutas nuevas

La página tiene dos modos: listado y formulario (alta o edición de un id). Al abrir el formulario el foco va a su encabezado («Nueva dirección» / «Editar dirección»); al cerrarlo vuelve al botón que lo abrió. El modo vive en el estado de la página (no en la URL). *Alternativas*: rutas `/direcciones/nueva` y `/:id/editar` (más tablas que tocar: `RUTAS`, `ACCESO_RUTAS`, `MAPA_RUTAS`, navegación, y un `GET /{id}` al recargar) o un diálogo modal (formulario largo e incómodo a 390 px). Trade-off aceptado: el botón «Atrás» del navegador no cierra el formulario (R4).

### D7 — Selector para C-19

```ts
export interface SelectorDireccionProps {
  /** Dirección elegida: id, `null` = retiro en el local, `undefined` = todavía sin elegir. */
  valor: number | null | undefined;
  onCambiar: (valor: number | null) => void;
  /** Muestra la opción «Retiro en el local» (por defecto true; C-19 decide según PA-13). */
  permitirRetiro?: boolean;
  /** Leyenda del grupo (por defecto «¿Dónde lo recibís?»). */
  leyenda?: string;
}
```

- Controlado: `fieldset` + `legend` + `input type="radio"` (nombre único con `useId`); cada opción muestra `TarjetaDireccion` compacta.
- Preselección: cuando los datos llegan y `valor === undefined`, llama una vez a `onCambiar` con `direccionPorDefecto(items)` (spec «Selector de dirección»). `direccionPorDefecto` = id de la principal, si no la primera, si no `null`; un `null` solo se informa si `permitirRetiro` (sin direcciones ni retiro, `valor` queda `undefined` y C-19 no deja avanzar). Si `valor` es un id que ya no está en la lista (eliminada), se trata como `undefined`.
- Estados: carga (esqueleto, `aria-busy`), error («No pudimos cargar tus direcciones» + «Reintentar»), vacío («No tenés direcciones guardadas» + enlace «Agregar dirección» a `RUTAS.direcciones`).
- No incluye el formulario de alta (fuera de alcance) ni sabe de costos de envío.

### D8 — Notificaciones y confirmación globales

- `Notificaciones`: región fija (abajo a la derecha en desktop, abajo a lo ancho en mobile, sobre el contenido), cada toast con `role="alert"` (error) o `role="status"` (resto), botón «Cerrar notificación» y descarte automático a 5000 ms (`setTimeout` por toast, limpiado al desmontar; los tests usan `vi.useFakeTimers({ shouldAdvanceTime: true })`). Animación de entrada `slidein` del design system (≤ 200 ms, `ease-out`), sin animación con `prefers-reduced-motion`.
- `ConfirmacionGlobal`: si `confirmModal !== null` renderiza `Dialogo` con título, mensaje, «Cancelar» (foco inicial) y el botón de confirmar (`btn-danger` cuando el texto es «Eliminar»; prop `variante` opcional en `ConfirmModal`, ver OQ-2). Confirmar → `cerrarConfirmacion()` y luego `onConfirmar()` (una sola vez aunque haya doble clic). Cancelar/Escape/scrim → `cerrarConfirmacion()`. Guarda `document.activeElement` al abrir y le devuelve el foco al cerrar.
- Ambos se montan en `ShellConSesion` (dentro del router, así un toast sobrevive a navegar entre páginas).
- `Dialogo` sin `<dialog>` nativo: jsdom no implementa `showModal` de forma fiable; un `div role="dialog" aria-modal="true" aria-labelledby aria-describedby` con trampa de foco simple (Tab/Shift+Tab ciclan entre los focusables) y `inert` no se usa (soporte desigual en jsdom).

### D8b — Nombres accesibles y textos

- Cada dirección se nombra por su alias o, si no tiene, por su línea 1 (`nombreDireccion(d)` en `entities/direccion/model`): botones «Editar Trabajo», «Eliminar Trabajo», «Marcar Trabajo como principal» (texto visible «Editar», «Eliminar», «Marcar como principal», como el mockup) y título del diálogo «¿Eliminar «Trabajo»?».
- Textos según los mockups aprobados: encabezado «Direcciones», «Agregar dirección», marca «Principal» (badge con `--color-accent`), aviso «Ninguna dirección es principal», notificaciones «Dirección guardada» / «Dirección eliminada» / «Dirección principal actualizada».
- Íconos nuevos usados por la página (`editar`, `basura`, `estrella`, `mas`, `tienda`): se suman a `shared/ui/icon`; no están en el sprite de `design-system/components.html` (como `candado` en C-13b; se registra en C-25b).

### D9 — Ruta real

`routes.tsx` suma `PAGINAS: Partial<Record<Ruta, ComponentType>>` con `[RUTAS.direcciones]: DireccionesPage`; las rutas sin entrada siguen con `PlaceholderPage`. `RequiereAcceso` no cambia. Los changes siguientes agregan su línea.

### D10 — Tests

- MSW: `src/test/msw/direcciones.ts` con un estado en memoria (lista de DTO) y handlers para las seis rutas que aplican las reglas del backend (primera principal, principal primero, paginación, 204, 404 de id inexistente), para probar flujos completos con `renderApp('/direcciones', { sesion: { roles: ['CLIENT'] } })`; overrides por test con `server.use` para errores (503, 422, sin respuesta con `HttpResponse.error()`). Los handlers registran los cuerpos recibidos para afirmar la normalización.
- Accesibilidad: `axe-core` (dev) con un helper `esperarSinViolacionesA11y(contenedor)` en `src/test/axe.ts` (desactiva `color-contrast`, que jsdom no puede calcular; el contraste ya lo valida el design system). *Alternativa*: `vitest-axe`/`jest-axe`: envoltorios de axe con mantenimiento irregular; el helper son ~15 líneas.
- Unidad pura: `validarDireccion`/`aDireccionDatos`, `direccionPorDefecto`.
- Arquitectura: fixtures nuevos `pages/x → @/entities/direccion` (válido) y `entities/direccion → @/pages/direcciones` (inválido).

## Risks / Trade-offs

- **R1 [Principal eliminada]** Tras eliminar la principal nadie queda marcado y el backend no lo corrige. → Aviso en el diálogo y en la página (spec «Direcciones sin principal»); el selector elige la primera. Decisión de fondo en OQ-1.
- **R2 [Más de 100 direcciones]** El selector pide una sola página de 100. → Aceptado (caso irreal para un cliente); si `pages > 1` se muestra «Mostrando 100 de N» y el enlace a «Direcciones».
- **R3 [Dos principales por carrera]** Sin índice único parcial, dos `PATCH /principal` simultáneos podrían dejar dos principales. → El frontend deshabilita la acción mientras hay una pendiente; el índice (`WHERE es_principal AND deleted_at IS NULL`) queda como deuda sugerida para C-25b, no se toca acá (BAJO, sin cambios de backend).
- **R4 [Atrás del navegador]** Con el formulario abierto, «Atrás» sale de `/direcciones`. → Aceptado (D6); el formulario no guarda borradores.
- **R5 [Editar cambia pedidos viejos]** Sin `direccion_snapshot` (IN-15), editar una dirección cambia lo que muestran pedidos anteriores que la referencian. → Fuera de alcance (PA-13/IN-15); C-15 no agrega avisos al respecto. Si PA-13 se resuelve con snapshot, no cambia nada en esta pantalla.
- **R6 [`null` en obligatorios]** Un `PATCH` con `linea1: null` daría 500. → `aDireccionDatos` tipa los obligatorios como `string` (no `string | null`) y un test lo verifica.
- **R7 [TanStack Form 0.x/1.x]** La KB dice «0.x»; la versión actual es 1.x con la misma API base (`useForm`, `form.Field`, `validators`). → Apply instala la última 1.x estable y verifica con context7; se anota en `frontend/README.md`.

## Migration Plan

Sin migración de datos ni backend. Apply: instalar `@tanstack/react-form` y `axe-core` (dev), luego los bloques TDD de `tasks.md`. Rollback: revertir el commit (no hay estado persistido nuevo).

## Open Questions

> Governance BAJO: se aplican los valores por defecto salvo que el usuario diga otra cosa; ninguno cambia las specs salvo donde se indica.

- **OQ-1 — Al eliminar la principal, ¿se promueve otra?** Por defecto: **no se toca el backend**; el frontend avisa y el selector elige la primera (specs ya escritas así). Alternativa: change de backend (C-25b o uno nuevo) que promueva la más antigua al eliminar la principal; cambiaría el escenario «Eliminar la principal con otras» y «Direcciones sin principal».
- **OQ-2 — ¿El botón de confirmar del diálogo puede ser «peligroso» (rojo)?** Por defecto: sí, se agrega `variante?: 'peligro' | 'normal'` a `ConfirmModal` (campo opcional, compatible con C-13b) y «Eliminar» usa `btn-danger` del design system. Alternativa: siempre `btn-primary`.
- **OQ-3 — ¿Validar formato de código postal argentino (4 dígitos o CPA `A1234ABC`)?** Por defecto: no (el backend solo limita a 10 caracteres y la KB no lo pide). Alternativa: validar el formato en el cliente.
- **OQ-4 — ¿Retiro en el local se ofrece siempre en el selector?** Por defecto: el selector lo muestra (`permitirRetiro` true) y C-19 decide con PA-13 si lo apaga. No bloquea C-15.

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-17)
- Mockups: `mockups/` (`direcciones-lista.html`, `direcciones-vacio.html`, `direcciones-form.html`, `direcciones-eliminar.html`, `selector-checkout.html`, `mockup.css`, `mockup.js`, `README.md`, `previews/`)
- Approval: approved (2026-11-17, by user). OQ-1..OQ-4: el usuario aprobó los valores por defecto (2026-11-17).
- Preview: rendered (2026-11-17, headless Microsoft Edge desde `file://`, 1440x900 y 390x844 —390 px dentro de un iframe—; capturas en `mockups/previews/`: `lista`, `lista-sin-principal`, `vacio`, `form-errores`, `form-editar`, `form-error-red`, `eliminar`, `selector`, `selector-vacio`, cada una `-desktop.png` y `-mobile.png`; inspeccionadas)
- Visual verify: passed (2026-11-17, backend real + Vite, browser pane, cliente@foodstore.com; capturas en `mockups/verify/`). Recorrido:
  - a 1440: formulario vacío → errores en calle y ciudad sin envío; alta con trim → `POST` 201, refetch y toast; marcar principal → `PATCH /principal`, la principal pasa arriba;
  - a 390: lista; diálogo inferior con «Eliminar» rojo y foco en «Cancelar»; Escape devuelve el foco al botón; borrar la principal → `DELETE` 204 y aviso «Ninguna dirección es principal»; edición precargada.
  - Recarga: 1 refresh + 1 `/me` + 1 lista; consola sin errores. Datos del seed restaurados.
  - Diferencias menores: el toast de alta no muestra la segunda línea del mockup («"Trabajo" ya está en tu lista»); en mobile el toast tapa el pie del formulario mientras dura.
  - No revisado en vivo: estado vacío, paginación y el selector (no tiene ruta hasta C-19); cubiertos por tests.
- Code verify: PASS WITH FINDINGS (2026-11-17): 0 críticos, 4 warnings, 6 sugerencias; 44/44 escenarios con test.

Estados visibles y cobertura:

| Estado | Mockup |
|--------|--------|
| Listado con datos: principal destacada, acciones por ítem, aviso de toast de éxito | `direcciones-lista.html` |
| Listado sin principal (aviso) | `direcciones-lista.html?estado=sin-principal` |
| Estado vacío | `direcciones-vacio.html` |
| Formulario de alta con errores de validación | `direcciones-form.html` |
| Formulario de edición (datos cargados) | `direcciones-form.html?modo=editar` |
| Formulario con error del servidor (sin respuesta) | `direcciones-form.html?modo=red` |
| Confirmación de eliminación de la principal | `direcciones-eliminar.html` |
| Selector en el checkout (con la principal preseleccionada y «Retiro en el local») | `selector-checkout.html` |
| Selector sin direcciones | `selector-checkout.html?estado=vacio` |
| Carga y error del listado | Cubiertos por patrones aprobados (esqueleto `.skel` y `.state` de `components.html`); sin mockup propio |

## Notas de implementación (apply 2026-11-17)

Línea base antes de apply: 34 archivos / 260 tests verdes. Al cierre: 46 archivos / 371 tests, `typecheck` y `lint` limpios, `git diff --stat backend/` vacío.

### Escenario → test

Abreviaturas (carpeta `frontend/`): **PAG** `src/pages/direcciones/__tests__/direcciones-page.test.tsx`, **FRM** `.../direcciones-formulario.test.tsx`, **ACC** `.../direcciones-acciones.test.tsx`, **VAL** `.../validacion.test.ts`, **SEL** `src/entities/direccion/__tests__/selector-direccion.test.tsx`, **NOT** `src/app/layouts/app-shell/__tests__/notificaciones.test.tsx`, **CNF** `.../confirmacion.test.tsx`, **ROB** `src/pages/direcciones/__tests__/direcciones-robustez.test.tsx`.

| Requisito / escenario | Test |
|-----------------------|------|
| Listado: dos direcciones / sin opcionales | PAG «muestra las dos direcciones…», «una dirección sin opcionales…» |
| Estado vacío, carga y error: vacío / falla y reintento | PAG «sin direcciones…», «mientras carga…», «un 503 muestra el error…» |
| Paginación: una página / segunda página | PAG «con una sola página…», «con 25 direcciones «Siguiente»…», «mientras llega la página 2…» |
| Alta: primera / segunda | FRM «un usuario sin direcciones agrega «Casa»…», «una segunda dirección «Trabajo»…» |
| Validación: obligatorios / código postal largo | FRM «guardar con los obligatorios vacíos…», «salir del código postal con 11…»; VAL (límites 50/100/10) |
| Normalización: opcionales vacíos | VAL `aDireccionDatos`; FRM «…envía el cuerpo normalizado…» |
| Errores del servidor: validación / servidor caído | FRM «un 422 con field codigo_postal…», «sin respuesta del servidor…» |
| Edición: cambiar ciudad / cancelar | FRM ««Editar Trabajo» abre el formulario…», ««Cancelar» no envía pedidos…» |
| Marcar principal: cambio / la principal no ofrece la acción | ACC ««Marcar Trabajo como principal»…»; PAG «con una principal no hay aviso…» |
| Eliminación: confirmar / cancelar / principal con otras | ACC ««Eliminar Trabajo» pide confirmar…», ««Cancelar» no envía ningún DELETE…», «eliminar la principal habiendo otras…» |
| Sin principal: principal eliminada | PAG «con dos direcciones y ninguna principal…»; ACC (tras eliminar la principal) |
| Dirección que ya no existe: eliminada en otra pestaña | ACC «un 404…», «un 403…» (marcar y eliminar); FRM «un 404 al guardar…» |
| Datos privados de la sesión: cambio de usuario | PAG «al cambiar de usuario…» |
| Selector: preselección principal / sin principal / elegir retiro | SEL «sin elección previa…», «sin principal elige la primera…», ««Retiro en el local» informa null» |
| Selector sin direcciones | SEL «vacío muestra «No tenés direcciones guardadas»…» |
| Accesibilidad: acciones con nombre propio / revisión automática | PAG «las acciones nombran su dirección», axe con datos y vacío; FRM axe con errores; ACC axe del diálogo; SEL axe |
| Notificaciones visibles: éxito / error | NOT «una notificación de éxito…», «una de error…» |
| Fin de sesión con diálogo abierto | `sesion-gate.test.tsx` «limpieza de la UI transitoria…»; `ui-store.test.ts` «limpiarTransitorios…» |
| Foco tras eliminar | ROB «foco tras eliminar» |
| Falla la actualización con datos previos | ROB «listado desactualizado tras un refetch fallido» |
| Eliminaciones superpuestas | ROB «dos eliminaciones superpuestas» |
| Descarte: manual / automático | NOT «cerrar la primera de dos…», «se descarta sola a los 5000 ms…» |
| Diálogo de confirmación: apertura | CNF «muestra el diálogo con título, mensaje…» |
| Respuesta del diálogo: confirmar / Escape | CNF ««Eliminar» con doble clic…», «Escape cierra sin ejecutar…», ««Cancelar»…», «un clic fuera…» |

### Desvíos respecto del diseño

- **Errores del servidor por campo**: se guardan en estado de React (`erroresServidor`) y no con `setFieldMeta`/`errorMap.onServer`: un error `onServer` persistente deja el campo inválido para TanStack Form y `handleSubmit` no vuelve a enviar. El mensaje se borra al editar el campo.
- **Validadores del formulario**: `onMount`, `onChange` y `onBlur` (todos con la misma función pura) en lugar de `onBlur`/`onSubmit`. Con `onBlur`+`onSubmit`, un campo ya inválido bloquea `handleSubmit` (`canSubmit` falso) antes de validar los demás, y los otros errores no aparecían. El error se muestra si el campo fue tocado.
- **Marcar principal en curso**: el botón se deshabilita en **todas** las direcciones mientras hay un `PATCH /principal` pendiente (no solo en la del ítem), para cubrir R3 sin índice único.
- **Avisos de error de las acciones** (`avisarErrorAccion`, «Esa dirección ya no está disponible» / «No pudimos completar la acción») viven en `pages/direcciones/model/` y los dispara la página; la invalidación ante 403/404 la hace el hook de mutación de la entidad (un único lugar).
- **`TarjetaDireccion`** es el ítem `<li>` completo (ícono, resumen y acciones); el texto de la dirección es `ResumenDireccion`, que reusa el selector (DRY).
- **Mockups**: el formulario abierto conserva un `<h1>` «Direcciones» solo para lector de pantalla (`sr-only`; el mockup no lo muestra); «Volver a Direcciones» es un `<button>` (no hay ruta propia, D6); la opción «Retiro en el local» del selector no lleva la anotación «(TBD dirección del local)» del mockup. Sin otras diferencias visuales conocidas; la verificación visual contra los mockups queda para verify.
- **Estilos**: las reglas de los mockups aprobados se trasladaron a un `.css` junto a cada componente (`notificaciones.css`, `dialogo.css`, `campo.css`, `direccion.css`, `direcciones.css`) importados desde `app/styles/index.css`; los tamaños de `svg.ico` se dan con clases del `<Icon>` (el test V-2 prohíbe reglas `svg.ico` que le ganen a las utilidades). `claseBoton` suma las variantes `fantasma` y `peligro` y la opción `compacto`.
- **TDD**: en 3.4 (mutaciones) la implementación base se escribió antes de correr el test de los casos de éxito (RED observado solo en la invalidación ante 404 y en el resto de los bloques); las demás tareas siguieron RED → GREEN.
- **Ruido en tests**: axe imprime en stderr «HTMLCanvasElement's getContext() not implemented» (jsdom); no afecta el resultado.

### Correcciones del verify (2026-11-17)

Cuatro WARNING del verify de código, corregidos con TDD (RED observado en cada uno):

1. **UI transitoria al terminar la sesión**: nueva acción `limpiarTransitorios()` en `uiStore` (vacía `toasts` y `confirmModal`, conserva `sidebarCollapsed`; no se usa `reset()`). `SesionGate` la llama en la transición `autenticada` → `anonima` (logout y vencimiento).
2. **Foco tras eliminar**: el `<h1>` «Direcciones» lleva `tabIndex={-1}` y, tras una eliminación exitosa, la página le da el foco (el diálogo ya había devuelto el foco al botón «Eliminar», que el refetch quita). Cancelar, Escape o un error siguen devolviendo el foco al botón.
3. **Listado desactualizado**: con la consulta en error y datos previos, la página muestra `ListadoDesactualizado` (alerta no bloqueante con «Reintentar» → `refetch`) sobre el listado.
4. **Avisos con mutaciones superpuestas**: la página usa `mutateAsync` y el helper `avisarResultado(promesa, tituloExito)` (`pages/direcciones/model/avisos.ts`), que avisa éxito o error por cada llamada; ya no dependen de los callbacks de `mutate`, que solo disparan para la última.

Tests nuevos: `direcciones-robustez.test.tsx` (10), `sesion-gate.test.tsx` (+3), `ui-store.test.ts` (+2). Se amplió la delta spec (`frontend-addresses`: aviso desactualizado, foco, eliminaciones superpuestas; `frontend-feedback`: fin de sesión con diálogo abierto).
