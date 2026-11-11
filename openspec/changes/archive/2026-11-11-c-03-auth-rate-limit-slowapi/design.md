# Design — C-03 `auth-rate-limit-slowapi`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/auth-session` (límite de fallos de login), `specs/api-conventions` (429 con formato único), `specs/backend-runtime` (`/health`) y `specs/backend-config` (retiro de `RATE_LIMIT_*`).

Estado relevante (`dev`, 2026-11-11):

- `main.py::create_app` registra `RateLimitMiddleware` (antes que CORS). El middleware construye dos `RateLimiter` token-bucket desde `settings.rate_limit_*`, elige por `path.startswith` y devuelve 429 con `cuerpo_error(..., RATE_LIMIT_EXCEEDED)`, `Retry-After` y `X-RateLimit-*`. Clave: primera IP de `X-Forwarded-For` o `request.client.host`.
- `auth/router.py::login` pasa `request.client.host` y el user-agent a `AuthService.login(email, password, ip, user_agent)`; el service decide 401 «Credenciales incorrectas» (con bcrypt de relleno, D20 de C-02) o abre la sesión dentro de `AuthUnitOfWork`.
- `AppError(status_code, code, detail, field)` no transporta headers; `app_error_handler` arma `{detail, code, field}`.
- Tests: `conftest.py` llama `RateLimitMiddleware.reset_all_limiters()` en `client` y `plain_client`; `test_rate_limit.py` reemplaza los limiters por unos chicos (`strict_limits`); `test_health.py` usa `RATE_LIMIT_DEFAULT_PER_MINUTE`; `tests/support/settings_env.py` incluye `RATE_LIMIT_*` en `REQUIRED_ENV`; `test_env_example.py` exige que `backend/.env.example` y `backend/tests/.env.test.example` no tengan claves fuera de `Settings` (salvo bloques rotulados). No hay `freezegun` ni reloj inyectable: el tiempo sale de `utc_now()`/`time.time()`.
- Entorno: Python 3.14, Starlette 1.10 (`TestClient(app, client=(host, port))` disponible), uvicorn 0.54. En PyPI: `slowapi` 0.1.10, `limits` 5.8.0, `freezegun` 1.5.5.
- slowapi 0.1.10 (context7): `Limiter(key_func, strategy, storage_uri, headers_enabled, ...)`, decorador `limit(limit_value, key_func, exempt_when, cost, ...)` que **chequea y consume antes de ejecutar el endpoint**; `exempt_when` y `cost` solo ven la `Request`. No tiene `deduct_when` (eso es de Flask-Limiter). Expone `limiter.limiter` (estrategia de `limits` ligada al storage: `hit`, `test`, `get_window_stats`, `clear`) y `limiter.reset()`.

## Goals / Non-Goals

**Goals:** contar solo los fallos de credenciales del login por IP con ventana deslizante, bloquear con 429 + `Retry-After` exacto, reiniciar tras un éxito, retirar todo otro límite y la configuración asociada, con tests deterministas en el tiempo y sin estado compartido entre tests.

**Non-Goals:** límite global o de otros endpoints (C-28); storage distribuido (Redis) o multi-worker; bloqueo por cuenta/email; CAPTCHA o backoff progresivo; cambiar la configuración de proxy del despliegue (se documenta).

## Decisions

**D1 — slowapi como limitador de la app; el conteo de fallos lo hace un adaptador sobre su estrategia, invocado desde el service.**
Nuevo `app/core/rate_limit/limiter.py` con el singleton `limiter = Limiter(key_func=get_remote_address, strategy="moving-window", storage_uri="memory://", headers_enabled=False)`, que `create_app` publica en `app.state.limiter` (lo que C-28 necesita para sumar `default_limits`/`SlowAPIMiddleware` sobre el mismo storage). Junto a él, un adaptador genérico `LimitadorPorClave(limiter, limite: str, ambito: str)` con:
- `verificar(clave) -> None`: si `limiter.limiter.test(item, ambito, clave)` es falso, lanza `AppError(429, RATE_LIMIT_EXCEEDED, …, headers={"Retry-After": n})` (D4).
- `registrar(clave) -> None`: `hit(item, ambito, clave)`.
- `reiniciar(clave) -> None`: `clear(item, ambito, clave)`.
`item = limits.parse(limite)`. `core/rate_limit/__init__.py` exporta además un `Protocol` `RegistroIntentos` con esos tres métodos, que es lo que conoce el service.
*Por qué:* el decorador de slowapi cuenta **requests** y decide antes de que exista el resultado; «contar solo fallos» exige conocer el resultado de la verificación de credenciales, que es lógica de negocio y vive en `AuthService` (regla dura 2). El adaptador mantiene a slowapi/limits fuera del service (reglas 1 y 4) y es reutilizable con otra clave/límite.
*Alternativas descartadas:* (a) `@limiter.limit("5/15 minutes")` en el endpoint: bloquea al usuario que entra bien 5 veces (semántica de DT-10); (b) decorador + `exempt_when`: no ve la respuesta; (c) capturar el 401 en el router y hacer `hit`: lógica en el router; (d) tabla de intentos en PostgreSQL: migración y escritura por cada fallo para algo que la spec pide «en memoria con slowapi»; (e) `limits` directo sin slowapi: equivalente técnicamente, pero se aparta de la spec (`[INT]` slowapi) y C-28 tendría que introducir un segundo limitador.

