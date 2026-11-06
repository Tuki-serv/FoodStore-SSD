# FoodStore API — backend

> API RESTful para un sistema de gestión de pedidos y productos de comida, construida con FastAPI y PostgreSQL.

---

## Stack tecnológico

| Tecnología | Propósito |
|---|---|
| **FastAPI** | Framework web de alto rendimiento |
| **Python 3.10+** | Lenguaje de programación |
| **PostgreSQL 15** | Base de datos relacional |
| **SQLModel** | ORM con validación de tipos |
| **Docker Compose** | Contenedor para la base de datos |
| **JWT + bcrypt** | Autenticación y hashing de contraseñas |
| **Alembic** | Migraciones de base de datos |

---

## Arquitectura

El proyecto sigue una **arquitectura limpia (Clean Architecture)** organizada por dominios funcionales:

```
backend/app/
├── main.py                 # create_app() y `app` (uvicorn app.main:app)
├── core/                   # Configuración compartida
│   ├── config.py           # Settings (variables de entorno)
│   ├── database.py         # Conexión a PostgreSQL
│   └── mixins/             # Mixins de auditoría / soft delete
├── db/                     # Utilidades de datos
│   ├── seed.py             # Datos de prueba (python -m app.db.seed)
│   └── reset.py            # Reset de la base de desarrollo
├── modules/                # Módulos feature-first
│   ├── health/              # GET /health (liveness)
│   ├── usuarios/            # Gestión de usuarios
│   ├── direcciones_entrega/ # Direcciones de entrega
│   ├── categorias/          # Gestión de categorías
│   ├── productos/          # Gestión de productos
│   ├── ingredientes/       # Gestión de ingredientes
│   ├── unidades_medida/    # Unidades de medida
│   ├── pedidos/            # Gestión de pedidos
│   ├── pagos/             # Gestión de pagos
│   ├── detalles_pedido/   # Detalles de pedido
│   ├── estados_pedido/    # Estados de pedido
│   ├── formas_pago/       # Formas de pago
│   ├── historiales_estado_pedido/ # Historial de estados
│   └── estadisticas/       # Estadísticas
└── utils/                  # Utilidades compartidas
    └── errores.py          # Manejo centralizado de errores
```

Cada módulo sigue el patrón **Repository + Service + Router**:
- `models.py` — Entidad de dominio
- `schemas.py` — Esquemas Pydantic de request/response
- `repository.py` — Acceso a datos
- `service.py` — Lógica de negocio
- `routers.py` — Endpoints FastAPI

---

## Requisitos previos

- Python 3.10 o superior
- pip
- Docker Desktop (para levantar PostgreSQL)

---

## Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPO>
cd Food-Store-Prueba/backend

# 2. Crear y activar el entorno virtual
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno (ver «Variables de entorno»)
cp .env.example .env                          # backend: completar los CHANGE_ME_*
cp tests/.env.test.example tests/.env.test    # para los tests
cp ../.env.example ../.env                    # raíz: variables de docker compose

# 5. Levantar la base de datos con Docker (docker-compose.yml está en la RAÍZ del proyecto)
(cd .. && docker compose up -d db)

# 6. Poblar la base de datos con datos de prueba
python -m app.db.seed

# 7. Iniciar el servidor de desarrollo
uvicorn app.main:app --reload
```

La API estará disponible en **http://localhost:8000**. `GET /health` responde `{"status":"ok"}` (liveness, sin BD ni credenciales).

---

## Documentación de la API

FastAPI genera documentación interactiva automáticamente:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Endpoints principales

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/register` | Registro de usuario |
| POST | `/api/v1/auth/login` | Inicio de sesión |

### Usuarios
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/usuarios` | Listar usuarios |
| GET | `/api/v1/usuarios/{id}` | Obtener usuario por ID |
| PUT | `/api/v1/usuarios/{id}` | Actualizar usuario |
| DELETE | `/api/v1/usuarios/{id}` | Eliminar usuario |

### Direcciones de entrega
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/direcciones` | Listar direcciones |
| POST | `/api/v1/direcciones` | Crear dirección |
| GET | `/api/v1/direcciones/{id}` | Obtener dirección |
| PUT | `/api/v1/direcciones/{id}` | Actualizar dirección |
| DELETE | `/api/v1/direcciones/{id}` | Eliminar dirección |

### Categorías
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/categorias` | Listar categorías |
| POST | `/api/v1/categorias` | Crear categoría |
| GET | `/api/v1/categorias/{id}` | Obtener categoría |
| PUT | `/api/v1/categorias/{id}` | Actualizar categoría |
| DELETE | `/api/v1/categorias/{id}` | Eliminar categoría |

### Productos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/productos` | Listar productos |
| POST | `/api/v1/productos` | Crear producto |
| GET | `/api/v1/productos/{id}` | Obtener producto |
| PUT | `/api/v1/productos/{id}` | Actualizar producto |
| DELETE | `/api/v1/productos/{id}` | Eliminar producto |

