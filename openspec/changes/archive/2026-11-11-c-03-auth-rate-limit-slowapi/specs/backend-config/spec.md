## MODIFIED Requirements

### Requirement: Una variable obligatoria faltante impide el arranque
Una variable es obligatoria cuando la app la necesita para funcionar. Si falta alguna, la carga SHALL fallar con un error de validación que la nombre, y la app no SHALL arrancar. Obligatorias: `ENVIRONMENT`, `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `REFRESH_REUSE_GRACE_SECONDS`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE`, `LOG_LEVEL`, `SQL_ECHO` y `CORS_ORIGINS`.

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

#### Scenario: Arranque sin variables de rate limiting
- **WHEN** se carga la configuración con todas las obligatorias y sin ninguna variable `RATE_LIMIT_*`
- **THEN** la carga es exitosa

#### Scenario: Configuración completa
- **WHEN** se carga la configuración con todas las variables, obligatorias y opcionales, definidas
- **THEN** la carga es exitosa y cada valor efectivo es exactamente el provisto

### Requirement: Variables retiradas
La configuración no SHALL leer `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL` ni las variables de rate limiting `RATE_LIMIT_DEFAULT_PER_MINUTE`, `RATE_LIMIT_DEFAULT_BURST`, `RATE_LIMIT_AUTH_PER_MINUTE` y `RATE_LIMIT_AUTH_BURST` (retiradas por C-03), y no SHALL requerir `VITE_API_URL`. Si alguna está presente en el entorno, no SHALL alterar ningún valor efectivo.

#### Scenario: Arranque sin variables retiradas
- **WHEN** se carga la configuración con todas las variables obligatorias y sin `VITE_API_URL`, `VITE_FRONTEND_URL`, `NGROK_URL` ni `MP_WEBHOOK_URL`
- **THEN** la carga es exitosa

#### Scenario: Variables retiradas presentes no afectan valores
- **WHEN** se carga la configuración completa más `NGROK_URL=https://viejo.example` y `VITE_FRONTEND_URL=https://viejo-front.example`
- **THEN** la URL de notificación, la base pública y la URL del frontend son exactamente las provistas en `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL`

#### Scenario: Variables retiradas no rellenan opcionales ausentes
- **WHEN** se carga la configuración con `NGROK_URL=https://viejo.example` y sin `BACKEND_PUBLIC_URL` ni `MP_NOTIFICATION_URL`
- **THEN** `BACKEND_PUBLIC_URL` y `MP_NOTIFICATION_URL` valen vacío

#### Scenario: Variables de rate limiting presentes no afectan
- **WHEN** se carga la configuración completa más `RATE_LIMIT_AUTH_PER_MINUTE=1` y `RATE_LIMIT_DEFAULT_BURST=1`
- **THEN** la carga es exitosa y la configuración no expone ninguna variable `RATE_LIMIT_*`

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
- **THEN** no aparece ninguna de `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL` ni ninguna `RATE_LIMIT_*`
