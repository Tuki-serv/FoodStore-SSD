# Mockups — C-14 `fe-auth-cuenta`

- Design system: Revision 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14). Los mockups importan `../../../../design-system/tokens.css` y `brand.js`; no copian valores (el bloque «Cuenta» de `mockup.css` solo compone tokens existentes).
- Approval: approved (2026-11-19, by user) (revisión de mockup 2026-11-19: botón «Cerrar sesión» en Mi cuenta; Ingresar y Registrarse siguen aprobadas)
- Revisión de mockup 2026-11-19: botón «Cerrar sesión» en Mi cuenta (tarjeta «Sesiones»: «Cerrar sesión» neutro + «Cerrar todas las sesiones» en peligro; solo cambia `mi-cuenta.html` y sus 14 capturas). La revisión fue aprobada por el usuario el 2026-11-19.
- Preview: rendered (2026-11-19, `previews/`, 1440x900 y 390x844, página completa cuando el contenido es más alto que la ventana; Edge + playwright-core porque el Playwright MCP no tiene Chrome instalado; sin errores de consola, sin pedidos fallidos y sin scroll horizontal)
- Decisiones reflejadas: DU-1 (auto-login tras registrarse, con fallback a `/ingresar`), DU-5 («Repetir contraseña» solo en el cliente). Ver `design.md`.

## Brief

Visitante sin sesión que ingresa con email y contraseña o crea su cuenta de cliente (al terminar entra directo), y cualquier usuario con sesión que revisa y edita sus datos básicos o cierra la sesión en este dispositivo o en todos. Navegación por el panel lateral de la Revision 2 (DD-25): sin sesión muestra Catálogo, Ingresar y Registrarse, sin pie de usuario; con sesión, las secciones del rol y el pie con nombre y rol principal. Los formularios usan el `Campo` del design system (`.field`, `.input`, `.hint`, `.err`); los errores del servidor se muestran en el campo cuando corresponden y si no en una alerta (`.form-alert`, `role="alert"`).

## Pantallas y estados

| Archivo | Estado | Qué muestra |
|---------|--------|-------------|
| `ingresar.html` | vacío | Email + Contraseña, «Ingresar», enlace «Registrate» |
| `?estado=errores` | validación | «Ingresá un email válido» (`ana@`) y «Ingresá tu contraseña» |
| `?estado=credenciales` | 401 | Alerta «Email o contraseña incorrectos.» sin decir cuál; email conservado, contraseña vacía |
| `?estado=bloqueo` | 429 | Aviso «Demasiados intentos… Probá de nuevo en 14 minutos.» (`Retry-After: 840`); «Ingresar» deshabilitado |
| `?estado=enviando` | enviando | Campos deshabilitados, «Ingresando…» con spinner |
| `?estado=red` | sin respuesta | Alerta «No pudimos conectar con el servidor.» |
| `?estado=cuenta-creada` | DU-1 fallback | Aviso «Tu cuenta se creó. Ingresá para continuar.», email precargado, contraseña vacía |
| `registrarse.html` | vacío | Nombre, Apellido (dos columnas en desktop), Email, Celular (opcional), Contraseña («Al menos 8 caracteres»), Repetir contraseña, «Crear cuenta», enlace «Ingresá» |
| `?estado=errores` | validación | «Ingresá tu nombre» (en blanco), «Ingresá tu apellido» (vacío), «Las contraseñas no coinciden» |
| `?estado=email-duplicado` | 409 | «Ya existe una cuenta con este email.» + enlace «Ingresar» en el campo email; demás valores conservados |
| `?estado=enviando` | enviando | Campos deshabilitados, «Creando cuenta…» con spinner |
| `mi-cuenta.html` | datos | «Tus datos»: Nombre, Apellido, Celular editables; Email y Rol de solo lectura; «Guardar cambios». Sección «Sesiones» con «Cerrar sesión» (este dispositivo, sin confirmación) y «Cerrar todas las sesiones» |
| `?rol=admin` | varios roles | Roles «Administrador» y «Gestor de stock»; panel con las secciones de ADMIN |
| `?estado=guardando` | enviando | «Guardando…» con spinner, campos deshabilitados |
| `?estado=guardado` | PATCH 200 | Toast «Datos guardados»; el pie del panel ya muestra «Analía Gómez» (roles conservados) |
| `?estado=validacion` | validación | «Ingresá tu apellido» |
| `?estado=error-servidor` | 503 | Alerta en la tarjeta; valores editados conservados (en la app el texto es el `detail` normalizado) |
| `?estado=cerrar-todas` | confirmación | Diálogo «¿Cerrar todas las sesiones?» — «Vas a salir en este y en todos tus dispositivos.» — «Cancelar» / «Cerrar todas» (peligro); hoja inferior en mobile |

Parámetros extra: `?nav=collapsed` y `?nav=drawer` (de `mockup.js`).

## Capturas

`previews/<pantalla>[-<estado>]-<desktop|mobile>.png` (18 estados × 2 tamaños = 36 capturas):
`ingresar`, `ingresar-errores`, `ingresar-credenciales`, `ingresar-bloqueo`, `ingresar-enviando`, `ingresar-red`, `ingresar-cuenta-creada`, `registrarse`, `registrarse-errores`, `registrarse-email-duplicado`, `registrarse-enviando`, `mi-cuenta`, `mi-cuenta-admin`, `mi-cuenta-guardando`, `mi-cuenta-guardado`, `mi-cuenta-validacion`, `mi-cuenta-error-servidor`, `mi-cuenta-cerrar-todas`.

## Fuentes

- `design-system/components.html`, `tokens.css`, `brand.js`, `assets/logo.svg` (Revision 2): shell, `.field`, `.btn`, `.toast`, `.modal`, `.badge`.
- `archive/2026-11-19-c-19-fe-checkout-pedido/mockups/` (`mockup.css` y `mockup.js` copiados sin cambios; `checkout.js` → `cuenta.js`, que arma el shell con y sin sesión).
- App real: `frontend/src/app/layouts/app-shell/` (sin sesión no hay pie del panel ni carrito en la barra superior; pie con `rolPrincipal`), `frontend/src/shared/ui/campo/`.
- `design.md` (D3–D8, DU-1..DU-5) y specs `frontend-account`, `user-profile` de este change.
- Clases nuevas (solo composición de tokens; `(TBD)` sumarlas a `components.html` si se aprueban): `.auth-card`, `.ok-box`, `.ro-list`, `.badge.b-rol`, `.danger-zone`, `.btn-danger-outline`, `.btn-neutral` (dentro de `.danger-zone`), `.sesiones-actions`, `.spinner-sm`.

## Cómo verlos

Abrir cada `.html` desde el explorador (`file://`) o servir la carpeta del repo con cualquier servidor estático (las rutas son relativas a `design-system/`). No usan recursos remotos.
