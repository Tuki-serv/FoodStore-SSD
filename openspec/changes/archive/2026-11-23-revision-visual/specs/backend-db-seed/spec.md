# Spec Delta — backend-db-seed

## MODIFIED Requirements

### Requirement: Datos de demostración
El seed SHALL crear, si no existen, los usuarios de prueba `cliente@foodstore.com` (CLIENT), `pedidos@foodstore.com` (PEDIDOS) y `stock@foodstore.com` (STOCK), y el catálogo de demostración: 7 unidades de medida, 6 categorías, 12 ingredientes y 6 productos con sus relaciones. Las imágenes de las categorías y productos de demostración SHALL ser rutas relativas a archivos servidos por la propia aplicación o quedar vacías; no SHALL apuntar a hosts externos.

#### Scenario: Demo sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existen los tres usuarios de prueba con su rol, 7 unidades de medida, 6 categorías, 12 ingredientes y 6 productos

#### Scenario: Imágenes de demostración sin hosts externos
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** ninguna `imagen_url` de categoría ni `imagenes_url` de producto de demostración empieza con `http://` o `https://`
