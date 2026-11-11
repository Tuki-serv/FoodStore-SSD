## MODIFIED Requirements

### Requirement: Endpoint de salud
La aplicación SHALL exponer `GET /health`, fuera de `/api/v1`. No SHALL requerir autenticación ni consultar la base de datos. SHALL responder 200 con `{"status": "ok"}` y no SHALL estar sujeto a rate limiting.

#### Scenario: Health responde OK
- **WHEN** un cliente sin credenciales hace `GET /health`
- **THEN** recibe 200 con cuerpo `{"status": "ok"}`

#### Scenario: Health no consume cupo de rate limiting
- **WHEN** un cliente hace 100 requests seguidas a `GET /health`, incluso desde una IP bloqueada en el login
- **THEN** todas las respuestas son 200 y ninguna es 429
