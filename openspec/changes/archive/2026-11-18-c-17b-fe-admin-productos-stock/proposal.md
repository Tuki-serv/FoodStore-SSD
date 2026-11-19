# Proposal — C-17b `fe-admin-productos-stock`

## Why

US-010 (gestión de productos, ADMIN) y US-012 (stock y disponibilidad, STOCK) solo existen en la API: `/admin/productos` muestra la página provisoria (dueño `C-17b` en `route-map.ts`). Sin esta pantalla nadie puede dar de alta un producto con sus categorías e ingredientes (`es_removible`, que habilita la personalización de C-18) ni el rol `STOCK` puede hacer su único trabajo. Además, C-17a dejó dos huecos de backend que esta pantalla necesita cerrados (decisión del usuario, 2026-11-18): el ingrediente no expone ni deja cambiar su unidad, y crear o editar un producto con ingredientes responde 500.

Observado en el repo (`dev`, 2026-11-18):

- **Productos** (`/api/v1/productos`): `GET /` paginado (`page`, `size` ≤100; filtros `q`, `categoria_ids` repetido, `disponible`, `precio_min`/`precio_max`, `con_stock`, `estado`; orden por `id`), cada ítem `ProductoReadFull` (`id`, `nombre`, `descripcion`, `precio_base` decimal como string, `stock_cantidad`, `disponible`, `imagenes_url`, `unidad_venta_id`, `categorias[{id,nombre,es_principal}]`, `ingredientes[{id,nombre,es_alergeno,es_removible,cantidad,unidad_medida_id}]`). ADMIN y STOCK ven también los no disponibles; solo ADMIN ve eliminados. `GET /{id}` igual visibilidad. `POST /` (ADMIN, 201) con `nombre` (≤150, único entre activos → 409 `DUPLICATE_VALUE` `field=nombre`), `descripcion?`, `precio_base` (≥0), `stock_cantidad` (≥0, defecto 0), `disponible` (defecto true), `categoria_ids` (mín. 1; la **primera** queda `es_principal`; 404 si una no existe) e `ingredientes?[{ingrediente_id, cantidad>0, unidad_medida_id, es_removible}]`. `PUT /{id}` (ADMIN) es **parcial** (`exclude_unset`): `categoria_ids`/`ingredientes`, si vienen, **reemplazan** las asociaciones. `DELETE /{id}` (ADMIN, 204, soft delete).
- **Inventario** (C-08): `PATCH /{id}/stock` `{"stock_cantidad": int>=0}` y `PATCH /{id}/disponibilidad` `{"disponible": bool}`, ambos ADMIN/STOCK, idempotentes, `extra="forbid"`, 200 con `ProductoReadFull`, 404 si eliminado, independientes entre sí (RN-PR-02).
- **Ingredientes de un producto**: `GET /{id}/ingredientes` (público, ordenado por nombre), `POST /{id}/ingredientes` (ADMIN, crea o actualiza una asociación con cantidad y unidad: **funciona**), `DELETE /{id}/ingredientes/{ing_id}` (ADMIN, 204).
- **Bug C-11, más amplio de lo registrado**: `ProductoService.create` **y** `ProductoService.update` arman `ProductoIngrediente` sin `cantidad` ni `unidad_medida_id` (columnas `NOT NULL`) → `IntegrityError` sin manejar → **500** al crear o editar un producto con `ingredientes`. Tampoco se valida la unidad, ni que un `ingrediente_id` o `categoria_id` venga repetido en la lista (PK compuesta duplicada → 500).
- **Ingredientes** (`/api/v1/ingredientes`): `IngredienteRead`/`IngredienteReadFull` **no** incluyen `unidad_medida_id` (`_to_read_full` tampoco lo copia) e `IngredienteUpdate` **no** lo acepta; el alta lo acepta (defecto 1) pero no valida que la unidad exista (FK → 500). La columna existe (`NOT NULL`): no hace falta migración.
- `ProductoReadFull.unidad_venta_id` llega siempre `null` (`_to_read_full` no lo copia); la unidad de venta no está en ninguna historia del alcance (US-014 → C-28).
- **Frontend**: `RUTAS.adminProductos` ya tiene `roles: ['ADMIN','STOCK']` (C-13b) y el panel muestra «Productos y stock» a ambos; `entities/producto` (C-16b) tiene el tipo `Producto`, `formatearPrecio`, `estadoStock`, `categoriaPrincipal` y `listarProductos`, que **fuerza** `disponible=true` (catálogo público); `entities/ingrediente` y `entities/unidad-medida` (C-17a) ya existen; `shared/ui` tiene `estados`, `dialogo-baja`, `paginacion` y `lista-admin`. `pages/admin-ingredientes` muestra la unidad «cuando llega» y en la edición ofrece «Sin cambios» porque no la conoce.

