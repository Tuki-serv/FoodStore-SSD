"""Paginación genérica: única definición de los parámetros `page`/`size` y de su cálculo de `offset`."""
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query

MAX_SIZE = 100
DEFAULT_SIZE = 20


@dataclass(frozen=True)
class PageParams:
    """Parámetros de página ya validados (sin dependencias de FastAPI)."""

    page: int = 1
    size: int = DEFAULT_SIZE

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=MAX_SIZE)] = DEFAULT_SIZE,
) -> PageParams:
    return PageParams(page=page, size=size)


PageQuery = Annotated[PageParams, Depends(page_params)]
