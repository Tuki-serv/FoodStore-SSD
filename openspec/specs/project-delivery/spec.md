# project-delivery Specification

## Purpose
Define cómo se arranca Food Store de forma reproducible desde el README en una máquina limpia y qué evidencia de entrega acompaña al repositorio (plantillas de entorno, compose, checklist de la rúbrica, capturas, guion y enlace del video, metadatos de portada).

## Requirements

### Requirement: Arranque reproducible desde el README
El `README.md` de la raíz SHALL describir, en orden y desde una máquina limpia, los pasos para levantar el proyecto completo: base con Docker Compose, instalación del backend, `alembic upgrade head`, `python -m app.db.seed`, `uvicorn app.main:app`, instalación y arranque del frontend, cada uno con el directorio desde el que se corre y el resultado esperado.

#### Scenario: Seguir el README sin conocimiento previo
- **WHEN** una persona clona el repo en una máquina con Docker, Python 3.10+ y Node instalados y ejecuta solo los comandos del README
- **THEN** obtiene el catálogo de demostración en `http://localhost:5173` y Swagger en `http://localhost:8000/docs` sin pasos adicionales

#### Scenario: Comandos verificables
- **WHEN** se comparan los comandos del README con los scripts de `frontend/package.json`, las variables de `docker-compose.yml` y los módulos del backend
- **THEN** cada comando, script y variable nombrados existen con ese nombre

### Requirement: Credenciales de prueba documentadas
El README SHALL listar las cuentas que crea el seed con su rol y contraseña de desarrollo, y SHALL aclarar que son credenciales de desarrollo que no deben usarse fuera del entorno local.

#### Scenario: Cuentas del seed
- **WHEN** se lee la sección de credenciales del README
- **THEN** figuran `admin@foodstore.com` (ADMIN), `cliente@foodstore.com` (CLIENT), `pedidos@foodstore.com` (PEDIDOS) y `stock@foodstore.com` (STOCK) con las contraseñas que siembra el seed

### Requirement: Plantillas de entorno completas
Cada `.env.example` del repo (raíz para compose, `backend/` y `frontend/`) SHALL declarar todas las variables que lee su consumidor, con placeholders no sensibles y un comentario por variable; las de MercadoPago SHALL explicar dónde se obtienen en el panel de desarrolladores. Ningún `.env.example` SHALL contener un secreto real.

#### Scenario: Variables de compose
- **WHEN** se comparan las variables `${...}` de `docker-compose.yml` con el `.env.example` de la raíz
- **THEN** cada variable usada está declarada en la plantilla

#### Scenario: Sin secretos
- **WHEN** se inspeccionan las plantillas de entorno
- **THEN** ningún valor de MercadoPago, JWT o Cloudinary parece una credencial real (prefijos `APP_USR-`/`TEST-` seguidos de un token válido, claves largas aleatorias)

### Requirement: Limitaciones conocidas documentadas
El README SHALL incluir una sección de limitaciones conocidas que nombre, como mínimo, la contraseña inicial elegida por el administrador sin cambio de contraseña (DT-28), el rol `COCINA`/KDS sin incorporar (PA-07), los filtros de fecha en UTC del gestor de pedidos, el envío fijo de $50 también en retiro (PA-13) y la falta de idempotencia en la creación de pedidos.

#### Scenario: Limitaciones visibles
- **WHEN** un evaluador lee el README
- **THEN** encuentra cada limitación con una frase que explica su efecto y, si aplica, cómo recuperarse (por ejemplo, recrear el admin con el seed)

### Requirement: Checklist de entrega con evidencia
El repo SHALL incluir un checklist que recorra los 13 criterios de la rúbrica de 200 puntos, los bonus y los ítems CE-01..CE-14, y que para cada uno indique su estado (cumplido, parcial, pendiente del usuario) y la evidencia (archivo, test, captura o momento del video).

#### Scenario: Cobertura del checklist
- **WHEN** se compara el checklist con `knowledge-base/13_rubrica_y_entrega.md`
- **THEN** cada criterio, bonus e ítem CE aparece exactamente una vez con estado y evidencia

### Requirement: Capturas de pantalla
El repo SHALL incluir al menos 10 capturas de pantallas distintas de la aplicación en funcionamiento, con datos de demostración, cubriendo cliente (catálogo, producto, carrito, checkout, pago, mis pedidos) y administración (gestión de pedidos, productos y stock, usuarios, dashboard), referenciadas desde el README o el checklist.

#### Scenario: Diez pantallas distintas
- **WHEN** se listan las capturas de la entrega
- **THEN** hay al menos 10 archivos de pantallas distintas y cada uno está enlazado con un nombre que identifica la pantalla

### Requirement: Video de demostración enlazado
El README SHALL enlazar el video de demostración de 5 a 10 minutos y el repo SHALL incluir el guion que sigue, que recorre registro o ingreso, catálogo, carrito, checkout, pago con tarjeta sandbox, seguimiento del pedido y su avance hasta `ENTREGADO` desde el panel, y el dashboard.

#### Scenario: Enlace presente
- **WHEN** se lee el README publicado para la entrega
- **THEN** contiene un enlace accesible al video y la duración indicada está entre 5 y 10 minutos

#### Scenario: Guion completo
- **WHEN** se lee el guion del video
- **THEN** cada paso del flujo compra → pago → entrega figura con la cuenta que lo realiza

### Requirement: Recorrido de punta a punta verificado
El flujo completo con frontend SHALL estar verificado sobre el stack local: un cliente compra, el pedido se paga (tarjeta sandbox o confirmación manual de efectivo) y un gestor lo lleva hasta `ENTREGADO`, quedando el historial y el dashboard consistentes. El resultado SHALL registrarse con fecha, cuentas usadas y capturas.

#### Scenario: Efectivo hasta entregado
- **WHEN** `cliente@foodstore.com` crea un pedido `EFECTIVO` desde el frontend y `pedidos@foodstore.com` lo confirma, lo pasa a preparación, lo despacha y lo entrega
- **THEN** el cliente ve el pedido `ENTREGADO` con su historial completo en «Mis pedidos» y el dashboard lo cuenta como venta

#### Scenario: Tarjeta sandbox
- **WHEN** el cliente paga un pedido `MERCADOPAGO` con una tarjeta de prueba aprobada y el webhook llega por ngrok
- **THEN** el pedido pasa a `CONFIRMADO` sin intervención del gestor

### Requirement: Metadatos de portada de la entrega
La documentación de entrega SHALL mostrar materia, carrera, equipo y docente. Mientras alguno no esté confirmado por el equipo SHALL figurar como `(TBD)` visible, nunca inventado.

#### Scenario: Metadato sin confirmar
- **WHEN** el equipo todavía no informó la materia
- **THEN** el campo dice `(TBD)` y el checklist marca PA-18 como pendiente del usuario
