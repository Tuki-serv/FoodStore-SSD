"""`restringir_estado`: el público nunca ve eliminados (intersección de filtros, sin error)."""
from app.core.enums import EstadoFiltro, restringir_estado


def test_restringir_estado_todos_para_publico_queda_en_activo() -> None:
    assert restringir_estado(EstadoFiltro.TODOS, solo_publicos=True) == EstadoFiltro.ACTIVO


def test_restringir_estado_eliminado_para_publico_da_resultado_vacio() -> None:
    assert restringir_estado(EstadoFiltro.ELIMINADO, solo_publicos=True) is None


def test_restringir_estado_activo_para_publico_se_mantiene() -> None:
    assert restringir_estado(EstadoFiltro.ACTIVO, solo_publicos=True) == EstadoFiltro.ACTIVO


def test_restringir_estado_eliminado_para_privilegiado_se_respeta() -> None:
    assert restringir_estado(EstadoFiltro.ELIMINADO, solo_publicos=False) == EstadoFiltro.ELIMINADO


def test_restringir_estado_todos_para_privilegiado_se_respeta() -> None:
    assert restringir_estado(EstadoFiltro.TODOS, solo_publicos=False) == EstadoFiltro.TODOS
