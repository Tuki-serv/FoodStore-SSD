"""Correcciones del esquema a la spec (D13) a nivel de base, con SQL real."""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.security import hash_password
from app.modules.categorias.models import Categoria
from app.modules.direcciones_entrega.models import DireccionEntrega
from app.modules.productos.models import Producto
from app.modules.usuarios.models import Usuario

ID_MAYOR_A_32_BITS = 3_000_000_000


def test_usuario_con_id_mayor_a_32_bits_y_direccion_que_lo_referencia_se_aceptan(session: Session) -> None:
    session.add(
        Usuario(
            id=ID_MAYOR_A_32_BITS,
            nombre="Big",
            apellido="Id",
            email="bigid@example.com",
            password_hash=hash_password("x"),
        )
    )
    session.flush()
    session.add(DireccionEntrega(usuario_id=ID_MAYOR_A_32_BITS, linea1="Calle 1", ciudad="Mendoza"))
    session.flush()

    direccion_usuario = session.execute(
        text("SELECT usuario_id FROM direccion_entrega WHERE usuario_id = :id"), {"id": ID_MAYOR_A_32_BITS}
    ).scalar_one()

    assert direccion_usuario == ID_MAYOR_A_32_BITS


def test_borrado_fisico_de_categoria_padre_deja_a_la_hija_con_parent_id_nulo(session: Session) -> None:
    padre = Categoria(nombre="Padre SQL", imagen_url=None)
    session.add(padre)
    session.flush()
    hija = Categoria(nombre="Hija SQL", imagen_url=None, parent_id=padre.id)
    session.add(hija)
    session.flush()
    hija_id, padre_id = hija.id, padre.id
    session.expunge_all()

    session.execute(text("DELETE FROM categorias WHERE id = :id"), {"id": padre_id})

    parent_id = session.execute(text("SELECT parent_id FROM categorias WHERE id = :id"), {"id": hija_id}).scalar_one()
    assert parent_id is None


def test_stock_negativo_se_rechaza_con_el_check_nombrado_y_cero_se_acepta(session: Session) -> None:
    producto = Producto(nombre="Stock SQL", precio_base="10.00", stock_cantidad=5)
    session.add(producto)
    session.flush()
    producto_id = producto.id

    with pytest.raises(IntegrityError, match="ck_producto_stock_no_negativo"):
        with session.begin_nested():
            session.execute(text("UPDATE productos SET stock_cantidad = -1 WHERE id = :id"), {"id": producto_id})

    session.execute(text("UPDATE productos SET stock_cantidad = 0 WHERE id = :id"), {"id": producto_id})
    stock = session.execute(text("SELECT stock_cantidad FROM productos WHERE id = :id"), {"id": producto_id}).scalar_one()
    assert stock == 0


def test_linea1_de_1000_caracteres_se_guarda_y_se_lee_completa(session: Session) -> None:
    session.add(
        Usuario(nombre="Line", apellido="Larga", email="linea@example.com", password_hash=hash_password("x"))
    )
    session.flush()
    usuario_id = session.execute(text("SELECT id FROM usuario WHERE email = 'linea@example.com'")).scalar_one()
    larga = "a" * 1000
    direccion = DireccionEntrega(usuario_id=usuario_id, linea1=larga, ciudad="Mendoza")
    session.add(direccion)
    session.flush()
    direccion_id = direccion.id
    session.expire_all()

    leida = session.get(DireccionEntrega, direccion_id)

    assert leida is not None
    assert leida.linea1 == larga
    assert len(leida.linea1) == 1000
