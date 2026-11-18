# Tasks — C-16a `backend-catalogo-filtros`

> **Governance BAJO**: autonomía total si los tests pasan. Sin UI (`design.md` §UI Mockups: `Decision: no (no UI)`), sin gate de mockups. OQ-1..OQ-3 del C-16 original están resueltas por el usuario (2026-11-18, `design.md` DU-1..DU-3): no hay preguntas abiertas.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. pytest con PostgreSQL real (`backend/tests/.env.test`), AAA, nombres `test_<unidad>_<escenario>_<resultado>`, valores esperados literales, sin aserciones tautológicas.
> **Hard rules**: capas `models ← repository ← uow ← services ← routers`, sin lógica ni consultas en el router; el service no importa FastAPI (lanza `AppError`); DRY (filtros en un único `_aplicar_filtros`); sin cambio de esquema ni migración; no leer ni escribir `.env*`; **no** correr `uvicorn` ni servidores (regla 13); no commitear. Comandos desde `backend/`.
> **Consumidor**: C-16b `fe-catalogo-publico` (depende de este change).

## 1. Red de seguridad

- [x] 1.1 Safety net: `pytest tests/integration/test_producto.py tests/integration/test_catalogo_visibilidad.py tests/integration/test_paginacion_listados.py -q`; anotar la línea base en este archivo. Si algo falla, frenar y reportar como falla previa.
  - Línea base (2026-11-18): 39 passed.

## 2. Rango de precio (spec «Filtro por rango de precio», «Rango de precio inválido»)

- [x] 2.1 RED: `backend/tests/integration/test_producto_filtros.py` — `test_listar_productos_con_rango_de_precio_devuelve_los_del_rango`: productos de 700, 1500 y 1900, `?precio_min=700&precio_max=1500` → nombres de 700 y 1500, `total` 2. Ejecutar → falla (el parámetro se ignora).
- [x] 2.2 GREEN: parámetros `precio_min`/`precio_max` (`Decimal`, `ge=0`) en `router.py` → `service.get_all_productos` → repositorio; extraer los filtros repetidos de `get_all_filtered`/`count_filtered` a `_aplicar_filtros` (design D1, D4). Ejecutar → verde.
- [x] 2.3 TRIANGULATE precio: solo mínimo 1600 → solo el de 1900; solo máximo 700 → solo el de 700; `min > max` (2000/1000) → 422 `VALIDATION_ERROR` `field` `precio_max` (`AppError` en el service); `precio_min=-1` → 422 `VALIDATION_ERROR` `field` `precio_min`. Ejecutar → verde.

## 3. Solo con stock (spec «Filtro solo con stock»)

- [x] 3.1 RED → GREEN `con_stock`: producto disponible con stock 0 y otro con 5, `?con_stock=true` → solo el de 5, `total` 1 (design D2). Ejecutar → verde.
- [x] 3.2 TRIANGULATE: `con_stock=false` → ambos, `total` 2; omitido → ambos. Ejecutar → verde.

## 4. Sin duplicados (spec «Resultados sin duplicados»)

- [x] 4.1 RED: producto en «Hamburguesas» y «Veganas» + otro solo en «Hamburguesas», pedido con ambos `categoria_ids` → cada producto aparece una vez y `total` es 2. Ejecutar → falla (hoy aparece duplicado y `total` es 3).
- [x] 4.2 GREEN: reemplazar los `JOIN` de `categoria_ids`/`ingrediente_ids` por `EXISTS` dentro de `_aplicar_filtros` (design D3). Ejecutar → verde.
- [x] 4.3 TRIANGULATE: producto con «Lechuga» y «Tomate» pedido con ambos `ingrediente_ids` → una vez, `total` 1; con `size=1` y 2 productos que coinciden con dos categorías cada uno → `total` 2 y `pages` 2 (el conteo y el listado coinciden). Ejecutar → verde.

## 5. Visibilidad y combinación (spec «Los filtros nuevos respetan la visibilidad»)

- [x] 5.1 TRIANGULATE: anónimo con `?precio_min=500&con_stock=true` no ve un no disponible de 1000 con stock 10; ADMIN sin `disponible` sí lo ve con los mismos filtros; `q` + `categoria_ids` + precio + `con_stock` combinados devuelven la intersección. Ejecutar → verde.

## 6. Refactor y cierre del bloque

- [x] 6.1 REFACTOR: `get_all_filtered` y `count_filtered` sin `where`/`join` propios (todo pasa por `_aplicar_filtros`); type hints en las firmas nuevas; corregir el `description` de `q` en `router.py` a «Buscar por nombre (búsqueda parcial)» (design D5). Correr la línea base del 1.1 + `test_producto_filtros.py` → verde.
- [x] 6.2 Suite backend completa `pytest -q` → verde (sin regresiones en otros módulos). Verificar con `git diff --stat backend/` que solo cambian `app/modules/productos/{router,service,repository}.py` y el test nuevo.
  - Resultado (2026-11-18): suite completa `pytest -q` → **1683 passed, 0 failed** en 7 min 19 s.

## 7. Documentación

- [x] 7.1 `knowledge-base/06_funcionalidades.md` US-007: filtros `precio_min`/`precio_max`/`con_stock` disponibles en el backend (C-16a) y sin duplicados por categoría. Verificar con `grep -n "C-16a" knowledge-base/06_funcionalidades.md`.
- [x] 7.2 `CHANGES.md`: C-16b recibe «Punto de partida (C-16a)» (nombres exactos de los parámetros, `categoria_ids` repetido sin `[]`, 422 `field` `precio_max`, sin duplicados → `total` confiable para la paginación). Verificar con `grep -n "Punto de partida (C-16a)" CHANGES.md`.

## Workflow follow-up

- verify → `/opsx:archive` y marcar `[x]` C-16a en `CHANGES.md`; luego C-16b puede aplicar su bloque de frontend.
