# Mockups — C-13b `fe-foundation-auth-data`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-17, by user)
- Preview: rendered (2026-11-17, headless Microsoft Edge desde `file://`, 1440x900 y 390x844)

## Brief

- **Audiencia**: usuarios con sesión sin el rol necesario para una sección (p. ej. cliente que abre una URL de administración) y cualquier visitante durante el arranque de la app.
- **Tarea**: entender que no tienen acceso y volver al catálogo sin perder el panel; ver que la app está verificando la sesión y no se colgó.
- **Pantallas**: «Sin permiso» dentro del shell (design D7/OQ-5, URL intacta) y pantalla de carga de la sesión antes del router (D6/OQ-4).
- **Tamaños**: 1440x900 y 390x844 (breakpoint 1024 px).
- **Tokens y assets**: `design-system/tokens.css` y `brand.js` importados; `design-system/assets/logo.svg` (provisional, rotulado «LOGO PROVISIONAL (TBD)»). Shell copiado sin cambios de los mockups aprobados de C-13a.
- **Restricciones**: sin jerga técnica; sin animar el estado inicial del shell; el indicador de carga respeta `prefers-reduced-motion` (queda quieto); `role="status"` + `aria-live="polite"` en la carga.

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `forbidden.html` | `CLIENT` (usuaria de ejemplo) que abrió `/admin/usuarios`: panel con sus secciones, pie con usuario, «No tenés acceso a esta sección», una frase y «Ir al catálogo». Misma familia que el 404 aprobado, con ícono de candado y copy propio. | `?nav=expanded`, `?nav=collapsed`, `?nav=drawer` |
| `session-loading.html` | Pantalla completa: logo, indicador y «Cargando…». Sin shell. | no aplica |

Las anotaciones (franja amarilla y etiqueta azul punteada) no son parte de la app. El nombre de marca viene del logo; `brand.js` está importado por consistencia.

## Cambios respecto del design system

- Ícono nuevo `i-candado` (definido en `mockup.js`, no está en el sprite de `components.html`): **ícono nuevo, requiere revisión**. Se suma a `obra`, `brujula` y `alerta` ya registrados en C-13a.
- El indicador de carga (`.spinner`) y el contenedor `.boot-wrap` son estilos de mockup con tokens existentes; no hay un componente equivalente en `components.html`.

## Capturas (`previews/`)

| Captura | Tamaño |
|---------|--------|
| `forbidden-desktop.png` | 1440x900 |
| `forbidden-mobile.png` | 390x844 |
| `forbidden-mobile-drawer.png` | 390x844 |
| `session-loading-desktop.png` | 1440x900 |
| `session-loading-mobile.png` | 390x844 |

La captura de carga muestra el indicador en un instante de su giro; con «reducir movimiento» queda quieto.

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador. Las rutas a `design-system/` son relativas: `../../../../../design-system/` (ajustadas al archivar el change, igual que en C-13a).
2. Mobile: ventana < 1024 px; menú con «Abrir menú». Para capturas: `?nav=drawer`.
3. Re-render: headless Edge con `--screenshot`; para 390 px, un iframe de 390x844 dentro de un HTML contenedor y recortar a 390 de ancho (Edge no baja de ~500 px).

## Fuentes

- `design-system/README.md` (Revision 2), `design-system/components.html`, `design-system/tokens.css`
- Mockups aprobados de C-13a (`not-found.html`, `shell-admin.html`, `mockup.css`, `mockup.js`)
- `openspec/changes/c-13b-fe-foundation-auth-data/design.md` (D6, D7, OQ-4, OQ-5), specs `frontend-route-guards` y `frontend-session`
