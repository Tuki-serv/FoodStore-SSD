# C-12 · Prueba manual en sandbox con la Orders API (tarea 10.2)

`pago-prueba.html` es una herramienta de prueba, no parte del frontend. Tokeniza una tarjeta de prueba con el brick
`CardPayment` de MercadoPago y manda el pago a `POST /api/v1/pagos/crear`, que crea una orden en `POST /v1/orders`
(Orders API). No guarda nada: la clave pública, la
contraseña y el access token viven solo en memoria de la pestaña. Usar solo con credenciales `APP_USR-`.

## Preparación

1. `backend/.env`: `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY` con las credenciales `APP_USR-…`, `MP_WEBHOOK_SECRET` con la clave
   secreta de Webhooks del panel de MercadoPago (sin ella el webhook responde 503).
2. ngrok hacia el backend: `ngrok http 8000`. En el panel de MercadoPago (aplicación creada con «API de Orders»),
   «Configuración de Webhooks», modo **Prueba**: URL `https://<ngrok>/api/v1/pagos/webhook` y evento
   **«Order (Mercado Pago)»**; copiar la clave secreta generada en `MP_WEBHOOK_SECRET`. `MP_NOTIFICATION_URL` ya no
   existe: Orders no admite una URL de notificación por pedido.
3. `CORS_ORIGINS` de `backend/.env` debe incluir el origen desde el que se sirve la página (paso 5). Si ya incluye
   `http://localhost:5173`, usar ese puerto.
4. Desde la raíz: `docker compose up -d db`. Desde `backend/`: `alembic upgrade head`, `python -m app.db.seed` (si la
   base está vacía) y `uvicorn app.main:app --port 8000`.
5. Desde esta carpeta: `python -m http.server 5173` y abrir `http://localhost:5173/pago-prueba.html`.
   Abrir el archivo con doble clic (`file://`) no sirve: el backend rechaza ese origen por CORS.

## Crear el pedido a pagar

En `http://localhost:8000/docs`, con un usuario CLIENT: `POST /api/v1/pedidos/` con
`forma_pago_codigo: "MERCADOPAGO"`, una dirección propia y al menos un ítem con stock. Anotar el `id`.

## Casos (tarjetas de prueba de Orders con vencimiento futuro)

Titular de la tarjeta de prueba = resultado simulado: `APRO` (aprobado), `FUND` (fondos insuficientes), `OTHE`
(error general), `CONT` (pago pendiente). Tarjetas y titulares: <https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/integration-test/cards>.

| Caso | Cómo | Esperado |
|------|------|----------|
| Aprobado | Tarjeta de prueba, titular `APRO` | 201 con `mp_status: processed`, `mp_status_detail: accredited`, `mp_order_id` `ORD…`; el pedido pasa a `CONFIRMADO` |
| Fondos insuficientes | Titular `FUND` en un pedido nuevo | 201 `estado: rechazado`, `mp_status: failed`, `mp_status_detail: insufficient_amount`; el pedido sigue `PENDIENTE` |
| Error general | Titular `OTHE` | 201 `estado: rechazado` con `mp_status: failed`; el pedido sigue `PENDIENTE` |
| Pendiente | Titular `CONT` | 201 `estado: pendiente` (`processing`); el webhook `order` lo resuelve después |
| Reintento | Volver a pagar el pedido rechazado con `APRO` | Aprobado; el pedido pasa a `CONFIRMADO`; un solo pago aprobado |
| Webhook firmado (OQ-13) | Mirar el panel de ngrok (`http://localhost:4040`) después de cada pago | `POST /api/v1/pagos/webhook?data.id=ORD…&type=order` con `x-signature` y respuesta 200; anotar si firmó el `data.id` en minúsculas o tal cual |
| Clave repetida (OQ-14) | Reintentar tras cortar la red a mitad de un pago | 201 si MercadoPago devuelve la orden original o 409 + búsqueda por `external_reference`; anotar cuál |

Después de cada caso, el botón «Consultar» de la página muestra `GET /api/v1/pagos/{pedido_id}` y el estado del pedido.
Registrar los resultados en `design.md`.
