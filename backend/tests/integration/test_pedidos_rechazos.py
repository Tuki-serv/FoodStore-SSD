"""Rechazos de `POST /pedidos/` con código y campo estables, dirección propia y personalización válida (C-25b1)."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.modules.direcciones.models import DireccionEntrega
from app.modules.ingredientes.models import Ingrediente
from app.modules.pagos.models import FormaPago
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto, ProductoIngrediente
from tests.support.auth_helpers import crear_usuario_con_roles


def _producto(session: Session, nombre: str, stock: int = 10, disponible: bool = True) -> Producto:
    producto = Producto(nombre=nombre, precio_base="100.00", disponible=disponible, stock_cantidad=stock)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto


def _ingrediente(
    session: Session, nombre: str, producto: Producto | None, removible: bool, unidad_id: int
) -> Ingrediente:
    ingrediente = Ingrediente(nombre=nombre, unidad_medida_id=unidad_id)
    session.add(ingrediente)
    session.commit()
    session.refresh(ingrediente)
    if producto is not None:
        session.add(
            ProductoIngrediente(
                producto_id=producto.id,
                ingrediente_id=ingrediente.id,
                cantidad="1.000",
                unidad_medida_id=unidad_id,
                es_removible=removible,
            )
        )
        session.commit()
    return ingrediente


def _post(client: TestClient, headers: dict, items: list[dict], direccion_id: int | None, forma: str = "EFECTIVO"):
    return client.post(
        "/api/v1/pedidos/",
        json={"direccion_id": direccion_id, "forma_pago_codigo": forma, "items": items},
        headers=headers,
    )


def _sin_pedidos(session: Session) -> bool:
    return len(session.exec(select(Pedido)).all()) == 0


def _code_field(response) -> tuple[str, str | None]:
    cuerpo = response.json()
    return cuerpo["code"], cuerpo["field"]


# ─── Códigos y campos de los rechazos de línea ───────────────────────────────
def test_producto_inexistente_en_la_primera_linea_responde_404_product_not_found(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    response = _post(client, user_auth_headers, [{"producto_id": 999999, "cantidad": 1}], direccion_db.id)

    assert response.status_code == 404
    assert _code_field(response) == ("PRODUCT_NOT_FOUND", "items.0.producto_id")
    assert _sin_pedidos(session)


def test_producto_inexistente_en_la_segunda_linea_indica_el_indice_de_esa_linea(
    client: TestClient, user_auth_headers: dict, direccion_db, producto_db
) -> None:
    response = _post(
        client,
        user_auth_headers,
        [{"producto_id": producto_db.id, "cantidad": 1}, {"producto_id": 999999, "cantidad": 1}],
        direccion_db.id,
    )

    assert response.status_code == 404
    assert _code_field(response) == ("PRODUCT_NOT_FOUND", "items.1.producto_id")


def test_producto_eliminado_responde_404_product_not_found(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    producto = _producto(session, "Eliminado")
    producto.deleted_at = datetime.now(timezone.utc)
    session.add(producto)
    session.commit()

    response = _post(client, user_auth_headers, [{"producto_id": producto.id, "cantidad": 1}], direccion_db.id)

    assert response.status_code == 404
    assert _code_field(response) == ("PRODUCT_NOT_FOUND", "items.0.producto_id")


def test_producto_no_disponible_responde_400_product_unavailable_con_el_campo_de_la_linea(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db, producto_db
) -> None:
    agotado = _producto(session, "No disponible", disponible=False)

    response = _post(
        client,
        user_auth_headers,
        [{"producto_id": producto_db.id, "cantidad": 1}, {"producto_id": agotado.id, "cantidad": 1}],
        direccion_db.id,
    )

    assert response.status_code == 400
    assert _code_field(response) == ("PRODUCT_UNAVAILABLE", "items.1.producto_id")
    assert _sin_pedidos(session)


def test_stock_insuficiente_responde_400_insufficient_stock_con_el_campo_de_la_linea(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    producto = _producto(session, "Poco stock", stock=5)

    response = _post(client, user_auth_headers, [{"producto_id": producto.id, "cantidad": 6}], direccion_db.id)

    assert response.status_code == 400
    assert _code_field(response) == ("INSUFFICIENT_STOCK", "items.0.producto_id")


def test_stock_insuficiente_sumando_dos_lineas_usa_el_campo_de_la_primera_linea_del_producto(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db, producto_db, unidad_medida_db
) -> None:
    escaso = _producto(session, "Escaso", stock=5)
    sin_sal = _ingrediente(session, "Sal Escaso", escaso, True, unidad_medida_db.id)

    response = _post(
        client,
        user_auth_headers,
        [
            {"producto_id": producto_db.id, "cantidad": 1},
            {"producto_id": escaso.id, "cantidad": 3},
            {"producto_id": escaso.id, "cantidad": 3, "personalizacion": [sin_sal.id]},
        ],
        direccion_db.id,
    )

    assert response.status_code == 400
    assert _code_field(response) == ("INSUFFICIENT_STOCK", "items.1.producto_id")


def test_lineas_repetidas_responde_400_duplicate_item_con_el_indice_de_la_segunda(
    client: TestClient, user_auth_headers: dict, direccion_db, producto_db
) -> None:
    response = _post(
        client,
        user_auth_headers,
        [{"producto_id": producto_db.id, "cantidad": 1}, {"producto_id": producto_db.id, "cantidad": 2}],
        direccion_db.id,
    )

    assert response.status_code == 400
    assert _code_field(response) == ("DUPLICATE_ITEM", "items.1.producto_id")


def test_duplicado_en_la_tercera_linea_indica_el_indice_de_la_repetida(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db, producto_db
) -> None:
    otro = _producto(session, "Otro")

    response = _post(
        client,
        user_auth_headers,
        [
            {"producto_id": producto_db.id, "cantidad": 1},
            {"producto_id": otro.id, "cantidad": 1},
            {"producto_id": otro.id, "cantidad": 1},
        ],
        direccion_db.id,
    )

    assert _code_field(response) == ("DUPLICATE_ITEM", "items.2.producto_id")


# ─── Forma de pago ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("codigo", ["BITCOIN", "DESHABILITADA"])
def test_forma_de_pago_inexistente_o_deshabilitada_responde_400_payment_method_unavailable(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db, producto_db, codigo: str
) -> None:
    session.add(FormaPago(codigo="DESHABILITADA", descripcion="Off", habilitado=False))
    session.commit()

    response = _post(
        client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], direccion_db.id, codigo
    )

    assert response.status_code == 400
    assert _code_field(response) == ("PAYMENT_METHOD_UNAVAILABLE", "forma_pago_codigo")
    assert _sin_pedidos(session)


# ─── Dirección propia (gate A1 aprobado por el usuario) ──────────────────────
def _direccion_ajena(session: Session) -> DireccionEntrega:
    otro = crear_usuario_con_roles(session, ["CLIENT"])
    direccion = DireccionEntrega(usuario_id=otro.id, linea1="Ajena 1", ciudad="Mendoza", es_principal=True)
    session.add(direccion)
    session.commit()
    session.refresh(direccion)
    return direccion


def test_direccion_de_otro_usuario_responde_404_address_not_found_y_no_crea_pedido(
    client: TestClient, session: Session, user_auth_headers: dict, producto_db, normal_user
) -> None:
    ajena = _direccion_ajena(session)

    response = _post(client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], ajena.id)

    assert response.status_code == 404
    assert _code_field(response) == ("ADDRESS_NOT_FOUND", "direccion_id")
    assert _sin_pedidos(session)


def test_direccion_inexistente_responde_404_y_no_500(client: TestClient, user_auth_headers: dict, producto_db) -> None:
    response = _post(client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], 999999)

    assert response.status_code == 404
    assert _code_field(response) == ("ADDRESS_NOT_FOUND", "direccion_id")


def test_direccion_propia_dada_de_baja_responde_404_address_not_found(
    client: TestClient, session: Session, user_auth_headers: dict, producto_db, direccion_db
) -> None:
    direccion_db.deleted_at = datetime.now(timezone.utc)
    session.add(direccion_db)
    session.commit()

    response = _post(client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], direccion_db.id)

    assert response.status_code == 404
    assert _code_field(response) == ("ADDRESS_NOT_FOUND", "direccion_id")


def test_direccion_propia_activa_responde_201_y_el_detalle_la_muestra(
    client: TestClient, user_auth_headers: dict, producto_db, direccion_db
) -> None:
    response = _post(client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], direccion_db.id)

    assert response.status_code == 201
    assert response.json()["direccion_id"] == direccion_db.id


def test_retiro_en_el_local_con_direccion_nula_responde_201(
    client: TestClient, user_auth_headers: dict, producto_db
) -> None:
    response = _post(client, user_auth_headers, [{"producto_id": producto_db.id, "cantidad": 1}], None)

    assert response.status_code == 201
    assert response.json()["direccion_id"] is None


# ─── Personalización ─────────────────────────────────────────────────────────
def test_personalizacion_con_ingrediente_removible_del_producto_guarda_el_nombre_en_el_snapshot(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db, producto_db, unidad_medida_db
) -> None:
    cebolla = _ingrediente(session, "Cebolla Pers", producto_db, True, unidad_medida_db.id)

    response = _post(
        client,
        user_auth_headers,
        [{"producto_id": producto_db.id, "cantidad": 1, "personalizacion": [cebolla.id]}],
        direccion_db.id,
    )

    assert response.status_code == 201
    assert response.json()["items"][0]["personalizacion_snapshot"] == ["Cebolla Pers"]


@pytest.mark.parametrize("caso", ["otro-producto", "no-removible", "inexistente"])
def test_personalizacion_invalida_responde_400_invalid_customization(
    client: TestClient,
    session: Session,
    user_auth_headers: dict,
    direccion_db,
    producto_db,
    unidad_medida_db,
    caso: str,
) -> None:
    otro = _producto(session, "Otro prod")
    ids = {
        "otro-producto": lambda: _ingrediente(session, "Ajeno", otro, True, unidad_medida_db.id).id,
        "no-removible": lambda: _ingrediente(session, "Fijo", producto_db, False, unidad_medida_db.id).id,
        "inexistente": lambda: 999999,
    }

    response = _post(
        client,
        user_auth_headers,
        [
            {"producto_id": otro.id, "cantidad": 1},
            {"producto_id": producto_db.id, "cantidad": 1, "personalizacion": [ids[caso]()]},
        ],
        direccion_db.id,
    )

    assert response.status_code == 400
    assert _code_field(response) == ("INVALID_CUSTOMIZATION", "items.1.personalizacion")
    assert _sin_pedidos(session)
