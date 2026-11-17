"""Composición del módulo `ingredientes`: arma el service para inyectarlo en el router (raíz de composición, D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.ingredientes.service import IngredienteService


def get_ingrediente_service(session: SessionDep) -> IngredienteService:
    return IngredienteService(session)


IngredienteServiceDep = Annotated[IngredienteService, Depends(get_ingrediente_service)]
