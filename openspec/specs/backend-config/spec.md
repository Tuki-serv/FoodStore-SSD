# backend-config Specification

## Purpose

Define el contrato de configuración del backend por variables de entorno: qué variables existen, cuáles son obligatorias (necesarias para que la app funcione) y cuáles son opcionales (integraciones como pagos e imágenes). También define que no hay valores por defecto ocultos en código, sus formatos, el comportamiento por entorno y cómo se documentan en `.env.example`.

## Requirements

### Requirement: Toda variable es explícita
Cada valor de configuración que use el backend SHALL provenir de una variable de entorno propia, declarada en la configuración y documentada en `.env.example`. Ningún valor efectivo SHALL derivarse ni construirse a partir de otras variables, sin excepciones.

#### Scenario: Una variable no altera a otra
- **WHEN** se carga la configuración con `MP_NOTIFICATION_URL=https://a.example/api/v1/pagos/webhook` y `BACKEND_PUBLIC_URL=https://b.example`
- **THEN** la URL de notificación es `https://a.example/api/v1/pagos/webhook` y la base pública es `https://b.example`

### Requirement: Sin valores por defecto ocultos
La configuración no SHALL definir valores por defecto para ninguna variable: ni URLs locales ni constantes. Una variable obligatoria SHALL provenir únicamente del entorno o de `.env`. Una variable opcional ausente SHALL valer vacío (`None`), que significa «funcionalidad no configurada», nunca un valor sustituto.

#### Scenario: Entorno vacío
- **WHEN** se carga la configuración con un entorno sin ninguna variable y sin archivo `.env`
- **THEN** la carga falla con un error de validación que enumera las variables obligatorias faltantes y no menciona las opcionales

#### Scenario: Opcional ausente vale vacío
- **WHEN** se carga la configuración con todas las obligatorias y sin `CLOUDINARY_NAME`
- **THEN** la carga es exitosa y `CLOUDINARY_NAME` vale vacío, sin ningún valor sustituto

### Requirement: Una variable obligatoria faltante impide el arranque
Una variable es obligatoria cuando la app la necesita para funcionar. Si falta alguna, la carga SHALL fallar con un error de validación que la nombre, y la app no SHALL arrancar. Obligatorias: `ENVIRONMENT`, `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `REFRESH_REUSE_GRACE_SECONDS`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE`, `LOG_LEVEL`, `SQL_ECHO`, `RATE_LIMIT_*` (hasta C-03) y `CORS_ORIGINS`.

#### Scenario: Falta SECRET_KEY
- **WHEN** se carga la configuración con todas las obligatorias salvo `SECRET_KEY`
- **THEN** la carga falla con un error que menciona `SECRET_KEY`

#### Scenario: Falta ACCESS_TOKEN_EXPIRE_MINUTES
- **WHEN** se carga la configuración con todas las obligatorias salvo `ACCESS_TOKEN_EXPIRE_MINUTES`
- **THEN** la carga falla con un error que menciona `ACCESS_TOKEN_EXPIRE_MINUTES`

#### Scenario: Falta DATABASE_URL
- **WHEN** se carga la configuración con todas las obligatorias salvo `DATABASE_URL`
- **THEN** la carga falla con un error que menciona `DATABASE_URL`

#### Scenario: Falta REFRESH_REUSE_GRACE_SECONDS
- **WHEN** se carga la configuración con todas las obligatorias salvo `REFRESH_REUSE_GRACE_SECONDS`
- **THEN** la carga falla con un error que menciona `REFRESH_REUSE_GRACE_SECONDS`

#### Scenario: Falta un atributo de la cookie del refresh
- **WHEN** se carga la configuración con todas las obligatorias salvo `REFRESH_COOKIE_SECURE`, y en otro intento salvo `REFRESH_COOKIE_SAMESITE`
- **THEN** cada carga falla con un error que menciona la variable faltante

#### Scenario: Configuración completa
- **WHEN** se carga la configuración con todas las variables, obligatorias y opcionales, definidas
- **THEN** la carga es exitosa y cada valor efectivo es exactamente el provisto