### Ingredientes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/ingredientes` | Listar ingredientes |
| POST | `/api/v1/ingredientes` | Crear ingrediente |
| GET | `/api/v1/ingredientes/{id}` | Obtener ingrediente |
| PUT | `/api/v1/ingredientes/{id}` | Actualizar ingrediente |
| DELETE | `/api/v1/ingredientes/{id}` | Eliminar ingrediente |

### Unidades de medida
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/unidades-medida` | Listar unidades |
| POST | `/api/v1/unidades-medida` | Crear unidad |
| GET | `/api/v1/unidades-medida/{id}` | Obtener unidad |
| PUT | `/api/v1/unidades-medida/{id}` | Actualizar unidad |
| DELETE | `/api/v1/unidades-medida/{id}` | Eliminar unidad |

### Pedidos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/pedidos` | Listar pedidos |
| POST | `/api/v1/pedidos` | Crear pedido |
| GET | `/api/v1/pedidos/{id}` | Obtener pedido |
| PUT | `/api/v1/pedidos/{id}` | Actualizar pedido |
| DELETE | `/api/v1/pedidos/{id}` | Eliminar pedido |

---

## Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y reemplazar los `CHANGE_ME_*`. Convención:

- **Toda variable es explícita**: vive en `.env` y se declara en `app/core/config.py`. Nada se deriva de otra.
- **Las obligatorias no tienen default**: si falta una, la app no arranca y el error la nombra
  (`ENVIRONMENT`, `DATABASE_URL`, `SQL_ECHO`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
  `REFRESH_TOKEN_EXPIRE_DAYS`, `LOG_LEVEL`, `CORS_ORIGINS`, `RATE_LIMIT_*`).
- **MercadoPago y Cloudinary son opcionales**: se puede probar el CRUD sin cuentas externas. La funcionalidad
  responde `503` (formato uniforme `{detail, code, field}`) solo cuando se usa sin configurar.

| Integración | Variables que habilita | Sin ellas |
|---|---|---|
| Pagos (MercadoPago) | `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` | `POST /api/v1/pagos/crear` y el redirect post-pago responden 503 |
| Imágenes (Cloudinary) | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | subir una imagen responde 503; borrar es un no-op |

`DATABASE_URL` es la **única** variable de BD que lee el backend y se usa tal cual (esquema `postgresql+psycopg://`).
`POSTGRES_*` y `PGADMIN_*` viven en el `.env` de la **raíz** y las lee **solo docker-compose**: la consistencia entre ambas es manual
(usuario, contraseña y base; puerto host **5433**). Ejemplo coherente:

```env
# .env de la raíz: lo lee docker-compose
POSTGRES_USER=foodstore_user
POSTGRES_PASSWORD=una_clave
POSTGRES_DB=foodstore
# backend/.env: lo lee el backend (mismos usuario, contraseña y base; puerto host 5433)
DATABASE_URL=postgresql+psycopg://foodstore_user:una_clave@localhost:5433/foodstore
```

`CORS_ORIGINS` es un array JSON: `CORS_ORIGINS=["http://localhost:5173"]`.

### Migración desde un `.env` anterior

- `CORS_ORIGINS` pasa de «separado por comas» a array JSON.
- `NGROK_URL` se reemplaza por `BACKEND_PUBLIC_URL=<url pública>` y `MP_NOTIFICATION_URL=<url pública>/api/v1/pagos/webhook`.
- `VITE_FRONTEND_URL` se reemplaza por `FRONTEND_URL`. `MP_WEBHOOK_URL` se retira.
- `VITE_API_URL` deja de ser de `Settings` (es del frontend).
- Nueva: `SQL_ECHO` (`true` imprime el SQL). Las que antes tenían default ahora son obligatorias.
- Ya no se construye `DATABASE_URL` desde `POSTGRES_*`: definirla explícitamente.

---

## Tests

Los tests corren contra **PostgreSQL 15 real**, en la base `foodstore_test` (la crea la suite si falta) del mismo
contenedor de desarrollo (puerto host 5433). Requieren `backend/tests/.env.test` (copiado de `backend/tests/.env.test.example`); la suite
aborta si falta, si `ENVIRONMENT` no es `test` o si el nombre de la base no termina en `_test`.

```bash
# desde la raíz del proyecto
docker compose up -d db
# desde backend/
pytest
```

Dentro del contenedor `backend` de compose, la `DATABASE_URL` se declara en `docker-compose.yml` (host `db:5432`) y pisa la de `backend/.env` (que apunta a `localhost:5433`, para uvicorn/pytest locales).
