"""Decisión pura de idempotencia del webhook de pagos (D5): ¿se procesa la notificación o ya estaba aplicada?"""
import pytest

from app.modules.pagos.decision_webhook import Accion, decidir_transicion_pago


@pytest.mark.parametrize("nuevo_estado", ["aprobado", "rechazado", "pendiente"])
def test_pago_local_aprobado_es_terminal_para_cualquier_notificacion(nuevo_estado: str) -> None:
    assert decidir_transicion_pago("aprobado", 100, 100, nuevo_estado) == Accion.YA_PROCESADO
    assert decidir_transicion_pago("aprobado", 100, 999, nuevo_estado) == Accion.YA_PROCESADO


def test_pago_local_pendiente_con_notificacion_aprobada_se_procesa() -> None:
    assert decidir_transicion_pago("pendiente", None, 100, "aprobado") == Accion.PROCESAR


@pytest.mark.parametrize("nuevo_estado", ["aprobado", "rechazado", "pendiente"])
def test_pago_local_a_devolver_es_terminal(nuevo_estado: str) -> None:
    assert decidir_transicion_pago("a_devolver", 100, 100, nuevo_estado) == Accion.YA_PROCESADO


def test_reentrega_de_un_rechazado_con_el_mismo_id_ya_estaba_procesada() -> None:
    assert decidir_transicion_pago("rechazado", 100, 100, "rechazado") == Accion.YA_PROCESADO


def test_nuevo_intento_aprobado_tras_un_rechazo_con_otro_id_se_procesa() -> None:
    assert decidir_transicion_pago("rechazado", 100, 101, "aprobado") == Accion.PROCESAR


def test_reentrega_de_un_pendiente_con_el_mismo_id_ya_estaba_procesada() -> None:
    assert decidir_transicion_pago("pendiente", 100, 100, "pendiente") == Accion.YA_PROCESADO


def test_pendiente_sin_id_local_con_notificacion_pendiente_se_procesa_para_registrar_el_id() -> None:
    assert decidir_transicion_pago("pendiente", None, 100, "pendiente") == Accion.PROCESAR


def test_pendiente_local_que_pasa_a_rechazado_o_aprobado_se_procesa() -> None:
    assert decidir_transicion_pago("pendiente", 100, 100, "rechazado") == Accion.PROCESAR
    assert decidir_transicion_pago("pendiente", 100, 100, "aprobado") == Accion.PROCESAR
