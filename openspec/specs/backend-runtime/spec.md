# backend-runtime Specification

## Purpose

Define cómo arranca la API de Food Store, qué superficie HTTP expone al iniciar (rutas versionadas, documentación OpenAPI, CORS, formato de errores) y cómo se verifica que el proceso está vivo.

## Requirements

### Requirement: La aplicación arranca desde el paquete `app`
El backend SHALL poder iniciarse con `uvicorn app.main:app`. El módulo de entrada SHALL exponer una instancia ASGI lista para servir y una factory que construya una instancia nueva con la misma configuración. Ningún punto de entrada SHALL depender de archivos en la raíz del repo.

#### Scenario: Arranque con el módulo del paquete
- **WHEN** se importa `app.main` con una configuración válida
- **THEN** expone una aplicación ASGI y la factory devuelve una instancia nueva cada vez que se invoca

#### Scenario: Documentación OpenAPI disponible
- **WHEN** un cliente hace `GET /openapi.json` sobre la aplicación arrancada
- **THEN** recibe 200 con un documento OpenAPI cuyo título es `FoodStoreAPI`

### Requirement: Rutas de negocio montadas bajo `/api/v1`
La aplicación SHALL montar los routers de negocio (auth, usuarios, admin, direcciones, categorías, productos, ingredientes, unidades de medida, imágenes, pedidos, estadísticas, pagos) bajo el prefijo `/api/v1`, con los paths y métodos del contrato vigente que definen las capacidades de cada recurso (`order-api` para pedidos, `product-ingredients`, `api-conventions`). Las rutas retiradas por ese contrato no SHALL seguir respondiendo como antes.

#### Scenario: Ruta pública de catálogo accesible
- **WHEN** un cliente sin autenticación hace `GET /api/v1/productos/`
- **THEN** la respuesta no es 404 y tiene la forma paginada `{items, total, page, size, pages}`

#### Scenario: Ruta inexistente
- **WHEN** un cliente hace `GET /api/v1/no-existe`
- **THEN** recibe 404 con cuerpo JSON en el formato de error de la API (`detail`, `code`)

#### Scenario: Ruta retirada de pedidos
- **WHEN** un `CLIENT` autenticado hace `PATCH /api/v1/pedidos/mis-pedidos/1/cancelar`
- **THEN** no recibe 200 y el cuerpo tiene el formato de error de la API

### Requirement: Endpoint de salud
La aplicación SHALL exponer `GET /health`, fuera de `/api/v1`. No SHALL requerir autenticación ni consultar la base de datos. SHALL responder 200 con `{"status": "ok"}` y no SHALL estar sujeto a rate limiting.

#### Scenario: Health responde OK
- **WHEN** un cliente sin credenciales hace `GET /health`
- **THEN** recibe 200 con cuerpo `{"status": "ok"}`

#### Scenario: Health no consume cupo de rate limiting
- **WHEN** un cliente hace 100 requests seguidas a `GET /health`, incluso desde una IP bloqueada en el login
- **THEN** todas las respuestas son 200 y ninguna es 429

### Requirement: CORS según configuración
La aplicación SHALL aceptar credenciales en CORS solo para los orígenes listados en `CORS_ORIGINS`. Un origen ausente de la lista no SHALL recibir cabeceras CORS que lo habiliten.

#### Scenario: Origen permitido
- **WHEN** llega un preflight `OPTIONS` con `Origin` incluido en `CORS_ORIGINS`
- **THEN** la respuesta incluye `access-control-allow-origin` con ese origen y `access-control-allow-credentials: true`

#### Scenario: Origen no permitido
- **WHEN** llega un preflight `OPTIONS` con un `Origin` que no está en `CORS_ORIGINS`
- **THEN** la respuesta no incluye `access-control-allow-origin` para ese origen

### Requirement: Arranque sin integraciones opcionales
La aplicación SHALL arrancar y servir sus rutas de catálogo, auth, pedidos y salud sin MercadoPago ni Cloudinary configurados. Ningún módulo SHALL requerir credenciales de esas integraciones al importarse.

#### Scenario: App arranca sin MP ni Cloudinary
- **WHEN** se arranca la aplicación con todas las variables obligatorias y sin `MP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` ni `CLOUDINARY_*`
- **THEN** `GET /health` responde 200 y `GET /api/v1/productos/` no falla por configuración faltante

### Requirement: Subida de imágenes sin Cloudinary configurado
Si falta alguna de `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY` o `CLOUDINARY_API_SECRET`, una subida de imagen SHALL responder 503 en el formato de error de la API, con un `detail` que indique que el servicio de imágenes no está configurado. No SHALL contactarse a Cloudinary.

#### Scenario: Upload sin credenciales
- **WHEN** un ADMIN sube una imagen válida y Cloudinary no está configurado
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que menciona que el servicio de imágenes no está configurado

