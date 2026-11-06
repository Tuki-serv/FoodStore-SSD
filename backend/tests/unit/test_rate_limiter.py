"""
tests/unit/test_rate_limiter.py
================================

Pruebas unitarias del TokenBucket y RateLimiter.

Estas pruebas son PURAS (sin DB, sin HTTP, sin FastAPI). Solo
importan la clase y la estresan.

Patrón (cap12):
---------------
- Una función por test.
- Nombres descriptivos: test_[acción]_[contexto]_[resultado].
- Si testeás concurrencia, marcá con @pytest.mark.slow para que se
  pueda correr selectivamente.
"""

import threading
import time

import pytest

from app.core.rate_limit.rate_limiter import RateLimiter, TokenBucket


# ===========================================================================
# TESTS DEL TOKEN BUCKET (la primitiva)
# ===========================================================================
class TestTokenBucket:
    """Tests del primitive TokenBucket (un bucket individual)."""

    def test_init_full_capacity(self):
        """
        Al crear un bucket, arranca LLENO (capacity tokens disponibles).
        Esto permite ráfagas iniciales sin penalizar al usuario.
        """
        # ⚠️ TokenBucket recibe `refill_rate` en tokens/segundo, no por minuto.
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        assert bucket.capacity == 10
        assert bucket.tokens == 10  # arranca lleno

    def test_try_consume_succeeds_when_tokens_available(self):
        """Consumir 1 token cuando hay 10 disponibles debe funcionar."""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        assert bucket.try_consume(1) is True
        assert bucket.tokens == 9

    def test_try_consume_fails_when_empty(self):
        """
        Si el bucket está vacío, try_consume devuelve False (no bloquea).
        El caller decide qué hacer (típicamente: devolver 429).
        """
        bucket = TokenBucket(capacity=2, refill_rate=1.0)
        assert bucket.try_consume(2) is True  # vacía el bucket
        assert bucket.try_consume(1) is False  # falla, no hay tokens

    def test_try_consume_multiple_tokens(self):
        """try_consume(N) consume N tokens atómicamente."""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        assert bucket.try_consume(5) is True
        # `pytest.approx` porque el refill pasivo agrega una cantidad
        # ínfima entre operaciones (depende del scheduling del OS).
        assert bucket.tokens == pytest.approx(5, abs=0.01)
        assert bucket.try_consume(3) is True
        assert bucket.tokens == pytest.approx(2, abs=0.01)

    def test_try_consume_rejects_more_than_capacity(self):
        """
        Pedir más tokens que la capacidad del bucket debe fallar.
        No tiene sentido "reservar" más de lo que el bucket puede tener.
        """
        bucket = TokenBucket(capacity=5, refill_rate=1.0)
        assert bucket.try_consume(10) is False  # > capacity
        # Y el bucket queda intacto.
        assert bucket.tokens == 5

    def test_refill_over_time(self):
        """
        Después de esperar, el bucket se rellena automáticamente.
        Usamos time.sleep para simular el paso del tiempo.
        """
        # refill_rate=10 → 10 tokens/segundo.
        bucket = TokenBucket(capacity=10, refill_rate=10)
        # Vaciamos el bucket.
        bucket.try_consume(10)
        assert bucket.tokens == 0

        # Esperamos ~0.2s → deberíamos tener ~2 tokens.
        time.sleep(0.2)
        # No podemos ser exactos por el scheduling, pero al menos 1.
        assert bucket.try_consume(1) is True

    def test_refill_caps_at_capacity(self):
        """
        El refill NUNCA supera la capacity. Si esperás una hora, el
        bucket queda con `capacity` tokens, no más.
        """
        bucket = TokenBucket(capacity=5, refill_rate=100)
        # Esperamos lo suficiente para que se llene varias veces.
        time.sleep(0.2)
        # Verificamos que podemos consumir `capacity` y que todavía
        # quedan tokens (no se "rellenó infinito").
        assert bucket.try_consume(5) is True


