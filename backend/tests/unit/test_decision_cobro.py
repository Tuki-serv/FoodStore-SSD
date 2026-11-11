"""Decisión pura de cobro: qué hacer con un nuevo `POST /pagos/crear` de un pedido (C-12, D5)."""
from dataclasses import dataclass

import pytest

from app.modules.pagos.decision_cobro import Intento, decidir_intento


@dataclass
class PagoFalso:
    """Lo único que la decisión lee de un pago: estado local e id de MercadoPago."""

    estado: str
    mp_payment_id: int | None = None


def _decidir(pagos: list[PagoFalso], forma: str = "MERCADOPAGO", estado: str = "PENDIENTE") -> Intento:
    """`pagos` va del más reciente al más antiguo (como `get_by_pedido`)."""
    return decidir_intento(forma, estado, pagos)


def test_pedido_mercadopago_pendiente_sin_pagos_crea_un_intento() -> None:
    assert _decidir([]) is Intento.CREAR


def test_pedido_en_efectivo_pendiente_no_permite_pagar() -> None:
    assert _decidir([], forma="EFECTIVO") is Intento.NO_PERMITIDO


def test_pedido_por_transferencia_no_permite_pagar() -> None:
    assert _decidir([], forma="TRANSFERENCIA") is Intento.NO_PERMITIDO


@pytest.mark.parametrize("estado", ["CANCELADO", "CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO"])
def test_pedido_que_no_esta_pendiente_no_permite_pagar(estado: str) -> None:
    assert _decidir([], estado=estado) is Intento.NO_PERMITIDO


def test_ultimo_pago_rechazado_crea_un_intento_nuevo() -> None:
    assert _decidir([PagoFalso("rechazado", 600)]) is Intento.CREAR


def test_un_pago_aprobado_impide_pagar_aunque_el_ultimo_sea_rechazado() -> None:
    pagos = [PagoFalso("rechazado", 601), PagoFalso("aprobado", 600)]

    assert _decidir(pagos) is Intento.NO_PERMITIDO


def test_un_pago_a_devolver_impide_pagar() -> None:
    assert _decidir([PagoFalso("a_devolver", 600)]) is Intento.NO_PERMITIDO


def test_ultimo_pago_pendiente_con_id_de_mercadopago_esta_en_proceso_y_no_permite_pagar() -> None:
    assert _decidir([PagoFalso("pendiente", 555)]) is Intento.NO_PERMITIDO


def test_ultimo_pago_pendiente_sin_id_de_mercadopago_se_reutiliza() -> None:
    assert _decidir([PagoFalso("pendiente", None)]) is Intento.REUTILIZAR


def test_pendiente_sin_id_tras_un_rechazo_antiguo_se_reutiliza() -> None:
    pagos = [PagoFalso("pendiente", None), PagoFalso("rechazado", 600)]

    assert _decidir(pagos) is Intento.REUTILIZAR
