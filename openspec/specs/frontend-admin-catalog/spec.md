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
La página «Ingredientes» SHALL listar los ingredientes activos en páginas de 20, en el orden del servidor, con nombre, descripción, unidad de medida (siempre, con nombre y símbolo), la marca «Alérgeno» cuando corresponde y la cantidad de productos que lo usan. SHALL ofrecer el filtro «Todos» / «Alérgenos» / «No alérgenos», guardado en la URL junto con la página, y estados de carga, vacío (con y sin filtro) y error con reintento.

#### Scenario: Ingredientes del seed
- **WHEN** el servidor devuelve «Pan Brioche» (`es_alergeno` true, unidad «u», usado por 3 productos) y «Lechuga» (`es_alergeno` false)
- **THEN** «Pan Brioche» muestra la marca «Alérgeno», «Unidad (u)» y «Usado en 3 productos», y «Lechuga» no muestra la marca

#### Scenario: Filtrar alérgenos
- **WHEN** el ADMIN elige «Alérgenos»
- **THEN** el pedido incluye `is_alergeno=true` y `page=1`, y la URL guarda el filtro

#### Scenario: Filtro sin resultados
- **WHEN** el filtro «Alérgenos» no devuelve ingredientes
- **THEN** se ve «No hay ingredientes alérgenos» con «Ver todos»

### Requirement: Alta y edición de ingrediente
El formulario de ingrediente SHALL pedir nombre (obligatorio, sin espacios a los costados, hasta 100 caracteres), descripción opcional, unidad de medida (lista del servidor, «Unidad» por defecto en el alta y la unidad actual en la edición) y «Es alérgeno». Con datos inválidos no SHALL enviar nada; el 409 `DUPLICATE_VALUE` de `nombre` SHALL mostrarse en «Nombre»; otros errores, como alerta general conservando lo escrito. Al guardar con éxito SHALL volver al listado con un aviso y reflejar el cambio sin recargar.

#### Scenario: Crear un alérgeno
- **WHEN** el ADMIN escribe «Maní», marca «Es alérgeno», elige la unidad «Gramo (g)» y guarda
- **THEN** se envía `POST /ingredientes/` con `nombre` «Maní», `es_alergeno` true y el `unidad_medida_id` de «g», y se ve «Ingrediente creado»

#### Scenario: Editar sin cambiar el nombre
- **WHEN** el ADMIN edita «Mayonesa», desmarca «Es alérgeno» y guarda
- **THEN** se envía `PATCH /ingredientes/<id>` solo con los campos cambiados y la fila deja de mostrar «Alérgeno»

#### Scenario: La edición preelige la unidad actual
- **WHEN** el ADMIN edita «Maní», medido en gramos
- **THEN** el selector de unidad muestra «Gramo (g)» elegido y no ofrece «Sin cambios»

#### Scenario: Cambiar la unidad
- **WHEN** el ADMIN cambia la unidad de «Maní» a «Kilogramo (kg)» y guarda
- **THEN** se envía `PATCH /ingredientes/<id>` solo con el `unidad_medida_id` de «kg» y la fila muestra «Kilogramo (kg)»

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

### Requirement: Acceso a Productos y stock por rol
La página «Productos y stock» (`/admin/productos`) SHALL estar disponible para usuarios con rol `ADMIN` o `STOCK` (entre cualquiera de sus roles). Con `ADMIN` SHALL ofrecer todas las acciones; con `STOCK` y sin `ADMIN`, solo editar stock y disponibilidad, sin «Nuevo producto», «Editar» ni «Eliminar». Otros usuarios SHALL ver la página de acceso denegado sin disparar pedidos de escritura.

#### Scenario: STOCK ve acciones limitadas
- **WHEN** un usuario con solo el rol `STOCK` abre `/admin/productos`
- **THEN** ve el listado con el campo de stock y el interruptor «Disponible» en cada fila, y no ve «Nuevo producto», «Editar» ni «Eliminar»

#### Scenario: ADMIN ve todas las acciones
- **WHEN** un usuario con roles `ADMIN` y `STOCK` abre `/admin/productos`
- **THEN** ve «Nuevo producto» y, en cada fila, «Editar <producto>» y «Eliminar <producto>» además del stock y la disponibilidad

