# Tasks — C-25b `entrega-docs-video`

Convenciones:
- Bloque B del C-25b original (partición aprobada por el usuario 2026-11-21): entrega (documentación, evidencia y tareas del usuario). La deuda heredada (código con TDD) está en `c-25b1-deuda-heredada`. **Dependencia**: las capturas, el recorrido E2E y el video (grupos 2, 3 y 5) se hacen sobre el código ya cerrado, es decir con `c-25b1-deuda-heredada` archivado; la redacción de documentación (grupos 1 y 4) puede adelantarse y se revisa al final.
- `[USUARIO]` = la hace el usuario, no el agente. `[GATE: …]` = no empezar hasta resolver lo indicado. `[OQ-x]`/`[PA-xx]` = tarea condicionada por esa decisión abierta (se escribe con la opción recomendada).
- Backend: comandos desde `backend/` (`pytest` contra `foodstore_test`). Frontend: desde `frontend/` (`npm test`, `npm run typecheck`, `npm run lint`). No levantar dev server ni build sin permiso (regla 13); no commitear.

## 1. Arranque reproducible y plantillas de entorno (US-029, CE-02..CE-07)

- [x] 1.1 Test de plantillas: variables `${...}` de `docker-compose.yml` ⊆ `.env.example` raíz; extender los tests existentes de `backend/.env.example` y `frontend/.env.example` para cubrir todas las variables y comentarios de MercadoPago; verifica: escenarios «Plantillas de entorno completas» en verde — Hecho: `backend/tests/unit/test_entrega_docs.py` (compose contenido en la raíz, README vs. scripts/módulos/compose/seed, checklist, metadatos, recorrido) + los tests existentes de las plantillas de entorno. Los 3 tests de comentarios de MercadoPago están en xfail estricto hasta completar 1.2
- [x] 1.2 Hecho (2026-11-23): el usuario agregó en `backend/.env.example` el comentario «dónde se obtiene» de las tres variables de MercadoPago (la lectura de las plantillas está denegada al agente); se quitó el xfail y `test_entrega_docs.py` pasa completo (73); CE-03 marcado cumplido en el checklist. Revisar y completar los tres `.env.example` (placeholders no sensibles, comentario por variable, de dónde sale cada credencial de MercadoPago); verifica: tests de 7.1 en verde y ningún valor con forma de credencial real
- [x] 1.3 Reescribir `README.md` raíz como guía única: requisitos, pasos en orden con directorio y resultado esperado (compose `db` → `pip install` → `alembic upgrade head` → `python -m app.db.seed` → `uvicorn` → `npm install` → `npm run dev`), credenciales del seed, tests y cobertura (PA-16 resuelta), MercadoPago sandbox + ngrok, perfil `prod`, estado del roadmap actualizado, limitaciones conocidas (DT-28, PA-07, UTC, envío fijo PA-13, sin idempotencia), enlaces a `docs/entrega/`; verifica: escenarios de `project-delivery` «Arranque reproducible», «Credenciales de prueba» y «Limitaciones conocidas», y un test/script que comprueba que los scripts y variables nombrados existen — README raíz reescrito (pasos con directorio y resultado, credenciales del seed, tests y cobertura, MercadoPago + ngrok, perfil `prod`, estado actualizado, «Limitaciones conocidas» con DT-28, PA-07, UTC, PA-13, idempotencia y Tailwind, enlaces a `docs/entrega/`); el enlace al video queda `(TBD)` hasta la tarea 5.2
- [ ] 1.4 [USUARIO] Prueba en máquina o carpeta limpia (clone nuevo) siguiendo solo el README; anotar fricciones; verifica: checklist CE-02..CE-07 marcado con fecha en `docs/entrega/checklist-rubrica.md` (evita la penalización del −30 %)

## 2. Recorrido E2E con frontend (compra → pago → entrega) [OQ-3]

