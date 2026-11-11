# Tasks — C-03 `auth-rate-limit-slowapi`

> **Governance ALTO** (auth; aprobado 2026-11-11 por el usuario, OQ-1..OQ-2 con defaults): NO escribir código hasta que el usuario apruebe explícitamente `proposal.md`, `design.md` y las specs, y responda (o acepte por defecto) OQ-1..OQ-2 de `design.md`. Si una respuesta cambia los defaults, actualizar specs/design/tasks antes de aplicar.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por la interfaz HTTP o la API pública del adaptador, valores esperados escritos a mano, sin aserciones tautológicas. **No se mockea el limitador**: los tests usan slowapi/limits reales en memoria; el tiempo se controla con `freezegun`; el estado se aísla con `limiter.reset()` (fixture autouse) y, en unit tests, con un `Limiter` propio por test.
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Capas `models ← repository ← unit of work ← services ← routers`; el router solo extrae la IP y delega; sin migraciones. No leer/escribir `.env*` salvo autorización explícita (4.3), no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 Correr la suite completa y registrar total/passed/failed (baseline). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.
- [x] 0.2 Registrar en `design.md` §Open Questions la respuesta del usuario a OQ-1..OQ-2 con fecha. Verificar con `grep -n "OQ-[1-2]" openspec/changes/c-03-auth-rate-limit-slowapi/design.md`.

## 1. Dependencias y reloj de pruebas (D7, D8)

- [x] 1.1 Agregar `slowapi==0.1.10`, `limits==5.8.0` (bloque de seguridad) y `freezegun==1.5.5` (bloque Testing) a `requirements.txt`; instalar con `.venv/Scripts/python -m pip install -r requirements.txt`. Verificar que el resolver no reporta conflictos y que `.venv/Scripts/python -c "import slowapi, limits, freezegun"` no falla.
- [x] 1.2 Test de humo del reloj (`tests/unit/test_limitador_por_clave.py`): con un `Limiter(strategy="moving-window", storage_uri="memory://")` propio y `freeze_time`, 1 hit de `"1 per 15 minutes"` → `test()` falso; `move_to` +15 min → `test()` verdadero. Ejecutar → verde. Si no pasa (freezegun no controla el reloj de `limits`), frenar y reportar (design D7).

## 2. Adaptador `LimitadorPorClave` y `AppError` con headers (D1, D3, D4)

- [x] 2.1 RED: en `tests/unit/test_limitador_por_clave.py`, con límite `"5 per 15 minutes"`: 5 `registrar("1.1.1.1")` y `verificar("1.1.1.1")` → lanza `AppError` con `status_code` 429, `code` `RATE_LIMIT_EXCEEDED`, `field` `None`. Ejecutar → falla (no existe el módulo).
- [x] 2.2 GREEN: `app/core/rate_limit/limiter.py` (singleton `limiter` de slowapi, `moving-window`, `memory://`, `headers_enabled=False`, `key_func=get_remote_address`), `LimitadorPorClave(limiter, limite, ambito)` con `verificar`/`registrar`/`reiniciar`, y `Protocol` `RegistroIntentos` exportado desde `app/core/rate_limit/__init__.py`. `AppError` gana `headers: Mapping[str, str] | None = None`. Ejecutar → verde.
- [x] 2.3 TRIANGULATE (umbral, claves, reinicio): 4 registros → `verificar` no lanza; 5 en `"1.1.1.1"` no afectan a `"2.2.2.2"`; `reiniciar("1.1.1.1")` tras 4 registros → 4 registros más no bloquean y el quinto sí; dos ámbitos distintos con la misma IP no se pisan. Ejecutar → verde.
- [x] 2.4 TRIANGULATE (ventana y `Retry-After`, con `freeze_time`): 5 registros en t0 y `verificar` en t0+60 s → `headers["Retry-After"] == "840"`; en t0+899,5 s → `"1"`; en t0+900 s → no lanza; 4 registros en t0, 1 en t0+16 min → `verificar` no lanza. Ejecutar → verde.
- [x] 2.5 RED→GREEN (handler): en `tests/integration/test_exception_handlers.py`, una ruta de prueba que lanza `AppError(429, ..., headers={"Retry-After": "7"})` → respuesta 429 con `{detail, code, field}` y header `Retry-After: 7`; sin `headers` → sin header extra. `app_error_handler` pasa `exc.headers`. Ejecutar → verde.

## 3. Límite de fallos en el login (D2, D5; spec `auth-session`, `api-conventions`)

- [x] 3.1 RED: reescribir `tests/integration/test_rate_limit.py` (helper `tests/support/login.py::fallar_login(client, n)` y `client` con IP fija vía `TestClient(app, client=("10.0.0.1", 50000))`): 5 logins con contraseña incorrecta → 5 × 401; el sexto con credenciales correctas → 429 `RATE_LIMIT_EXCEEDED`, `field` nulo, sin clave `error`, `Retry-After` > 0, sin `Set-Cookie` del refresh y sin sesión nueva en la BD. Ejecutar → falla (hoy cuenta todo y el sexto con credenciales correctas da 429 o 200 según el bucket, sin bloqueo por fallos).
- [x] 3.2 GREEN: `AuthService(uow, intentos: RegistroIntentos)` con `LIMITE_FALLOS_LOGIN = "5 per 15 minutes"`; `login` hace `verificar(ip)` antes de leer el usuario, `registrar(ip)` antes del 401 y `reiniciar(ip)` después del commit. `auth/router.py`: dependencia `get_registro_intentos_login()` (ámbito `"login-fallos"`) inyectada en `get_auth_service`; la IP sale de `get_remote_address(request)`. Ejecutar → verde.
- [x] 3.3 TRIANGULATE (conteo): 10 logins correctos seguidos → 10 × 200; 6 requests sin `password` (422) y luego un login correcto → 200; 5 fallos de `10.0.0.1` y login correcto desde `10.0.0.2` → 200; IP bloqueada con `X-Forwarded-For: 203.0.113.9` → 429; email inexistente y usuario dado de baja también cuentan como fallo (5 mezclados → el sexto 429). Ejecutar → verde.
- [x] 3.4 TRIANGULATE (ventana, con `freeze_time`): 5 fallos en t0 → en t0+14 min 429, en t0+15 min login correcto 200; 4 fallos, +16 min, 1 fallo → el siguiente fallo da 401; sexto intento a t0+60 s → `Retry-After` 840. Ejecutar → verde.
- [x] 3.5 TRIANGULATE (reinicio): 4 fallos, login correcto, 4 fallos → 401 y el siguiente correcto 200; 4 fallos, correcto, 5 fallos → el siguiente 429; un login correcto desde otra IP no reinicia los fallos de la primera. Ejecutar → verde.
- [x] 3.6 Red de seguridad de auth: `pytest tests/integration/test_auth*.py tests/unit/test_security.py` → verde (el contrato de C-02 —401 idéntico, bcrypt de relleno, cookies— no cambia).

