"""Composición del módulo `categorias`: arma el service para inyectarlo en el router (raíz de composición, D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.categorias.service import CategoriaService


def get_categoria_service(session: SessionDep) -> CategoriaService:
    return CategoriaService(session)


CategoriaServiceDep = Annotated[CategoriaService, Depends(get_categoria_service)]
