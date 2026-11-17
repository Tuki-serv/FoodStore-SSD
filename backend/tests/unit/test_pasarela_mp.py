"""Adaptador del borde de MercadoPago: traduce la Orders API (SDK) a resultados y errores del dominio (C-12, D17-D19, D25)."""
import logging
import warnings
from decimal import Decimal

import pytest

from app.modules.pagos.pasarela_mp import (
    CredencialesMPRechazadas,
    DatosCobroMP,
    MercadoPagoNoDisponible,
    PagoRechazadoPorMP,
    PasarelaMercadoPago,
    ResultadoMP,
)
from tests.support.mp_webhook import MPFalso, construir_orden

REF = "3f2b8c1e-0000-4000-8000-000000000001"
CLAVE = "clave-idempotencia-1"
ACCESS_TOKEN = "TEST-access-token"


@pytest.fixture
def mp(monkeypatch: pytest.MonkeyPatch) -> MPFalso:
    doble = MPFalso()
    monkeypatch.setattr("app.modules.pagos.pasarela_mp.mercadopago.SDK", doble)
    return doble


def _datos(monto: str = "1500.50", **cambios) -> DatosCobroMP:
    base = dict(
        monto=Decimal(monto),
        token="tok-1",
        payment_method_id="visa",
        payment_type_id="credit_card",
        installments=1,
        payer_email="a@test.com",
        payer_identification={"type": "DNI", "number": "12345678"},
        descripcion="Pedido #7 - FoodStore",
        external_reference=REF,
    )
    return DatosCobroMP(**{**base, **cambios})


def _pasarela() -> PasarelaMercadoPago:
    return PasarelaMercadoPago(ACCESS_TOKEN)


# ── crear_pago: cuerpo, headers y resultado ─────────────────────────────────

def test_crear_pago_envia_la_orden_online_automatica_con_montos_en_texto_y_la_clave_de_idempotencia(mp: MPFalso) -> None:
    mp.responder_orden(201, "processed", "accredited", "accredited", order_id="ORD01X", payment_id="PAY01X")

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    (creacion,) = mp.creaciones
    assert creacion.cuerpo == {
        "type": "online",
        "processing_mode": "automatic",
        "total_amount": "1500.50",
        "external_reference": REF,
        "description": "Pedido #7 - FoodStore",
        "payer": {"email": "a@test.com", "identification": {"type": "DNI", "number": "12345678"}},
        "transactions": {
            "payments": [
                {
                    "amount": "1500.50",
                    "payment_method": {"id": "visa", "type": "credit_card", "token": "tok-1", "installments": 1},
                }
            ]
        },
    }
    assert creacion.idempotency_key == CLAVE
    assert mp.tokens == [ACCESS_TOKEN]
    assert resultado == ResultadoMP(
        mp_order_id="ORD01X",
        mp_payment_id="PAY01X",
        mp_status="processed",
        mp_status_detail="accredited",
        external_reference=REF,
    )


def test_crear_pago_con_tarjeta_de_debito_y_sin_identificacion_envia_ese_tipo_y_solo_el_email(mp: MPFalso) -> None:
    mp.responder_orden()

    _pasarela().crear_pago(_datos(payment_type_id="debit_card", payer_identification=None), CLAVE)

    cuerpo = mp.creaciones[0].cuerpo
    assert cuerpo["payer"] == {"email": "a@test.com"}
    assert cuerpo["transactions"]["payments"][0]["payment_method"]["type"] == "debit_card"
    assert "issuer_id" not in str(cuerpo)
    assert "notification_url" not in cuerpo


def test_monto_chico_se_envia_con_dos_decimales_exactos_en_texto(mp: MPFalso) -> None:
    mp.responder_orden()

    _pasarela().crear_pago(_datos("0.10"), CLAVE)

    cuerpo = mp.creaciones[0].cuerpo
    assert cuerpo["total_amount"] == "0.10"
    assert cuerpo["transactions"]["payments"][0]["amount"] == "0.10"


def test_monto_con_mas_de_dos_decimales_se_redondea_half_up(mp: MPFalso) -> None:
    mp.responder_orden()

    _pasarela().crear_pago(_datos("10.005"), CLAVE)

    assert mp.creaciones[0].cuerpo["total_amount"] == "10.01"


def test_crear_pago_no_emite_warnings(mp: MPFalso) -> None:
    mp.responder_orden()

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        _pasarela().crear_pago(_datos(), CLAVE)


# ── crear_pago: respuestas de la orden ──────────────────────────────────────

def test_402_con_la_orden_failed_en_la_raiz_es_un_resultado_con_el_detalle_de_la_transaccion(mp: MPFalso) -> None:
    mp.responder_orden(402, "failed", "failed", "insufficient_amount", order_id="ORD02", payment_id="PAY02")

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    assert (resultado.mp_order_id, resultado.mp_payment_id, resultado.mp_status, resultado.mp_status_detail) == (
        "ORD02",
        "PAY02",
        "failed",
        "insufficient_amount",
    )


def test_402_con_errors_y_la_orden_bajo_data_es_el_mismo_resultado(mp: MPFalso) -> None:
    mp.responder_orden(
        402, "failed", "failed", "insufficient_amount", order_id="ORD03", payment_id="PAY03", envuelta_en_data=True
    )

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    assert (resultado.mp_order_id, resultado.mp_status, resultado.mp_status_detail) == (
        "ORD03",
        "failed",
        "insufficient_amount",
    )


