"""Filtros del listado público de productos (C-16a): rango de precio, solo con stock y resultados sin duplicados."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import Ingrediente
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.unidades_medida.models import UnidadMedida

URL = "/api/v1/productos/"


def _producto(session: Session, nombre: str, precio: str, stock: int = 5, disponible: bool = True) -> Producto:
    producto = Producto(nombre=nombre, precio_base=precio, disponible=disponible, stock_cantidad=stock)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto


def _categoria(session: Session, nombre: str) -> Categoria:
    categoria = Categoria(nombre=nombre)
    session.add(categoria)
    session.commit()
    session.refresh(categoria)
    return categoria


def _ingrediente(session: Session, nombre: str, unidad_medida_id: int) -> Ingrediente:
    ingrediente = Ingrediente(nombre=nombre, unidad_medida_id=unidad_medida_id)
    session.add(ingrediente)
    session.commit()
    session.refresh(ingrediente)
    return ingrediente


def _vincular_categorias(session: Session, producto: Producto, *categorias: Categoria) -> None:
    for categoria in categorias:
        session.add(ProductoCategoria(producto_id=producto.id, categoria_id=categoria.id))
    session.commit()


def _vincular_ingredientes(session: Session, producto: Producto, *ingredientes: Ingrediente) -> None:
    for ingrediente in ingredientes:
        session.add(
            ProductoIngrediente(
                producto_id=producto.id,
                ingrediente_id=ingrediente.id,
                cantidad=1,
                unidad_medida_id=ingrediente.unidad_medida_id,
            )
        )
    session.commit()


def _nombres(response) -> list[str]:
    assert response.status_code == 200
    return [item["nombre"] for item in response.json()["items"]]


def _tres_precios(session: Session) -> None:
    _producto(session, "Barato", "700.00")
    _producto(session, "Medio", "1500.00")
    _producto(session, "Caro", "1900.00")


# -- Rango de precio ----------------------------------------------------------

def test_listar_productos_con_rango_de_precio_devuelve_los_del_rango(client: TestClient, session: Session) -> None:
    _tres_precios(session)

    response = client.get(f"{URL}?precio_min=700&precio_max=1500")

    assert _nombres(response) == ["Barato", "Medio"]
    assert response.json()["total"] == 2


def test_listar_productos_con_solo_precio_minimo_devuelve_los_de_ese_precio_o_mas(client: TestClient, session: Session) -> None:
    _tres_precios(session)

    assert _nombres(client.get(f"{URL}?precio_min=1600")) == ["Caro"]


def test_listar_productos_con_solo_precio_maximo_devuelve_los_de_ese_precio_o_menos(client: TestClient, session: Session) -> None:
    _tres_precios(session)

    assert _nombres(client.get(f"{URL}?precio_max=700")) == ["Barato"]


def test_listar_productos_con_minimo_mayor_que_maximo_responde_422_en_precio_max(client: TestClient, session: Session) -> None:
    _tres_precios(session)

    response = client.get(f"{URL}?precio_min=2000&precio_max=1000")

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["field"] == "precio_max"


def test_listar_productos_con_precio_minimo_negativo_responde_422_en_precio_min(client: TestClient) -> None:
    response = client.get(f"{URL}?precio_min=-1")

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["field"] == "precio_min"


# -- Solo con stock -----------------------------------------------------------

def _agotado_y_con_stock(session: Session) -> None:
    _producto(session, "Agotado", "1000.00", stock=0)
    _producto(session, "Con Stock", "1000.00", stock=5)


def test_listar_productos_con_stock_true_excluye_los_agotados(client: TestClient, session: Session) -> None:
    _agotado_y_con_stock(session)

    response = client.get(f"{URL}?con_stock=true")

    assert _nombres(response) == ["Con Stock"]
    assert response.json()["total"] == 1


def test_listar_productos_con_stock_false_no_filtra_por_stock(client: TestClient, session: Session) -> None:
    _agotado_y_con_stock(session)

    response = client.get(f"{URL}?con_stock=false")

    assert _nombres(response) == ["Agotado", "Con Stock"]
    assert response.json()["total"] == 2


def test_listar_productos_sin_con_stock_no_filtra_por_stock(client: TestClient, session: Session) -> None:
    _agotado_y_con_stock(session)

    assert _nombres(client.get(URL)) == ["Agotado", "Con Stock"]


# -- Sin duplicados -----------------------------------------------------------

def test_listar_productos_en_dos_categorias_pedidas_aparece_una_vez(client: TestClient, session: Session) -> None:
    hamburguesas = _categoria(session, "Hamburguesas")
    veganas = _categoria(session, "Veganas")
    vegana = _producto(session, "Burger Vegana", "1800.00")
    clasica = _producto(session, "Hamburguesa Clasica", "1500.00")
    _vincular_categorias(session, vegana, hamburguesas, veganas)
    _vincular_categorias(session, clasica, hamburguesas)

    response = client.get(f"{URL}?categoria_ids={hamburguesas.id}&categoria_ids={veganas.id}")

    assert _nombres(response) == ["Burger Vegana", "Hamburguesa Clasica"]
    assert response.json()["total"] == 2


def test_listar_productos_con_dos_ingredientes_pedidos_aparece_una_vez(
    client: TestClient, session: Session, unidad_medida_db: UnidadMedida
) -> None:
    lechuga = _ingrediente(session, "Lechuga", unidad_medida_db.id)
    tomate = _ingrediente(session, "Tomate", unidad_medida_db.id)
    ensalada = _producto(session, "Ensalada", "900.00")
    _vincular_ingredientes(session, ensalada, lechuga, tomate)

    response = client.get(f"{URL}?ingrediente_ids={lechuga.id}&ingrediente_ids={tomate.id}")

    assert _nombres(response) == ["Ensalada"]
    assert response.json()["total"] == 1


def test_listar_productos_paginado_con_categorias_multiples_total_y_paginas_coinciden(client: TestClient, session: Session) -> None:
    cat_a = _categoria(session, "A")
    cat_b = _categoria(session, "B")
    for nombre in ("Uno", "Dos"):
        _vincular_categorias(session, _producto(session, nombre, "1000.00"), cat_a, cat_b)

    body = client.get(f"{URL}?categoria_ids={cat_a.id}&categoria_ids={cat_b.id}&size=1").json()

    assert [item["nombre"] for item in body["items"]] == ["Uno"]
    assert body["total"] == 2
    assert body["pages"] == 2


# -- Visibilidad y combinacion ------------------------------------------------

def test_listar_productos_anonimo_con_precio_y_stock_no_ve_el_no_disponible(client: TestClient, session: Session) -> None:
    _producto(session, "Oculto", "1000.00", stock=10, disponible=False)
    _producto(session, "Visible", "1000.00", stock=10)

    assert _nombres(client.get(f"{URL}?precio_min=500&con_stock=true")) == ["Visible"]


def test_listar_productos_admin_con_precio_y_stock_ve_el_no_disponible(
    client: TestClient, session: Session, admin_auth_headers: dict
) -> None:
    _producto(session, "Oculto", "1000.00", stock=10, disponible=False)
    _producto(session, "Visible", "1000.00", stock=10)

    response = client.get(f"{URL}?precio_min=500&con_stock=true", headers=admin_auth_headers)

    assert _nombres(response) == ["Oculto", "Visible"]


def test_listar_productos_con_filtros_combinados_devuelve_la_interseccion(client: TestClient, session: Session) -> None:
    categoria = _categoria(session, "Combos")
    otra = _categoria(session, "Otra")
    _vincular_categorias(session, _producto(session, "Burger Doble", "1500.00", stock=3), categoria)
    for nombre, precio, stock, cat in (
        ("Burger Cara", "2500.00", 3, categoria),
        ("Burger Agotada", "1500.00", 0, categoria),
        ("Burger Otra", "1500.00", 3, otra),
        ("Pizza", "1500.00", 3, categoria),
    ):
        _vincular_categorias(session, _producto(session, nombre, precio, stock=stock), cat)

    response = client.get(
        f"{URL}?q=burger&categoria_ids={categoria.id}&precio_min=1000&precio_max=2000&con_stock=true"
    )

    assert _nombres(response) == ["Burger Doble"]
    assert response.json()["total"] == 1
