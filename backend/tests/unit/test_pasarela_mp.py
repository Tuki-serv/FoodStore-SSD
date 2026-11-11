"""Adaptador del borde de MercadoPago: traduce el SDK a resultados y errores del dominio (C-12, D2/D10/D11)."""
import warnings
from decimal import Decimal

import pytest

from app.modules.pagos.pasarela_mp import (
    DatosCobroMP,
    MercadoPagoNoDisponible,
    PagoRechazadoPorMP,
    PasarelaMercadoPago,
    ResultadoMP,
)
from tests.support.mp_webhook import MPFalso

REF = "3f2b8c1e-0000-4000-8000-000000000001"
CLAVE = "clave-idempotencia-1"
URL_NOTIFICACION = "https://a.example/api/v1/pagos/webhook"


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
        installments=1,
        issuer_id=310,
        payer_email="a@test.com",
        payer_identification={"type": "DNI", "number": "12345678"},
        descripcion="Pedido #7 - FoodStore",
        external_reference=REF,
        notification_url=URL_NOTIFICACION,
    )
    return DatosCobroMP(**{**base, **cambios})


def _pasarela() -> PasarelaMercadoPago:
    return PasarelaMercadoPago("TEST-access-token")


# ── crear_pago: cuerpo y headers ────────────────────────────────────────────

def test_crear_pago_envia_el_cuerpo_del_brick_y_la_clave_de_idempotencia(mp: MPFalso) -> None:
    mp.responder_creacion(201, "approved", "accredited", payment_id=900)

    resultado = _pasarela().crear_pago(_datos(), CLAVE)

    (creacion,) = mp.creaciones
    assert creacion.cuerpo["transaction_amount"] == 1500.5
    assert creacion.cuerpo["token"] == "tok-1"
    assert creacion.cuerpo["payment_method_id"] == "visa"
    assert creacion.cuerpo["installments"] == 1
    assert creacion.cuerpo["issuer_id"] == 310
    assert creacion.cuerpo["payer"] == {"email": "a@test.com", "identification": {"type": "DNI", "number": "12345678"}}
    assert creacion.cuerpo["external_reference"] == REF
    assert creacion.cuerpo["notification_url"] == URL_NOTIFICACION
    assert creacion.cuerpo["description"] == "Pedido #7 - FoodStore"
    assert creacion.idempotency_key == CLAVE
    assert mp.tokens == ["TEST-access-token"]
    assert resultado == ResultadoMP(
        mp_payment_id=900,
        mp_status="approved",
        mp_status_detail="accredited",
        mp_merchant_order_id=None,
        external_reference=None,
    )


def test_crear_pago_sin_issuer_ni_identificacion_no_envia_esos_campos(mp: MPFalso) -> None:
    mp.responder_creacion()

    _pasarela().crear_pago(_datos(issuer_id=None, payer_identification=None), CLAVE)

    cuerpo = mp.creaciones[0].cuerpo
    assert "issuer_id" not in cuerpo
    assert cuerpo["payer"] == {"email": "a@test.com"}


def test_monto_chico_se_envia_con_dos_decimales_exactos(mp: MPFalso) -> None:
    mp.responder_creacion()

    _pasarela().crear_pago(_datos("0.10"), CLAVE)

    assert mp.creaciones[0].cuerpo["transaction_amount"] == 0.1


def test_monto_con_mas_de_dos_decimales_se_redondea_half_up(mp: MPFalso) -> None:
    mp.responder_creacion()

    _pasarela().crear_pago(_datos("10.005"), CLAVE)

    assert mp.creaciones[0].cuerpo["transaction_amount"] == 10.01


def test_crear_pago_no_emite_el_deprecation_warning_de_notification_url(mp: MPFalso) -> None:
    mp.responder_creacion()

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        _pasarela().crear_pago(_datos(), CLAVE)


# ── crear_pago: errores ─────────────────────────────────────────────────────

def test_respuesta_400_es_pago_rechazado_por_mp_con_la_causa(mp: MPFalso) -> None:
    mp.responder_creacion_error(400, "invalid_token")

    with pytest.raises(PagoRechazadoPorMP) as exc:
        _pasarela().crear_pago(_datos(), CLAVE)

    assert "invalid_token" in exc.value.causa


def test_respuesta_500_es_mercadopago_no_disponible(mp: MPFalso) -> None:
    mp.responder_creacion_error(500, "internal_error")

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


def test_los_mensajes_de_error_no_contienen_el_token_de_tarjeta_ni_el_access_token(mp: MPFalso) -> None:
    mp.fallar_creacion(OSError("fallo"))

    with pytest.raises(MercadoPagoNoDisponible) as exc:
        _pasarela().crear_pago(_datos(), CLAVE)

    assert "tok-1" not in str(exc.value)
    assert "TEST-access-token" not in str(exc.value)


# ── consultar_pago ──────────────────────────────────────────────────────────

def test_consultar_pago_200_devuelve_el_resultado_con_la_orden_de_mercadopago(mp: MPFalso) -> None:
    mp.responder(700, REF, "approved", merchant_order_id=55)

    resultado = _pasarela().consultar_pago(700)

    assert resultado == ResultadoMP(
        mp_payment_id=700,
        mp_status="approved",
        mp_status_detail=None,
        mp_merchant_order_id=55,
        external_reference=REF,
    )


def test_consultar_pago_toma_merchant_order_id_del_nivel_superior_si_no_hay_order(mp: MPFalso) -> None:
    mp._respuestas[701] = {
        "status": 200,
        "response": {"id": 701, "status": "rejected", "merchant_order_id": 66, "external_reference": REF},
    }

    assert _pasarela().consultar_pago(701).mp_merchant_order_id == 66


def test_consultar_pago_no_200_es_mercadopago_no_disponible(mp: MPFalso) -> None:
    with pytest.raises(MercadoPagoNoDisponible):
        _pasarela().consultar_pago(999)  # el doble responde 404 a ids desconocidos