def test_orden_sin_transaccion_usa_el_detalle_de_la_orden(mp: MPFalso) -> None:
    mp.responder_orden(201, "processing", "in_process", None, order_id="ORD04", payment_id=None)

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    assert (resultado.mp_payment_id, resultado.mp_status, resultado.mp_status_detail) == (
        None,
        "processing",
        "in_process",
    )


def test_400_de_validacion_es_pago_rechazado_por_mp_con_el_primer_codigo_de_error(mp: MPFalso) -> None:
    mp.responder_orden_error(400, "property_value")

    with pytest.raises(PagoRechazadoPorMP) as exc:
        _pasarela().crear_pago(_datos(), CLAVE)

    assert exc.value.causa == "property_value"


@pytest.mark.parametrize("status", [401, 403])
def test_401_y_403_son_credenciales_rechazadas(mp: MPFalso, status: int) -> None:
    mp.responder_orden_error(status, "unauthorized")

    with pytest.raises(CredencialesMPRechazadas):
        _pasarela().crear_pago(_datos(), CLAVE)


def test_409_clave_ya_usada_busca_la_orden_por_referencia_y_devuelve_su_resultado(mp: MPFalso) -> None:
    mp.responder_orden_error(409, "idempotency_key_already_used")
    mp.responder_busqueda([construir_orden("processed", "accredited", "accredited", "ORD05", "PAY05", REF)])

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    assert mp.busquedas == [{"external_reference": REF}]
    assert (resultado.mp_order_id, resultado.mp_payment_id, resultado.mp_status) == ("ORD05", "PAY05", "processed")


def test_409_y_busqueda_vacia_es_mercadopago_no_disponible(mp: MPFalso) -> None:
    mp.responder_orden_error(409, "idempotency_key_already_used")
    mp.responder_busqueda([])

    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().crear_pago(_datos(), CLAVE)


@pytest.mark.parametrize("status", [423, 500, 503])
def test_423_y_5xx_son_mercadopago_no_disponible(mp: MPFalso, status: int) -> None:
    mp.responder_orden_error(status, "resource_locked")

    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().crear_pago(_datos(), CLAVE)


def test_falla_de_red_es_mercadopago_no_disponible(mp: MPFalso) -> None:
    mp.fallar_creacion(OSError("sin red"))

    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().crear_pago(_datos(), CLAVE)


def test_error_tipado_del_sdk_es_mercadopago_no_disponible(mp: MPFalso) -> None:
    from mercadopago import MPServerError

    mp.fallar_creacion(MPServerError(503, {"message": "unavailable"}))

    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().crear_pago(_datos(), CLAVE)


def test_la_causa_se_acota_al_ancho_de_la_columna(mp: MPFalso) -> None:
    mp.responder_orden_error(400, "x" * 300)

    with pytest.raises(PagoRechazadoPorMP) as exc:
        _pasarela().crear_pago(_datos(), CLAVE)

    assert exc.value.causa == "x" * 100


def test_ningun_mensaje_ni_registro_contiene_el_token_de_tarjeta_ni_el_access_token(
    mp: MPFalso, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    escenarios = [
        lambda: mp.fallar_creacion(OSError("fallo")),
        lambda: mp.responder_orden_error(401, "unauthorized"),
        lambda: mp.responder_orden_error(500, "internal_error"),
    ]
    for configurar in escenarios:
        mp._ordenes_a_crear.clear()
        mp.creaciones.clear()
        configurar()
        with pytest.raises((MercadoPagoNoDisponible, CredencialesMPRechazadas)) as exc:
            _pasarela().crear_pago(_datos(), CLAVE)
        assert "tok-1" not in str(exc.value) and ACCESS_TOKEN not in str(exc.value)

    assert caplog.records  # se registró algo
    assert "tok-1" not in caplog.text
    assert ACCESS_TOKEN not in caplog.text


# ── consultar_orden ─────────────────────────────────────────────────────────

def test_consultar_orden_200_devuelve_el_resultado(mp: MPFalso) -> None:
    mp.responder_orden(
        201, "processed", "accredited", "accredited",
        order_id="ORD01X", payment_id="PAY01X", external_reference=REF, solo_consulta=True,
    )

    resultado = _pasarela().consultar_orden("ORD01X")

    assert resultado == ResultadoMP("ORD01X", "PAY01X", "processed", "accredited", REF)
    assert mp.llamadas == ["ORD01X"]


def test_consultar_orden_failed_expone_el_detalle_de_la_transaccion(mp: MPFalso) -> None:
    mp.responder_orden(
        201, "failed", "failed", "insufficient_amount", order_id="ORD06", payment_id="PAY06", solo_consulta=True
    )

    assert _pasarela().consultar_orden("ORD06").mp_status_detail == "insufficient_amount"


@pytest.mark.parametrize("status", [401, 403])
def test_consultar_orden_401_y_403_son_credenciales_rechazadas(mp: MPFalso, status: int) -> None:
    mp.responder_consulta_error("ORD07", status)

    with pytest.raises(CredencialesMPRechazadas):
        _pasarela().consultar_orden("ORD07")


@pytest.mark.parametrize("status", [404, 500])
def test_consultar_orden_no_200_es_mercadopago_no_disponible(mp: MPFalso, status: int) -> None:
    mp.responder_consulta_error("ORD08", status, "internal_error")

    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().consultar_orden("ORD08")


# ── buscar_por_referencia ───────────────────────────────────────────────────

def test_buscar_por_referencia_sin_resultados_devuelve_none(mp: MPFalso) -> None:
    mp.responder_busqueda([])

    assert _pasarela().buscar_por_referencia(REF) is None
    assert mp.busquedas == [{"external_reference": REF}]
