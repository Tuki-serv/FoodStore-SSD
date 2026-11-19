# Tasks — C-20a `fe-pago-tarjeta`

> **Governance CRÍTICO** (pagos): no se escribe código sin el OK explícito del usuario. Gate: mockups del bloque 0 aprobados (`design.md` §UI Mockups con `Approval: approved`) antes del bloque 1. OQ-1 (endpoint), OQ-3, OQ-4 y OQ-6 ya están respondidas (2026-11-19, `design.md` §Open Questions); OQ-2 y OQ-7 son de C-20b.
> **Partición (OQ-5 = partir)**: este change es la parte A (bloques 0–6 y 8–9 del C-20 original, sin 6.3). El polling, la recarga desde el servidor y el estado del pago en la confirmación son de **C-20b** `fe-pago-seguimiento`.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `zustand`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR con la suite verde tras cada paso. Backend con pytest contra la base `foodstore_test` (`backend/tests/.env.test`). Frontend: red simulada solo con MSW (`onUnhandledRequest: 'error'`); el único `vi.mock` permitido es el de `@mercadopago/sdk-react` (terceros). Consultas por rol/nombre accesible, `userEvent.setup()` con `await`, valores esperados literales, sin snapshots ni aserciones tautológicas.
> **Hard rules**: backend en capas `models ← repository ← UoW ← services ← routers` (el router solo delega); FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; pagos/pedidos = server state, `paymentStore` = client state; ningún secreto en el frontend; no leer ni escribir `.env` reales; **no** correr `npm run dev`, `vite build`, `uvicorn` ni servidores (regla 13); no commitear. Comandos de frontend desde `frontend/`, de backend desde `backend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con los estados de `design.md` §UI Mockups (`pago-pedido.html` con `?estado=`), `mockup.css`/`mockup.js` copiados de C-19, importando `design-system/tokens.css` y `brand.js`; el brick como recuadro «Formulario de Mercado Pago (simulado)»; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 Mostrar los mockups al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`. Las respuestas a OQ-1, OQ-3, OQ-4 y OQ-6 ya están registradas (2026-11-19). Verificación: ambos archivos actualizados.
- [x] 0.4 Pedir el OK explícito del usuario para escribir código (governance CRÍTICO, incluye el endpoint de backend) y la versión exacta de `@mercadopago/sdk-react` a instalar. Verificación: OK registrado en este archivo.

## 1. Red de seguridad

- [x] 1.1 Ejecutar `pytest` (desde `backend/`) y `npm test`, `npm run typecheck`, `npm run lint` (desde `frontend/`); anotar la línea base. Si algo falla, frenar y reportarlo como falla previa. Verificación: línea base anotada acá. **Línea base (2026-11-19)**: frontend `npm test` 116 archivos / 1096 tests verdes, `typecheck` y `lint` limpios; backend `pytest` 1731 passed y 1 falla previa ajena al change (`tests/unit/test_limitador_por_clave.py::test_retry_after_es_el_tiempo_hasta_que_vence_el_fallo_mas_antiguo`, depende del reloj).
- [x] 1.2 Instalar `@mercadopago/sdk-react` con versión exacta (`--save-exact`). Verificación: `package.json` y lock actualizados; `npm test` sigue verde. Instalada `@mercadopago/sdk-react` `1.1.0` (exacta).

## 2. Backend: clave pública (spec `payment-api`, design D3)

- [x] 2.1 RED → GREEN + TRIANGULATE `GET /api/v1/pagos/config` (pytest de integración, `monkeypatch` de `settings`): con `MP_PUBLIC_KEY=APP_USR-clave-publica-de-prueba` y un `CLIENT` autenticado → 200 `{"public_key": "APP_USR-clave-publica-de-prueba"}` y ningún otro campo; un `ADMIN` sin `CLIENT` → 200; sin token → 401 `HTTP_401`; clave `None` y `"  "` → 503 `HTTP_503`; con `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` definidas el cuerpo no contiene sus valores; la ruta no responde 422 de `pedido_id`. Implementar `ConfiguracionPagosResponse` (schemas), `PaymentService.obtener_configuracion_publica()` (service) y la ruta en `router.py` **antes** de `GET /{pedido_id}`, sin lógica en el router. Verificación: tests nuevos verdes.
- [x] 2.2 Sumar la fila `Fila("GET", f"{P}/pagos/config", AUTENTICADO)` a `tests/support/rbac_matriz.py`. Verificación: `test_rbac_matriz.py` verde y `pytest` completo verde.