## 4. Retiro del rate limit propio y de `RATE_LIMIT_*` (D6, D9; specs `auth-session`, `api-conventions`, `backend-runtime`, `backend-config`)

- [x] 4.1 RED: en `test_rate_limit.py`, 20 requests seguidas a `POST /auth/register` (emails distintos), `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all` y `GET /auth/me` → ninguna 429; 100 a `GET /api/v1/productos/` → ninguna 429 ni header `X-RateLimit-*`; con la IP bloqueada en login, `GET /auth/me` y `POST /auth/refresh` válidos → 200. En `test_health.py`, 100 requests a `/health` (sin `settings.RATE_LIMIT_*`) desde una IP bloqueada → todas 200. Ejecutar → falla (middleware actual).
- [x] 4.2 GREEN: quitar `RateLimitMiddleware` de `main.py` y publicar `app.state.limiter = limiter`; borrar `core/rate_limit/rate_limiter.py`, `core/rate_limit/rate_limit_middleware.py` y `tests/unit/test_rate_limiter.py`; `tests/conftest.py`: fixture autouse que llama `limiter.reset()` y quitar `reset_all_limiters`. Ejecutar `pytest tests/integration/test_rate_limit.py tests/integration/test_health.py` → verde.
- [x] 4.3 RED→GREEN (config): en `tests/unit/test_config.py`, cargar `Settings` con `REQUIRED_ENV` sin ninguna `RATE_LIMIT_*` → carga exitosa; con `RATE_LIMIT_AUTH_PER_MINUTE=1` → la configuración no expone ningún atributo `RATE_LIMIT_*`. Quitar las cuatro variables y sus propiedades de `core/config.py` y de `tests/support/settings_env.py`; agregar `RATE_LIMIT_*` a las retiradas de `tests/unit/test_env_example.py`. Quitar `RATE_LIMIT_*` de `backend/.env.example` y `backend/tests/.env.test.example` — **requiere que el usuario lo haga o autorice editar esos archivos**. Verificar `pytest tests/unit/test_config.py tests/unit/test_env_example.py` → verde.
- [x] 4.4 REFACTOR: `grep -rn "RateLimitMiddleware\|RATE_LIMIT_\|rate_limit_\|X-RateLimit" backend/app backend/tests` solo devuelve `ErrorCode.RATE_LIMIT_EXCEEDED` y las listas de variables retiradas; el router de auth no contiene lógica de conteo. Ejecutar `pytest tests/integration/test_rate_limit.py tests/unit/test_limitador_por_clave.py` → verde.

## 5. Documentación

- [x] 5.1 KB: `05` RN-AU-08 (objetivo cumplido, sin deuda); `09` DD-12 (slowapi + adaptador, ventana deslizante, memoria) y DT-10 resuelta por C-03; `08` §Seguridad (IP de la conexión, `--proxy-headers`/`--forwarded-allow-ips` de uvicorn, límite de un proceso), tabla de variables sin `RATE_LIMIT_*`, sección de tests (`limiter.reset()`, freezegun), árbol de `core/rate_limit/`; `02` stack (slowapi en uso, sin la nota DT-10); `backend/README.md` (variables obligatorias sin `RATE_LIMIT_*`); `CLAUDE.md`/`AGENTS.md` (fila slowapi del stack sin «Deuda técnica DT-10»). Verificar con `grep -rn "DT-10\|RATE_LIMIT_\|token bucket" knowledge-base backend/README.md CLAUDE.md AGENTS.md` que solo quedan menciones históricas marcadas como resueltas.

## 6. Cierre

- [x] 6.1 Revisión de capas, SOLID y DRY: slowapi/limits solo en `core/rate_limit/`; `AuthService` depende del `Protocol`; el router solo extrae la IP; type hints en firmas públicas nuevas; ningún log con email o contraseña.
- [x] 6.2 Suite completa: 0 failed y passed ≥ baseline de 0.1 menos los tests borrados de `test_rate_limiter.py` más los nuevos; registrar el número y la diferencia. **Resultado: 1360 passed, 0 failed (7 min); suite completa tras retirar RATE_LIMIT_* de los .env.example.**

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-03-auth-rate-limit-slowapi` (marca `[x]` en CHANGES.md y agrega «Punto de partida (C-03)» en C-28: `app.state.limiter` de slowapi en memoria, sin handler de `RateLimitExceeded`; registrar uno con `cuerpo_error` al usar el decorador).
- El usuario puede borrar `RATE_LIMIT_*` de sus `.env` y `tests/.env.test` locales (quedan inertes).
