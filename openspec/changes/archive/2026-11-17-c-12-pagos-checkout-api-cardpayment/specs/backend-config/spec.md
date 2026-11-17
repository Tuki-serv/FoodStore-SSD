## MODIFIED Requirements

### Requirement: Toda variable es explícita
Cada valor de configuración que use el backend SHALL provenir de una variable de entorno propia, declarada en la configuración y documentada en `.env.example`. Ningún valor efectivo SHALL derivarse ni construirse a partir de otras variables, sin excepciones.

#### Scenario: Una variable no altera a otra
- **WHEN** se carga la configuración con `MP_WEBHOOK_SECRET=secreto-de-prueba` y `MP_PUBLIC_KEY=TEST-clave-publica`
- **THEN** la clave secreta del webhook es `secreto-de-prueba` y la clave pública es `TEST-clave-publica`

### Requirement: Integraciones opcionales no son necesarias para arrancar
Las variables de integraciones opcionales SHALL ser opcionales. Son las de pagos con MercadoPago (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`) y las de imágenes con Cloudinary (`CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). La configuración, la app y la suite de tests SHALL poder iniciarse sin ellas.

#### Scenario: Arranque sin MercadoPago ni Cloudinary
- **WHEN** se carga la configuración con todas las obligatorias y sin ninguna variable `MP_*` ni `CLOUDINARY_*`
- **THEN** la carga es exitosa y todas esas variables valen vacío

#### Scenario: Faltante obligatoria sigue fallando con integraciones presentes
- **WHEN** se carga la configuración con todas las variables de integraciones definidas pero sin `SECRET_KEY`
- **THEN** la carga falla con un error que menciona `SECRET_KEY`

### Requirement: Variables de MercadoPago con nombres de la spec
La configuración SHALL leer `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` y `MP_WEBHOOK_SECRET` como opcionales. Si se definen, SHALL usarse exactamente el valor provisto. `MP_WEBHOOK_SECRET` es la clave secreta con la que MercadoPago firma las notificaciones del webhook (la genera el panel al configurar el Webhook con el evento de órdenes); es un secreto y solo SHALL vivir en el entorno, nunca en el repositorio. La URL del webhook no es una variable del backend: se configura en el panel de MercadoPago, porque la Orders API no admite una URL de notificación por pedido.

#### Scenario: MP_NOTIFICATION_URL provista
- **WHEN** se carga la configuración con `MP_NOTIFICATION_URL=https://abc.ngrok-free.app/api/v1/pagos/webhook`
- **THEN** la carga es exitosa y la configuración no expone `MP_NOTIFICATION_URL` (variable retirada)

#### Scenario: MP_ACCESS_TOKEN provista
- **WHEN** se carga la configuración con `MP_ACCESS_TOKEN=TEST-token-de-prueba`
- **THEN** el access token efectivo es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET provista
- **WHEN** se carga la configuración con `MP_WEBHOOK_SECRET=secreto-de-prueba`
- **THEN** la clave secreta efectiva del webhook es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET documentada sin valor real
- **WHEN** se inspecciona `backend/.env.example`
- **THEN** contiene la clave `MP_WEBHOOK_SECRET` con un placeholder evidentemente falso

### Requirement: Variables retiradas
La configuración no SHALL leer `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`, las variables del redirect de Checkout Pro `BACKEND_PUBLIC_URL` y `FRONTEND_URL` (retiradas por C-12), `MP_NOTIFICATION_URL` (retirada por C-12 al pasar a la Orders API, que no admite URL de notificación por pedido) ni las variables de rate limiting `RATE_LIMIT_DEFAULT_PER_MINUTE`, `RATE_LIMIT_DEFAULT_BURST`, `RATE_LIMIT_AUTH_PER_MINUTE` y `RATE_LIMIT_AUTH_BURST` (retiradas por C-03), y no SHALL requerir `VITE_API_URL`. Si alguna está presente en el entorno, no SHALL alterar ningún valor efectivo.