## 3. Entidad `payment`: modelo puro (spec `frontend-payment`, `frontend-client-stores`)

- [x] 3.1 RED → GREEN + TRIANGULATE `paymentStore` (D7): `registrarResultado({estado:'aprobado', mpPaymentId:'PAY01JX7', statusDetail:'accredited'})` guarda el id como texto; acepta `a_devolver`; los tests existentes de recarga siguen verdes. Verificación: `payment-store.test.ts` verde.
- [x] 3.2 RED → GREEN + TRIANGULATE `cuerpoDesdeBrick` (spec «Envío del pago sin datos de tarjeta»): caso completo del escenario (installments `"3"` → `3`, issuer `"310"` → `310`, identificación DNI); issuer vacío → `null`; identificación sin número → `payer` solo con `email`; campos extra del brick no pasan. Verificación: test verde.
- [x] 3.3 RED → GREEN + TRIANGULATE `vistaPago` (D4): un caso por fila de la tabla y la precedencia (aprobado con pedido `CONFIRMADO` → `aprobado`; `a_devolver` con `CANCELADO` → `a-devolver`; `pendiente` → `pendiente`; `EFECTIVO` → `no-tarjeta`; `CANCELADO` sin pago → `no-pagable`; `rechazado` + `PENDIENTE` → `rechazado`; sin pago + `PENDIENTE` → `formulario`). Verificación: test verde.
- [x] 3.4 RED → GREEN + TRIANGULATE `motivoRechazo` (D5): `insufficient_amount` y `cc_rejected_insufficient_amount` → «La tarjeta no tiene fondos suficientes.»; desconocido y `null` → genérico. Exportarla desde `@/entities/payment` (la reutiliza C-20b). Verificación: test verde.
- [x] 3.5 RED → GREEN + TRIANGULATE `clasificarErrorPago` (D6): 409, 400, 502, 503, 404, 403, `status: null`, 500. Verificación: test verde.
- [x] 3.6 RED → GREEN + TRIANGULATE `montoDesdeTotal` (D8): `"2850.00"` → `2850`; `"1300.50"` → `1300.5`; `"0.10"` → `0.1`. Verificación: test verde.

## 4. Entidad `payment`: API (TanStack Query + MSW)

- [x] 4.1 RED → GREEN + TRIANGULATE `pagoQueries.configuracion()`: clave `['pagos', 'config']`, `GET /pagos/config` → `public_key`; 503 llega como `ApiError` con `status` 503 sin reintentos. Verificación: test con MSW verde.
- [x] 4.2 RED → GREEN + TRIANGULATE `pagoQueries.estado(pedidoId)`: clave `['pagos', 58]`, `GET /pagos/58`; respuesta sin intentos (`estado: null`). Verificación: test con MSW verde.
- [x] 4.3 RED → GREEN + TRIANGULATE `useCrearPago`: envía el cuerpo exacto, escribe la respuesta en la caché de `['pagos', id]`; error 502 llega como `ApiError` con `status` 502. Verificación: test con MSW verde.

## 5. Feature `pagar-con-tarjeta` (doble del SDK con `vi.mock`)

- [x] 5.1 RED → GREEN + TRIANGULATE montaje: `GET /pagos/config` 503 o sin respuesta → «El pago con tarjeta no está disponible en este momento» y el doble no se monta; con clave → el doble recibe `APP_USR-clave-publica-de-prueba`, indicador de carga hasta `onReady`; monto `2850` pasado al brick. Verificación: test verde.
- [x] 5.2 RED → GREEN + TRIANGULATE envío: «Simular pago» → `POST /pagos/crear` con el cuerpo del escenario; «Procesando el pago…» visible; un segundo submit durante el proceso no hace otro POST. Verificación: test con MSW que cuenta requests.
- [x] 5.3 RED → GREEN + TRIANGULATE error del brick: `onError` → «No pudimos cargar el formulario de tarjeta» y «Reintentar» remonta. Verificación: test verde.

