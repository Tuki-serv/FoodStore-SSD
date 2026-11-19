# Spec Delta — frontend-foundation

## MODIFIED Requirements

### Requirement: Configuración explícita por variables `VITE_*`
El frontend SHALL leer su configuración de variables de entorno `VITE_*` explícitas, sin valores por defecto ocultos, en un único módulo. `VITE_API_URL` (URL base del backend) SHALL ser obligatoria; si falta o está vacía, el arranque SHALL fallar con un error que la nombre. `VITE_MP_PUBLIC_KEY` (clave **pública** de MercadoPago) SHALL ser opcional: si falta o está vacía, la configuración SHALL exponerla como ausente (`null`) y solo el pago con tarjeta SHALL quedar deshabilitado; el arranque no SHALL fallar por ella. Ninguna variable del frontend SHALL contener secretos (access token, secreto del webhook).

#### Scenario: Variable presente
- **WHEN** el frontend arranca con `VITE_API_URL=http://localhost:8000`
- **THEN** la configuración expone esa URL tal cual

#### Scenario: Variable ausente
- **WHEN** el frontend arranca sin `VITE_API_URL` o con valor vacío
- **THEN** el arranque falla con un error cuyo mensaje contiene `VITE_API_URL`

#### Scenario: Clave pública presente
- **WHEN** el frontend arranca con `VITE_API_URL=http://localhost:8000` y `VITE_MP_PUBLIC_KEY=APP_USR-clave-publica-de-prueba`
- **THEN** la configuración expone la clave pública `APP_USR-clave-publica-de-prueba`

#### Scenario: Clave pública ausente
- **WHEN** el frontend arranca con `VITE_API_URL=http://localhost:8000` y sin `VITE_MP_PUBLIC_KEY` (o con `"  "`)
- **THEN** el arranque no falla y la configuración expone la clave pública como `null`
