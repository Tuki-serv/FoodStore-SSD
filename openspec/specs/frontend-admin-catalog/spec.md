# frontend-admin-catalog Specification

## Purpose
Define cómo un usuario con rol `ADMIN` administra el catálogo desde el frontend (US-009, US-011, RN-CA-01..03): el árbol de categorías con alta, edición sin ciclos y baja validada, y los ingredientes con su marca de alérgeno y unidad de medida.

## Requirements

### Requirement: Acceso solo para ADMIN
Las páginas «Categorías» (`/admin/categorias`) e «Ingredientes» (`/admin/ingredientes`) SHALL estar disponibles solo para usuarios con rol `ADMIN` (entre cualquiera de sus roles). Un usuario con sesión sin ese rol SHALL ver la página de acceso denegado y no SHALL disparar pedidos de escritura.

#### Scenario: ADMIN abre Categorías
- **WHEN** un usuario con roles `ADMIN` y `CLIENT` abre `/admin/categorias`
- **THEN** ve el título «Categorías» y el botón «Nueva categoría»

#### Scenario: STOCK no ve la administración de categorías
- **WHEN** un usuario con rol `STOCK` abre `/admin/ingredientes`
- **THEN** ve la página de acceso denegado y el panel lateral no muestra «Categorías» ni «Ingredientes»

### Requirement: Árbol de categorías
La página «Categorías» SHALL mostrar todas las categorías activas como un árbol en el orden del servidor, con las subcategorías anidadas bajo su padre y, por fila, el nombre, la descripción, la cantidad de subcategorías y las acciones «Editar», «Agregar subcategoría» y «Eliminar» nombradas con la categoría. Mientras carga SHALL mostrar un esqueleto; sin categorías, un estado vacío con «Nueva categoría»; ante un error, un mensaje con «Reintentar».

#### Scenario: Árbol del seed
- **WHEN** el servidor devuelve «Bebidas» (con «Gaseosas»), «Hamburguesas» (con «Sin TACC» y «Veganas») y «Postres»
- **THEN** se ven tres filas raíz y las subcategorías dentro de su padre; la fila «Hamburguesas» indica «2 subcategorías» y tiene el botón «Eliminar Hamburguesas»

#### Scenario: Sin categorías
- **WHEN** el árbol llega vacío
- **THEN** se ve «Todavía no hay categorías» con el botón «Nueva categoría»

#### Scenario: Error al cargar
- **WHEN** el pedido del árbol falla y el usuario pulsa «Reintentar»
- **THEN** se vuelve a pedir el árbol y, si responde, se muestran las categorías

### Requirement: Alta y edición de categoría
El formulario de categoría SHALL pedir nombre (obligatorio, sin espacios a los costados, hasta 100 caracteres), descripción opcional, categoría padre opcional y URL de imagen opcional; con datos inválidos no SHALL enviar nada y SHALL mostrar el error junto a cada campo. Al guardar con éxito SHALL volver al árbol con un aviso de éxito y el cambio SHALL verse también en el catálogo público sin recargar.

#### Scenario: Crear una subcategoría
- **WHEN** el ADMIN pulsa «Agregar subcategoría» en «Bebidas», escribe «Aguas» y guarda
- **THEN** se envía `POST /categorias/` con `nombre` «Aguas» y `parent_id` de «Bebidas», se ve el aviso «Categoría creada» y «Aguas» aparece bajo «Bebidas»

#### Scenario: Nombre vacío
- **WHEN** el ADMIN guarda el formulario con el nombre en blanco
- **THEN** no se envía ningún pedido y «Nombre» muestra «Ingresá un nombre.»

#### Scenario: Nombre repetido
- **WHEN** el servidor responde 409 `DUPLICATE_VALUE` con `field` `nombre`
- **THEN** «Nombre» muestra «Ya existe una categoría con ese nombre.» y lo escrito se conserva

#### Scenario: Error del servidor o de red al guardar
- **WHEN** el servidor responde 400 (ciclo) o no responde
- **THEN** se ve una alerta general arriba del formulario con el detalle y los datos escritos se conservan

### Requirement: Padre de categoría sin ciclos
Al editar una categoría, el selector de padre no SHALL ofrecer la propia categoría ni ninguna de sus descendientes.

#### Scenario: Padre sin ciclos
- **WHEN** el ADMIN edita «Hamburguesas»
- **THEN** el selector de padre ofrece «Sin padre (categoría raíz)», «Bebidas», «Gaseosas» y «Postres», y no ofrece «Hamburguesas», «Veganas» ni «Sin TACC»

### Requirement: Baja de categoría validada
«Eliminar» SHALL abrir un diálogo de confirmación con el nombre de la categoría. Si el árbol muestra subcategorías activas, el diálogo SHALL explicar que primero hay que moverlas o eliminarlas y no SHALL ofrecer «Eliminar». Si el servidor responde 409 `CATEGORY_HAS_PRODUCTS` o `CATEGORY_HAS_CHILDREN`, el diálogo SHALL mostrar el motivo y quedar abierto sin cambiar el árbol.

