"""Decisión pura de idempotencia del webhook de pagos (D5): ¿se procesa la notificación o ya estaba aplicada?"""
from decimal import Decimal

import pytest

from app.modules.pagos.decision_webhook import (
    Accion,
    decidir_transicion_pago,
    estado_local_para,
    monto_coincide,
)


@pytest.mark.parametrize("nuevo_estado", ["aprobado", "rechazado", "pendiente"])
def test_pago_local_aprobado_es_terminal_para_cualquier_notificacion(nuevo_estado: str) -> None:
    assert decidir_transicion_pago("aprobado", "ORD100", "ORD100", nuevo_estado) == Accion.YA_PROCESADO
    assert decidir_transicion_pago("aprobado", "ORD100", "ORD999", nuevo_estado) == Accion.YA_PROCESADO


def test_pago_local_pendiente_con_notificacion_aprobada_se_procesa() -> None:
    assert decidir_transicion_pago("pendiente", None, "ORD100", "aprobado") == Accion.PROCESAR


@pytest.mark.parametrize("nuevo_estado", ["aprobado", "rechazado", "pendiente"])
def test_pago_local_a_devolver_es_terminal(nuevo_estado: str) -> None:
    assert decidir_transicion_pago("a_devolver", "ORD100", "ORD100", nuevo_estado) == Accion.YA_PROCESADO


def test_reentrega_de_un_rechazado_con_el_mismo_id_ya_estaba_procesada() -> None:
    assert decidir_transicion_pago("rechazado", "ORD100", "ORD100", "rechazado") == Accion.YA_PROCESADO


def test_nuevo_intento_aprobado_tras_un_rechazo_con_otro_id_se_procesa() -> None:
    assert decidir_transicion_pago("rechazado", "ORD100", "ORD101", "aprobado") == Accion.PROCESAR


def test_reentrega_de_un_pendiente_con_el_mismo_id_ya_estaba_procesada() -> None:
    assert decidir_transicion_pago("pendiente", "ORD100", "ORD100", "pendiente") == Accion.YA_PROCESADO


def test_pendiente_sin_id_local_con_notificacion_pendiente_se_procesa_para_registrar_el_id() -> None:
    assert decidir_transicion_pago("pendiente", None, "ORD100", "pendiente") == Accion.PROCESAR


def test_pendiente_local_que_pasa_a_rechazado_o_aprobado_se_procesa() -> None:
    assert decidir_transicion_pago("pendiente", "ORD100", "ORD100", "rechazado") == Accion.PROCESAR
    assert decidir_transicion_pago("pendiente", "ORD100", "ORD100", "aprobado") == Accion.PROCESAR


def test_pendiente_sin_orden_en_la_notificacion_no_se_toma_por_reentrega() -> None:
    assert decidir_transicion_pago("pendiente", None, None, "pendiente") == Accion.PROCESAR


# ─── Mapeo de estados de la orden (spec «Estados de la orden de MercadoPago») ────────────────────────────────────────
@pytest.mark.parametrize(
    ("estado_orden", "esperado"),
    [
        ("processed", "aprobado"),
        ("partially_refunded", "aprobado"),
        ("failed", "rechazado"),
        ("canceled", "rechazado"),
        ("refunded", "rechazado"),
        ("charged_back", "rechazado"),
        ("created", "pendiente"),
        ("processing", "pendiente"),
        ("action_required", "pendiente"),
        ("expired_x", None),
        (None, None),
    ],
)
def test_estado_local_segun_el_estado_de_la_orden(estado_orden: str | None, esperado: str | None) -> None:
    assert estado_local_para(estado_orden) == esperado


# ─── Control del monto (spec «Control del monto antes de confirmar») ─────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("esperado", "informado"),
    [
        (Decimal("1500.00"), Decimal("1500.00")),
        (Decimal("1500"), Decimal("1500.0")),
        (Decimal("0.10"), Decimal("0.1000")),
    ],
)
def test_montos_iguales_al_centavo_coinciden_aunque_cambie_la_escala(esperado: Decimal, informado: Decimal) -> None:
    assert monto_coincide(esperado, informado) is True


@pytest.mark.parametrize(
    ("esperado", "informado"),
    [
        (Decimal("1500.00"), Decimal("1499.99")),
        (Decimal("1500.00"), Decimal("1.00")),
        (Decimal("1500.00"), None),
    ],
)
def test_montos_distintos_por_un_centavo_o_ausentes_no_coinciden(esperado: Decimal, informado: Decimal | None) -> None:
    assert monto_coincide(esperado, informado) is False