#### Scenario: CLIENT no entra
- **WHEN** un usuario con solo el rol `CLIENT` abre `/admin/productos`
- **THEN** ve la página de acceso denegado y no se envía ningún pedido de escritura

### Requirement: Listado de productos para gestión
La página SHALL listar en páginas de 20, en el orden del servidor, todos los productos activos que el usuario puede ver, incluidos los no disponibles, con nombre, categoría principal, precio, stock (con la marca «Agotado» en 0) y disponibilidad. SHALL ofrecer búsqueda por nombre, filtro por categoría y por disponibilidad («Todos» / «Disponibles» / «No disponibles»), guardados en la URL con la página, y estados de carga, vacío (con y sin filtros) y error con reintento.

#### Scenario: Productos del seed con uno no disponible
- **WHEN** el servidor devuelve «Hamburguesa Clásica» (stock 50, disponible) y «Limonada Natural» (stock 0, no disponible)
- **THEN** «Hamburguesa Clásica» muestra «Hamburguesas», «$ 1.500» y stock 50; «Limonada Natural» muestra «Agotado» y el interruptor «Disponible» apagado

#### Scenario: Filtrar no disponibles
- **WHEN** el usuario elige «No disponibles»
- **THEN** el pedido incluye `disponible=false` y `page=1`, y la URL guarda el filtro

#### Scenario: Búsqueda sin resultados
- **WHEN** la búsqueda «pizza» no devuelve productos
- **THEN** se ve «No encontramos productos con esos filtros» con «Limpiar filtros»

#### Scenario: Error al cargar
- **WHEN** el pedido del listado falla y el usuario pulsa «Reintentar»
- **THEN** se vuelve a pedir el listado

### Requirement: Stock desde la lista
Cada fila SHALL permitir fijar el stock con un número entero mayor o igual a 0 y «Guardar stock de <producto>». Un valor inválido no SHALL enviar nada y SHALL mostrar el error en la fila. Al guardar SHALL enviar `PATCH /productos/{id}/stock` con `{"stock_cantidad": n}`, mostrar el valor devuelto y un aviso; ante un error SHALL mostrarlo en la fila conservando lo escrito. Cambiar el stock no SHALL cambiar la disponibilidad.

#### Scenario: Fijar stock
- **WHEN** un usuario `STOCK` escribe 12 en el stock de «Burger Vegana» y pulsa «Guardar stock de Burger Vegana»
- **THEN** se envía `{"stock_cantidad": 12}`, la fila muestra 12, se ve «Stock actualizado» y el interruptor «Disponible» no cambia

#### Scenario: Valor negativo
- **WHEN** el usuario escribe -1 y guarda
- **THEN** no se envía ningún pedido y la fila muestra «Ingresá un número entero desde 0.»

#### Scenario: Error del servidor
- **WHEN** el servidor responde 404 porque el producto fue eliminado
- **THEN** la fila muestra el error y el valor escrito se conserva

### Requirement: Disponibilidad desde la lista
Cada fila SHALL tener un interruptor «Disponible» nombrado con el producto que, al cambiarlo, SHALL enviar `PATCH /productos/{id}/disponibilidad` con el valor elegido, quedar deshabilitado mientras espera y mostrar el valor devuelto con un aviso. Ante un error SHALL volver al valor anterior y mostrar el motivo. Cambiar la disponibilidad no SHALL cambiar el stock.

#### Scenario: Deshabilitar un producto
- **WHEN** un usuario `STOCK` apaga «Disponible» en «Coca-Cola 500ml»
- **THEN** se envía `{"disponible": false}`, el interruptor queda apagado, el stock sigue igual y se ve «Coca-Cola 500ml ya no se ofrece en el catálogo»

#### Scenario: Falla al cambiar
- **WHEN** el servidor no responde al cambiar la disponibilidad
- **THEN** el interruptor vuelve a su valor anterior y se ve un aviso de error

