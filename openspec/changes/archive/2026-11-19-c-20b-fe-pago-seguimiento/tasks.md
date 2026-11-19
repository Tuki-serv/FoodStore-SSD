# Tasks — C-20b `fe-pago-seguimiento`

> **Depende de C-20a** `fe-pago-tarjeta` (archivado o, como mínimo, aplicado): usa `PagoPedidoPage`, `pagoQueries.estado`, `vistaPago`, `motivoRechazo` y el doble de `@mercadopago/sdk-react`.
> **Governance CRÍTICO** (pagos): no se escribe código sin el OK explícito del usuario. Gate: mockups del bloque 0 aprobados (`design.md` §UI Mockups con `Approval: approved`) y respuestas a OQ-2 y OQ-7 registradas antes del bloque 1. Si una respuesta difiere del defecto, se ajustan specs, mockups y estas tareas antes de codear.
> **Partición (OQ-5 = partir)**: este change es la parte B (tarea 6.3 y bloque 7 del C-20 original).
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR con la suite verde tras cada paso. Red simulada solo con MSW (`onUnhandledRequest: 'error'`); el único `vi.mock` permitido es el de `@mercadopago/sdk-react` (terceros). Consultas por rol/nombre accesible, `userEvent.setup()` con `await`, valores esperados literales, sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; pagos/pedidos = server state; ningún secreto en el frontend; **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear. No se toca `backend/`. Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con los estados de `design.md` §UI Mockups (`pago-pedido.html` con `?estado=` para recarga/pendiente/demorando, `pedido-creado-pago.html` para las líneas de D3), reutilizando `mockup.css`/`mockup.js` de C-20a e importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 (OQ-2 y OQ-7 ya respondidas por el usuario el 2026-11-19: defectos confirmados; falta la aprobación de los mockups) Mostrar mockups y OQ-2, OQ-7 al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md` y la respuesta (o «por defecto») de cada OQ. Verificación: ambos archivos actualizados.
- [x] 0.4 Pedir el OK explícito del usuario para escribir código (governance CRÍTICO). Verificación: OK registrado en este archivo.
  - OK explícito del usuario (2026-11-19) para escribir código y aprobación de los mockups tal como se mostraron (avisos pendiente→rechazado / pendiente→aprobado y enlace «Ver el estado del pago»). OQ-2 y OQ-7: defectos confirmados.

## 1. Red de seguridad

- [x] 1.1 Ejecutar `npm test`, `npm run typecheck` y `npm run lint`; anotar la línea base (debe incluir los tests de C-20a). Si algo falla, frenar y reportarlo como falla previa. Verificación: línea base anotada acá.
  - Línea base (2026-11-19): `npm test` 124 archivos / 1186 tests verdes; `npm run typecheck` y `npm run lint` sin errores.

## 2. Recarga desde el servidor (spec `frontend-payment`, D1)

- [x] 2.1 RED → GREEN + TRIANGULATE recarga: con `GET /pagos/58` `aprobado` y pedido `CONFIRMADO` → «¡Pago aprobado!» sin brick; `rechazado` con `cc_rejected_insufficient_amount` → motivo «La tarjeta no tiene fondos suficientes.» + formulario; `pendiente` → «Estamos esperando la confirmación de Mercado Pago» sin brick; pedido `EFECTIVO` → «Este pedido no se paga con tarjeta» sin pedir `GET /pagos/60`; error de red en la consulta → «No pudimos conectarnos…» sin brick. Verificación: tests verdes.

## 3. Seguimiento del pendiente (D2)

- [x] 3.1 RED → GREEN + TRIANGULATE polling con timers falsos: `pendiente` → consulta cada 5 s; pasa a `aprobado` → vista aprobado, invalida detalle y lista de pedidos y sin más consultas; pasa a `rechazado` → vista rechazado con reintento; pasa a `a_devolver` → vista aprobado sin stock. Verificación: test que cuenta requests.
- [x] 3.2 RED → GREEN + TRIANGULATE tope: a los 2 min sigue `pendiente` → «La confirmación está demorando», sin más consultas automáticas; «Actualizar» hace una consulta; «Ver mi pedido» enlaza a la confirmación. Verificación: test verde.

## 4. Estado del pago en la confirmación (spec `frontend-checkout`, D3, OQ-7)

- [x] 4.1 RED → GREEN + TRIANGULATE en `pedido-creado`: rechazado con motivo + CTA; pendiente «Pago en confirmación» sin CTA; aprobado sin CTA; sin intentos sin línea extra y con CTA; pedidos no `MERCADOPAGO` no consultan `/pagos`. Verificación: tests de `pedido-creado` verdes.

## 5. Estilos y cierre técnico

- [x] 5.1 Portar los estilos de los mockups aprobados con tokens de `design-system/tokens.css`. Verificación: sin valores de color/espaciado sueltos fuera de tokens (revisión del diff).
- [x] 5.2 REFACTOR general + revisión SOLID/DRY; `npm test`, `npm run typecheck`, `npm run lint` (incluye `fsd-boundaries`) en verde. Verificación: salida de los tres comandos anotada acá.
  - Salida (2026-11-19): `npm test` 127 archivos / 1225 tests verdes; `npm run typecheck` y `npm run lint` (incluye `fsd-boundaries`) sin errores.

## 6. Verificación con el usuario

- [ ] 6.1 Prueba manual en sandbox con el backend, ngrok y credenciales de prueba del usuario (con su permiso para levantar servidores): `CONT` → pendiente → webhook → la vista pasa sola al estado final; recarga tras `APRO` y tras `FUND` reconstruye la vista; la confirmación muestra la línea de estado. Verificación: resultados anotados en `design.md`. **Diferida (2026-11-19, decisión del usuario):** se archiva sin probar el webhook con ngrok; las transiciones pendiente→aprobado/rechazado quedan cubiertas solo por tests. Retomar cuando haya ngrok configurado en el panel de MP.
- [x] 6.2 Visual verify contra los mockups aprobados (1440x900 y 390x844) en `mockups/verify/`; registrar `Visual verify` en `design.md`. Verificación: capturas y reporte de diferencias.

## Workflow follow-up

- `openspec-verify` del change; luego `/opsx:archive` (después de archivar C-20a) y marcar C-20b `[x]` en `CHANGES.md`.
