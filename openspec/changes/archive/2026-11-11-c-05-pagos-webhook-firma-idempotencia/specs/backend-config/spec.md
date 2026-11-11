# Spec Delta

## MODIFIED Requirements

### Requirement: Integraciones opcionales no son necesarias para arrancar
Las variables de integraciones opcionales SHALL ser opcionales. Son las de pagos con MercadoPago (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL`, `MP_WEBHOOK_SECRET`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`) y las de imágenes con Cloudinary (`CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). La configuración, la app y la suite de tests SHALL poder iniciarse sin ellas.

#### Scenario: Arranque sin MercadoPago ni Cloudinary
- **WHEN** se carga la configuración con todas las obligatorias y sin ninguna variable `MP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` ni `CLOUDINARY_*`
- **THEN** la carga es exitosa y todas esas variables valen vacío

#### Scenario: Faltante obligatoria sigue fallando con integraciones presentes
- **WHEN** se carga la configuración con todas las variables de integraciones definidas pero sin `SECRET_KEY`
- **THEN** la carga falla con un error que menciona `SECRET_KEY`

### Requirement: Variables de MercadoPago con nombres de la spec
La configuración SHALL leer `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL` y `MP_WEBHOOK_SECRET` como opcionales. Si se definen, SHALL usarse exactamente el valor provisto. `MP_NOTIFICATION_URL` es la URL completa del webhook. `MP_WEBHOOK_SECRET` es la clave secreta con la que MercadoPago firma las notificaciones del webhook; es un secreto y solo SHALL vivir en el entorno, nunca en el repositorio.

#### Scenario: MP_NOTIFICATION_URL provista
- **WHEN** se carga la configuración con `MP_NOTIFICATION_URL=https://abc.ngrok-free.app/api/v1/pagos/webhook`
- **THEN** la URL de notificación efectiva es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET provista
- **WHEN** se carga la configuración con `MP_WEBHOOK_SECRET=secreto-de-prueba`
- **THEN** la clave secreta efectiva del webhook es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET documentada sin valor real
- **WHEN** se inspecciona `backend/.env.example`
- **THEN** contiene la clave `MP_WEBHOOK_SECRET` con un placeholder evidentemente falso
