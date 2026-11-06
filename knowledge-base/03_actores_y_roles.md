# Actores y Roles

## Actores del sistema

| Actor | Rol técnico | Descripción | Cómo interactúa |
|-------|-------------|-------------|-----------------|
| Cliente | `CLIENT` | Usuario final de la tienda. Rol asignado **automáticamente** al registrarse | Navega catálogo, carrito, crea pedidos, paga, ve/cancela sus pedidos, gestiona sus direcciones. Solo ve y opera sus propios datos |
| Administrador | `ADMIN` | Control total | Usuarios y roles, catálogo completo, todos los pedidos, métricas, configuración |
| Gestor de Stock | `STOCK` | Mantiene el inventario | Actualiza `stock_cantidad` y `disponible`, consulta ingredientes/alérgenos. Sin acceso a pedidos/usuarios/métricas |
| Gestor de Pedidos | `PEDIDOS` | Flujo operativo de pedidos | Ve todos los pedidos, avanza estados, cancela según reglas. Sin acceso a catálogo ni usuarios |
| Cocina (**extra del código, no especificado**) | `COCINA` | Pantalla de cocina (KDS) | Recibe pedidos CONFIRMADO/EN_PREP por WebSocket; el rol **no está en el seed ni en la spec** (IN-12, DT-02). Fuera del RBAC objetivo hasta decidir PA-07 |
| Sistema | — (proceso automático) | Procesos sin intervención humana | Procesa webhooks IPN de MercadoPago, actualiza pagos, dispara CONFIRMADO, rota/expira tokens |
| MercadoPago | externo | Pasarela de pago | Notifica estados de pago al webhook |

Un usuario puede tener **múltiples roles** (N:M `UsuarioRol`, p. ej. ADMIN + STOCK); los permisos son la unión de los roles.

> **Deuda técnica (DT-14):** el código actual usa solo `current_user.roles[0]` para decidir transiciones (IN-13).

## RBAC — Matriz de permisos (objetivo: spec `[INT]`)

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Las celdas marcadas `[DESC]` son divergencias informativas, no normativas. Leyenda: C=crear, R=leer, U=actualizar, D=borrar (soft). `—` sin acceso. `*` = divergencia entre fuentes (ver nota).

| Recurso | ADMIN | STOCK | PEDIDOS | CLIENT | Público |
|---------|-------|-------|---------|--------|---------|
| Usuarios (admin) | CRUD + asignar roles | — | — | — | — |
| Perfil propio (`/usuarios/me`) | RU | RU | RU | RU | — |
| Direcciones | — (propias) | — | — | CRUD **propias** | — |
| Categorías | CRUD | `*` CRUD [DESC] / solo lectura [INT] | — | R | R |
| Productos | CRUD | `*` RU (stock, disponible) [INT]; CRUD [DESC] | — | R | R (solo `disponible` y no eliminados) |
| Ingredientes | CRUD | `*` CRUD [DESC] / R [INT]; en el código actual escritura solo ADMIN | — | R | R |
| Unidades de medida | CRUD | R | R | R | R |
| Imágenes (uploads) | CD | — | — | — | — |
| Pedidos — crear | — | — | — | C | — |
| Pedidos — listar | todos | — | todos | solo propios | — |
| Pedidos — avanzar estado | ✔ | — | ✔ (`*` ver 05) | — | — |
| Pedidos — cancelar | ✔ (PENDIENTE, CONFIRMADO, EN_PREP) | — | ✔ (`*` EN_PREP: ADMIN solo [DESC]) | ✔ propios en PENDIENTE/CONFIRMADO | — |
| Pedidos — eliminar (soft) | ✔ | — | — | — | — |
| Historial de pedido | ✔ | — | ✔ | `*` propio [INT]; en el código actual solo ADMIN/PEDIDOS | — |
| Pagos — crear / consultar | — | — | — | C/R propios [INT]; *deuda DT-05: sin auth en el código actual* | — |
| Pagos — webhook | — | — | — | — | Público (objetivo: validar firma; *deuda DT-06:* el código actual no la valida) |
| Estadísticas / dashboard | ✔ | — | — | — | — |
| Cocina: lista y WS | ✔ | — | ✔ | — | (rol `COCINA`) |

Implementación: dependencia `require_role([...])` (403 si no hay ninguno de los roles); `get_current_user()` (401 si token inválido/expirado); `get_current_active_user` rechaza usuarios con `deleted_at` (responde 404 "Cuenta de usuario desactivada" para no revelar el estado).

Nota: `[DESC]` es más permisivo con STOCK, pero **`[INT]` es normativo**: STOCK solo actualiza stock/`disponible` y lee ingredientes (IN-14 cerrada). En el código actual, escritura de categorías/ingredientes/unidades es solo ADMIN (DT-16).

## Rutas públicas (sin autenticación)

Según spec `[INT]`:
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login` (rate limited), `POST /api/v1/auth/refresh`
- `GET /api/v1/productos`, `GET /api/v1/productos/{id}`, `GET /api/v1/productos/{id}/ingredientes`
- `POST /api/v1/pagos/webhook` (debe validar firma de MercadoPago)
- `/docs`, `/redoc`, `/openapi.json`

> **Deuda técnica (DT-05):** el código actual expone además como públicos (riesgo de seguridad; el objetivo es que `/pagos/crear` y `/pagos/{id}` exijan autenticación y propiedad): `GET /categorias/`, `/categorias/arbol`, `/categorias/{id}`, `GET /ingredientes[/{id}]`, `GET /unidades-medida[/{id}]`, **`POST /pagos/crear`, `GET /pagos/{pedido_id}` y `GET /pagos/redirect/...` (sin ningún control de autenticación ni de propiedad del pedido)**.

Rutas excluidas del rate limiting en el código actual (extra no especificado): `/health`, `/`, `/favicon.ico`, `/openapi.json`, `/docs`, `/redoc`.
