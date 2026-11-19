# Spec Delta — frontend-client-stores

## ADDED Requirements

### Requirement: Nombres de los ingredientes excluidos en la línea
Al agregar con personalización, la línea SHALL guardar, además de los ids excluidos, el nombre de cada ingrediente excluido tal como estaba al agregar, en el mismo orden que los ids. Sumar unidades a una línea existente no SHALL cambiar sus nombres guardados.

#### Scenario: Agregar con exclusiones
- **WHEN** se agrega el producto 7 excluyendo «Tomate» (id 3) y «Cebolla» (id 1)
- **THEN** la línea tiene los ids `[1, 3]` y los nombres «Cebolla» y «Tomate», en ese orden

#### Scenario: Sumar a una línea existente
- **WHEN** la línea del producto 7 sin `[1]` guarda el nombre «Cebolla» y se vuelve a agregar el producto 7 sin `[1]` con el nombre «Cebolla morada»
- **THEN** la línea suma la cantidad y sigue guardando «Cebolla»

### Requirement: Migración del carrito guardado
El carrito guardado con el formato anterior (sin nombres de exclusiones) SHALL recuperarse con todas sus líneas, cantidades y personalizaciones, y con la lista de nombres vacía. Un carrito guardado con un formato desconocido o inválido SHALL arrancar vacío.

#### Scenario: Carrito del formato anterior
- **WHEN** el almacenamiento tiene un carrito del formato anterior con 2 unidades del producto 7 sin `[1]` y la página se recarga
- **THEN** el carrito tiene la línea del producto 7 sin `[1]` con 2 unidades y sin nombres de exclusiones

#### Scenario: Nombres que no coinciden con los ids
- **WHEN** una línea guardada tiene 2 ids excluidos y 3 nombres
- **THEN** el carrito arranca vacío

### Requirement: Subtotal de una línea
El carrito SHALL exponer el subtotal de cada línea (precio unitario por cantidad) calculado sin errores de redondeo binario y expresado con dos decimales.

#### Scenario: Subtotal exacto
- **WHEN** una línea tiene 3 unidades a «0.10»
- **THEN** su subtotal es «0.30»