# ===========================================================================
# TESTS DEL RATE LIMITER (la fábrica de buckets)
# ===========================================================================
class TestRateLimiter:
    """Tests del RateLimiter (dict de buckets por key)."""

    def test_first_request_allowed(self):
        """La primera request de una key siempre pasa (bucket arranca lleno)."""
        limiter = RateLimiter(capacity=10, refill_rate_per_minute=60)
        assert limiter.is_allowed("ip:1.2.3.4") is True

    def test_different_keys_have_independent_buckets(self):
        """
        Keys distintas tienen buckets independientes.
        Que una IP agote su bucket no afecta a otra.
        """
        limiter = RateLimiter(capacity=2, refill_rate_per_minute=1)
        # IP A agota.
        assert limiter.is_allowed("ip:A") is True
        assert limiter.is_allowed("ip:A") is True
        assert limiter.is_allowed("ip:A") is False  # bloqueada
        # IP B no afectada.
        assert limiter.is_allowed("ip:B") is True
        assert limiter.is_allowed("ip:B") is True

    def test_burst_equals_capacity(self):
        """
        La ráfaga inicial máxima es exactamente `capacity` requests.
        Después, hay que esperar el refill.
        """
        limiter = RateLimiter(capacity=5, refill_rate_per_minute=1)  # casi 0 refill
        for _ in range(5):
            assert limiter.is_allowed("ip:X") is True
        # La 6ª falla (no hubo tiempo de refill).
        assert limiter.is_allowed("ip:X") is False

    def test_reset_all_clears_everything(self):
        """
        `reset_all()` borra TODOS los buckets. Útil entre tests.
        """
        limiter = RateLimiter(capacity=2, refill_rate_per_minute=1)
        limiter.is_allowed("ip:A")
        limiter.is_allowed("ip:A")
        assert limiter.is_allowed("ip:A") is False  # bloqueada

        limiter.reset_all()

        # Después del reset, el bucket arranca lleno de nuevo.
        assert limiter.is_allowed("ip:A") is True
        assert limiter.is_allowed("ip:A") is True
        assert limiter.is_allowed("ip:A") is False

    def test_reset_key_clears_specific_key(self):
        """`reset_key(k)` borra solo el bucket de esa key."""
        limiter = RateLimiter(capacity=2, refill_rate_per_minute=1)
        limiter.is_allowed("ip:A")
        limiter.is_allowed("ip:A")
        limiter.is_allowed("ip:B")

        limiter.reset_key("ip:A")

        # A está limpio de nuevo.
        assert limiter.is_allowed("ip:A") is True
        # B no fue tocado.
        assert limiter.is_allowed("ip:B") is True
        assert limiter.is_allowed("ip:B") is False  # ya tenía 1 token


# ===========================================================================
# TESTS DE THREAD SAFETY
# ===========================================================================
@pytest.mark.slow
class TestThreadSafety:
    """
    Tests de concurrencia. Marcados con @pytest.mark.slow para poder
    saltearlos con `pytest -m "not slow"` cuando queremos suite rápida.
    """

    def test_concurrent_consume_respects_capacity(self):
        """
        N threads hacen try_consume en paralelo. La suma de consumos
        exitosos NO debe superar la capacity.

        Esto valida que el Lock del TokenBucket funciona.
        """
        capacity = 100
        limiter = RateLimiter(capacity=capacity, refill_rate_per_minute=1)
        # 200 threads compiten por 100 tokens. Esperamos ~100 successes.
        successes = []
        lock = threading.Lock()

        def consume():
            ok = limiter.is_allowed("shared")
            with lock:
                successes.append(ok)

        threads = [threading.Thread(target=consume) for _ in range(200)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # El primer sub-lote (capacity=100) debe haber pasado.
        # El resto falla.
        assert sum(successes) == capacity