**D2 — Flujo en `AuthService.login` y regla de reinicio.**
`AuthService(uow, intentos: RegistroIntentos)`; la constante `LIMITE_FALLOS_LOGIN = "5 per 15 minutes"` vive en `auth/service.py` (RN-AU-08) y `auth/router.py::get_auth_service` construye el adaptador con ámbito `"login-fallos"` (dependencia `get_registro_intentos_login`, sobrescribible en tests). Orden:
1. `intentos.verificar(ip)` **antes** de leer el usuario o correr bcrypt → 429 sin crear sesión.
2. Credenciales inválidas (email inexistente, contraseña errónea o `deleted_at`) → `intentos.registrar(ip)` y el mismo 401 de hoy.
3. Éxito → sesión creada y confirmada; recién **después del commit** `intentos.reiniciar(ip)`.
El 422 de validación ocurre antes del service, así que no cuenta; el 429 sale en el paso 1, así que tampoco cuenta.
*Por qué bloquear aun con credenciales correctas:* si el éxito pasara durante el bloqueo, el atacante seguiría probando y el límite solo frenaría a quien se equivoca. *Por qué reiniciar solo tras commit:* un fallo de BD no debe borrar el historial. *Tiempo:* el 429 corta antes de bcrypt, pero depende solo de la IP, no del email, así que no reabre la enumeración de C-02.

**D3 — Ventana deslizante (`moving-window`) y storage en memoria.**
`moving-window` cuenta los fallos de los últimos 15 minutos exactos (un fallo deja de contar 15 min después), que es lo que dice RN-AU-08; `fixed-window` permitiría 10 fallos en segundos a caballo de dos ventanas. Storage `memory://`: por proceso, se pierde al reiniciar y no se comparte entre workers. El backend corre con un único proceso uvicorn (`Dockerfile`, sin `--workers`), así que el límite es correcto; se documenta en KB 08 y el cambio a Redis queda en C-28 (solo cambia `storage_uri`).

**D4 — 429 con formato único y `Retry-After` exacto.**
`AppError` gana `headers: Mapping[str, str] | None = None` y `app_error_handler` los pasa a la `JSONResponse` (genérico, sin acoplar a rate limit). `Retry-After = max(1, ceil(reset_time - time.time()))` con `reset_time` de `get_window_stats` (en `moving-window`, vencimiento del fallo más antiguo de la ventana). `detail`: «Demasiados intentos fallidos de inicio de sesión. Intentá de nuevo más tarde.»; `code` `RATE_LIMIT_EXCEEDED`; `field` nulo. Se loguea `warning` con IP y ámbito (nunca email ni contraseña). No se emiten `X-RateLimit-*` (`headers_enabled=False`). No se registra el handler `_rate_limit_exceeded_handler` de slowapi (su cuerpo es `{"error": …}`, prohibido por `api-conventions`); C-28 registrará uno con `cuerpo_error` cuando use el decorador.

**D5 — IP: la de la conexión, sin leer `X-Forwarded-For` en la app.**
Router y limiter usan la misma función (`slowapi.util.get_remote_address`: `request.client.host`, ignora `X-Forwarded-For`). La traducción de headers de proxy es responsabilidad del servidor ASGI: uvicorn tiene `--proxy-headers` activo por defecto y solo confía en `127.0.0.1`, así que con el agente de ngrok local la IP real llega en `request.client.host`; en Docker (conexión desde la red bridge) el header se ignora y todo cliente detrás del mismo NAT comparte cupo. Se documenta en KB 08 cómo ampliar `--forwarded-allow-ips` solo para un proxy confiable. *Descartado:* leer la primera IP de `X-Forwarded-For` (código actual): un atacante la rota en cada request y evade el límite.

