"""Verificación de la firma del webhook: el `data.id` se valida solo en minúsculas (D6, OQ-2 = A)."""
import logging

import pytest

from app.core.errors import AppError
from app.modules.pagos.firma_webhook import verificar_firma_webhook
from tests.support.mp_firma import firmar
from tests.support.mp_webhook import SECRETO, TS


def _verificar(firmado_sobre: str, data_id: str, request_id: str = "req-9", secreto: str = SECRETO) -> None:
    cabeceras = firmar(firmado_sobre, request_id, TS, SECRETO)
    verificar_firma_webhook(cabeceras["x-signature"], request_id, data_id, secreto)


def test_la_firma_sobre_el_id_en_minusculas_se_acepta() -> None:
    _verificar("ord01abc", "ORD01ABC")


def test_un_id_que_ya_viene_en_minusculas_se_acepta() -> None:
    _verificar("ord01abc", "ord01abc")


def test_la_firma_sobre_el_id_tal_cual_se_rechaza_con_401() -> None:
    with pytest.raises(AppError) as exc:
        _verificar("ORD01ABC", "ORD01ABC")

    assert exc.value.status_code == 401


def test_la_firma_con_otro_id_se_rechaza_y_se_loguea_sin_secretos(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.modules.pagos.firma_webhook"):
        with pytest.raises(AppError) as exc:
            _verificar("ord99", "ORD01ABC")

    assert exc.value.status_code == 401
    mensajes = [r.getMessage() for r in caplog.records]
    assert len(mensajes) == 1 and mensajes[0].startswith("Firma de webhook MP inválida") and "req-9" in mensajes[0]
    assert SECRETO not in mensajes[0]


def test_la_firma_con_otra_clave_se_rechaza() -> None:
    with pytest.raises(AppError) as exc:
        _verificar("ord01abc", "ORD01ABC", secreto="otra-clave")

    assert exc.value.status_code == 401
