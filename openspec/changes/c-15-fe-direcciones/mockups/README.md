# Mockups — C-15 `fe-direcciones`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-17, by user)
- Preview: rendered (2026-11-17, headless Microsoft Edge desde `file://`, 1440x900 y 390x844)

## Brief

- **Audiencia**: clientes con sesión (rol `CLIENT`; cualquier usuario con sesión puede tener direcciones).
- **Tarea**: guardar varias direcciones de entrega, reconocer cuál es la principal, editarlas, cambiar la principal y eliminarlas sin miedo a equivocarse; al pedir, elegir una (o retiro en el local) con la principal ya elegida.
- **Pantallas y estados**: listado con datos, listado sin principal, estado vacío, formulario de alta con errores de validación, formulario de edición, formulario con error del servidor, confirmación al eliminar la principal, selector en el checkout (con datos y sin direcciones). Notificaciones (toasts) y diálogo de confirmación son los globales que dibuja este change.
- **Tamaños**: 1440x900 y 390x844 (breakpoint del shell 1024 px; las tarjetas pasan a una columna con acciones abajo bajo 720 px).
- **Tokens y assets**: `design-system/tokens.css` y `brand.js` importados; logo provisional `design-system/assets/logo.svg` («LOGO PROVISIONAL (TBD)»). Shell copiado sin cambios de los mockups aprobados de C-13a/C-13b (variante `CLIENT`, usuaria de ejemplo «Lucía Pérez»).
- **Restricciones**: datos según el contrato real del backend (`alias`, `linea1`, `linea2`, `ciudad`, `provincia`, `codigo_postal`, `es_principal`); textos en español rioplatense; acciones con nombre accesible propio («Editar Trabajo»); animaciones cortas `ease-out` y quietas con «reducir movimiento».

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `direcciones-lista.html` | Tres direcciones: «Casa» principal (borde y badge verde «Principal», sin «Marcar como principal»), «Trabajo» y una sin alias («Sin alias», nombrada por su línea 1); acciones por ítem; notificación «Dirección guardada». | `?estado=sin-principal` (se eliminó la principal: aviso «Ninguna dirección es principal» y toast «Dirección eliminada»); `?nav=expanded|collapsed|drawer` |
| `direcciones-vacio.html` | Estado vacío con ícono, «Todavía no tenés direcciones», explicación y «Agregar dirección». | `?nav=…` |
| `direcciones-form.html` | Formulario «Nueva dirección» tras pulsar «Guardar dirección» con errores: alias de más de 50, calle y ciudad vacías, código postal de 11 caracteres. | `?modo=editar` («Editar dirección» con los datos de «Trabajo», «Guardar cambios»); `?modo=red` (alerta general «No pudimos guardar la dirección» con los datos conservados) |
| `direcciones-eliminar.html` | Diálogo «¿Eliminar «Casa»?» sobre el listado, con el aviso de que ninguna quedará principal; «Eliminar» en rojo (`btn-danger`) y «Cancelar». En mobile es una hoja inferior. | — |
| `selector-checkout.html` | Paso «Entrega» de un checkout de ejemplo: grupo «¿Dónde lo recibís?» con «Casa» (principal) preseleccionada, «Trabajo» y «Retiro en el local»; enlace «Gestionar direcciones». Pasos, resumen y montos son ilustrativos de C-19. | `?estado=vacio` («No tenés direcciones guardadas» + enlace; queda elegido el retiro) |

Las anotaciones (franja amarilla y etiquetas azules punteadas) no son parte de la app.

## Cambios respecto del design system

- **Íconos nuevos, requieren revisión**: `i-editar`, `i-basura`, `i-estrella`, `i-mas`, `i-tienda` (definidos en `mockup.js`, mismo trazo que el sprite de `components.html`). Se suman a `candado`, `obra`, `brujula` y `alerta` ya registrados.
- **Badge «Principal»** (`.b-principal`): misma forma que `.badge`, con `--color-accent` / `--color-accent-soft` (tokens existentes). No existe en `components.html`.
- **Diálogo de confirmación** (`.modal`, `.modal-scrim`): componente nuevo con tokens existentes (`--shadow-lg`, `--color-overlay`, `--radius-lg`); en mobile se apoya abajo como hoja. `components.html` no tiene diálogo.
- **Toast con botón de cierre**: el `.toast` de `components.html` más un `icon-btn` «Cerrar notificación»; región fija abajo a la derecha (desktop) o a lo ancho (mobile).
- **Opción de radio en tarjeta** (`.opt`), tarjeta de dirección (`.addr`), aviso (`.notice`) y alerta de formulario (`.form-alert`): composiciones con tokens existentes.

## Capturas (`previews/`)

| Captura | Tamaño |
|---------|--------|
| `lista-desktop.png` / `lista-mobile.png` | 1440x900 / 390x844 |
| `lista-sin-principal-desktop.png` / `lista-sin-principal-mobile.png` | 1440x900 / 390x844 |
| `vacio-desktop.png` / `vacio-mobile.png` | 1440x900 / 390x844 |
| `form-errores-desktop.png` / `form-errores-mobile.png` | 1440x900 / 390x844 |
| `form-editar-desktop.png` / `form-editar-mobile.png` | 1440x900 / 390x844 |
| `form-error-red-desktop.png` / `form-error-red-mobile.png` | 1440x900 / 390x844 |
| `eliminar-desktop.png` / `eliminar-mobile.png` | 1440x900 / 390x844 |
| `selector-desktop.png` / `selector-mobile.png` | 1440x900 / 390x844 |
| `selector-vacio-desktop.png` / `selector-vacio-mobile.png` | 1440x900 / 390x844 |

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar el change pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Para capturas: `?nav=drawer`.
3. Re-render: headless Edge con `--screenshot` y `--window-size=1440,900`; para 390 px, un HTML contenedor con un iframe de 390x844 y `--window-size=390,844` (Edge no baja de ~500 px de viewport, pero recorta la captura al tamaño pedido).

## Fuentes

- `design-system/README.md` (Revision 2), `design-system/components.html`, `design-system/tokens.css`, `design-system/brand.md`
- Mockups aprobados de C-13b (`mockup.css`, `mockup.js`, `forbidden.html`) y C-13a (`shell-admin.html`)
- `knowledge-base/06_funcionalidades.md` US-006, `knowledge-base/05_reglas_de_negocio.md` RN-DI-01..04
- `backend/app/modules/direcciones/` (contrato real), `openspec/changes/c-15-fe-direcciones/design.md` y specs `frontend-addresses`, `frontend-feedback`