#### Scenario: Upload con credenciales
- **WHEN** un ADMIN sube una imagen válida con las tres variables `CLOUDINARY_*` definidas
- **THEN** la subida se delega al proveedor con esas credenciales y devuelve la URL y el `public_id` resultantes

### Requirement: Borrado de imágenes sin Cloudinary configurado
Sin Cloudinary configurado, la eliminación de imágenes SHALL ser un no-op: registra una advertencia y reporta que no se eliminó. Nunca SHALL hacer fallar la operación de negocio que la invoca, por ejemplo el soft delete de un producto.

#### Scenario: Soft delete de producto sin Cloudinary
- **WHEN** un ADMIN elimina un producto con imágenes y Cloudinary no está configurado
- **THEN** recibe 204, el producto queda eliminado lógicamente y no se contacta a Cloudinary

### Requirement: Pagos sin MercadoPago configurado
Si falta una variable de pagos que la operación necesita (crear pago: `MP_ACCESS_TOKEN`), SHALL responder 503 en el formato de error de la API (`{detail, code, field}`, `code` `HTTP_503`), nombrando la variable faltante, sin crear pagos y sin contactar a MercadoPago. La URL de notificaciones no es una variable del backend: se configura en el panel de MercadoPago (Orders API).

#### Scenario: Crear pago sin token
- **WHEN** el propietario autenticado de un pedido `MERCADOPAGO` en `PENDIENTE` solicita crear su pago y `MP_ACCESS_TOKEN` no está definida
- **THEN** recibe 503 con `code` `HTTP_503`, `field` nulo y un `detail` que indica que MercadoPago no está configurado y menciona `MP_ACCESS_TOKEN`; no se crea ninguna fila en `pagos`

#### Scenario: Crear pago sin URL de notificación
- **WHEN** el propietario de un pedido `MERCADOPAGO` en `PENDIENTE` solicita crear su pago con `MP_ACCESS_TOKEN` definida y sin `MP_NOTIFICATION_URL` en el entorno
- **THEN** no recibe 503 y el backend contacta a MercadoPago para crear la orden

#### Scenario: Redirect sin FRONTEND_URL
- **WHEN** llega un `GET /api/v1/pagos/redirect/{pedido_id}/{status}` (ruta de Checkout Pro, retirada junto con `FRONTEND_URL`)
- **THEN** recibe 404 con `code` `HTTP_404`, no 503

### Requirement: Orden del 503 al crear un pago
Al crear un pago, el 503 por falta de configuración de MercadoPago SHALL evaluarse después de la autenticación, del acceso al pedido y de las precondiciones de cobro (`payment-api`): sin acceso es 401, 403 o 404, y un pedido que no se puede cobrar es 409.

#### Scenario: Usuario sin acceso y MercadoPago sin configurar
- **WHEN** `MP_ACCESS_TOKEN` no está definida y un cliente que no es el dueño del pedido solicita crear su pago
- **THEN** recibe 403 y no se informa nada sobre la configuración de MercadoPago

### Requirement: Errores de validación con formato uniforme
Cuando un request falla la validación de entrada, la aplicación SHALL responder 422 con cuerpo JSON en el formato de error de la API actual (`detail`, `code`, `field`).

#### Scenario: Cuerpo inválido
- **WHEN** un cliente envía a `POST /api/v1/auth/register` un cuerpo sin campos obligatorios
- **THEN** recibe 422 con un JSON que contiene `detail` y `code`

### Requirement: Swagger documenta todos los endpoints de negocio
La documentación OpenAPI servida en `/docs` y `/openapi.json` SHALL describir cada operación bajo `/api/v1` con un `summary` en español, al menos un `tag` del recurso, el esquema de su respuesta exitosa y las respuestas de error de negocio que puede devolver (401, 403, 404, 409 o 422 según corresponda) con el formato de error de la API. Las operaciones que requieren sesión SHALL declarar el esquema de seguridad Bearer.

#### Scenario: Operación sin resumen
- **WHEN** se recorre `/openapi.json` y alguna operación bajo `/api/v1` no tiene `summary` o `tags`
- **THEN** el test de documentación falla nombrando el método y la ruta

#### Scenario: Errores documentados
- **WHEN** se lee en `/openapi.json` la operación `POST /api/v1/pedidos/`
- **THEN** documenta la respuesta 201 con el detalle del pedido y las respuestas 400, 401, 403, 404 y 422 con el formato `{detail, code, field}`

#### Scenario: Seguridad declarada
- **WHEN** se lee la operación `GET /api/v1/pedidos`
- **THEN** declara el esquema de seguridad Bearer, y `GET /api/v1/categorias/arbol` (catálogo público, sin autenticación obligatoria) no lo exige

#### Scenario: Swagger UI disponible
- **WHEN** un cliente hace `GET /docs` sobre la aplicación arrancada
- **THEN** recibe 200 con la interfaz de Swagger UI
