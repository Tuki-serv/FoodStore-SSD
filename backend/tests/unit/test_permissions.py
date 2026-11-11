"""Primitivas puras de autorización: `tiene_algun_rol` y `union_por_roles` (sin BD)."""
from app.core.permissions import puede_acceder_a_propio, tiene_algun_rol, union_por_roles


def test_tiene_algun_rol_con_un_rol_permitido_devuelve_true() -> None:
    assert tiene_algun_rol({"CLIENT", "STOCK"}, ["STOCK"]) is True


def test_tiene_algun_rol_sin_ningun_rol_permitido_devuelve_false() -> None:
    assert tiene_algun_rol({"CLIENT"}, ["ADMIN", "STOCK"]) is False


def test_tiene_algun_rol_con_roles_vacios_devuelve_false() -> None:
    assert tiene_algun_rol(set(), ["ADMIN"]) is False


def test_union_por_roles_une_los_aportes_de_cada_rol() -> None:
    mapa = {"A": {"x": {"1"}}, "B": {"x": {"2"}, "y": {"3"}}}

    assert union_por_roles(mapa, {"A", "B"}, "x") == frozenset({"1", "2"})


def test_union_por_roles_con_roles_vacios_devuelve_conjunto_vacio() -> None:
    assert union_por_roles({"A": {"x": {"1"}}}, set(), "x") == frozenset()


def test_union_por_roles_rol_ausente_del_mapa_no_aporta_ni_lanza_key_error() -> None:
    assert union_por_roles({"A": {"x": {"1"}}}, {"C"}, "x") == frozenset()


def test_union_por_roles_clave_ausente_para_un_rol_presente_aporta_vacio() -> None:
    mapa = {"A": {"x": {"1"}}, "B": {"y": {"3"}}}

    assert union_por_roles(mapa, {"A", "B"}, "y") == frozenset({"3"})


def test_union_por_roles_con_solapamiento_no_duplica() -> None:
    mapa = {"A": {"x": {"1", "2"}}, "B": {"x": {"2", "3"}}, "C": {"x": {"3", "1"}}}

    assert union_por_roles(mapa, {"A", "B", "C"}, "x") == frozenset({"1", "2", "3"})


def test_puede_acceder_a_propio_el_dueno_sin_roles_privilegiados_devuelve_true() -> None:
    assert puede_acceder_a_propio(7, 7, frozenset({"CLIENT"}), {"ADMIN"}) is True


def test_puede_acceder_a_propio_otro_usuario_sin_rol_privilegiado_devuelve_false() -> None:
    assert puede_acceder_a_propio(7, 8, frozenset({"CLIENT"}), {"ADMIN"}) is False


def test_puede_acceder_a_propio_otro_usuario_con_rol_privilegiado_entre_varios_devuelve_true() -> None:
    assert puede_acceder_a_propio(7, 8, frozenset({"CLIENT", "ADMIN"}), {"ADMIN"}) is True


def test_puede_acceder_a_propio_otro_usuario_con_roles_no_privilegiados_devuelve_false() -> None:
    assert puede_acceder_a_propio(7, 8, frozenset({"PEDIDOS", "STOCK"}), {"ADMIN"}) is False


def test_puede_acceder_a_propio_otro_usuario_sin_roles_devuelve_false() -> None:
    assert puede_acceder_a_propio(7, 8, frozenset(), {"ADMIN"}) is False