### Requirement: Integraciones opcionales no son necesarias para arrancar
Las variables de integraciones opcionales SHALL ser opcionales. Son las de pagos con MercadoPago (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL`, `MP_WEBHOOK_SECRET`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`) y las de imágenes con Cloudinary (`CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). La configuración, la app y la suite de tests SHALL poder iniciarse sin ellas.

#### Scenario: Arranque sin MercadoPago ni Cloudinary
- **WHEN** se carga la configuración con todas las obligatorias y sin ninguna variable `MP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` ni `CLOUDINARY_*`
- **THEN** la carga es exitosa y todas esas variables valen vacío

#### Scenario: Faltante obligatoria sigue fallando con integraciones presentes
- **WHEN** se carga la configuración con todas las variables de integraciones definidas pero sin `SECRET_KEY`
- **THEN** la carga falla con un error que menciona `SECRET_KEY`

### Requirement: Entorno de ejecución acotado
`ENVIRONMENT` SHALL aceptar solo `development`, `production` o `test`. Cualquier otro valor SHALL hacer fallar la carga de la configuración.

#### Scenario: Valor válido
- **WHEN** se carga la configuración con `ENVIRONMENT=production`
- **THEN** el entorno efectivo es `production`

#### Scenario: Valor inválido
- **WHEN** se carga la configuración con `ENVIRONMENT=staging`
- **THEN** la carga falla con un error de validación que menciona `ENVIRONMENT`

### Requirement: Logging de SQL configurable
`SQL_ECHO` SHALL ser booleana y obligatoria. El motor de base de datos SHALL registrar las sentencias SQL solo cuando `SQL_ECHO` es verdadera.

#### Scenario: Echo desactivado
- **WHEN** se crea el motor de base de datos con `SQL_ECHO=false`
- **THEN** el motor no registra las sentencias SQL

#### Scenario: Echo activado
- **WHEN** se crea el motor de base de datos con `SQL_ECHO=true`
- **THEN** el motor registra las sentencias SQL

### Requirement: CORS_ORIGINS como array JSON
`CORS_ORIGINS` SHALL leerse como un array JSON de strings (por ejemplo `["http://localhost:5173","http://localhost:3000"]`) y exponerse como una lista de orígenes. Un valor que no sea un array JSON válido SHALL hacer fallar la carga. Como CORS se usa con credenciales (cookie del refresh), un array que contenga `*` SHALL hacer fallar la carga.

#### Scenario: Array JSON válido
- **WHEN** se carga la configuración con `CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]`
- **THEN** los orígenes efectivos son exactamente esos dos, en ese orden

#### Scenario: Formato separado por comas rechazado
- **WHEN** se carga la configuración con `CORS_ORIGINS=http://localhost:5173,http://localhost:3000`
- **THEN** la carga falla con un error que menciona `CORS_ORIGINS`

#### Scenario: Comodín rechazado
- **WHEN** se carga la configuración con `CORS_ORIGINS=["*"]`
- **THEN** la carga falla con un error que menciona `CORS_ORIGINS`

#### Scenario: Comodín mezclado con orígenes rechazado
- **WHEN** se carga la configuración con `CORS_ORIGINS=["http://localhost:5173","*"]`
- **THEN** la carga falla con un error que menciona `CORS_ORIGINS`

### Requirement: Variables de MercadoPago con nombres de la spec
La configuración SHALL leer `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL` y `MP_WEBHOOK_SECRET` como opcionales. Si se definen, SHALL usarse exactamente el valor provisto. `MP_NOTIFICATION_URL` es la URL completa del webhook. `MP_WEBHOOK_SECRET` es la clave secreta con la que MercadoPago firma las notificaciones del webhook; es un secreto y solo SHALL vivir en el entorno, nunca en el repositorio.

#### Scenario: MP_NOTIFICATION_URL provista
- **WHEN** se carga la configuración con `MP_NOTIFICATION_URL=https://abc.ngrok-free.app/api/v1/pagos/webhook`
- **THEN** la URL de notificación efectiva es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET provista
- **WHEN** se carga la configuración con `MP_WEBHOOK_SECRET=secreto-de-prueba`
- **THEN** la clave secreta efectiva del webhook es exactamente ese valor

#### Scenario: MP_WEBHOOK_SECRET documentada sin valor real
- **WHEN** se inspecciona `backend/.env.example`
- **THEN** contiene la clave `MP_WEBHOOK_SECRET` con un placeholder evidentemente falso

