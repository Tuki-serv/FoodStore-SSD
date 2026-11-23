# Spec Delta — frontend-visual-language

## Purpose

Define las reglas visuales transversales y verificables del frontend de Food Store (fuentes, importes, badges y movimiento) que el design system vigente fija para todas las pantallas, de modo que la aplicación se vea consistente y profesional sin depender de servicios externos.

## ADDED Requirements

### Requirement: Fuentes autoalojadas
El frontend SHALL servir sus fuentes de display y de texto desde sus propios archivos empaquetados, declaradas con `@font-face` y con un respaldo del sistema, sin pedir hojas de estilo ni archivos de fuentes a hosts externos.

#### Scenario: Sin pedidos de fuentes a terceros
- **WHEN** se carga cualquier página de la aplicación
- **THEN** ningún pedido de red de fuentes sale del origen de la aplicación y los títulos usan la fuente de display definida por el token del design system

#### Scenario: Fuente no disponible
- **WHEN** el archivo de una fuente no carga
- **THEN** el texto se muestra con la fuente de respaldo del token sin ocultarse (`font-display: swap`)

### Requirement: Numerales tabulares en importes
Precios, subtotales, totales, cantidades y métricas numéricas SHALL mostrarse con numerales tabulares para que las cifras queden alineadas en listas y tablas.

#### Scenario: Importes alineados
- **WHEN** se renderiza el precio de una tarjeta de producto o un total del carrito
- **THEN** el elemento del importe usa numerales tabulares (`font-variant-numeric: tabular-nums`)

### Requirement: Badges solo para estados
Los badges (pastillas con fondo teñido) SHALL reservarse para estados: estado del pedido, estado del pago y marca de stock. Categorías, roles en listados, filtros activos y demás metadatos SHALL mostrarse como texto o con el estilo neutro de chip, sin fondo de estado.

#### Scenario: Categoría como texto
- **WHEN** se renderiza una tarjeta de producto con categoría principal
- **THEN** la categoría no lleva la clase ni el fondo de badge de estado

#### Scenario: Estado de pedido como badge
- **WHEN** se renderiza un pedido `CONFIRMADO` en «Mis pedidos»
- **THEN** su estado se muestra como badge con el estilo del estado `CONFIRMADO`

### Requirement: Respuesta al presionar
Botones, enlaces con forma de botón y tarjetas clicables SHALL dar respuesta visual inmediata al presionarse (escala sutil en `:active`) usando las duraciones y curvas de los tokens de movimiento.

#### Scenario: Botón presionado
- **WHEN** el usuario presiona el botón «Agregar» de una tarjeta
- **THEN** el botón aplica la transformación de presión definida por el token y vuelve al soltarlo

### Requirement: Hover solo con puntero
Los efectos de hover SHALL aplicarse solo en dispositivos con puntero capaz de hover (`@media (hover: hover)`), para que en pantallas táctiles no queden estados de hover pegados.

#### Scenario: Pantalla táctil
- **WHEN** la aplicación se usa en un dispositivo sin hover y el usuario toca una tarjeta
- **THEN** la tarjeta no queda con el estilo de hover aplicado

### Requirement: Entrada escalonada en el primer montaje
Las listas principales (catálogo, mis pedidos, gestión de pedidos) SHALL animar la entrada de sus elementos de forma escalonada solo en el primer montaje de la página; cambios de página, filtros o refrescos de datos SHALL mostrarse sin repetir la animación.

#### Scenario: Primer montaje
- **WHEN** el visitante abre `/catalogo` y la página se monta con resultados
- **THEN** las tarjetas entran escalonadas con un retardo creciente acotado (los elementos más allá del tope entran con el retardo máximo)

#### Scenario: Cambio de filtro
- **WHEN** el visitante cambia la categoría del catálogo
- **THEN** los nuevos resultados se muestran sin animación de entrada

### Requirement: Movimiento reducido
Con `prefers-reduced-motion: reduce` el frontend SHALL anular transformaciones, entradas escalonadas y transiciones de desplazamiento, conservando solo cambios de opacidad o color instantáneos o muy breves.

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el sistema del usuario pide movimiento reducido y abre el catálogo
- **THEN** las tarjetas aparecen sin entrada escalonada y los botones no escalan al presionarse

### Requirement: Encabezado de página fijo
Toda página con título SHALL mostrar un encabezado de página compartido con título, subtítulo, metadatos y acción primaria; en las páginas de listado SHALL integrar búsqueda y filtros, con los filtros activos como chips quitables, y quedar fijo arriba del área de contenido mientras solo la lista se desplaza. En detalle y formularios SHALL quedar fijo solo si contiene acciones.

#### Scenario: Lista que se desplaza bajo el encabezado
- **WHEN** el gestor de pedidos desplaza la lista de gestión de pedidos hacia abajo
- **THEN** el título, los filtros de estado y fechas, el conteo y los chips de filtros activos siguen visibles arriba y solo la lista se desplaza por debajo

#### Scenario: Estado compacto al desplazar
- **WHEN** el visitante desplaza el catálogo y el encabezado queda fijo
- **THEN** el título baja un paso de tamaño, el subtítulo se oculta y aparece un filete o sombra sutil bajo el encabezado

#### Scenario: Encabezado fijo con movimiento reducido
- **WHEN** el sistema del usuario pide movimiento reducido y el encabezado pasa a compacto
- **THEN** el cambio de tamaño y visibilidad ocurre sin transición

#### Scenario: Filtro activo quitable
- **WHEN** el visitante filtra el catálogo por categoría y rango de precio
- **THEN** el encabezado muestra un chip quitable por filtro, «Limpiar filtros» y el conteo de resultados

#### Scenario: Encabezados de tabla fijos
- **WHEN** el administrador desplaza una tabla de una página de listado
- **THEN** la fila de encabezados de la tabla queda fija inmediatamente debajo del encabezado de página

#### Scenario: Encabezado en mobile
- **WHEN** el visitante abre el catálogo en un ancho menor a 1024 px y desplaza la lista
- **THEN** el encabezado compacto queda fijo debajo de la barra superior con el título, un botón «Filtros» con el número de filtros activos que abre la hoja inferior y una fila de chips con desplazamiento horizontal, sin ocupar más de un cuarto del alto de la pantalla

#### Scenario: Detalle sin acciones
- **WHEN** el cliente abre el detalle de producto
- **THEN** el encabezado muestra la ruta de vuelta al catálogo y no queda fijo al desplazar
