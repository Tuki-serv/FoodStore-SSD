# Spec Delta — frontend-app-shell

## MODIFIED Requirements

### Requirement: Panel lateral como navegación principal
Toda página de la aplicación, salvo la página de error genérica, SHALL mostrarse dentro de un shell con un panel lateral izquierdo que contiene el logo, la navegación principal (landmark `navigation` con nombre «Principal») y, con sesión, el pie con el usuario. No SHALL existir una barra de navegación superior en desktop. El logo SHALL ser el del design system vigente (isotipo y wordmark), con nombre accesible «Food Store» y sin rótulos de provisorio («LOGO PROVISIONAL», «(TBD)»); con el panel colapsado SHALL verse solo el isotipo.

#### Scenario: Arranque del shell
- **WHEN** un visitante abre la aplicación en `/`
- **THEN** ve el panel lateral con la navegación «Principal» y el contenido de Catálogo en la región principal

#### Scenario: Página actual marcada
- **WHEN** el visitante está en `/catalogo`
- **THEN** el ítem «Catálogo» tiene `aria-current="page"` y ningún otro ítem lo tiene

#### Scenario: Logo sin rótulo provisorio
- **WHEN** se renderiza el shell en cualquier ruta
- **THEN** el logo tiene nombre accesible «Food Store» y ningún texto visible del shell contiene «PROVISIONAL» ni «(TBD)»

#### Scenario: Isotipo con el panel colapsado
- **WHEN** el usuario colapsa el panel en desktop
- **THEN** el encabezado del panel muestra solo el isotipo, que conserva el nombre accesible «Food Store»