### Requirement: URLs explícitas del flujo de pago actual
Mientras exista el flujo de redirect de Checkout Pro (deuda DT-01, se retira en C-12), la configuración SHALL leer dos variables opcionales del grupo de pagos. `BACKEND_PUBLIC_URL` es la base pública del backend para las `back_urls`. `FRONTEND_URL` es el destino del redirect post-pago.

#### Scenario: Valores provistos
- **WHEN** se carga la configuración con `BACKEND_PUBLIC_URL=https://abc.ngrok-free.app` y `FRONTEND_URL=https://tienda.example`
- **THEN** la base pública del backend y la URL del frontend son exactamente esos valores

#### Scenario: FRONTEND_URL independiente de CORS
- **WHEN** se carga la configuración con `CORS_ORIGINS=["http://otro:3000"]` y sin `FRONTEND_URL`
- **THEN** la URL del frontend vale vacío; no se toma de `CORS_ORIGINS`

### Requirement: Variables retiradas
La configuración no SHALL leer `MP_WEBHOOK_URL`, `NGROK_URL` ni `VITE_FRONTEND_URL`, y no SHALL requerir `VITE_API_URL`. Si alguna está presente en el entorno, no SHALL alterar ningún valor efectivo.

#### Scenario: Arranque sin variables retiradas
- **WHEN** se carga la configuración con todas las variables obligatorias y sin `VITE_API_URL`, `VITE_FRONTEND_URL`, `NGROK_URL` ni `MP_WEBHOOK_URL`
- **THEN** la carga es exitosa

#### Scenario: Variables retiradas presentes no afectan valores
- **WHEN** se carga la configuración completa más `NGROK_URL=https://viejo.example` y `VITE_FRONTEND_URL=https://viejo-front.example`
- **THEN** la URL de notificación, la base pública y la URL del frontend son exactamente las provistas en `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL`

#### Scenario: Variables retiradas no rellenan opcionales ausentes
- **WHEN** se carga la configuración con `NGROK_URL=https://viejo.example` y sin `BACKEND_PUBLIC_URL` ni `MP_NOTIFICATION_URL`
- **THEN** `BACKEND_PUBLIC_URL` y `MP_NOTIFICATION_URL` valen vacío

### Requirement: DATABASE_URL es la única configuración de base de datos
`DATABASE_URL` SHALL ser obligatoria y SHALL ser la única variable de base de datos que lee el backend. SHALL usarse tal como viene, sin construirla ni transformarla. El backend no SHALL leer `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST` ni `POSTGRES_PORT`: esas variables son solo de docker-compose.

#### Scenario: Falta DATABASE_URL
- **WHEN** se carga la configuración con todas las variables salvo `DATABASE_URL`, aunque estén definidas las `POSTGRES_*`
- **THEN** la carga falla con un error que menciona `DATABASE_URL`

#### Scenario: Valor usado tal cual
- **WHEN** se carga la configuración con `DATABASE_URL=postgresql+psycopg://u:p@h:5433/d`
- **THEN** la URL efectiva es exactamente `postgresql+psycopg://u:p@h:5433/d`

#### Scenario: Variables POSTGRES_* ignoradas
- **WHEN** se carga la configuración completa más `POSTGRES_USER=otro` y `POSTGRES_DB=otra`
- **THEN** la URL efectiva es exactamente la de `DATABASE_URL` y la configuración no expone ninguna variable `POSTGRES_*`

### Requirement: `.env.example` documenta el contrato
El repo SHALL incluir un `.env.example` con todas las variables de la configuración, con placeholders evidentemente falsos y no sensibles, más un comentario por variable. Toda variable de la configuración SHALL aparecer en `.env.example`. Las claves extra solo SHALL existir en bloques rotulados de docker-compose (`POSTGRES_*`, `PGADMIN_*`, con la advertencia de mantener `DATABASE_URL` consistente) y de frontend (`VITE_*`). No SHALL contener secretos reales ni variables retiradas.

#### Scenario: El ejemplo es cargable
- **WHEN** se carga la configuración usando solo los valores de `.env.example`
- **THEN** la carga es exitosa