### Requirement: Alta y edición de producto
Solo con `ADMIN`, el formulario SHALL pedir nombre (obligatorio, sin espacios a los costados, hasta 150 caracteres), descripción opcional, precio (obligatorio, desde 0, hasta 2 decimales) y, solo en el alta, stock inicial (entero desde 0) y «Disponible». Con datos inválidos no SHALL enviar nada. SHALL guardar en un solo pedido; la edición SHALL enviar solo lo que cambió. Al guardar SHALL volver al listado con un aviso.

#### Scenario: Crear un producto
- **WHEN** el ADMIN completa «Burger Doble», precio «2500», stock 10, categoría «Hamburguesas» y guarda
- **THEN** se envía un solo `POST /productos/` con esos datos, se ve «Producto creado» y «Burger Doble» aparece en el listado

#### Scenario: Precio inválido
- **WHEN** el ADMIN guarda con precio «-5» o «12,345»
- **THEN** no se envía ningún pedido y «Precio» muestra «Ingresá un precio desde 0 con hasta 2 decimales.»

#### Scenario: Editar solo el precio
- **WHEN** el ADMIN edita «Burger Vegana», cambia el precio a «1900» y guarda
- **THEN** se envía `PUT /productos/<id>` solo con `precio_base`

#### Scenario: Nombre repetido
- **WHEN** el servidor responde 409 `DUPLICATE_VALUE` con `field` `nombre`
- **THEN** «Nombre» muestra «Ya existe un producto con ese nombre.» y lo escrito se conserva

### Requirement: Categorías del producto en el formulario
El formulario SHALL ofrecer las categorías activas en orden de árbol para marcar una o más, exigir al menos una («Elegí al menos una categoría.») y permitir elegir cuál es la principal entre las marcadas (por defecto la primera marcada). SHALL enviar la principal primero en `categoria_ids`.

#### Scenario: Principal elegida
- **WHEN** el ADMIN marca «Hamburguesas» y «Veganas» y elige «Veganas» como principal
- **THEN** se envía `categoria_ids` con el id de «Veganas» primero

#### Scenario: Sin categorías
- **WHEN** el ADMIN guarda sin categorías marcadas
- **THEN** no se envía ningún pedido y se ve «Elegí al menos una categoría.»

### Requirement: Ingredientes del producto en el formulario
El formulario SHALL permitir agregar y quitar ingredientes; cada uno con ingrediente (sin repetir), cantidad (mayor que 0, hasta 3 decimales), unidad (propuesta la del ingrediente) y «Se puede quitar» (`es_removible`). Los alérgenos SHALL marcarse. Al editar, SHALL mostrar los actuales; si la lista cambió, SHALL enviarla completa.

#### Scenario: Agregar un ingrediente removible
- **WHEN** el ADMIN agrega «Tomate», deja la unidad propuesta «Unidad (u)», escribe cantidad 2, marca «Se puede quitar» y guarda
- **THEN** el pedido incluye en `ingredientes` `{ingrediente_id: <Tomate>, cantidad: "2", unidad_medida_id: <u>, es_removible: true}`

#### Scenario: Ingrediente repetido
- **WHEN** el ADMIN elige «Tomate» en dos filas
- **THEN** no se envía ningún pedido y la segunda fila muestra «Este ingrediente ya está en la lista.»

#### Scenario: Edición sin tocar ingredientes
- **WHEN** el ADMIN edita solo el nombre de «Hamburguesa Clásica»
- **THEN** el pedido no incluye `ingredientes`

### Requirement: Baja de producto
Solo con `ADMIN`, «Eliminar <producto>» SHALL abrir un diálogo de confirmación con el nombre del producto que explique que deja de verse en el catálogo. Al confirmar y responder 204 SHALL cerrar el diálogo, avisar el éxito y quitarlo del listado; ante un error SHALL mostrarlo dentro del diálogo.

#### Scenario: Baja exitosa
- **WHEN** el ADMIN confirma la baja de «Limonada Natural» y el servidor responde 204
- **THEN** se ve «Producto eliminado» y la fila deja de mostrarse

#### Scenario: Error al eliminar
- **WHEN** el servidor no responde al confirmar
- **THEN** el diálogo sigue abierto con el mensaje de error y el producto sigue en el listado
