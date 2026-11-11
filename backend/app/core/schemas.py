from typing import Generic, TypeVar, List, Sequence
from pydantic import BaseModel

from app.core.pagination import PageParams

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def desde(cls, items: Sequence[T], total: int, params: PageParams) -> "PaginatedResponse[T]":
        """Único lugar que calcula `pages` (techo de total / size; 0 si no hay resultados)."""
        pages = (total + params.size - 1) // params.size if total > 0 else 0
        return cls(items=list(items), total=total, page=params.page, size=params.size, pages=pages)

    @classmethod
    def vacia(cls, params: PageParams) -> "PaginatedResponse[T]":
        """Página sin resultados (p. ej. un filtro que la visibilidad del lector deja vacío)."""
        return cls.desde([], 0, params)
