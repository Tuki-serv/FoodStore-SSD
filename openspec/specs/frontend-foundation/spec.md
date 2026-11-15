# frontend-foundation Specification

## Purpose
Define la base técnica verificable del frontend de Food Store: organización en capas Feature-Sliced Design con fronteras de import, TypeScript estricto sin `any`, tokens del design system como única fuente visual, configuración por variables de entorno explícitas y entorno de desarrollo y de tests reproducible.

## Requirements

### Requirement: Capas Feature-Sliced Design con imports hacia abajo
El código del frontend SHALL organizarse en las capas FSD `app`, `pages`, `widgets`, `features`, `entities` y `shared` (solo las que tengan contenido). Un módulo SHALL importar únicamente de capas estrictamente inferiores, y no SHALL importar otro slice de su misma capa.

#### Scenario: Import hacia una capa superior
- **WHEN** se inspeccionan los imports de todos los archivos de `shared` y `pages`
- **THEN** ningún archivo de `shared` importa de `pages` o `app`, y ningún archivo de `pages` importa de `app`

#### Scenario: Cross-import entre páginas
- **WHEN** se inspeccionan los imports de cada slice de `pages`
- **THEN** ninguno importa otro slice de `pages`

### Requirement: API pública por slice
Cada slice SHALL exponer su API pública en un `index.ts` y cada segmento de `shared` SHALL tener el suyo. Los imports entre capas SHALL pasar por esa API pública, nunca por archivos internos.

#### Scenario: Import profundo desde otra capa
- **WHEN** se inspeccionan los imports de `app` hacia `pages` y `shared`
- **THEN** todos apuntan a la raíz del slice o del segmento (`@/pages/<slice>`, `@/shared/<segmento>`), no a archivos internos

### Requirement: TypeScript estricto sin `any`
El frontend SHALL compilar con TypeScript en modo `strict` sin errores, y el código fuente no SHALL usar el tipo `any` explícito. Los componentes SHALL nombrarse en PascalCase.

#### Scenario: Chequeo de tipos
- **WHEN** se ejecuta el chequeo de tipos del frontend
- **THEN** termina sin errores con `strict` activo

#### Scenario: Uso de `any`
- **WHEN** se ejecuta el linter del frontend
- **THEN** reporta como error cualquier `any` explícito y la base actual no tiene ninguno

### Requirement: Tokens del design system como única fuente visual
El frontend SHALL cargar `design-system/tokens.css` del repositorio sin copiarlo, y cada color, tipografía, espaciado, radio, sombra y duración del tema de utilidades CSS SHALL referenciar una variable definida en ese archivo, sin valores literales.

#### Scenario: Tema mapeado a variables existentes
- **WHEN** se comparan los valores del tema de utilidades con las variables declaradas en `design-system/tokens.css`
- **THEN** cada valor es una referencia `var(--…)` a una variable que existe en ese archivo

#### Scenario: Cambio de un token
- **WHEN** se modifica el valor de `--color-primary` en `design-system/tokens.css`
- **THEN** el frontend muestra el nuevo color sin editar ningún archivo de `frontend/`

### Requirement: Configuración explícita por variables `VITE_*`
El frontend SHALL leer su configuración de variables de entorno `VITE_*` explícitas, sin valores por defecto ocultos, en un único módulo. `VITE_API_URL` (URL base del backend) SHALL ser obligatoria; si falta o está vacía, el arranque SHALL fallar con un error que la nombre.

#### Scenario: Variable presente
- **WHEN** el frontend arranca con `VITE_API_URL=http://localhost:8000`
- **THEN** la configuración expone esa URL tal cual

#### Scenario: Variable ausente
- **WHEN** el frontend arranca sin `VITE_API_URL` o con valor vacío
- **THEN** el arranque falla con un error cuyo mensaje contiene `VITE_API_URL`

### Requirement: Plantilla de entorno del frontend
El repo SHALL incluir `frontend/.env.example` con todas las variables que lee el frontend, con placeholders no sensibles y un comentario por variable; `frontend/.env` no SHALL versionarse. Las variables `VITE_*` no SHALL agregarse al `.env.example` de la raíz.

#### Scenario: Plantilla completa
- **WHEN** se comparan las variables que lee el módulo de configuración con las claves de `frontend/.env.example`
- **THEN** coinciden exactamente

#### Scenario: Raíz sin variables del frontend
- **WHEN** se inspecciona el `.env.example` de la raíz
- **THEN** sigue conteniendo solo variables `POSTGRES_*` y `PGADMIN_*`

### Requirement: Suite de tests del frontend
El frontend SHALL tener una suite de tests de componentes en un DOM simulado que se ejecute con un único comando desde `frontend/`, sin backend ni red, y que pruebe el comportamiento por lo que el usuario ve y hace (roles accesibles, texto, interacción).

#### Scenario: Corrida sin backend
- **WHEN** se ejecutan los tests del frontend sin backend levantado
- **THEN** la suite completa pasa

### Requirement: Servicio de desarrollo del frontend en Docker Compose
El `docker-compose.yml` de la raíz SHALL declarar un servicio `frontend` que sirva el frontend en modo desarrollo en el puerto 5173 del host, con su configuración tomada de `frontend/.env`, y con acceso a `design-system/` del repo.

#### Scenario: Servicio declarado
- **WHEN** se lee la configuración resuelta de Docker Compose
- **THEN** existe el servicio `frontend` que publica el puerto 5173, toma `frontend/.env` y monta `design-system/` en solo lectura

#### Scenario: Servicios existentes intactos
- **WHEN** se lee la configuración resuelta de Docker Compose
- **THEN** los servicios `db`, `pgadmin` y `backend` conservan su imagen, puertos, variables y dependencias