- [x] 2.1 Escribir `docs/entrega/recorrido-e2e.md`: pasos, cuenta, resultado esperado (efectivo hasta `ENTREGADO`; tarjeta sandbox `APRO` hasta `CONFIRMADO`; cancelación con motivo; dashboard con la venta); verifica: escenarios de `project-delivery` «Recorrido de punta a punta verificado» cubiertos paso a paso — `docs/entrega/recorrido-e2e.md` escrito (tramos A efectivo, B tarjeta sandbox, C cancelación); sin ejecutar
- [x] 2.2 [GATE: `c-25b1-deuda-heredada` archivado] [GATE: permiso del usuario para levantar el stack, regla 13] Ejecutar el tramo efectivo con Edge headless + `playwright-core` contra el stack local, registrando resultado, fecha y capturas; detener lo que se levantó; verifica: resultado anotado en `recorrido-e2e.md` con capturas — **Hecho (2026-11-23): tramos A (pedido #62, hasta `ENTREGADO`) y C (cancelación con motivo, #64 y #65) ok con Edge headless + `playwright-core` sobre el stack ya levantado; resultados en `recorrido-e2e.md`; el tramo B sigue `[USUARIO]`.**
- [ ] 2.3 [USUARIO] Ejecutar el tramo con tarjeta sandbox (CE-09) con ngrok y el webhook configurado en el panel; verifica: pedido `CONFIRMADO` por «Sistema» anotado en `recorrido-e2e.md`

## 3. Capturas y verificación visual (CE-12)

- [x] 3.1 [GATE: 2.2] Capturar ≥ 10 pantallas distintas a 1440x900 y 390x844 (catálogo, producto, carrito, checkout, pago, mis pedidos/detalle, gestión de pedidos, productos y stock, usuarios, dashboard, más 404/ingresar) en `docs/entrega/capturas/NN-<pantalla>-<viewport>.png`; verifica: escenario «Diez pantallas distintas» y enlaces desde el checklist — **Hecho (2026-11-23): 17 pantallas distintas en ambos viewports (34 PNG) en `docs/entrega/capturas/`; CE-12 pasa a cumplido; sin errores de consola salvo el 401 esperado de `/auth/refresh` en sesión anónima; defectos hallados informados para el verify visual (3.2).**
- [x] 3.2 Verify visual: comparar cada pantalla con su mockup aprobado (16 carpetas `archive/*/mockups/`) y con design system Revision 3 (aprobada en `c-25b1-deuda-heredada`); reportar diferencias blocker/major/minor por pantalla y viewport, revisar consola y red; guardar en `openspec/changes/c-25b-entrega-docs-video/verify/`; verifica: informe con pantallas revisadas y no revisadas, `Visual verify:` registrado en design.md — **Hecho (2026-11-23): `verify/informe-visual.md` — 17 pantallas x 2 viewports comparadas contra los mockups de `2026-11-23-revision-visual` (design system Revision 4, no la 3 que decía la tarea) y barrido programático de 19 rutas a 390x844 y 375x667; 0 blocker, 1 major (V-01: «+» del selector de cantidad tapado por el precio en `/carrito` mobile), 12 minor (V-02 «Guardar» de stock cortado en `/admin/productos` mobile, V-03 ícono de refrescar suelto en el detalle de gestión mobile, V-04..V-13 divergencias de apariencia); consola sin errores salvo el 401 esperado de `/auth/refresh` anónimo; `Visual verify: differences` registrado en design.md; los defectos quedan para decisión del usuario (no se tocó código de la aplicación).**

## 4. Checklist de rúbrica, guion y metadatos

- [x] 4.1 `docs/entrega/checklist-rubrica.md`: 13 criterios (200 pts), bonus (+10 tests, +10 deploy) y CE-01..CE-14 con estado (cumplido / parcial / pendiente del usuario) y evidencia (archivo, test, captura o minuto del video); verifica: escenario «Cobertura del checklist» (cada ítem una sola vez) — `docs/entrega/checklist-rubrica.md` con estados honestos (CE-01, CE-09, CE-12, CE-13, CE-14 pendientes; CE-03 parcial por 1.2; bonus de deploy sin reclamar)
- [x] 4.2 `docs/entrega/guion-video.md` de 5–10 min con cuenta por paso (registro/ingreso, catálogo, carrito, checkout, pago sandbox, seguimiento, avance hasta `ENTREGADO`, dashboard, Swagger, tests); verifica: escenario «Guion completo» — Hecho (2026-11-23): `docs/entrega/guion-video.md` — 15 pasos con minuto, cuenta, pantalla, narración y criterio (total 9:40), «Preparación antes de grabar» (stack, seed, ngrok + webhook, cuentas por email sin contraseñas), variante `EFECTIVO` sin ngrok, «Después de grabar» (subir, enlace sin sesión, README 5.2, CE-13); enlazado desde el README y citado en CE-13 (que sigue pendiente: el video es del usuario); 11 tests nuevos en `test_entrega_docs.py`
- [x] 4.3 [PA-18] `docs/entrega/metadatos.md` con materia, carrera, equipo y docente en `(TBD)` visibles; verifica: escenario «Metadato sin confirmar» — `docs/entrega/metadatos.md` con materia, carrera, equipo y docente en `(TBD)`
- [x] 4.4 [USUARIO] [PA-18] Informar materia, carrera, equipo y docente; verifica: los `(TBD)` reemplazados y PA-18 marcada resuelta en `knowledge-base/10_preguntas_abiertas.md` — Hecho (2026-11-23): el usuario informó los datos; `docs/entrega/metadatos.md` completo (dos docentes), PA-18 resuelta en la KB y tests de metadatos actualizados a los valores confirmados

## 5. Video y publicación — tareas del usuario

- [ ] 5.1 [USUARIO] Grabar el video siguiendo `guion-video.md` (5–10 min) y subirlo; verifica: enlace accesible sin sesión
- [ ] 5.2 Agregar el enlace del video al README (CE-13) cuando el usuario lo provea; verifica: escenario «Enlace presente»
- [ ] 5.3 [USUARIO] Repositorio público y verificado con sesión cerrada (CE-01, CE-14); verifica: el repo abre en una ventana privada y el checklist lo marca

## 6. Deploy opcional [PA-17 / OQ-1 — recomendado: no en este change]

- [x] 6.1 ~~[GATE: PA-17 = sí] Documentar el plan de deploy elegido (variables `REFRESH_COOKIE_SECURE=true`, `REFRESH_COOKIE_SAMESITE`, `CORS_ORIGINS`, URL del webhook en el panel, migraciones + seed en el entorno) en el README; si PA-17 = no, registrar «sin deploy» en el checklist; verifica: sección o fila presente~~ **N/A: PA-17 = no (decisión del usuario 2026-11-21, sin deploy)** Registrado en el checklist y en «Limitaciones conocidas» del README; el bonus de +10 por deploy queda sin reclamar.
- [x] 6.2 ~~[USUARIO] [GATE: PA-17 = sí] Crear las cuentas y servicios en el proveedor y cargar los secretos (nunca en el repo); verifica: URL pública responde `/health` y el catálogo~~ **N/A: PA-17 = no (decisión del usuario 2026-11-21, sin deploy)**

## 7. Integración final

- [ ] 7.1 Actualizar `CHANGES.md` (estado de C-25b, ítems diferidos X1–X4 de `c-25b1-deuda-heredada` con destino) y `knowledge-base/13_rubrica_y_entrega.md` («Estado frente a la rúbrica» al día); verifica: ambos reflejan el estado final y los diferidos — pendiente: se hace al cerrar el change (el estado parcial ya figura en `CHANGES.md`)

## 8. Correcciones del verify visual

- [x] 8.1 V-01 (major) `/carrito` mobile: «Sumar una unidad» tapado por el subtotal. Hecho (2026-11-23): grilla mobile de `.cartitem` en `frontend/src/pages/carrito/ui/carrito.css` pasa a `64px minmax(0,1fr) auto auto` con áreas `"thumb meta meta meta" "qty qty sub remove"` (el selector ocupa las dos primeras columnas); comprobado con `elementFromPoint` y un clic real que sube la cantidad a 390x844 y 375x667, sin cambios a 1440x900.
- [x] 8.2 V-02 (minor) `/admin/productos` mobile: «Guardar stock» cortado en el borde de la tarjeta. Hecho (2026-11-23): `min-width:0` en `.stock-edit .input-sm` (`admin-productos.css`) para que el campo se achique y el botón entre; los 6 botones quedan dentro de su tarjeta y del viewport a 390x844 y 375x667.
- [x] 8.3 V-03 (minor) detalle de pedido (gestión) mobile: ícono «Actualizar» suelto y título partido en dos líneas. Hecho (2026-11-23): en `shared/ui/encabezado-pagina/encabezado-pagina.css` (≤1023 px) la banda con «Actualizar» seguido de otras acciones pasa a grilla: título y ícono en la misma fila (ícono a la derecha) y las acciones debajo a todo el ancho; el título «Pedido #N» entra en una línea. Alcanza también a `mi-pedido-detalle` (mismo patrón); desktop sin cambios.
- [ ] 8.4 [USUARIO] Decidir qué hacer con V-04..V-13 del informe visual (ajustar la app o actualizar el mockup); no se corrigieron en este paso.

## Workflow follow-up

- Verify del change (`openspec-verify`), incluido el verify visual del grupo 3.
- Archivar con `/opsx:archive` y marcar C-25b `[x]` en `CHANGES.md`.
- Commits y push solo a pedido del usuario, siguiendo el flujo `dev → main → dev` de `CLAUDE.md`.
