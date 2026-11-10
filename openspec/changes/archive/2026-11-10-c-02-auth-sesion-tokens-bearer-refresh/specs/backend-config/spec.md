# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
