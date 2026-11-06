# Visión y Objetivos

> Fuentes: `[DESC]` = docs/Descripcion.docx, `[INT]` = docs/integrador.docx (Especificación Técnica v5.0). El código actual del backend se describe sin etiqueta. Cuando difieren, ver [10_preguntas_abiertas.md](10_preguntas_abiertas.md).

## Propósito del sistema

**Food Store** es una aplicación web full-stack de comercio electrónico para un negocio de comidas: permite explorar un catálogo, armar un carrito, hacer pedidos con pago vía MercadoPago y seguir el estado del pedido con trazabilidad completa, mientras los roles internos gestionan catálogo, stock, pedidos y métricas.

Contexto: es un **Trabajo Práctico Integrador (TPI)** de una materia de metodología/desarrollo, trabajado con **Spec-Driven Development (SDD)** y organización **Feature-First** `[INT]`. El documento fuente se evalúa con una rúbrica de 200 puntos (ver [13_rubrica_y_entrega.md](13_rubrica_y_entrega.md)). El código actual es una implementación **solo backend** (FastAPI); no incluye frontend.

## Objetivos por actor

| ID | Actor | Objetivo principal | Objetivos secundarios |
|----|-------|--------------------|-----------------------|
| OBJ-01 | Cliente (`CLIENT`) | Navegar el catálogo, gestionar carrito, pagar con MercadoPago y rastrear sus pedidos con trazabilidad completa | Registrarse/loguearse, gestionar direcciones de entrega, ver historial propio, cancelar pedidos permitidos |
| OBJ-02 | Administrador (`ADMIN`) | Gestionar categorías, productos, stock, usuarios y ciclo de vida de pedidos desde un panel | Asignar roles, ver métricas (dashboard), configurar catálogos (formas de pago, estados) |
| OBJ-03 | Gestor de Stock (`STOCK`) | Controlar disponibilidad y cantidad de stock de productos | Gestionar ingredientes y alérgenos `[DESC]` |
| OBJ-04 | Gestor de Pedidos (`PEDIDOS`) | Avanzar el estado de los pedidos según la máquina de estados | Ver todos los pedidos y su historial; cancelar según reglas |
| OBJ-05 | Sistema | Garantizar trazabilidad completa de transiciones con audit trail append-only | Expiración/rotación de tokens |
| OBJ-06 | Sistema | Procesar y registrar pagos vía MercadoPago de forma atómica e idempotente | Disparar la confirmación automática del pedido al aprobarse el pago (webhook IPN) |

Extra del código, **no especificado**: rol **`COCINA`** (pantalla de cocina/KDS en tiempo real). No existe en `[DESC]` ni `[INT]` (la spec define 4 roles) — ver IN-12, DT-02, PA-07.

## Alcance v5.0

- Autenticación y autorización con **JWT (access 30 min + refresh 7 días)** y **RBAC de 4 roles**, con invalidación de refresh token en BD.
- Catálogo de productos con **categorías jerárquicas** e **ingredientes** con flag `es_alergeno`.
- **Carrito** persistente en el cliente (Zustand + localStorage).
- **Pedidos** con **máquina de estados (FSM)** y **audit trail append-only** (`HistorialEstadoPedido`).
- **Pasarela MercadoPago** (tarjeta crédito/débito, Rapipago, Pago Fácil) y **webhook IPN** para confirmación automática de pagos.
- **Direcciones de entrega**: CRUD con dirección principal por usuario.
- **Panel de administración**: dashboard con gráficos (recharts), CRUD de entidades, gestión de pedidos y stock.
- **Rate limiting** en login (5 intentos / 15 min por IP según spec).
- **CORS** configurado; **seed data obligatorio** (roles, estados, formas de pago, admin).
- API REST documentada con OpenAPI (`/docs`, `/redoc`), prefijo `/api/v1`.

Extras del código, **no especificados** (decisión pendiente, PA-19): módulo de **estadísticas** (`/api/v1/estadisticas/*`), **unidades de medida**, subida de **imágenes a Cloudinary**, **WebSocket** de tiempo real para cocina/seguimiento de pedido, rate limiting general (token bucket).

## Fuera de alcance

Explícito o inferido de las fuentes:

- Descuentos/promociones reales: el campo `descuento` existe pero es siempre `0.00`; no hay reglas definidas.
- Costo de envío dinámico: valor **fijo 50.00** en v1 `[INT]`.
- Pagos con datos de tarjeta en el servidor propio (PCI SAQ-A: nunca pasan por Food Store).
- Multi-tenant, multi-sucursal, multi-moneda (se usa ARS).
- Integración de seguimiento de repartidor/GPS (solo se guardan lat/long de la dirección en el backend actual).
- Escalado horizontal del rate limiter y WebSocket (estado en memoria, ver [12_tiempo_real_websocket.md](12_tiempo_real_websocket.md)).

## Métricas de éxito

- Cumplimiento de la **rúbrica de 200 pts** (>= 181 = Excelente), bonus +10 por tests (pytest, cobertura > 60%) y +10 por deploy; penalización −30% si no corre localmente con el README.
- Checklist de entrega CE-01..CE-14 completo (ver [13](13_rubrica_y_entrega.md)).
- Pago de prueba con tarjeta sandbox MercadoPago funcionando de extremo a extremo.
- KPI operativos del dashboard: ventas, ticket promedio, pedidos activos, ingresos por forma de pago, productos top.
