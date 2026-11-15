# Mockups — C-13a `fe-foundation-scaffold`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: pending
- Preview: rendered (2026-11-15, headless Microsoft Edge desde `file://`, 1440x900 y 390x844)

## Brief

- **Audiencia**: cualquier visitante de la tienda (sin sesión) en C-13a; clientes, gestores de pedidos y de stock y administradores cuando C-13b provea la sesión.
- **Tarea**: orientarse y moverse entre secciones desde el panel lateral de toda la app (DD-25), en desktop y en el teléfono; entender qué pasó cuando una URL no existe o algo falla.
- **Pantallas y estados**: shell «sin sesión» con la página provisoria de Catálogo (lo que C-13a muestra); shell ADMIN (vista futura, depende de C-13b) para probar que la navegación completa entra en 900 px de alto y en el drawer mobile; 404 dentro del shell; error genérico fuera del shell. Estados del panel: expandido, colapsado (desktop) y drawer abierto/cerrado (mobile).
- **Tamaños**: 1440x900 (desktop, panel colapsable) y 390x844 (mobile, drawer). Breakpoint 1024 px.
- **Tokens y assets**: `design-system/tokens.css` (importado, sin copiar valores), `design-system/brand.js` (nombre), `design-system/assets/logo.svg` (provisional, rotulado «LOGO PROVISIONAL (TBD)»). Marcado, clases y CSS del shell copiados sin cambios de `design-system/components.html` (es lo mismo que la app porta, design D4).
- **Restricciones**: no rediseñar la Revision 2; sin animación del estado inicial (patrón `.is-ready`); foco visible; objetivos táctiles de 44 px; sin texto técnico ni trazas en la página de error; el dueño de cada página provisoria no se muestra al usuario (OQ-6).
- **Agregados respecto del design system** (a incorporar al sprite si se aprueban): íconos `i-obra` (sección en preparación), `i-brujula` (404) e `i-alerta` (error), con el mismo estilo de trazo.

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `shell-anon.html` | Shell sin sesión: Catálogo, Ingresar, Registrarse; sin pie de usuario; página provisoria «Catálogo» (dueño C-16). **Es lo que entrega C-13a.** | `?nav=expanded`, `?nav=collapsed`, `?nav=drawer` |
| `shell-admin.html` | **Vista futura, depende de C-13b**: navegación ADMIN completa (incluye grupo «Administración»), pie con usuaria de ejemplo, contador del carrito (C-18) y botón de carrito en la barra mobile. Página provisoria «Dashboard» (dueño C-24). | ídem |
| `not-found.html` | 404 dentro del shell sin sesión: «Página no encontrada», ruta pedida y «Ir al catálogo». | ídem |
| `error.html` | Error genérico a pantalla completa, fuera del shell: «Algo salió mal», «Reintentar», «Volver al inicio». | no aplica (sin panel) |

Las anotaciones del mockup (franja amarilla superior y la etiqueta azul punteada «Anotación del mockup…») **no** son parte de la app.

Archivos de soporte: `mockup.css` (reglas del shell de `components.html` + estilos de página) y `mockup.js` (sprite de íconos, navegación por rol con la misma configuración de design D5, comportamiento del panel de design D7).

## Capturas (`previews/`)

| Captura | Tamaño | Qué se revisó |
|---------|--------|---------------|
| `shell-anon-desktop-expanded.png` | 1440x900 | Panel expandido, Catálogo actual, Ingresar/Registrarse separados, sin pie |
| `shell-anon-desktop-collapsed.png` | 1440x900 | Solo íconos, logo oculto, botón de panel centrado, sin transición a medio camino |
| `shell-anon-mobile-closed.png` | 390x844 | Barra superior con menú y logo, sin desborde horizontal |
| `shell-anon-mobile-drawer.png` | 390x844 | Drawer abierto sobre scrim, botón cerrar |
| `shell-admin-desktop-expanded.png` | 1440x900 | Navegación ADMIN completa entra en 900 px, pie visible, contador |
| `shell-admin-desktop-collapsed.png` | 1440x900 | Íconos con contador, separador en lugar del título de grupo |
| `shell-admin-mobile-drawer.png` | 390x844 | Navegación completa y pie entran en 844 px |
| `not-found-desktop.png` | 1440x900 | 404 centrado en el área principal, panel intacto |
| `not-found-mobile.png` | 390x844 | Título en dos líneas, ruta sin cortes, botón visible |
| `error-desktop.png` | 1440x900 | Tarjeta centrada con logo, dos acciones |
| `error-mobile.png` | 390x844 | Acciones en una fila, sin desborde |

## Cómo previsualizar

1. Abrir cualquier `.html` de esta carpeta directamente en el navegador (no hace falta servidor; las rutas a `design-system/` son relativas: `../../../../design-system/`).
2. Desktop: ventana ≥ 1024 px; el botón del encabezado colapsa/expande (la preferencia se guarda en `localStorage`, clave `foodstore.mockup.sidebarCollapsed`). Mobile: < 1024 px o modo dispositivo; «Abrir menú», cerrar con ✕, scrim o Esc.
3. Para capturas: agregar `?nav=expanded`, `?nav=collapsed` o `?nav=drawer` (este último solo en mobile).
4. Re-render: headless Edge (`msedge --headless --screenshot=… --window-size=1440,900 "file:///…/shell-anon.html?nav=expanded"`); para 390 px, cargar el mockup dentro de un iframe de 390x844 (Edge headless no baja de ~500 px de ancho). Usar un `--user-data-dir` distinto por captura.

## Fuentes

- `design-system/README.md` §Sidebar navigation (Revision 2), `design-system/components.html`, `design-system/tokens.css`, `design-system/brand.md`
- `knowledge-base/09_decisiones_y_supuestos.md` DD-25 (secciones por rol), DD-24
- `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (`uiStore`), §Navegación
- `openspec/changes/c-13a-fe-foundation-scaffold/design.md` (D4, D5, D7, D8, D9; OQ-2 sobre `STOCK`, OQ-6, OQ-7)
