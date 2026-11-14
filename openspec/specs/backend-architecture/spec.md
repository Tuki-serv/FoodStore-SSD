# backend-architecture Specification

## Purpose
Define las reglas verificables de la arquitectura del backend de Food Store (capas, fronteras entre paquetes, estructura de módulos de la spec `[INT]`) y las garantías de calidad que acompañan cualquier reorganización: contrato HTTP invariante, cobertura mínima y prueba end-to-end del flujo de compra.

## Requirements

### Requirement: Los routers no acceden a datos
Los routers HTTP y WebSocket del backend SHALL obtener sus services por inyección de dependencias y no SHALL importar la sesión de base de datos, el motor ORM, repositorios, unidades de trabajo ni modelos de tabla. La consulta y la validación de propiedad de recursos SHALL ocurrir en el service.

#### Scenario: Router de catálogo
- **WHEN** se inspeccionan los imports del router de categorías, productos, ingredientes o unidades de medida
- **THEN** ninguno importa la sesión de base de datos, el ORM, un repositorio, una unidad de trabajo ni un modelo de tabla

#### Scenario: WebSocket de pedidos
- **WHEN** un cliente se suscribe al canal de un pedido que no es suyo
- **THEN** la conexión se cierra con código 1008 y la verificación de propiedad la resolvió el service, no el router

### Requirement: Dependencia unidireccional entre capas
Cada capa SHALL depender solo de las inferiores en el orden `models ← repository ← unidad de trabajo ← service ← router`. Un repositorio no SHALL importar schemas de API, services ni routers; una unidad de trabajo no SHALL importar services ni routers; un service no SHALL importar routers.

#### Scenario: Repositorio de pedidos con filtros
- **WHEN** se inspeccionan los imports de cualquier repositorio del backend
- **THEN** ninguno importa un módulo de schemas, service o router

#### Scenario: Service sin router
- **WHEN** se inspeccionan los imports de cualquier service del backend
- **THEN** ninguno importa un router

### Requirement: Capas inferiores independientes del framework web
Los modelos, repositorios, unidades de trabajo y services SHALL estar libres del framework HTTP: no SHALL importarlo ni depender de su inyección de dependencias. Los errores de negocio SHALL expresarse con el error de dominio de la aplicación, que el borde HTTP traduce al formato único `{detail, code, field}`.

#### Scenario: Service lanza un error de negocio
- **WHEN** se inspeccionan los imports de cualquier service, repositorio, unidad de trabajo o modelo
- **THEN** ninguno importa el framework HTTP

#### Scenario: Recurso inexistente tras la migración de errores
- **WHEN** un `ADMIN` hace `GET /api/v1/categorias/999999`
- **THEN** recibe 404 con `code` `HTTP_404` y el mismo `detail` que antes de la reorganización

### Requirement: El núcleo no depende de los módulos de negocio
El paquete `core` (configuración, base de datos, seguridad, unidad de trabajo base, repositorio y service genéricos, paginación, errores, integraciones) SHALL ser independiente de los módulos de negocio: no SHALL importar nada de `modules`.

#### Scenario: Imports del núcleo
- **WHEN** se inspeccionan los imports de todos los archivos de `app/core`
- **THEN** ninguno importa de `app.modules`

### Requirement: Estructura de módulos de la spec
El backend SHALL organizar sus módulos de negocio en `auth`, `refreshtokens`, `usuarios`, `direcciones`, `categorias`, `productos`, `pedidos`, `pagos` y `admin`, más los extras conservados `ingredientes`, `unidades_medida` y `health`, y la unidad de trabajo base SHALL vivir en `app/core/uow.py`.

#### Scenario: Módulos presentes
- **WHEN** se listan los paquetes de `app/modules`
- **THEN** el conjunto es exactamente el de la estructura objetivo más los extras conservados

#### Scenario: Unidad de trabajo base
- **WHEN** se busca la unidad de trabajo base
- **THEN** existe `app/core/uow.py` y no existe `app/core/unit_of_work.py`

### Requirement: Reorganizar el código no cambia el contrato HTTP ni el esquema
Mover o renombrar módulos SHALL dejar idéntico el conjunto de rutas expuestas (método y path), y SHALL dejar intactos los nombres de tablas y la cabeza de migraciones.

#### Scenario: Rutas tras la reorganización
- **WHEN** se compara el conjunto de pares método–path de la aplicación con el registrado antes de la reorganización
- **THEN** ambos conjuntos son iguales

#### Scenario: Esquema tras la reorganización
- **WHEN** se compara el esquema migrado con los modelos después de la reorganización
- **THEN** no hay diferencias y no se agregó ninguna migración

### Requirement: Cobertura mínima de tests
La suite del backend SHALL cubrir más del 60% de las líneas del paquete `app` y SHALL fallar si la cobertura total queda por debajo de ese umbral. Cada módulo evaluado por la rúbrica (auth, pedidos, pagos, categorías, direcciones, ingredientes, productos, estadísticas) SHALL superar también el 60%.

#### Scenario: Corrida con cobertura
- **WHEN** se ejecuta la suite completa con medición de cobertura desde `backend/`
- **THEN** el informe muestra una cobertura total mayor al 60% y la corrida no falla por umbral

#### Scenario: Módulo por debajo del umbral
- **WHEN** la cobertura total queda por debajo del 60%
- **THEN** la corrida con medición de cobertura termina con error

### Requirement: Prueba end-to-end del flujo de compra
El backend SHALL tener una prueba automatizada que recorra por la API el flujo compra→pago→entrega: un cliente crea un pedido, lo paga con MercadoPago (solo el SDK reemplazado por un doble), el pago aprobado lo confirma y descuenta stock, y los gestores lo llevan hasta `ENTREGADO`.

#### Scenario: Pedido pagado y entregado
- **WHEN** un `CLIENT` crea un pedido con forma de pago `MERCADOPAGO`, el pago queda aprobado y un gestor lo avanza por `EN_PREP` y `EN_CAMINO` hasta `ENTREGADO`
- **THEN** el pedido termina en `ENTREGADO`, su historial registra en orden `PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `EN_CAMINO` y `ENTREGADO`, y el stock del producto bajó en la cantidad comprada una sola vez
