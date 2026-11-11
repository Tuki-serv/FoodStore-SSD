## MODIFIED Requirements

### Requirement: Límite de peticiones con el formato de error
Superar el límite de peticiones SHALL responder 429 con `{detail, code, field}`, `code` `RATE_LIMIT_EXCEEDED` y `field` nulo, conservando el header `Retry-After` con un entero positivo de segundos. El cuerpo no SHALL tener la clave `error`. El único límite vigente es el de intentos fallidos de `POST /api/v1/auth/login` (spec `auth-session`); ningún otro endpoint SHALL responder 429 ni headers `X-RateLimit-*`.

#### Scenario: Ráfaga agotada
- **WHEN** una IP con 5 intentos fallidos de login en los últimos 15 minutos vuelve a hacer `POST /api/v1/auth/login`
- **THEN** recibe 429 con `code` `RATE_LIMIT_EXCEEDED`, `field` nulo, header `Retry-After` mayor que 0 y sin clave `error` en el cuerpo

#### Scenario: Sin límite general
- **WHEN** un cliente hace 100 requests seguidas a `GET /api/v1/productos/`
- **THEN** ninguna respuesta es 429 y ninguna tiene headers `X-RateLimit-*`