#### Scenario: Arranque sin variables retiradas
- **WHEN** se carga la configuración con todas las variables obligatorias y sin `VITE_API_URL`, `VITE_FRONTEND_URL`, `NGROK_URL`, `MP_WEBHOOK_URL`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` ni `MP_NOTIFICATION_URL`
- **THEN** la carga es exitosa

#### Scenario: Variables retiradas presentes no afectan valores
- **WHEN** se carga la configuración completa más `NGROK_URL=https://viejo.example`, `VITE_FRONTEND_URL=https://viejo-front.example`, `BACKEND_PUBLIC_URL=https://b.example`, `FRONTEND_URL=https://tienda.example` y `MP_NOTIFICATION_URL=https://a.example/api/v1/pagos/webhook`
- **THEN** la carga es exitosa, la clave secreta del webhook es exactamente la provista en `MP_WEBHOOK_SECRET` y la configuración no expone `BACKEND_PUBLIC_URL`, `FRONTEND_URL` ni `MP_NOTIFICATION_URL`

#### Scenario: Variables retiradas no rellenan opcionales ausentes
- **WHEN** se carga la configuración con `NGROK_URL=https://viejo.example` y `MP_NOTIFICATION_URL=https://a.example/api/v1/pagos/webhook`, sin `MP_ACCESS_TOKEN`
- **THEN** `MP_ACCESS_TOKEN` vale vacío

#### Scenario: Variables de rate limiting presentes no afectan
- **WHEN** se carga la configuración completa más `RATE_LIMIT_AUTH_PER_MINUTE=1` y `RATE_LIMIT_DEFAULT_BURST=1`
- **THEN** la carga es exitosa y la configuración no expone ninguna variable `RATE_LIMIT_*`

### Requirement: `.env.example` documenta el contrato
El repo SHALL incluir un `.env.example` con todas las variables de la configuración, con placeholders evidentemente falsos y no sensibles, más un comentario por variable. Toda variable de la configuración SHALL aparecer en `.env.example`. Las claves extra solo SHALL existir en bloques rotulados de docker-compose (`POSTGRES_*`, `PGADMIN_*`, con la advertencia de mantener `DATABASE_URL` consistente) y de frontend (`VITE_*`). No SHALL contener secretos reales ni variables retiradas.

#### Scenario: El ejemplo es cargable
- **WHEN** se carga la configuración usando solo los valores de `.env.example`
- **THEN** la carga es exitosa

#### Scenario: Cobertura completa de variables
- **WHEN** se comparan las claves de `.env.example` con las variables declaradas en la configuración
- **THEN** toda variable declarada aparece en `.env.example`, y toda clave extra pertenece a un bloque rotulado de docker-compose o de frontend. Las variables de docker-compose (`POSTGRES_*`, `PGADMIN_*`) viven en el `.env.example` de la raíz (design D10), que contiene exactamente esas claves y no se valida contra la configuración

#### Scenario: Sin variables retiradas en el ejemplo
- **WHEN** se inspeccionan las claves de `.env.example`
- **THEN** no aparece ninguna de `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`, `MP_NOTIFICATION_URL` ni ninguna `RATE_LIMIT_*`

## REMOVED Requirements

### Requirement: URLs explícitas del flujo de pago actual
**Reason**: Checkout Pro se retira (DT-01, DD-21): el cobro con token de tarjeta no usa `back_urls` ni un redirect post-pago, así que `BACKEND_PUBLIC_URL` y `FRONTEND_URL` no tienen uso.
**Migration**: Borrar `BACKEND_PUBLIC_URL` y `FRONTEND_URL` del `.env` local. Con la Orders API tampoco se usa `MP_NOTIFICATION_URL`: la URL del webhook se configura en el panel de MercadoPago (evento «Order (Mercado Pago)»); el frontend (C-20) muestra el resultado del pago con la respuesta de `POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}`.
