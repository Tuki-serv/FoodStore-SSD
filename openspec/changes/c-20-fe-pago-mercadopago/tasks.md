# Tasks — C-20 `fe-pago-mercadopago`

> **Governance CRÍTICO** (pagos): no se escribe código sin el OK explícito del usuario. Gate: mockups del bloque 0 aprobados (`design.md` §UI Mockups con `Approval: approved`) y respuestas a OQ-1..OQ-7 registradas antes del bloque 1. Si una respuesta difiere del defecto (p. ej. OQ-1 = endpoint, OQ-5 = partir), se ajustan specs, mockups y estas tareas antes de codear.
> **Partición (OQ-5)**: si se parte, la parte A son los bloques 1–6 y 8–9 (sin 6.3); la parte B, 6.3 y el bloque 7.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `zustand`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR con la suite verde tras cada paso. Red simulada solo con MSW (`onUnhandledRequest: 'error'`); el único `vi.mock` permitido es el de `@mercadopago/sdk-react` (terceros). Consultas por rol/nombre accesible, `userEvent.setup()` con `await`, valores esperados literales, sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; pagos/pedidos = server state, `paymentStore` = client state; ningún secreto en el frontend; no leer ni escribir `.env` reales (solo `.env.example`); **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear. No se toca `backend/` (salvo OQ-1 = endpoint). Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [ ] 0.1 Crear `mockups/` con los estados de `design.md` §UI Mockups (`pago-pedido.html` con `?estado=`, `pedido-creado-pago.html` para OQ-7), `mockup.css`/`mockup.js` copiados de C-19, importando `design-system/tokens.css` y `brand.js`; el brick como recuadro «Formulario de Mercado Pago (simulado)»; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [ ] 0.2 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [ ] 0.3 Mostrar mockups y OQ-1..OQ-7 al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md` y la respuesta (o «por defecto») de cada OQ. Verificación: ambos archivos actualizados.
- [ ] 0.4 Pedir el OK explícito del usuario para escribir código (governance CRÍTICO) y la versión exacta de `@mercadopago/sdk-react` a instalar. Verificación: OK registrado en este archivo.

## 1. Red de seguridad

- [ ] 1.1 Ejecutar `npm test`, `npm run typecheck` y `npm run lint`; anotar la línea base. Si algo falla, frenar y reportarlo como falla previa. Verificación: línea base anotada acá.
- [ ] 1.2 Instalar `@mercadopago/sdk-react` con versión exacta (`--save-exact`). Verificación: `package.json` y lock actualizados; `npm test` sigue verde.

## 2. Configuración: clave pública (spec `frontend-foundation`)

- [ ] 2.1 RED → GREEN + TRIANGULATE `readConfig`: con `VITE_MP_PUBLIC_KEY=APP_USR-clave-publica-de-prueba` expone `mpPublicKey` igual; ausente, vacía o `"  "` → `null` sin lanzar; `VITE_API_URL` sigue obligatoria. Agregar la clave a `VARIABLES_FRONTEND` y a `vite-env.d.ts`. Verificación: tests de `env` verdes.
- [ ] 2.2 Agregar `VITE_MP_PUBLIC_KEY` con placeholder no sensible y comentario a `frontend/.env.example`. Verificación: el test existente de plantilla completa (`VARIABLES_FRONTEND` ⊆ `.env.example`) pasa.

## 3. Entidad `payment`: modelo puro (spec `frontend-payment`, `frontend-client-stores`)

- [ ] 3.1 RED → GREEN + TRIANGULATE `paymentStore` (D8): `registrarResultado({estado:'aprobado', mpPaymentId:'PAY01JX7', statusDetail:'accredited'})` guarda el id como texto; acepta `a_devolver`; los tests existentes de recarga siguen verdes. Verificación: `payment-store.test.ts` verde.
- [ ] 3.2 RED → GREEN + TRIANGULATE `cuerpoDesdeBrick` (spec «Envío del pago sin datos de tarjeta»): caso completo del escenario (installments `"3"` → `3`, issuer `"310"` → `310`, identificación DNI); issuer vacío → `null`; identificación sin número → `payer` solo con `email`; campos extra del brick no pasan. Verificación: test verde.
- [ ] 3.3 RED → GREEN + TRIANGULATE `vistaPago` (D4): un caso por fila de la tabla y la precedencia (aprobado con pedido `CONFIRMADO` → `aprobado`; `a_devolver` con `CANCELADO` → `a-devolver`; `EFECTIVO` → `no-tarjeta`; `CANCELADO` sin pago → `no-pagable`; `rechazado` + `PENDIENTE` → `rechazado`; sin pago + `PENDIENTE` → `formulario`). Verificación: test verde.
- [ ] 3.4 RED → GREEN + TRIANGULATE `motivoRechazo` (D5): `insufficient_amount` y `cc_rejected_insufficient_amount` → «La tarjeta no tiene fondos suficientes.»; desconocido y `null` → genérico. Verificación: test verde.
- [ ] 3.5 RED → GREEN + TRIANGULATE `clasificarErrorPago` (D7): 409, 400, 502, 503, 404, 403, `status: null`, 500. Verificación: test verde.
- [ ] 3.6 RED → GREEN + TRIANGULATE `montoDesdeTotal` (D9): `"2850.00"` → `2850`; `"1300.50"` → `1300.5`; `"0.10"` → `0.1`. Verificación: test verde.

## 4. Entidad `payment`: API (TanStack Query + MSW)

- [ ] 4.1 RED → GREEN + TRIANGULATE `pagoQueries.estado(pedidoId)`: clave `['pagos', 58]`, `GET /pagos/58`; respuesta sin intentos (`estado: null`). Verificación: test con MSW verde.
- [ ] 4.2 RED → GREEN + TRIANGULATE `useCrearPago`: envía el cuerpo exacto, escribe la respuesta en la caché de `['pagos', id]`; error 502 llega como `ApiError` con `status` 502. Verificación: test con MSW verde.

## 5. Feature `pagar-con-tarjeta` (doble del SDK con `vi.mock`)

- [ ] 5.1 RED → GREEN + TRIANGULATE montaje: sin clave pública → «El pago con tarjeta no está disponible en este momento» y el doble no se monta; con clave → indicador de carga hasta `onReady`; monto `2850` pasado al brick. Verificación: test verde.
- [ ] 5.2 RED → GREEN + TRIANGULATE envío: «Simular pago» → `POST /pagos/crear` con el cuerpo del escenario; «Procesando el pago…» visible; un segundo submit durante el proceso no hace otro POST. Verificación: test con MSW que cuenta requests.
- [ ] 5.3 RED → GREEN + TRIANGULATE error del brick: `onError` → «No pudimos cargar el formulario de tarjeta» y «Reintentar» remonta. Verificación: test verde.

## 6. Página `pago-pedido` (spec `frontend-payment`)

- [ ] 6.1 RED → GREEN + TRIANGULATE acceso y carga: «Pagar pedido #58» y «$ 2.850»; `abc` sin requests; 404 → «No encontramos este pedido»; sin sesión → `/ingresar`; ADMIN → «Sin permiso». Reemplazar `PlaceholderPage` en `routes.tsx` (`RUTA_PAGO_PEDIDO`). Verificación: tests de página y de rutas verdes (actualizar el escenario «Ruta de pago provisoria» de C-19 a «Ruta de pago real»).
- [ ] 6.2 RED → GREEN + TRIANGULATE resultados inmediatos: aprobado (invalida detalle y lista de pedidos, enlaces «Ver mi pedido»/«Seguir comprando»), rechazado + «Intentar de nuevo» con nuevo POST del mismo pedido, 400 → rechazado genérico, `a_devolver` sin reintento, 409 → refetch y vista según servidor, 502, 503, red. Verificación: tests verdes.
- [ ] 6.3 RED → GREEN + TRIANGULATE recarga: con `GET /pagos/58` `aprobado` → «¡Pago aprobado!» sin brick; `rechazado` → motivo + formulario; pedido `EFECTIVO` → «Este pedido no se paga con tarjeta»; `CANCELADO` sin pago → «Este pedido ya no se puede pagar». Verificación: tests verdes.
- [ ] 6.4 RED → GREEN + TRIANGULATE accesibilidad: foco al título del resultado al cambiar de vista; único `h1`; mensajes de error en región viva. Verificación: tests verdes.

## 7. Pendiente y confirmación por webhook (D6)

- [ ] 7.1 RED → GREEN + TRIANGULATE polling con timers falsos: `pendiente` → consulta cada 5 s; pasa a `aprobado` → vista aprobado y sin más consultas; pasa a `rechazado` → vista rechazado. Verificación: test que cuenta requests.
- [ ] 7.2 RED → GREEN + TRIANGULATE tope: a los 2 min sigue `pendiente` → «La confirmación está demorando», sin más consultas automáticas; «Actualizar» hace una consulta. Verificación: test verde.
- [ ] 7.3 RED → GREEN + TRIANGULATE estado del pago en la confirmación (spec `frontend-checkout`, OQ-7): rechazado con motivo + CTA; pendiente sin CTA; sin intentos sin línea extra; pedidos no `MERCADOPAGO` no consultan `/pagos`. Verificación: tests de `pedido-creado` verdes.

## 8. Estilos y cierre técnico

- [ ] 8.1 Portar los estilos de los mockups aprobados (`pago-pedido.css`) con tokens de `design-system/tokens.css`. Verificación: sin valores de color/espaciado sueltos fuera de tokens (revisión del diff).
- [ ] 8.2 REFACTOR general + revisión SOLID/DRY; `npm test`, `npm run typecheck`, `npm run lint` (incluye `fsd-boundaries`) en verde. Verificación: salida de los tres comandos anotada acá.
- [ ] 8.3 Documentar en el README de frontend la variable `VITE_MP_PUBLIC_KEY` y cómo probar en sandbox (tarjetas y titulares `APRO`/`FUND`/`OTHE`/`CONT`, email de comprador de prueba), sin credenciales reales. Verificación: sección presente.

## 9. Verificación con el usuario

- [ ] 9.1 Prueba manual en sandbox con el backend, ngrok y credenciales de prueba del usuario (con su permiso para levantar servidores): `APRO` aprobado, `FUND`/`OTHE` rechazado + reintento, `CONT` pendiente → webhook. Registrar los `status_detail` observados y ajustar `motivoRechazo` si difieren (OQ-6). Verificación: resultados anotados en `design.md`.
- [ ] 9.2 Visual verify contra los mockups aprobados (1440x900 y 390x844) en `mockups/verify/`; registrar `Visual verify` en `design.md`. Verificación: capturas y reporte de diferencias.

## Workflow follow-up

- `openspec-verify` del change; luego `/opsx:archive` y marcar C-20 `[x]` en `CHANGES.md` (o la parte A/B según OQ-5).
- Actualizar `knowledge-base/11_pagos_mercadopago.md` con los `status_detail` observados (OQ-14 de C-12).
