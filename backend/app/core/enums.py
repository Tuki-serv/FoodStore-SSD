from enum import Enum

class EstadoFiltro(str, Enum):
    ACTIVO = "ACTIVO"
    ELIMINADO = "ELIMINADO"
    TODOS = "TODOS"


def restringir_estado(estado: EstadoFiltro, solo_publicos: bool) -> EstadoFiltro | None:
    """Intersecta el filtro `estado` pedido con lo que puede ver el lector.

    Un lector público nunca ve eliminados: `TODOS` se reduce a `ACTIVO` y `ELIMINADO` devuelve `None`
    (resultado vacío, nunca un error). Un lector privilegiado ve el filtro tal cual.
    """
    if not solo_publicos:
        return estado
    if estado == EstadoFiltro.ELIMINADO:
        return None
    return EstadoFiltro.ACTIVO
