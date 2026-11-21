# Proposal — C-25b1 `deuda-heredada`

## Why

C-25b (entrega) congela el estado final del proyecto en capturas y en el **video obligatorio**, así que la deuda heredada de C-13a, C-15, C-19 y C-22 que afecta a seguridad, integridad o a lo que se ve en pantalla tiene que cerrarse **antes**. Una de ellas es de autorización: hoy un cliente puede crear un pedido apuntando a la dirección de otro usuario (IDOR). Este change nace de partir el C-25b original (OQ-9, partición aprobada por el usuario 2026-11-21): aquí va el código con TDD (bloque A); la documentación y la evidencia de entrega quedan en `c-25b-entrega-docs-video`, que depende de que este se archive primero.

## What Changes

- `POST /api/v1/pedidos/`: valida que `direccion_id` exista, esté activa y pertenezca al usuario (C-19 R3, **gobernanza CRÍTICO**: espera OK explícito antes de escribir código).
- `POST /api/v1/pedidos/`: valida que cada id de `personalizacion` sea un ingrediente removible del producto (C-19 R4).
- `POST /api/v1/pedidos/`: todos los rechazos llevan un `code` estable y el `field` de la línea o campo afectado (`PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `PAYMENT_METHOD_UNAVAILABLE`, `DUPLICATE_ITEM`, `ADDRESS_NOT_FOUND`, `INVALID_CUSTOMIZATION`), sin cambiar los status HTTP actuales (C-19 R1).
- Frontend: `clasificarErrorCreacion` decide por `code` y no por el texto de `detail`.
- Base de datos: índice único parcial que garantiza una sola dirección principal activa por usuario (C-15 R3), con migración Alembic `007` (tratada como **ALTO**: se muestra el SQL antes de aplicarla a una base con datos).
- Frontend: drawer mobile como diálogo modal accesible (`role="dialog"`, `aria-modal`, trampa de foco, contenido detrás `inert`) (C-13a).
- Frontend: test de arquitectura que exige `index.ts` en cada slice y segmento FSD; test de `readConfig` que distingue valor vacío de URL inválida; título del 404 en mobile igual al mockup aprobado (C-13a).
- Frontend: imagen de producción (Dockerfile multi-stage con target `prod` que sirve el build estático) y script `build` en `package.json` (C-13a).
- Design system: sincronizar el sprite de `design-system/components.html` con los íconos que usa `shared/ui/icon` y sumar el favicon derivado del logo provisional → **Revision 3**, que requiere revisión del usuario (C-13a, C-15, C-22).
- Swagger `/docs`: cada endpoint con `summary`, `tags` y respuestas de error documentadas (US-030, CE-08).

**Fuera de alcance (diferido, ver design.md)**: idempotencia de creación de pedidos (C-19 R2), envío $0 en retiro (C-22 R1, bloqueado por PA-13), filtros multi-estado / búsqueda / zona horaria del listado de gestión (C-22 R2, R6, OQ-7 de C-22), quitar la escala por defecto de Tailwind, endpoint de formas de pago y datos bancarios (C-19 OQ-2/OQ-5, ya resueltos por defecto), COCINA/KDS/WebSocket (PA-07, C-26/C-27). README, `.env.example`, E2E con frontend, capturas, checklist y video: `c-25b-entrega-docs-video`.

## Capabilities

### New Capabilities
- `address-integrity`: garantías de integridad de las direcciones de entrega en la base (una sola principal activa por usuario).

### Modified Capabilities
- `order-api`: la creación de pedidos valida la propiedad de la dirección y la personalización, y sus rechazos llevan código estable y campo afectado.
- `api-conventions`: se amplía la lista de códigos de error de negocio con los de creación de pedidos.
- `frontend-checkout`: los errores de creación se clasifican por `code` del servidor; se suman los casos de dirección y personalización inválidas.
- `frontend-app-shell`: el drawer mobile se comporta como diálogo modal (rol, `aria-modal`, foco atrapado, fondo inerte).
- `frontend-foundation`: API pública obligatoria verificada en cada slice/segmento, imagen de producción del frontend e ícono de la app.
- `backend-runtime`: la documentación OpenAPI (`/docs`) describe todos los endpoints de negocio.

## Impact

- **Backend**: `app/modules/pedidos/service.py` (creación), `app/core/errors.py` (`ErrorCode`), routers (metadatos OpenAPI), `app/modules/direcciones/models.py` + migración `alembic/versions/007_*.py`; tests de integración nuevos en `backend/tests/integration/`.
- **Frontend**: `entities/pedido/model/clasificar-error.ts`, `app/layouts/app-shell/`, `pages/not-found/`, `shared/config` (test), `tests/architecture/`, `Dockerfile`, `package.json`, `index.html`, `frontend/README.md`.
- **Design system**: `design-system/components.html`, `README.md` (Revision 3, aprobación pendiente), `assets/favicon.svg`, `design-system/previews/`.
- **Infra/docs**: `docker-compose.yml` (`target: dev`, perfil `prod`), `knowledge-base/04` y `05` (índice de principal), `CHANGES.md`.
- **Sin cambios** de contrato de éxito de la API; los status HTTP de error se conservan y el cuerpo suma `code`/`field` (aditivo). Una migración nueva (`007`).
