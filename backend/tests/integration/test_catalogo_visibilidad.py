"""Visibilidad de las lecturas del catálogo: público/CLIENT/PEDIDOS solo lo visible; ADMIN/STOCK no disponibles;
solo ADMIN eliminados. Los filtros intersectan, nunca amplían."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.productos.models import Producto


@pytest.fixture(name="catalogo")
def catalogo_fixture(session: Session, client: TestClient) -> dict[str, Producto]:
    """Un producto disponible, uno no disponible y uno eliminado (nombres literales)."""
    productos = {
        "disponible": Producto(nombre="Visible", precio_base="100.00", disponible=True, stock_cantidad=5),
        "no_disponible": Producto(nombre="Agotado", precio_base="200.00", disponible=False, stock_cantidad=5),
        "eliminado": Producto(
            nombre="Baja", precio_base="300.00", disponible=True, stock_cantidad=5, deleted_at=datetime.now(timezone.utc)
        ),
    }
    session.add_all(productos.values())
    session.commit()
    for producto in productos.values():
        session.refresh(producto)
    return productos


def _nombres(response) -> list[str]:
    assert response.status_code == 200
    return [item["nombre"] for item in response.json()["items"]]


def test_productos_anonimo_lista_solo_el_disponible(client: TestClient, catalogo: dict) -> None:
    response = client.get("/api/v1/productos")

    assert _nombres(response) == ["Visible"]
    assert response.json()["total"] == 1


def test_productos_anonimo_con_estado_todos_sigue_viendo_solo_el_disponible(client: TestClient, catalogo: dict) -> None:
    assert _nombres(client.get("/api/v1/productos?estado=TODOS")) == ["Visible"]


def test_productos_anonimo_con_disponible_false_recibe_pagina_vacia(client: TestClient, catalogo: dict) -> None:
    response = client.get("/api/v1/productos?disponible=false")

    assert _nombres(response) == []
    assert response.json()["total"] == 0


def test_producto_detalle_no_disponible_es_404_para_el_anonimo(client: TestClient, catalogo: dict) -> None:
    assert client.get(f"/api/v1/productos/{catalogo['no_disponible'].id}").status_code == 404


def test_producto_detalle_eliminado_con_include_deleted_es_404_para_el_anonimo(client: TestClient, catalogo: dict) -> None:
    assert client.get(f"/api/v1/productos/{catalogo['eliminado'].id}?include_deleted=true").status_code == 404


def test_productos_client_y_pedidos_con_estado_todos_ven_solo_el_disponible(
    client: TestClient, catalogo: dict, usuario_con_roles
) -> None:
    for roles in (["CLIENT"], ["PEDIDOS"]):
        _, headers = usuario_con_roles(roles)
        assert _nombres(client.get("/api/v1/productos?estado=TODOS", headers=headers)) == ["Visible"]


# ── Triangulación: lectores privilegiados de productos ───────────────────────

def test_productos_stock_con_disponible_false_incluye_el_no_disponible(
    client: TestClient, catalogo: dict, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    assert _nombres(client.get("/api/v1/productos?disponible=false", headers=headers)) == ["Agotado"]


def test_productos_admin_sin_filtros_ve_disponible_y_no_disponible_pero_no_el_eliminado(
    client: TestClient, catalogo: dict, admin_auth_headers: dict
) -> None:
    assert _nombres(client.get("/api/v1/productos", headers=admin_auth_headers)) == ["Visible", "Agotado"]


def test_producto_detalle_client_mas_stock_ve_el_no_disponible(
    client: TestClient, catalogo: dict, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["CLIENT", "STOCK"])

    response = client.get(f"/api/v1/productos/{catalogo['no_disponible'].id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["nombre"] == "Agotado"


def test_productos_admin_con_estado_eliminado_incluye_el_eliminado(
    client: TestClient, catalogo: dict, admin_auth_headers: dict
) -> None:
    assert _nombres(client.get("/api/v1/productos?estado=ELIMINADO", headers=admin_auth_headers)) == ["Baja"]
    detalle = client.get(f"/api/v1/productos/{catalogo['eliminado'].id}?include_deleted=true", headers=admin_auth_headers)
    assert detalle.status_code == 200


def test_productos_stock_no_ve_eliminados_ni_en_lista_ni_en_detalle(
    client: TestClient, catalogo: dict, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    assert _nombres(client.get("/api/v1/productos?estado=ELIMINADO", headers=headers)) == []
    assert client.get(f"/api/v1/productos/{catalogo['eliminado'].id}?include_deleted=true", headers=headers).status_code == 404


def test_lectura_publica_con_access_invalido_es_401_y_sin_header_es_200(client: TestClient, catalogo: dict) -> None:
    invalido = client.get("/api/v1/productos", headers={"Authorization": "Bearer no-es-un-jwt"})
    anonimo = client.get("/api/v1/productos")

    assert invalido.status_code == 401
    assert anonimo.status_code == 200


# ── Ingredientes, categorías y unidades de medida: eliminados solo ADMIN ─────

def _baja() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture(name="ingredientes")
def ingredientes_fixture(session: Session, unidad_medida_db) -> dict:
    from app.modules.ingredientes.models import Ingrediente

    ingredientes = {
        "activo": Ingrediente(nombre="Queso Vis", unidad_medida_id=unidad_medida_db.id),
        "eliminado": Ingrediente(nombre="Tomate Baja", unidad_medida_id=unidad_medida_db.id, deleted_at=_baja()),
    }
    session.add_all(ingredientes.values())
    session.commit()
    return ingredientes


def test_ingredientes_anonimo_con_estado_eliminado_recibe_pagina_vacia(client: TestClient, ingredientes: dict) -> None:
    response = client.get("/api/v1/ingredientes?estado=ELIMINADO")

    assert _nombres(response) == []
    assert response.json()["total"] == 0


def test_ingrediente_detalle_eliminado_stock_404_y_admin_200(
    client: TestClient, ingredientes: dict, usuario_con_roles, admin_auth_headers: dict
) -> None:
    ruta = f"/api/v1/ingredientes/{ingredientes['eliminado'].id}?incluir_eliminado=true"
    _, headers_stock = usuario_con_roles(["STOCK"])

    assert client.get(ruta, headers=headers_stock).status_code == 404
    assert client.get(ruta, headers=admin_auth_headers).status_code == 200


@pytest.fixture(name="categorias")
def categorias_fixture(session: Session) -> dict:
    from app.modules.categorias.models import Categoria

    categorias = {
        "activa": Categoria(nombre="Cat Vis", imagen_url="http://img.com/a"),
        "eliminada": Categoria(nombre="Cat Baja", imagen_url="http://img.com/b", deleted_at=_baja()),
    }
    session.add_all(categorias.values())
    session.commit()
    return categorias


@pytest.fixture(name="unidades")
def unidades_fixture(session: Session) -> dict:
    from app.modules.unidades_medida.models import UnidadMedida

    unidades = {
        "eliminada": UnidadMedida(nombre="Unidad Baja", simbolo="ub", tipo="peso", deleted_at=_baja()),
    }
    session.add_all(unidades.values())
    session.commit()
    return unidades


def test_categorias_anonimo_con_estado_todos_no_incluye_la_eliminada_y_admin_con_eliminado_si(
    client: TestClient, categorias: dict, admin_auth_headers: dict
) -> None:
    assert "Cat Baja" not in _nombres(client.get("/api/v1/categorias?estado=TODOS"))
    assert _nombres(client.get("/api/v1/categorias?estado=ELIMINADO", headers=admin_auth_headers)) == ["Cat Baja"]


def test_categoria_detalle_eliminada_con_incluir_eliminado_es_404_para_el_anonimo(
    client: TestClient, categorias: dict
) -> None:
    ruta = f"/api/v1/categorias/{categorias['eliminada'].id}?incluir_eliminado=true"

    assert client.get(ruta).status_code == 404


def test_unidad_detalle_eliminada_client_404_y_admin_200(
    client: TestClient, unidades: dict, usuario_con_roles, admin_auth_headers: dict
) -> None:
    ruta = f"/api/v1/unidades-medida/{unidades['eliminada'].id}?incluir_eliminado=true"
    _, headers_client = usuario_con_roles(["CLIENT"])

    assert client.get(ruta, headers=headers_client).status_code == 404
    assert client.get(ruta, headers=admin_auth_headers).status_code == 200


def test_unidades_anonimo_con_estado_eliminado_recibe_pagina_vacia(client: TestClient, unidades: dict) -> None:
    assert _nombres(client.get("/api/v1/unidades-medida?estado=ELIMINADO")) == []


# ── Usuario dado de baja en lectura pública: 401 como un access inválido (OQ-8) ──

_LECTURAS_PUBLICAS = [
    "/api/v1/productos",
    "/api/v1/productos/999999",
    "/api/v1/ingredientes",
    "/api/v1/ingredientes/999999",
    "/api/v1/categorias",
    "/api/v1/categorias/999999",
    "/api/v1/unidades-medida",
    "/api/v1/unidades-medida/999999",
]


@pytest.mark.parametrize("ruta", _LECTURAS_PUBLICAS)
def test_lectura_publica_con_access_de_usuario_dado_de_baja_es_401_igual_que_un_access_invalido(
    client: TestClient, session: Session, ruta: str
) -> None:
    from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles

    usuario = crear_usuario_con_roles(session, ["ADMIN"])
    usuario.deleted_at = datetime.now(timezone.utc)
    session.commit()
    esperado = client.get(ruta, headers={"Authorization": "Bearer no-es-un-jwt"})

    response = client.get(ruta, headers=bearer_de_usuario(usuario, ["ADMIN"]))

    assert response.status_code == 401
    assert response.json() == esperado.json()
    assert response.headers.get("www-authenticate") == esperado.headers.get("www-authenticate")
