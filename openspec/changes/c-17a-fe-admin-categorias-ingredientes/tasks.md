# Tasks — C-17a `fe-admin-categorias-ingredientes`

> **Governance MEDIO**: implementar con checkpoints y reportar decisiones no obvias. Gate: los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) antes de escribir código. OQ-1 y OQ-2 no bloquean: sin respuesta se aplica el valor por defecto (D5, D6).
> **Criterios de aceptación visual**: `mockups/categorias.html`, `categoria-form.html`, `categoria-eliminar.html`, `ingredientes.html`, `ingrediente-form.html`, `ingrediente-eliminar.html` y sus capturas en `mockups/previews/` (ver `mockups/README.md`).
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, ejecutando la suite después de cada paso. Red simulada **solo** con MSW (`server.use` por test, `onUnhandledRequest: 'error'`), nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()`); QueryClient nuevo por test sin reintentos; valores esperados literales, sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; datos del servidor en TanStack Query; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear; no tocar `backend/`. Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` (categorías: árbol, carga, vacío, error; formulario: alta con errores, edición, nombre repetido; baja: confirmar, con subcategorías, con productos; ingredientes: listado, filtrado vacío, carga, error; formulario alta/edición; baja con uso) con `mockup.css`/`mockup.js` de C-16b, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los HTML abren desde `file://`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar y registrar `Preview: rendered` en `design.md`. Verificación: PNG presentes.
- [x] 0.3 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`, junto con las respuestas (o «por defecto») a OQ-1 y OQ-2.

## 1. Red de seguridad

- [ ] 1.1 Safety net: `npm test`, `npm run typecheck`, `npm run lint`; anotar aquí la línea base (archivos/tests verdes). Si algo falla, frenar y reportar como falla previa.

## 2. Modelo de categoría (spec «Padre de categoría sin ciclos», «Baja de categoría validada»)

- [ ] 2.1 RED: `src/entities/categoria/__tests__/categoria-admin-modelo.test.ts`: `padresPosibles(arbolSeed, idHamburguesas)` → `[{id:2,nombre:'Bebidas',nivel:0},{id:6,nombre:'Gaseosas',nivel:1},{id:3,nombre:'Postres',nivel:0}]`. Ejecutar → falla.
- [ ] 2.2 GREEN + TRIANGULATE: `padresPosibles` y `contarDescendientes` en `entities/categoria/model/`; casos: sin id (alta) → todas en orden de árbol con niveles; hoja («Veganas») → todas menos ella; tres niveles → excluye nietos; `contarDescendientes` de «Hamburguesas» → 2 hijas directas, de hoja → 0. Ejecutar → verde.

## 3. API de administración (spec «Alta y edición…», «Baja…», «Listado de ingredientes»)

- [ ] 3.1 `src/test/msw/admin-catalogo.ts` (design D9): árbol, ingredientes y unidades del seed; POST/PATCH/DELETE con estado en memoria y registro de cuerpos; variantes 409/400/red. Cubierto por los tests de 3.2–8.
- [ ] 3.2 RED: `src/entities/categoria/__tests__/categoria-mutaciones.test.tsx`: `useCrearCategoria` con `{nombre:'Aguas', parent_id:2, descripcion:null, imagen_url:''}` envía exactamente ese cuerpo e invalida `['categorias']` y `['productos']`. Ejecutar → falla.
- [ ] 3.3 GREEN + TRIANGULATE: `crearCategoria`/`editarCategoria`/`eliminarCategoria` + hooks; casos: editar envía `PATCH /categorias/4` solo con lo pasado; eliminar → `DELETE /categorias/3`; 409 `CATEGORY_HAS_PRODUCTS` llega como `ApiError` con ese `code`. Ejecutar → verde.
- [ ] 3.4 RED → GREEN + TRIANGULATE `entities/ingrediente` (`src/entities/ingrediente/__tests__/`): `ingredienteQueries.lista({page:1,size:20,alergeno:true})` pide `page=1&size=20&is_alergeno=true` y `alergeno:null` omite el parámetro; `resumenUso` con 0, 2 y 5 productos («Lo usan 5 productos: A, B, C y 2 más»); mutaciones invalidan `['ingredientes']` y `['productos']`. Ejecutar → verde.
- [ ] 3.5 RED → GREEN `entities/unidad-medida`: `unidadMedidaQueries.todas()` pide `size=100` y `etiquetaUnidad({nombre:'Gramo',simbolo:'g'})` → «Gramo (g)». Ejecutar → verde.

## 4. Validación de formularios (spec «Alta y edición de categoría», «Alta y edición de ingrediente»)

- [ ] 4.1 RED: `src/pages/admin-categorias/__tests__/validacion.test.ts`: `validarCategoria({nombre:'   '})` → `{nombre:'Ingresá un nombre.'}`. Ejecutar → falla.
- [ ] 4.2 GREEN + TRIANGULATE: casos: 101 caracteres → «Máximo 100 caracteres.»; nombre válido con espacios → sin errores y `aCuerpoCategoria` lo recorta; URL vacía en alta → `imagen_url: ''`; `cambiosCategoria(inicial, actual)` devuelve solo los campos cambiados y `{}` si nada cambió. Igual para `validarIngrediente`/`cambiosIngrediente` en `pages/admin-ingredientes/__tests__/validacion.test.ts`. Ejecutar → verde.

## 5. Página Categorías — árbol y estados (spec «Acceso solo para ADMIN», «Árbol de categorías»; mockup `categorias.html`)

- [ ] 5.1 RED: `src/pages/admin-categorias/__tests__/admin-categorias-page.test.tsx`: con sesión ADMIN, `/admin/categorias` muestra «Categorías», las tres raíces del seed, «Gaseosas» dentro de «Bebidas» y «2 subcategorías» en «Hamburguesas». Ejecutar → falla.
- [ ] 5.2 GREEN: `pages/admin-categorias` (`ui/`, `index.ts`), entrada en el mapa de páginas de `app/router/routes.tsx`, CSS importado antes de cualquier regla. Ejecutar → verde.
- [ ] 5.3 TRIANGULATE: carga (`aria-busy`), vacío («Todavía no hay categorías» + «Nueva categoría»), error + «Reintentar» que vuelve a pedir; CLIENT y STOCK → página 403 sin pedidos de escritura; axe sin violaciones. Ejecutar → verde. Comparar con `mockups/categorias.html` (`?estado=carga|vacio|error`).

## 6. Formulario de categoría (spec «Alta y edición de categoría», «Padre de categoría sin ciclos»; mockup `categoria-form.html`)

- [ ] 6.1 RED: «Agregar subcategoría» en «Bebidas» → formulario «Nueva categoría» con padre «Bebidas»; escribir «Aguas» y guardar envía `POST` con `parent_id` 2, muestra «Categoría creada» y «Aguas» bajo «Bebidas». Ejecutar → falla.
- [ ] 6.2 GREEN: `FormularioCategoria` con TanStack Form, selector de padre con `padresPosibles`, foco en el título. Ejecutar → verde.
- [ ] 6.3 TRIANGULATE: nombre vacío → sin pedido y error en el campo; editar «Hamburguesas» → el selector no ofrece ella ni sus hijas; editar sin cambios → vuelve sin pedir; 409 `DUPLICATE_VALUE` → error en «Nombre» con lo escrito intacto; 400 y red caída → alerta general; «Cancelar» vuelve sin pedir; axe. Ejecutar → verde. Comparar con `categoria-form.html` (`?modo=editar|duplicado`).

## 7. Baja de categoría (spec «Baja de categoría validada»; mockup `categoria-eliminar.html`)

- [ ] 7.1 RED: «Eliminar Postres» → diálogo «¿Eliminar «Postres»?»; confirmar → 204, «Categoría eliminada», «Postres» ya no está. Ejecutar → falla.
- [ ] 7.2 GREEN + TRIANGULATE: «Eliminar Hamburguesas» → texto de 2 subcategorías y solo «Entendido», sin `DELETE`; 409 `CATEGORY_HAS_PRODUCTS` → mensaje dentro del diálogo y el árbol sin cambios; 409 `CATEGORY_HAS_CHILDREN` → mensaje e invalidación del árbol; botón «Eliminando…» deshabilitado durante el pedido; foco vuelve al botón de la fila al cerrar; axe. Ejecutar → verde. Comparar con `categoria-eliminar.html` (`?estado=subcategorias|productos`).

## 8. Página Ingredientes (spec «Listado…», «Alta y edición de ingrediente», «Baja de ingrediente»; mockups `ingredientes.html`, `ingrediente-form.html`, `ingrediente-eliminar.html`)

- [ ] 8.1 RED: `src/pages/admin-ingredientes/__tests__/admin-ingredientes-page.test.tsx`: ADMIN ve «Pan Brioche» con «Alérgeno», «u» y «Usado en 3 productos», y «Lechuga» sin marca. Ejecutar → falla.
- [ ] 8.2 GREEN: `pages/admin-ingredientes` + ruta. Ejecutar → verde.
- [ ] 8.3 TRIANGULATE listado: filtro «Alérgenos» → `is_alergeno=true&page=1` y `?alergeno=si` en la URL; abrir con `?alergeno=no&page=2` respeta ambos; vacío filtrado → «No hay ingredientes alérgenos» + «Ver todos»; carga, error + reintento; paginación; STOCK → 403; axe. Ejecutar → verde.
- [ ] 8.4 RED → GREEN + TRIANGULATE formulario: alta «Maní» alérgeno con «Gramo (g)» → cuerpo exacto y «Ingrediente creado»; unidad por defecto «Unidad (u)»; edición de «Mayonesa» → `PATCH` solo con `es_alergeno:false`; 409 → error en «Nombre»; red caída → alerta general. Ejecutar → verde.
- [ ] 8.5 RED → GREEN + TRIANGULATE baja: «Eliminar Queso Cheddar» avisa los 3 productos; sin uso → sin aviso; 204 → «Ingrediente eliminado» y la fila desaparece; error → mensaje en el diálogo. Ejecutar → verde.

## 9. Cierre

- [ ] 9.1 REFACTOR general (SOLID/DRY: sin lógica duplicada entre las dos páginas; si el diálogo de baja se repite tal cual, extraerlo a `shared/ui`) con la suite verde tras cada paso; `npm test`, `npm run typecheck`, `npm run lint` limpios; `fsd-boundaries` en cero.
- [ ] 9.2 Docs: `knowledge-base/06` (US-009 y US-011 marcadas en lo que cubre el frontend), `knowledge-base/08` (árbol FSD), `frontend/README.md`, `CHANGES.md` («Punto de partida (C-17a)» en C-17b: `entities/ingrediente`, `entities/unidad-medida`, invalidaciones). Verificación: diffs revisados.
- [ ] 9.3 Verify visual contra los mockups aprobados (1440x900 y 390x844; capturas en `mockups/verify/`) y registrar `Visual verify` en `design.md`.

## Workflow follow-up

- `/opsx:archive c-17a-fe-admin-categorias-ingredientes` y marcar `[x]` en `CHANGES.md`.
