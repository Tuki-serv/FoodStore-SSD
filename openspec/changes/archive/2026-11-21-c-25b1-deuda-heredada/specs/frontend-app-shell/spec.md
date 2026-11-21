# Spec Delta

## ADDED Requirements

### Requirement: Drawer mobile como diálogo modal
Mientras está abierto en mobile, el drawer SHALL exponerse como diálogo modal (`role="dialog"`, `aria-modal="true"` y un nombre accesible), el foco del teclado SHALL quedar atrapado dentro del drawer, y el contenido detrás (barra superior y página) SHALL quedar inerte para el teclado, el puntero y las tecnologías asistivas. Cerrado, o en desktop, el panel no SHALL exponerse como diálogo ni dejar contenido inerte.

#### Scenario: Rol y nombre del diálogo
- **WHEN** el drawer está abierto en mobile
- **THEN** existe un diálogo modal con nombre accesible que contiene la navegación y el botón «Cerrar menú»

#### Scenario: Tab no sale del drawer
- **WHEN** el foco está en el último elemento enfocable del drawer y el usuario presiona Tab
- **THEN** el foco pasa al primer elemento enfocable del drawer

#### Scenario: Shift+Tab no sale del drawer
- **WHEN** el foco está en «Cerrar menú» (primer elemento) y el usuario presiona Shift+Tab
- **THEN** el foco pasa al último elemento enfocable del drawer

#### Scenario: Contenido de fondo inerte
- **WHEN** el drawer está abierto en mobile
- **THEN** la región principal de la página está marcada como inerte y sus controles no reciben foco

#### Scenario: Cerrado libera el fondo
- **WHEN** el usuario cierra el drawer
- **THEN** la región principal deja de estar inerte y no queda ningún diálogo en el árbol de accesibilidad

#### Scenario: Desktop sin diálogo
- **WHEN** la ventana mide 1024 px o más
- **THEN** el panel lateral es navegación sin rol de diálogo y nada de la página está inerte

#### Scenario: Sin violaciones de accesibilidad
- **WHEN** se analiza el shell con el drawer abierto con una herramienta automática de accesibilidad
- **THEN** no se detectan violaciones