#### Scenario: Baja exitosa
- **WHEN** el ADMIN confirma la baja de «Postres» y el servidor responde 204
- **THEN** el diálogo se cierra, se ve «Categoría eliminada» y «Postres» deja de estar en el árbol

#### Scenario: Categoría con subcategorías
- **WHEN** el ADMIN pulsa «Eliminar Hamburguesas»
- **THEN** el diálogo dice que tiene 2 subcategorías activas, ofrece solo «Entendido» y no se envía ningún pedido

#### Scenario: Categoría con productos
- **WHEN** el servidor responde 409 `CATEGORY_HAS_PRODUCTS` al eliminar «Gaseosas»
- **THEN** el diálogo muestra «No se puede eliminar: tiene productos activos» con la indicación de quitarlos desde «Productos y stock», ofrece «Cerrar» e «Ir a Productos y stock», y «Gaseosas» sigue en el árbol

### Requirement: Listado de ingredientes
La página «Ingredientes» SHALL listar los ingredientes activos en páginas de 20, en el orden del servidor, con nombre, descripción, unidad de medida, la marca «Alérgeno» cuando corresponde y la cantidad de productos que lo usan. SHALL ofrecer el filtro «Todos» / «Alérgenos» / «No alérgenos», guardado en la URL junto con la página, y estados de carga, vacío (con y sin filtro) y error con reintento.

#### Scenario: Ingredientes del seed
- **WHEN** el servidor devuelve «Pan Brioche» (`es_alergeno` true, unidad «u», usado por 3 productos) y «Lechuga» (`es_alergeno` false)
- **THEN** «Pan Brioche» muestra la marca «Alérgeno» y «Usado en 3 productos», y «Lechuga» no muestra la marca

#### Scenario: Filtrar alérgenos
- **WHEN** el ADMIN elige «Alérgenos»
- **THEN** el pedido incluye `is_alergeno=true` y `page=1`, y la URL guarda el filtro

#### Scenario: Filtro sin resultados
- **WHEN** el filtro «Alérgenos» no devuelve ingredientes
- **THEN** se ve «No hay ingredientes alérgenos» con «Ver todos»

### Requirement: Alta y edición de ingrediente
El formulario de ingrediente SHALL pedir nombre (obligatorio, sin espacios a los costados, hasta 100 caracteres), descripción opcional, unidad de medida (lista del servidor, «Unidad» por defecto en el alta) y «Es alérgeno». Con datos inválidos no SHALL enviar nada; el 409 `DUPLICATE_VALUE` de `nombre` SHALL mostrarse en «Nombre»; otros errores, como alerta general conservando lo escrito. Al guardar con éxito SHALL volver al listado con un aviso y reflejar el cambio sin recargar.

#### Scenario: Crear un alérgeno
- **WHEN** el ADMIN escribe «Maní», marca «Es alérgeno», elige la unidad «Gramo (g)» y guarda
- **THEN** se envía `POST /ingredientes/` con `nombre` «Maní», `es_alergeno` true y el `unidad_medida_id` de «g», y se ve «Ingrediente creado»

#### Scenario: Editar sin cambiar el nombre
- **WHEN** el ADMIN edita «Mayonesa», desmarca «Es alérgeno» y guarda
- **THEN** se envía `PATCH /ingredientes/<id>` solo con los campos cambiados y la fila deja de mostrar «Alérgeno»

#### Scenario: Ingrediente repetido
- **WHEN** el servidor responde 409 `DUPLICATE_VALUE` con `field` `nombre`
- **THEN** «Nombre» muestra «Ya existe un ingrediente con ese nombre.»

### Requirement: Baja de ingrediente
«Eliminar» SHALL abrir un diálogo de confirmación con el nombre del ingrediente que, si lo usan productos, SHALL avisar cuántos y cuáles (hasta 3 nombres y «y N más»). Al confirmar y responder el servidor 204, SHALL cerrar el diálogo, avisar el éxito y quitarlo del listado; ante un error SHALL mostrarlo dentro del diálogo.

#### Scenario: Ingrediente en uso
- **WHEN** el ADMIN pulsa «Eliminar Queso Cheddar», usado por «Hamburguesa Clásica», «Burger BBQ Bacon» y «Burger Sin TACC»
- **THEN** el diálogo avisa «Lo usan 3 productos: Hamburguesa Clásica, Burger BBQ Bacon, Burger Sin TACC» y ofrece «Cancelar» y «Eliminar»

#### Scenario: Baja exitosa
- **WHEN** el ADMIN confirma y el servidor responde 204
- **THEN** se ve «Ingrediente eliminado» y la fila deja de mostrarse
