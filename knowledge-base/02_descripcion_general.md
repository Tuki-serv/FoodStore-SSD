# Descripción General

## Stack tecnológico

| Capa | Tecnología | Versión (spec `[INT]`) | Notas |
|------|-----------|------------------------|-------|
| Frontend | React + TypeScript | 18.x + 5.x | `strict: true`, sin `any` |
| Frontend | Vite | 5.x | Bundler/dev server |
| Frontend | Tailwind CSS | 3.x | Utility-first |
| Frontend | TanStack Query | 5.x | Estado del **servidor** |
| Frontend | TanStack Form | 0.x | Formularios con validación |
| Frontend | Zustand | 4.x | Estado del **cliente** (4 stores) |
| Frontend | Axios | 1.x | Interceptors (adjuntar JWT, refresh en 401) |
| Frontend | recharts | 2.x | Gráficos del dashboard admin |
| Frontend | `@mercadopago/sdk-react` / MercadoPago.js | — | Tokenización de tarjeta (PCI SAQ-A) |
| Backend | Python | 3.10+ | |
| Backend | FastAPI | 0.111+ | REST + OpenAPI automático |
| Backend | SQLModel (SQLAlchemy + Pydantic v2) | 0.0.19+ | ORM y schemas |
| Backend | PostgreSQL | 15+ | Arrays (`INTEGER[]`, `VARCHAR[]`), CTE recursivas |
| Backend | Alembic | 1.13+ | Migraciones (ver IN-18) |
| Backend | Passlib (bcrypt) | passlib 1.7.4 / bcrypt 4.0.1 | cost factor >= 12 |
| Backend | python-jose | 3.3.0 | JWT HS256 |
| Backend | mercadopago (SDK Python) | 2.3.0+ | |
| Backend | slowapi | 0.1.10 `[INT]` | Rate limiting de login (RN-AU-08, C-03) |
| Backend | cloudinary | — | Subida de imágenes |
| Backend | pytest, httpx, pytest-asyncio, pytest-cov | | Tests con PostgreSQL 15 real, base `foodstore_test` (`backend/tests/.env.test`) |
| Infra dev | Docker Compose | | `postgres:15` (puerto host 5433) + `pgadmin4` (5050) |
| Infra dev | ngrok | | URL pública para `back_urls` y webhook MP |

## Arquitectura general

```
 ┌──────────────────────────┐        HTTPS/JSON (cookie HttpOnly o Bearer)       ┌─────────────────────────────────┐
 │ Frontend React (Vite)    │ ─────────────────────────────────────────────────▶ │ Backend FastAPI  /api/v1        │
 │ FSD: pages/features/...  │ ◀───────────────────────────────────────────────── │ Router→Service→UoW→Repo→Model   │
 │ Zustand + TanStack Query │        WebSocket (pedido / cocina)          │ Middleware: CORS + RateLimit    │
 │ MercadoPago.js           │                                                    └──────────────┬──────────────────┘
 └───────────┬──────────────┘                                                                   │ SQLModel/psycopg
             │ tokeniza tarjeta / redirect Checkout Pro                                         ▼
             ▼                                                                   ┌─────────────────────────┐
     ┌───────────────┐   POST /pagos/webhook (IPN)   ┌────────────────────┐     │ PostgreSQL 15           │
     │ MercadoPago   │ ────────────────────────────▶ │ módulo pagos       │     └─────────────────────────┘
     └───────────────┘ ◀──── GET payment (verifica)  └────────────────────┘     Cloudinary (imágenes)
```

### Backend: capas con flujo unidireccional

`Router → Service → UnitOfWork → Repository → Model`. Ninguna capa importa de la superior.

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Router | `router.py` | HTTP puro: parsear/validar con Pydantic, delegar al Service, serializar con `response_model`. Sin lógica de negocio |
| Service | `service.py` | Lógica de negocio, stateless; recibe el UoW; lanza `HTTPException`; **no** hace commit/rollback directo |
| UoW | `core/unit_of_work.py` | Context manager: `commit()` al salir sin excepción, `rollback()` si hay error; expone repositorios |
| Repository | `repository.py` | Acceso a BD sin lógica de negocio; hereda de `BaseRepository[T]` |
| Model | `model.py` | Tablas SQLModel y relaciones |

Organización **feature-first** (módulo por funcionalidad). Módulos `[INT]`: `auth`, `refreshtokens`, `usuarios`, `direcciones`, `categorias`, `productos`, `pedidos`, `pagos`, `admin`. Módulos reales del backend: `usuarios` (incluye auth/refresh/admin), `direcciones_entrega`, `categorias`, `productos`, `ingredientes`, `unidades_medida`, `pedidos`, `detalles_pedido`, `estados_pedido`, `formas_pago`, `historiales_estado_pedido`, `pagos`, `estadisticas`, más `core/` (config, deps, security, unit_of_work, repository, service, websocket, cloudinary, rate_limit, mixin de auditoría).

### Frontend: Feature-Sliced Design

Capas (de mayor a menor abstracción) `[DESC]`: `app → pages → widgets → features → entities → shared`; `[INT]` lo resume como `pages / features / components / hooks / store / api / types`. Cada capa importa solo de las inferiores; las features no se cruzan.

**Separación estricta de estados**: Zustand = estado del **cliente** (carrito, sesión, proceso de pago, UI); TanStack Query = estado del **servidor** (productos, pedidos, dashboard). Mezclarlos es un error arquitectónico.

## Integraciones externas

