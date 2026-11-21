"""El webhook consulta la orden y accede a la base fuera del event loop: una consulta lenta no congela el servidor."""
import threading

from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import pedido_con_detalle, producto, referencia_de


def test_la_consulta_de_la_orden_corre_en_un_hilo_sin_event_loop_y_el_resultado_no_cambia(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_detalle(session, normal_user["id"], producto(session, "Loop", 5), 1, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    assert mp_sdk.corrio_en_event_loop == [False]


def test_health_responde_mientras_la_consulta_de_la_orden_esta_en_curso(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_detalle(session, normal_user["id"], producto(session, "Lenta", 5), 1, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))
    consulta_en_curso = threading.Event()
    liberar_consulta = threading.Event()

    def consulta_lenta(order_id: str) -> None:
        consulta_en_curso.set()
        liberar_consulta.wait(timeout=10)

    mp_sdk.antes_de_responder_consulta(consulta_lenta)
    resultado: dict[str, int] = {}
    hilo = threading.Thread(target=lambda: resultado.update(status=post_webhook(client, "ORD123").status_code))
    hilo.start()
    try:
        assert consulta_en_curso.wait(timeout=10), "la consulta de la orden nunca arrancó"

        salud = client.get("/health")

        assert salud.status_code == 200
        assert hilo.is_alive()  # el webhook sigue esperando la consulta lenta: /health no tuvo que esperarlo
    finally:
        liberar_consulta.set()
        hilo.join(timeout=10)
    assert resultado == {"status": 200}