## 6. Página `pago-pedido` (spec `frontend-payment`)

- [x] 6.1 RED → GREEN + TRIANGULATE acceso y carga: «Pagar pedido #58» y «$ 2.850»; `abc` sin requests; 404 → «No encontramos este pedido»; sin sesión → `/ingresar`; ADMIN → «Sin permiso». Reemplazar `PlaceholderPage` en `routes.tsx` (`RUTA_PAGO_PEDIDO`). Verificación: tests de página y de rutas verdes (actualizar el escenario «Ruta de pago provisoria» de C-19 a la página real).
- [x] 6.2 RED → GREEN + TRIANGULATE resultados inmediatos: aprobado (invalida detalle y lista de pedidos, enlaces «Ver mi pedido»/«Seguir comprando», sin redirección — OQ-4), rechazado + «Intentar de nuevo» con nuevo POST del mismo pedido, 400 → rechazado genérico, pendiente estático con «Ver mi pedido», `a_devolver` sin reintento, 409 → refetch de pedido y pago y vista según servidor, 502, 503, red. Verificación: tests verdes.
- [x] 6.3 RED → GREEN + TRIANGULATE no corresponde pagar: pedido `EFECTIVO` → «Este pedido no se paga con tarjeta»; `MERCADOPAGO` `CANCELADO` sin pago → «Este pedido ya no se puede pagar»; en ambos sin brick ni `GET /pagos/config`. Verificación: tests verdes.
- [x] 6.4 RED → GREEN + TRIANGULATE accesibilidad: foco al título del resultado al cambiar de vista; único `h1`; mensajes de error en región viva. Verificación: tests verdes.

## 8. Estilos y cierre técnico

- [x] 8.1 Portar los estilos de los mockups aprobados (`pago-pedido.css`) con tokens de `design-system/tokens.css`. Verificación: sin valores de color/espaciado sueltos fuera de tokens (revisión del diff).
- [x] 8.2 REFACTOR general + revisión SOLID/DRY (backend y frontend); `pytest`, `npm test`, `npm run typecheck`, `npm run lint` (incluye `fsd-boundaries`) en verde. Verificación: salida de los comandos anotada acá. **Salida (2026-11-19)**: `pytest` 1750 passed (el test del limitador, dependiente del reloj, falló en la corrida previa y pasó en esta); `npm test` 124 archivos / 1185 tests verdes; `npm run typecheck` y `npm run lint` (incluye `fsd-boundaries`) limpios.
- [x] 8.3 Documentar en los README de backend y frontend que el pago con tarjeta necesita `MP_PUBLIC_KEY` en el backend (servida por `GET /api/v1/pagos/config`) y cómo probar en sandbox (tarjetas y titulares `APRO`/`FUND`/`OTHE`/`CONT`, email de comprador de prueba), sin credenciales reales. Verificación: sección presente.

## 9. Verificación con el usuario

- [x] 9.1 Prueba manual en sandbox con el backend, ngrok y credenciales de prueba del usuario (con su permiso para levantar servidores): `APRO` aprobado, `FUND`/`OTHE` rechazado + reintento, `CONT` → vista pendiente estática (el seguimiento hasta el webhook se verifica en C-20b). Registrar los `status_detail` observados y ajustar `motivoRechazo` si difieren (OQ-6). Verificación: resultados anotados en `design.md`.
- [x] 9.2 Visual verify contra los mockups aprobados (1440x900 y 390x844) en `mockups/verify/`; registrar `Visual verify` en `design.md`. Verificación: capturas y reporte de diferencias. **Avance (2026-11-19):** formulario y estados «no corresponde pagar» verificados; los estados de resultado se verifican junto con 9.1.

## Workflow follow-up

- `openspec-verify` del change; luego `/opsx:archive` y marcar C-20a `[x]` en `CHANGES.md`. Sigue C-20b `fe-pago-seguimiento`.
- Actualizar `knowledge-base/11_pagos_mercadopago.md` con los `status_detail` observados (OQ-14 de C-12) y el endpoint `GET /pagos/config`.
