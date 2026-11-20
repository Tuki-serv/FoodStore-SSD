# Mockups C-23 — Usuarios (fe-admin-usuarios-roles)

- Design system revision: 2 (`design-system/tokens.css`, `brand.js`, panel lateral DD-25; «Usuarios» activo, usuaria ADMIN de ejemplo «Ana Gómez»)
- Approval: approved (2026-11-20, by user)
- Preview: rendered (2026-11-20) con Microsoft Edge headless (Playwright-core, sin servidor), 1440x900 y 390x844 (emulación móvil). Capturas en `previews/<nombre>-1440.png` y `previews/<nombre>-390.png` (las páginas más altas que la ventana se capturan completas).
- Fuentes: `design.md` (§UI Mockups, OQ-1..OQ-10 aceptadas con el default, D7–D10), `specs/frontend-admin-users/spec.md` (textos), nombres de rol de `frontend/src/shared/config/roles.ts`, base visual de los mockups de C-17a y C-22 (`mockup.css`, `mockup.js`) más `users.css` / `users.js` propios. Todo local, sin CDN ni fuentes remotas. Los datos son de ejemplo.

Cómo verlos: abrir el `.html` en el navegador (file://) con el query string indicado; `?nav=collapsed|expanded|drawer` controla el panel lateral.

## Pantallas y estados

| Pantalla / estado | URL | Capturas (`previews/`) |
|---|---|---|
| Listado con datos (varios roles, celular vacío, fila propia «Vos» sin «Desactivar») | `usuarios.html` | `usuarios-datos` |
| Filtrado por rol + paginación (Gestor de stock, página 2 de 2) | `usuarios.html?estado=filtrado` | `usuarios-filtrado-pagina2` |
| Cargando (esqueleto) | `usuarios.html?estado=cargando` | `usuarios-cargando` |
| Vacío con filtro («No hay usuarios con ese rol» + «Ver todos») | `usuarios.html?estado=vacio` | `usuarios-vacio-filtro` |
| Error con «Reintentar» | `usuarios.html?estado=error` | `usuarios-error` |
| Aviso «Usuario creado» | `usuarios.html?estado=creado` | `aviso-usuario-creado` |
| Aviso «Usuario actualizado» | `usuarios.html?estado=actualizado` | `aviso-usuario-actualizado` |
| Aviso «Usuario desactivado» | `usuarios.html?estado=desactivado` | `aviso-usuario-desactivado` |
| Alta vacía (Cliente viene marcado) | `usuario-form.html?modo=alta` | `form-alta-vacio` |
| Alta con errores de campos y sin roles | `usuario-form.html?modo=alta&error=campos` | `form-alta-errores-campos` |
| Alta con email repetido (409) | `usuario-form.html?modo=alta&error=email` | `form-alta-email-repetido` |
| Alta con error de conexión | `usuario-form.html?modo=alta&error=conexion` | `form-alta-conexion` |
| Edición de otro usuario (email no editable, sin contraseña) | `usuario-form.html?modo=edicion` | `form-edicion-otro` |
| Edición con alerta `LAST_ADMIN` | `usuario-form.html?modo=edicion&error=last-admin` | `form-edicion-last-admin` |
| Edición propia («Administrador» deshabilitada con explicación) | `usuario-form.html?modo=propia` | `form-edicion-propia` |
| Edición propia con 409 `SELF_ACTION_NOT_ALLOWED` | `usuario-form.html?modo=propia&error=self` | `form-edicion-propia-self` |
| Diálogo «Desactivar» en reposo | `usuario-desactivar.html` | `desactivar-reposo` |
| Diálogo enviando | `usuario-desactivar.html?estado=enviando` | `desactivar-enviando` |
| Diálogo con error de conexión | `usuario-desactivar.html?estado=error` | `desactivar-error` |
| Diálogo con 409 `LAST_ADMIN` | `usuario-desactivar.html?estado=error&error=last-admin` | `desactivar-last-admin` |
| Diálogo «ya no estaba activo» (404) | `usuario-desactivar.html?estado=inactivo` | `desactivar-ya-inactivo` |

## Decisiones de diseño a revisar
- Filtro de rol como grupo de botones (`aria-pressed`) «Todos / Administrador / Gestor de stock / Gestor de pedidos / Cliente»; en mobile se reparte en dos filas.
- Alta: el rol «Cliente» viene marcado de entrada (el spec exige al menos un rol; no está definido un valor inicial).
- Contraseña inicial con requisito visible («Mínimo 8 caracteres. Se la tenés que pasar vos al usuario.»).
- Fila propia: marca «Vos», solo «Editar». Casilla «Administrador» propia deshabilitada con candado y la explicación visible dentro de la casilla.
- Diálogo de baja: lista tres efectos (sesiones cerradas, no puede ingresar, email liberado).
- Los toasts son fijos abajo a la derecha y pueden tapar la última fila en la captura de 1440x900.
- Textos de validación del alta (`Ingresá el nombre`, `Ingresá un email válido`, `Usá al menos 8 caracteres`) siguen el estilo de Registrarse; el spec solo fija «Elegí al menos un rol.» y el 409 de email.

Approval: approved (2026-11-20, by user)