#### Scenario: Cobertura completa de variables
- **WHEN** se comparan las claves de `.env.example` con las variables declaradas en la configuración
- **THEN** toda variable declarada aparece en `.env.example`, y toda clave extra pertenece a un bloque rotulado de docker-compose o de frontend. Las variables de docker-compose (`POSTGRES_*`, `PGADMIN_*`) viven en el `.env.example` de la raíz (design D10), que contiene exactamente esas claves y no se valida contra la configuración

#### Scenario: Sin variables retiradas en el ejemplo
- **WHEN** se inspeccionan las claves de `.env.example`
- **THEN** no aparece ninguna de `MP_WEBHOOK_URL`, `NGROK_URL` ni `VITE_FRONTEND_URL`

### Requirement: Entorno de tests aislado
Con `ENVIRONMENT=test`, `DATABASE_URL` SHALL apuntar a una base PostgreSQL dedicada a tests. El nombre de la base, tomado del path de la URL, SHALL terminar en `_test`. Toda base auxiliar que use la suite (por ejemplo, la de los tests de migraciones) SHALL cumplir la misma condición. La suite SHALL negarse a ejecutarse si la URL efectiva no cumple esa condición o si falta la configuración de tests, para proteger los datos de desarrollo.

#### Scenario: Base de tests válida
- **WHEN** la suite arranca con `ENVIRONMENT=test` y una URL a `foodstore_test`
- **THEN** los tests se ejecutan contra esa base

#### Scenario: Base de desarrollo rechazada
- **WHEN** la suite arranca con `ENVIRONMENT=test` y una URL a una base cuyo nombre no termina en `_test`
- **THEN** la sesión de pytest aborta antes de aplicar migraciones, crear o borrar tablas, con un mensaje que explica el motivo

#### Scenario: Base auxiliar de migraciones protegida
- **WHEN** los tests de migraciones preparan su base auxiliar
- **THEN** su nombre termina en `_test` y, si no fuera así, el test aborta antes de conectarse a ella

#### Scenario: Falta el archivo de configuración de tests
- **WHEN** la suite arranca sin `backend/tests/.env.test`
- **THEN** la sesión de pytest aborta con un mensaje que indica copiarlo desde `backend/tests/.env.test.example`

### Requirement: Período de gracia del refresh configurable
`REFRESH_REUSE_GRACE_SECONDS` SHALL ser un entero mayor o igual a 0 que define cuántos segundos después de rotado un refresh se acepta todavía sin considerarlo reuso. Un valor negativo o no entero SHALL hacer fallar la carga.

#### Scenario: Valor válido
- **WHEN** se carga la configuración con `REFRESH_REUSE_GRACE_SECONDS=30`
- **THEN** el período de gracia efectivo es 30

#### Scenario: Valor negativo
- **WHEN** se carga la configuración con `REFRESH_REUSE_GRACE_SECONDS=-1`
- **THEN** la carga falla con un error que menciona `REFRESH_REUSE_GRACE_SECONDS`

### Requirement: Atributos de la cookie del refresh configurables
`REFRESH_COOKIE_SECURE` SHALL ser booleana y `REFRESH_COOKIE_SAMESITE` SHALL aceptar solo `lax`, `strict` o `none`. La combinación `REFRESH_COOKIE_SAMESITE=none` con `REFRESH_COOKIE_SECURE=false` SHALL hacer fallar la carga, porque los navegadores rechazan esa cookie.

#### Scenario: Valores válidos
- **WHEN** se carga la configuración con `REFRESH_COOKIE_SAMESITE=lax` y `REFRESH_COOKIE_SECURE=true`
- **THEN** los valores efectivos son `lax` y verdadero

#### Scenario: SameSite inválido
- **WHEN** se carga la configuración con `REFRESH_COOKIE_SAMESITE=relaxed`
- **THEN** la carga falla con un error que menciona `REFRESH_COOKIE_SAMESITE`

#### Scenario: None sin Secure
- **WHEN** se carga la configuración con `REFRESH_COOKIE_SAMESITE=none` y `REFRESH_COOKIE_SECURE=false`
- **THEN** la carga falla con un error que menciona `REFRESH_COOKIE_SAMESITE` y `REFRESH_COOKIE_SECURE`

#### Scenario: None con Secure
- **WHEN** se carga la configuración con `REFRESH_COOKIE_SAMESITE=none` y `REFRESH_COOKIE_SECURE=true`
- **THEN** la carga es exitosa