**D6 — Umbral y ventana como regla de negocio, no como variables.**
Se retiran las cuatro `RATE_LIMIT_*` de `Settings` (y sus propiedades). 5 y 15 min son RN-AU-08 y la spec los fija; volverlos configurables reabriría el riesgo de un entorno con límites laxos y obligaría a los tests a depender del entorno. `backend-config` («Toda variable es explícita») no se viola: no es un valor de despliegue.

**D7 — Tests: tiempo con freezegun, estado aislado con `limiter.reset()`.**
- `freezegun==1.5.5` en `requirements.txt` (bloque Testing). `MemoryStorage` de `limits` toma el tiempo de `time.time()`, que `freeze_time` controla (`frozen.move_to(...)`/`tick(...)`); la primera tarea es un test que lo confirma. Si `freeze_time` no controlara el reloj de `limits`, apply se detiene y lo reporta antes de seguir (cambiaría la estrategia de tests de la ventana).
- Hallazgo de apply (2026-11-11): `MemoryStorage` corre un hilo de purga con el reloj real (freezegun no controla `threading`) que borraba entradas creadas bajo `freeze_time`. La fixture autouse además anula `MemoryStorage._MemoryStorage__schedule_expiry` (no-op) en tests; no mockea lógica del limitador, pero depende de un nombre privado de `limits` (revisar al actualizar `limits`).
- Fixture autouse en `tests/conftest.py`: `limiter.reset()` antes de cada test (reemplaza `reset_all_limiters`). Los unit tests del adaptador crean su propio `Limiter` en memoria (sin singleton).
- IPs distintas con `TestClient(app, client=("10.0.0.1", 50000))`; helper `tests/support/login.py::fallar_login(client, n)`.
- Integración sobre la app real (sin mockear el limitador); solo se sobrescribe por `dependency_overrides` cuando un test necesita otra configuración.
- Nombres `test_<unidad>_<escenario>_<esperado>`, AAA.

**D8 — Dependencias fijadas.** `slowapi==0.1.10` y `limits==5.8.0` (se importa `limits.parse` directamente, así que se fija explícito; se verifica en apply que el resolver acepte la combinación con `pip install -r requirements.txt`), `freezegun==1.5.5`.

**D9 — Retiro del código propio.** Se borran `core/rate_limit/rate_limiter.py`, `core/rate_limit/rate_limit_middleware.py` y `tests/unit/test_rate_limiter.py`; `test_rate_limit.py` se reescribe contra la spec nueva.

## Risks / Trade-offs

- [Carrera verificar→registrar: requests concurrentes de la misma IP pueden pasar `verificar` antes de que se registren sus fallos, permitiendo algunos intentos de más] → aceptado: el cupo se excede como mucho en la concurrencia del atacante por IP y cada intento paga bcrypt (cost 12); documentado.
- [Estado en memoria: reiniciar el backend desbloquea; varios workers multiplican el cupo] → un proceso único hoy; Redis en C-28.
- [Clientes detrás del mismo NAT/proxy no confiable comparten cupo] → documentado (D5); el bloqueo dura como mucho 15 min y solo afecta al login.
- [freezegun y el hilo de expiración de `MemoryStorage`] → `moving-window` decide por timestamps, no por el hilo; test de humo del reloj como primera tarea.
- [slowapi lee `RATELIMIT_*` de un `.env` en el CWD] → no se definen claves `RATELIMIT_*`; todo se pasa explícito al constructor.
- [Mantenimiento de slowapi (releases espaciadas)] → se usa una superficie mínima (`Limiter` + `limiter.limiter`); el adaptador aísla un eventual reemplazo.

## Migration Plan

Sin migración de datos. Despliegue: `pip install -r requirements.txt`; quitar `RATE_LIMIT_*` de `backend/.env.example` y `backend/tests/.env.test.example` (los locales `.env`/`.env.test` pueden conservarlas: quedan inertes por `extra="ignore"`). Rollback: revertir el commit (vuelve a exigir `RATE_LIMIT_*`).

## Open Questions

- **OQ-1 — RESUELTA (aprobado 2026-11-11 por el usuario): sin límite por cuenta, solo por IP.** Límite adicional por cuenta (email). La spec solo pide por IP; un atacante con muchas IP no se frena. *Default:* no se agrega (C-28 o posterior).
- **OQ-2 — RESUELTA (aprobado 2026-11-11 por el usuario): solo documentar en KB 08, Dockerfile sin cambios.** Proxy en despliegue. Si se publica detrás de un proxy distinto del agente ngrok local, configurar `--forwarded-allow-ips`. *Default:* solo documentar en KB 08; el `Dockerfile` no cambia.

## UI Mockups

- Decision: no (no UI) — 2026-11-11