| Servicio | Propósito | Tipo |
|----------|-----------|------|
| MercadoPago (objetivo: Checkout API/Orders; **deuda DT-01:** Checkout Pro en el código actual) | Crear pago/preferencia, cobrar | REST vía SDK Python + MercadoPago.js en navegador |
| MercadoPago IPN | Notificación asíncrona del estado de pago | Webhook `POST /api/v1/pagos/webhook` |
| Cloudinary | Almacenar imágenes de categorías, ingredientes y productos | SDK Python (subida `multipart/form-data`) |
| ngrok | Exponer backend local para `back_urls`/webhook | Túnel HTTPS |

Detalle de pagos en [11_pagos_mercadopago.md](11_pagos_mercadopago.md).

## API REST

Prefijo `/api/v1`. Errores `{ "detail", "code", "field" }` (spec lo llama RFC 7807; ver IN-19). Docs en `/docs` y `/redoc`. Paginación: ver IN-11.

Resumen por recurso (rutas reales del backend salvo indicación; contraste con spec en [10](10_preguntas_abiertas.md)):

| Recurso | Endpoints | Acceso |
|---------|-----------|--------|
| Auth | `POST /auth/register` (201), `POST /auth/login` (form OAuth2, setea cookie), `POST /auth/refresh`, `POST /auth/logout` (204) | register/login/refresh públicos; logout autenticado. `GET /auth/me` solo en spec (en es `/usuarios/me`) |
| Usuarios | `GET /usuarios/me`, `PATCH /usuarios/me` | Autenticado |
| Admin usuarios | `POST /admin/usuarios/createUser`, `GET /admin/usuarios/` (paginado, filtro `rol_codigo`), `PATCH /{id}`, `DELETE /{id}` (soft) | `ADMIN` |
| Direcciones | `POST/GET /direcciones/`, `GET/PATCH/DELETE /direcciones/{id}`, `PATCH /{id}/principal` | Autenticado, solo propias |
| Categorías | `POST`, `PATCH/{id}`, `DELETE/{id}` (ADMIN); `GET /`, `GET /arbol`, `GET /{id}` (público) | Ver 03 |
| Productos | `GET` (público), `GET /{id}`, `POST/PUT/DELETE` (ADMIN), `PATCH /{id}/disponibilidad {disponible: bool}` y `PATCH /{id}/stock {stock_cantidad: int>=0}` (ADMIN/STOCK), `PATCH /{id}/imagenes`, `POST /{id}/ingredientes` (ADMIN), `GET /{id}/ingredientes` (público, con la visibilidad del producto; sin paginar, ordenado por nombre) y `DELETE /{id}/ingredientes/{ingrediente_id}` (ADMIN, 204) | Lectura pública solo de disponibles y no eliminados (ADMIN/STOCK ven no disponibles; solo ADMIN eliminados) |
| Ingredientes | CRUD `/ingredientes` | Escritura `ADMIN`; lectura pública |
| Unidades de medida | CRUD `/unidades-medida` | Escritura `ADMIN` |
| Uploads | `POST /uploads/imagen`, `DELETE /uploads/imagen/{public_id}` | `ADMIN` |
| Pedidos (C-11) | `POST /pedidos/`, `GET /pedidos/` (paginado; filtros `estado`, `desde`, `hasta` en UTC; CLIENT ve solo los propios, ADMIN/PEDIDOS todos), `GET /pedidos/{id}` y `GET /pedidos/{id}/historial` (dueño, ADMIN, PEDIDOS; otro cliente 403), `PATCH /pedidos/{id}/estado {nuevo_estado, motivo?}`, `DELETE /pedidos/{id}` (CLIENT cancela el propio; body **opcional** `{motivo}`, sin motivo se registra «Cancelado por el cliente»; responde 200 con el pedido), `GET /pedidos/cocina/pedidos` (paginado), WS | Ver 03 y 07. Axios: para enviar body en `DELETE` usar `axios.delete(url, { data: { motivo } })` (C-13b) |
| Pagos | `POST /pagos/crear`, `POST /pagos/webhook`, `GET /pagos/{pedido_id}`, `GET /pagos/redirect/{pedido_id}/{status}` | **Sin autenticación en** |
| Estadísticas | `GET /estadisticas/ventas`, `/productos-top`, `/pedidos-por-estado`, `/ingresos`, `/resumen` | `ADMIN` |

Convenciones transversales: soft delete (los GET filtran `deleted_at IS NULL`), esquemas separados Create/Update/Read (nunca exponer el modelo SQLModel), `response_model` siempre.

> **Contrato de pedidos y paginación (C-11):** todo listado de colección recibe `page` (>=1, defecto 1) y `size` (1..100, defecto 20) y responde `{items,total,page,size,pages}` (catálogo, usuarios, direcciones, pedidos y cocina). Los errores salen siempre como `{detail, code, field}`; los códigos de negocio son `INVALID_TRANSITION`, `INSUFFICIENT_STOCK`, `DUPLICATE_VALUE`, `CATEGORY_HAS_PRODUCTS`, `CATEGORY_HAS_CHILDREN`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR` y `VALIDATION_ERROR`; el resto usa `HTTP_<status>`. El 429 del rate limit usa el mismo formato (el tiempo de espera va en el header `Retry-After`). Pendiente de otros changes: pagos autenticados y `GET /auth/me` ([09 DT-05](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada)).

## Entorno y arranque (código actual)

Desde la raíz: `docker compose up -d db`; luego desde `backend/`: venv → `pip install -r requirements.txt` → `python -m app.db.seed` → `uvicorn app.main:app --reload` (API en `http://localhost:8000`). El entry point es `backend/app/main.py`. Ver [08](08_arquitectura_propuesta.md) para variables de entorno.
