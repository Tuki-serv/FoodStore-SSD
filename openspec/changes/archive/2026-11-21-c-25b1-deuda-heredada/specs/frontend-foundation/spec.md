# Spec Delta

## MODIFIED Requirements

### Requirement: API pública por slice
Cada slice SHALL exponer su API pública en un `index.ts` y cada segmento de `shared` SHALL tener el suyo. Los imports entre capas SHALL pasar por esa API pública, nunca por archivos internos. La suite de arquitectura SHALL fallar si algún slice de `pages`, `features` o `entities`, o algún segmento de `shared`, no tiene `index.ts`.

#### Scenario: Import profundo desde otra capa
- **WHEN** se inspeccionan los imports de `app` hacia `pages` y `shared`
- **THEN** todos apuntan a la raíz del slice o del segmento (`@/pages/<slice>`, `@/shared/<segmento>`), no a archivos internos

#### Scenario: Slice sin API pública
- **WHEN** existe una carpeta de slice en `features` (o `pages`, o `entities`) sin `index.ts`
- **THEN** la suite de tests de arquitectura falla nombrando esa carpeta

#### Scenario: Segmento de shared sin API pública
- **WHEN** existe un segmento de `shared` sin `index.ts`
- **THEN** la suite de tests de arquitectura falla nombrando ese segmento

#### Scenario: Base actual conforme
- **WHEN** se ejecuta la suite de arquitectura sobre el código actual
- **THEN** pasa: todos los slices y segmentos tienen su `index.ts`

## ADDED Requirements

### Requirement: Imagen de producción del frontend
El frontend SHALL poder construirse como sitio estático con un comando de build declarado en `frontend/package.json`, y su `Dockerfile` SHALL ofrecer un objetivo de producción que sirva ese build sin el servidor de desarrollo de Vite, recibiendo `VITE_API_URL` en tiempo de construcción. El objetivo de desarrollo actual SHALL seguir siendo el que usa `docker-compose.yml` por defecto.

#### Scenario: Script de build declarado
- **WHEN** se leen los scripts de `frontend/package.json`
- **THEN** existe `build` y su comando valida tipos y genera el sitio estático

#### Scenario: Objetivo de producción
- **WHEN** se lee `frontend/Dockerfile`
- **THEN** declara un objetivo de producción que copia el resultado del build a un servidor estático y no ejecuta `npm run dev`

#### Scenario: Rutas del cliente en producción
- **WHEN** el servidor estático de producción recibe `/mis-pedidos` directamente
- **THEN** responde con la aplicación (no con 404), para que el enrutado del cliente resuelva la ruta

#### Scenario: Compose de desarrollo intacto
- **WHEN** se lee la configuración resuelta de Docker Compose sin perfiles adicionales
- **THEN** el servicio `frontend` sigue sirviendo el modo desarrollo en el puerto 5173

### Requirement: Ícono de la aplicación
La aplicación SHALL declarar un ícono de pestaña derivado del logo del design system (`design-system/assets/`), de modo que el navegador no pida `/favicon.ico` ni registre un 404. Mientras el logo sea provisional, el ícono SHALL serlo también y reemplazarse desde el mismo asset.

#### Scenario: Sin 404 de favicon
- **WHEN** se abre cualquier página de la aplicación
- **THEN** la consola del navegador no muestra un error de `/favicon.ico` y la pestaña muestra el ícono de Food Store
