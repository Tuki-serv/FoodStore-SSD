# Spec Delta — frontend-foundation

## MODIFIED Requirements

### Requirement: Tokens del design system como única fuente visual
El frontend SHALL cargar `design-system/tokens.css` del repositorio sin copiarlo, y cada color, tipografía, espaciado, radio, sombra y duración del tema de utilidades CSS SHALL referenciar una variable definida en ese archivo, sin valores literales. Las familias tipográficas de los tokens SHALL resolverse a fuentes autoalojadas por el frontend.

#### Scenario: Tema mapeado a variables existentes
- **WHEN** se comparan los valores del tema de utilidades con las variables declaradas en `design-system/tokens.css`
- **THEN** cada valor es una referencia `var(--…)` a una variable que existe en ese archivo

#### Scenario: Cambio de un token
- **WHEN** se modifica el valor de `--color-primary` en `design-system/tokens.css`
- **THEN** el frontend muestra el nuevo color sin editar ningún archivo de `frontend/`

#### Scenario: Familias tipográficas declaradas
- **WHEN** se comparan las familias nombradas por los tokens de tipografía con las declaraciones `@font-face` que compila el frontend
- **THEN** cada familia de display y de texto del token tiene su `@font-face` con un archivo local del paquete de la aplicación

### Requirement: Ícono de la aplicación
La aplicación SHALL declarar un ícono de pestaña derivado del logo del design system (`design-system/assets/`), de modo que el navegador no pida `/favicon.ico` ni registre un 404. El ícono SHALL ser el isotipo definitivo del design system vigente, sin marcas de provisorio, y SHALL reemplazarse desde el mismo asset.

#### Scenario: Sin 404 de favicon
- **WHEN** se abre cualquier página de la aplicación
- **THEN** la consola del navegador no muestra un error de `/favicon.ico` y la pestaña muestra el ícono de Food Store

#### Scenario: Favicon sin marca provisoria
- **WHEN** se inspecciona el asset del ícono de la aplicación
- **THEN** no contiene los textos «PROVISIONAL» ni «TBD»
