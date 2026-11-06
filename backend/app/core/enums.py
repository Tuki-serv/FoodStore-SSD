from enum import Enum

class EstadoFiltro(str, Enum):
    ACTIVO = "ACTIVO"
    ELIMINADO = "ELIMINADO"
    TODOS = "TODOS"