## What Changes

- **Página «Productos y stock»** (`/admin/productos`, ADMIN y STOCK): listado paginado (20) de todos los productos activos, incluidos los no disponibles, con nombre, categoría principal, precio, stock (marca «Agotado»/«Quedan N») y disponibilidad; búsqueda por nombre, filtro por categoría y por disponibilidad (en la URL); esqueleto, vacío (con y sin filtros) y error con reintento.
- **Stock y disponibilidad en la fila** (ADMIN y STOCK): campo numérico de stock con «Guardar» (seteo absoluto, entero ≥0) e interruptor «Disponible»; cada uno usa su `PATCH` y avisa el resultado; el error se muestra en la fila sin perder lo escrito.
- **Vista por rol**: `STOCK` ve solo esas dos acciones (sin «Nuevo producto», «Editar» ni «Eliminar»); `ADMIN` ve todo.
- **Formulario de producto** (ADMIN, alta y edición en la misma página, patrón C-15/C-17a): nombre, descripción, precio, stock inicial y «Disponible» (solo en el alta), categorías (al menos una, con una principal) e ingredientes (ingrediente, cantidad, unidad —propuesta la del ingrediente— y «Se puede quitar» = `es_removible`); se guarda en **un solo pedido** (`POST` o `PUT` parcial). Errores por campo; 409 de nombre en «Nombre».
- **Baja de producto** (ADMIN): diálogo de confirmación; soft delete; el producto deja de verse en el catálogo.
- **Backend — ingredientes**: `GET /ingredientes/` y `GET /ingredientes/{id}` (y las respuestas de alta/edición) devuelven `unidad_medida_id`; `PATCH /ingredientes/{id}` acepta `unidad_medida_id`; alta y edición validan que la unidad exista (404 en vez de 500).
- **Backend — productos con ingredientes**: `POST /productos/` y `PUT /productos/{id}` guardan `cantidad`, `unidad_medida_id` y `es_removible` de cada ingrediente (fin del 500 de C-11), validan la unidad (404) y rechazan ingredientes o categorías repetidos en la lista (422).
- **Seguimiento de C-17a** (`pages/admin-ingredientes`): la fila siempre muestra la unidad y la edición preelige la unidad actual (desaparece «Sin cambios»).
- **Docs al cerrar**: KB/06 (US-010, US-012, US-011), KB/08 (árbol FSD), KB/09 (bug C-11 resuelto), `frontend/README.md`, `CHANGES.md`.

**Fuera de alcance (con dueño):** imágenes de producto y unidad de venta (C-28: US-013, US-014); ver o restaurar eliminados; edición masiva de stock; historial de movimientos de stock (no especificado); personalización en el carrito (C-18).

## Capabilities

### New Capabilities
- `ingredient-measure-unit`: la unidad de medida de un ingrediente en la API (se expone en las lecturas, se puede cambiar y se valida al escribir).

### Modified Capabilities
- `frontend-admin-catalog`: se agregan productos y stock (acceso ADMIN/STOCK, listado, stock y disponibilidad en la fila, alta/edición con categorías e ingredientes, baja) y cambian «Listado de ingredientes» y «Alta y edición de ingrediente» (unidad siempre visible y preelegida en la edición).
- `product-ingredients`: se agrega la configuración de ingredientes (cantidad, unidad, `es_removible`) al crear o editar un producto, con sus validaciones.

## Impact

- **Frontend nuevo** (`frontend/src/`): `pages/admin-productos/` (`ui/`, `model/`, `index.ts`), API de gestión en `entities/producto/api/` (lista de gestión, detalle, mutaciones de alta/edición/baja/stock/disponibilidad), handlers MSW `src/test/msw/admin-productos.ts`.
- **Frontend modificado**: `app/router/routes.tsx` (monta la página), `entities/ingrediente` (`unidad_medida_id` obligatorio), `pages/admin-ingredientes` (unidad preelegida), `shared/ui/icon` (íconos que apruebe el mockup).
- **Backend modificado**: `modules/ingredientes/` (schemas, service), `modules/productos/` (schemas, service: helper único de asociación de ingredientes reutilizado por alta, edición y `POST /{id}/ingredientes`). Tests pytest contra PostgreSQL real. **Sin migración** (columnas existentes). **Paquetes**: ninguno.
- **Dependencias**: C-17a y C-08 (cerrados). Desbloquea C-18 (personalización con `es_removible`).
- **Governance MEDIO** (catálogo, no auth/pagos): implementar con checkpoints; gate previo: mockups aprobados (`[UI-MOCKUP]`, política `system-and-mockups`).
