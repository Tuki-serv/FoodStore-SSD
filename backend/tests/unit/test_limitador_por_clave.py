"""Humo del reloj: freezegun controla el tiempo que usa `limits` (design D7)."""

import pytest
from freezegun import freeze_time
from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.errors import AppError
from app.core.rate_limit import LimitadorPorClave


def test_reloj_freezegun_controla_la_ventana_deslizante_de_limits() -> None:
    limiter = Limiter(key_func=get_remote_address, strategy="moving-window", storage_uri="memory://")
    item = parse("1 per 15 minutes")

    with freeze_time("2026-01-01 12:00:00") as reloj:
        limiter.limiter.hit(item, "ambito", "1.1.1.1")
        assert limiter.limiter.test(item, "ambito", "1.1.1.1") is False

        reloj.move_to("2026-01-01 12:15:00")
        assert limiter.limiter.test(item, "ambito", "1.1.1.1") is True


# --- Adaptador `LimitadorPorClave` (design D1, D3, D4) ---
LIMITE = "5 per 15 minutes"


@pytest.fixture(name="limitador")
def limitador_fixture() -> LimitadorPorClave:
    """Limitador con su propio `Limiter` en memoria: aislado por test, sin singleton."""
    limiter = Limiter(key_func=get_remote_address, strategy="moving-window", storage_uri="memory://")
    return LimitadorPorClave(limiter, LIMITE, "ambito-a")


def _registrar(limitador: LimitadorPorClave, clave: str, veces: int) -> None:
    for _ in range(veces):
        limitador.registrar(clave)


def test_verificar_con_cinco_registros_lanza_429_rate_limit_exceeded(limitador: LimitadorPorClave) -> None:
    _registrar(limitador, "1.1.1.1", 5)

    with pytest.raises(AppError) as excinfo:
        limitador.verificar("1.1.1.1")

    assert excinfo.value.status_code == 429
    assert excinfo.value.code == "RATE_LIMIT_EXCEEDED"
    assert excinfo.value.field is None
    assert excinfo.value.headers is not None and int(excinfo.value.headers["Retry-After"]) > 0


def test_verificar_con_cuatro_registros_no_lanza(limitador: LimitadorPorClave) -> None:
    _registrar(limitador, "1.1.1.1", 4)

    limitador.verificar("1.1.1.1")


def test_verificar_otra_clave_no_se_ve_afectada_por_el_bloqueo(limitador: LimitadorPorClave) -> None:
    _registrar(limitador, "1.1.1.1", 5)

    limitador.verificar("2.2.2.2")


def test_reiniciar_borra_los_registros_de_esa_clave(limitador: LimitadorPorClave) -> None:
    _registrar(limitador, "1.1.1.1", 4)
    limitador.reiniciar("1.1.1.1")

    _registrar(limitador, "1.1.1.1", 4)
    limitador.verificar("1.1.1.1")
    limitador.registrar("1.1.1.1")
    with pytest.raises(AppError):
        limitador.verificar("1.1.1.1")


def test_reiniciar_no_toca_otras_claves(limitador: LimitadorPorClave) -> None:
    _registrar(limitador, "2.2.2.2", 5)

    limitador.reiniciar("1.1.1.1")

    with pytest.raises(AppError):
        limitador.verificar("2.2.2.2")


def test_ambitos_distintos_con_la_misma_clave_no_se_pisan(limitador: LimitadorPorClave) -> None:
    otro = LimitadorPorClave(limitador.limiter, LIMITE, "ambito-b")
    _registrar(limitador, "1.1.1.1", 5)

    otro.verificar("1.1.1.1")
    otro.registrar("1.1.1.1")
    with pytest.raises(AppError):
        limitador.verificar("1.1.1.1")


def test_retry_after_es_el_tiempo_hasta_que_vence_el_fallo_mas_antiguo(limitador: LimitadorPorClave) -> None:
    with freeze_time("2026-01-01 12:00:00") as reloj:
        _registrar(limitador, "1.1.1.1", 5)

        reloj.move_to("2026-01-01 12:01:00")
        with pytest.raises(AppError) as a_los_60s:
            limitador.verificar("1.1.1.1")
        reloj.move_to("2026-01-01 12:14:59.5")
        with pytest.raises(AppError) as casi_vencido:
            limitador.verificar("1.1.1.1")
        reloj.move_to("2026-01-01 12:15:00")
        limitador.verificar("1.1.1.1")

    assert a_los_60s.value.headers == {"Retry-After": "840"}
    assert casi_vencido.value.headers == {"Retry-After": "1"}


def test_fallos_fuera_de_la_ventana_dejan_de_contar(limitador: LimitadorPorClave) -> None:
    with freeze_time("2026-01-01 12:00:00") as reloj:
        _registrar(limitador, "1.1.1.1", 4)

        reloj.move_to("2026-01-01 12:16:00")
        limitador.registrar("1.1.1.1")

        limitador.verificar("1.1.1.1")
