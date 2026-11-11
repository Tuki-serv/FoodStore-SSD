# Proposal — C-03 `auth-rate-limit-slowapi`

## Why

La spec `[INT]` (RN-AU-08, DD-12) pide limitar la fuerza bruta del login con slowapi: **5 intentos fallidos por IP en 15 minutos** solo en `POST /auth/login`, con 429 y `Retry-After`. El código usa un middleware token-bucket propio (DT-10, IN-10) que cuenta **todas** las requests, limita login, register y logout por prefijo (alcanza también `/auth/logout-all`) e impone un límite global de 60/min a toda la API. Un usuario legítimo que entra bien varias veces se bloquea, mientras que un atacante lento (1 intento cada 12 s) nunca lo hace. Es el único change de seguridad de Fase 0 pendiente (gobernanza ALTA).

## Punto de partida

Observado en el código (`dev`, 2026-11-11, después de C-02/C-05):

- `core/rate_limit/rate_limit_middleware.py::RateLimitMiddleware` (registrado en `main.py`) elige el limiter por `path.startswith` sobre `/api/v1/auth/login|register|logout` (por eso `/auth/logout-all` cae en el estricto) y usa el general (60/min, ráfaga 10) para todo lo demás salvo `/health` y docs; agrega `X-RateLimit-*` a toda respuesta.
- La clave del cliente es la primera IP de `X-Forwarded-For` si viene el header: suplantable sin proxy confiable (KB 08).
- `Settings` exige cuatro variables `RATE_LIMIT_*`; los tests las fijan altas (`.env.test`) y `conftest.py` resetea los buckets vía un registro de instancias.
- `AuthService.login` ya recibe la IP del router y concentra la decisión «credenciales válidas o 401».
- `slowapi` no está en `requirements.txt`.

## What Changes

- **BREAKING — Límite solo de fallos de login:** `POST /api/v1/auth/login` cuenta por IP los intentos con credenciales incorrectas (401). Con 5 fallos dentro de una ventana deslizante de 15 minutos, todo intento siguiente de esa IP (con o sin credenciales correctas) responde **429** `RATE_LIMIT_EXCEEDED` con `Retry-After` hasta que el fallo más viejo salga de la ventana. Los intentos rechazados con 429 no cuentan.
- **Reset tras login correcto:** un login exitoso antes de alcanzar el umbral borra los fallos acumulados de esa IP.
- **BREAKING — Sin límites en el resto:** se retiran el límite de `register`, `logout`, `logout-all`, `refresh` y `me`, y el límite global de 60/min (pasa a C-28 como extra). Desaparecen los headers `X-RateLimit-*`.
- **Reemplazo por slowapi:** se elimina el middleware y el token bucket propios (`core/rate_limit/`) y se adopta `slowapi` (sobre `limits`) con almacenamiento en memoria; la IP es la de la conexión (`X-Forwarded-For` ya no se confía en la app).
- **BREAKING (config) — Variables retiradas:** `RATE_LIMIT_DEFAULT_PER_MINUTE`, `RATE_LIMIT_DEFAULT_BURST`, `RATE_LIMIT_AUTH_PER_MINUTE` y `RATE_LIMIT_AUTH_BURST` dejan de leerse y de ser obligatorias; el umbral (5) y la ventana (15 min) son regla de negocio (RN-AU-08), no configuración.
- El 429 conserva el formato único de error `{detail, code, field}` (spec `api-conventions`).

**Fuera de alcance (con dueño):** rate limit global u otros endpoints (C-28); almacenamiento compartido entre procesos (Redis) y bloqueo por cuenta/email (no lo pide la spec; ver design); política de proxy en despliegue (se documenta, no se automatiza).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `auth-session`: se agregan los requisitos del límite de intentos fallidos de login (umbral, ventana, 429 con `Retry-After`, reset tras éxito, IP de la conexión) y que las demás rutas de `/auth` no tienen límite.
- `api-conventions`: «Límite de peticiones con el formato de error» pasa a describir el 429 del login (ya no hay ráfaga general en `GET /productos/`).
- `backend-runtime`: el escenario de `/health` deja de referirse al «límite general por minuto», que desaparece.
- `backend-config`: `RATE_LIMIT_*` sale de las obligatorias y entra en las variables retiradas.

## Impact

- **Código**: nuevo adaptador `core/rate_limit/` sobre `slowapi`/`limits` (registro de fallos por IP); `auth/service.py` (verificar bloqueo, registrar fallo, reiniciar); `auth/router.py` (inyección del registro, sin lógica); `core/errors.py` + `utils/errores.py` (headers opcionales en `AppError` para `Retry-After`); `main.py` (sin `RateLimitMiddleware`, `app.state.limiter`); `core/config.py` (sin `RATE_LIMIT_*`); se borran `rate_limiter.py` y `rate_limit_middleware.py`.
- **Dependencias**: `slowapi==0.1.10` y `limits` fijado; `freezegun==1.5.5` para tests.
- **API**: 429 solo en `POST /api/v1/auth/login`; ningún otro endpoint devuelve 429 ni `X-RateLimit-*`.
- **Tests**: reescritura de `tests/integration/test_rate_limit.py`; se borra `tests/unit/test_rate_limiter.py`; `conftest.py` resetea el limiter de slowapi; `tests/support/settings_env.py` y `test_health.py` sin `RATE_LIMIT_*`.
- **Config**: quitar `RATE_LIMIT_*` de `backend/.env.example` y `backend/tests/.env.test.example` (el test de cobertura de plantillas lo exige); en `.env`/`.env.test` locales quedan inertes y se pueden borrar.
- **Datos**: sin migración.
- **Docs**: KB `05` (RN-AU-08), `08` (§Seguridad, env vars, tests), `09` (DD-12, DT-10 resuelta), `02` (stack), `backend/README.md`, `CHANGES.md` (C-03 `[x]` al archivar).
