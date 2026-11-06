# Tiempo real — WebSocket (KDS y seguimiento de pedido)

> **Extra del código, no especificado.** La spec `[INT]` propone un **timeline con polling cada 30 s** para el seguimiento del cliente y no define WebSocket, KDS ni rol `COCINA`. Se documenta lo que existe; su inclusión en el alcance es la pregunta abierta PA-19 / PA-07.

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

 Ver IN-12 (rol COCINA) y DD-13.

## Componentes

`backend/app/core/websocket.py` — `ConnectionManager` singleton (`manager`):
- `rooms: dict[str, set[WebSocket]]` y `socket_rooms` (índice inverso).
- `connect(ws, role, user_id)`: `accept()` y une a la room `role:{ROLE}`.
- `join_role_room(ws, name)`: une a una room adicional (`role:KDS`, `pedido:{id}` — se usa el prefijo `role:` aunque no sea rol, a excepción de `pedido:{id}` que se pasa ya armado).
- `send_to_room(room, event, data)`: envía `{"event": ..., "data": ...}` a todos los miembros; remueve conexiones que fallan.
- `disconnect(ws)`: lo saca de todas las rooms.

## Endpoints

| Ruta | Quién | Validación |
|------|-------|-----------|
| `WS /api/v1/pedidos/cocina/ws` | Roles `COCINA`, `ADMIN`, `PEDIDOS` | Token de la cookie `access_token`; si falta/invalida/rol insuficiente: `accept()` + `close(1008)` con motivo. Une a `role:{roles[0]}` y `role:KDS` |
| `WS /api/v1/pedidos/{pedido_id}/ws` | Cliente dueño del pedido | Cookie válida y `pedido.usuario_id == user_id`; une a `pedido:{pedido_id}` |
| `GET /api/v1/pedidos/cocina/pedidos` | `COCINA`, `ADMIN`, `PEDIDOS` | Lista pedidos CONFIRMADO/EN_PREP (sobre los primeros 20 activos), ordenados por id ascendente |

El WebSocket autentica con la **cookie** porque el navegador no permite enviar `Authorization` al abrir un WebSocket.

## Eventos emitidos

Se emiten tras commit, a `role:KDS` y a `pedido:{id}`, desde `PedidoService.cambiar_estado_pedido` (transición manual) y desde el router de pagos (webhook, vía `BackgroundTasks`):

| Estado resultante | Evento |
|-------------------|--------|
| CONFIRMADO | `PEDIDO_CONFIRMADO` |
| EN_PREP | `PEDIDO_EN_PREPARACION` |
| CANCELADO | `PEDIDO_CANCELADO` |
| cualquier otro | `ESTADO_ACTUALIZADO` |

Payload: `PedidoReadFull` serializado (id, estado, totales, ítems). **No** se emite evento al crear un pedido ni al cancelarlo desde `mis-pedidos/.../cancelar`.

## Limitaciones / puntos a validar

- Estado en memoria del proceso: no funciona con varios workers/instancias (necesitaría Redis pub/sub).
- **Deuda técnica (DT-08)**: bug probable: `manager.disconnect(...)` es síncrono pero el router lo invoca con `await manager.disconnect(websocket)` (TypeError al desconectarse un cliente). Verificar y corregir.
- `obtener_pedidos_cocina` pagina con `offset=0, limit=20` fijo y filtra en memoria: pedidos de cocina fuera de los primeros 20 activos no aparecen; usa la clave `ESTADOS["preparando"]` (alias de EN_PREP).
- El cliente se suscribe con `connect(ws, "CLIENT", user_id)` aunque sea un solo pedido.
- Sin heartbeat/ping, ni reconexión definida.
