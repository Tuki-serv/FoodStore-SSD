# =============================================================================
# rate_limiter.py — Algoritmo Token Bucket (en memoria)
# =============================================================================
#
# CONCEPTO CLAVE: Algoritmos de Rate Limiting
# ----------------------------------------------------
# Hay varios algoritmos comunes:
#
# 1. FIXED WINDOW: contás requests en una ventana de tiempo (ej: 1 minuto).
#    Problema: en el borde de la ventana, un cliente puede hacer 2x el límite
#    (ej: 60 reqs a las 12:59:59 + 60 reqs a las 13:00:00 = 120 en 2 segundos).
#
# 2. SLIDING WINDOW LOG: guardás timestamp de cada request.
#    Preciso pero consume mucha memoria (un timestamp por request).
#
# 3. SLIDING WINDOW COUNTER: combina fixed windows ponderando la anterior.
#    Buen balance entre precisión y memoria.
#
# 4. TOKEN BUCKET (el que usamos): un balde se llena a razón constante.
#    Cada request consume 1 token. Si no hay tokens, se rechaza.
#    - Permite "bursts" (el balde acumula tokens si no se usan).
#    - Suaviza la tasa promedio sin rechazar picos cortos.
#
# ¿POR QUÉ EN MEMORIA Y NO REDIS?
# ----------------------------------------------------
# Para esta app educativa es suficiente. En producción con múltiples
# workers/replicas, el bucket debe estar en Redis (compartido entre
# procesos). Acá documentamos el trade-off pero la implementación actual
# es single-process.
# =============================================================================

import threading
import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    """
    Implementación del algoritmo Token Bucket para UN cliente.

    Atributos:
        capacity: máximo de tokens en el balde (tamaño del "burst").
        refill_rate: tokens por segundo que se agregan al balde.
        tokens: tokens actuales en el balde (float, para precisión).
        last_refill: timestamp del último refill (time.perf_counter()).
        _lock: lock para hacer las operaciones thread-safe.

    Funcionamiento:
      - El balde arranca LLENO (capacity tokens).
      - Cada request consume 1 token.
      - Si no hay tokens suficientes → request rechazada.
      - El balde se "rellena" pasivamente: cuando se consulta, calculamos
        cuántos tokens se agregaron desde el último refill.

    Ejemplo:
        bucket = TokenBucket(capacity=10, refill_rate=1)  # 10 burst, 1/s
        # Al inicio: 10 tokens. Cada segundo se agrega 1 más (hasta 10).
        # Si hago 10 requests en 1 segundo → 5xx request rechazada.
    """

    capacity: float
    refill_rate: float  # tokens por segundo
    tokens: float = field(init=False)
    last_refill: float = field(init=False)
    _lock: threading.Lock = field(init=False, repr=False)

    def __post_init__(self) -> None:
        """Inicializa el estado mutable DESPUÉS de __init__ (dataclass idiom)."""
        self.tokens = float(self.capacity)  # Arrancamos con el balde lleno.
        self.last_refill = time.perf_counter()
        self._lock = threading.Lock()

    def try_consume(self, tokens: float = 1.0) -> bool:
        """
        Intenta consumir tokens. Devuelve True si los había, False si no.

        Thread-safe: usa un lock para evitar race conditions cuando
        múltiples requests del mismo cliente llegan concurrentemente.
        """
        with self._lock:
            # 1) Refill: calculamos cuánto tiempo pasó y agregamos tokens.
            now = time.perf_counter()
            elapsed = now - self.last_refill
            # Tokens a agregar = tiempo * tasa. Cap al capacity (no overflow).
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate,
            )
            self.last_refill = now

            # 2) ¿Hay suficientes tokens?
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def reset(self) -> None:
        """
        Resetea el balde a su estado inicial (lleno).

        Útil para tests: cada test empieza con el bucket "como nuevo".
        """
        with self._lock:
            self.tokens = float(self.capacity)
            self.last_refill = time.perf_counter()


class RateLimiter:
    """
    Rate limiter que mantiene un TokenBucket por cliente.

    El "cliente" se identifica por una key (string). Típicamente:
      - IP del cliente (si no están autenticados)
      - user_id (si están autenticados, mejor que la IP)

    Mantenemos un dict {key: TokenBucket} en memoria. Esto es eficiente
    para miles de clientes pero NO escala a millones (usar Redis en prod).
    """

    def __init__(self, capacity: int, refill_rate_per_minute: int) -> None:
        """
        Args:
            capacity: tamaño del bucket (burst máximo). Ej: 10.
            refill_rate_per_minute: tokens agregados por minuto. Ej: 60.
                                    Se convierte a /segundo internamente.
        """
        self.capacity = float(capacity)
        # Convertimos "por minuto" a "por segundo" para el algoritmo.
        # 60/min = 1/seg.
        self.refill_rate = refill_rate_per_minute / 60.0
        # Dict protegido por lock: el dict en sí no es thread-safe en Python.
        self._buckets: dict[str, TokenBucket] = {}
        self._buckets_lock = threading.Lock()

    def _get_bucket(self, key: str) -> TokenBucket:
        """
        Obtiene (o crea) el bucket para una key.

        Uso interno: se llama dentro de is_allowed() que ya tiene su propio lock,
        pero el lookup + creación debe ser atómico (por eso otro lock).
        """
        with self._buckets_lock:
            if key not in self._buckets:
                # Lazy creation: creamos el bucket solo cuando se necesita.
                # Esto evita consumir memoria para clientes que nunca llegan.
                self._buckets[key] = TokenBucket(
                    capacity=self.capacity,
                    refill_rate=self.refill_rate,
                )
            return self._buckets[key]

    def is_allowed(self, key: str) -> bool:
        """
        Verifica si el cliente identificado por `key` puede hacer una request.

        Returns:
            True: hay tokens, la request pasa.
            False: no hay tokens, se debe rechazar con 429.
        """
        bucket = self._get_bucket(key)
        return bucket.try_consume(1.0)

    def reset_all(self) -> None:
        """
        Resetea TODOS los buckets. Solo se usa en tests.
        """
        with self._buckets_lock:
            for bucket in self._buckets.values():
                bucket.reset()

    def reset_key(self, key: str) -> None:
        """
        Resetea el bucket de UNA key específica. Útil para tests dirigidos.
        """
        with self._buckets_lock:
            if key in self._buckets:
                self._buckets[key].reset()
