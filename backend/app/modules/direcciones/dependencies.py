"""Composición del módulo `direcciones`: arma `DireccionService` para inyectarlo (D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.direcciones.service import DireccionService


def get_direccion_service(session: SessionDep) -> DireccionService:
    return DireccionService(session=session)


DireccionServiceDep = Annotated[DireccionService, Depends(get_direccion_service)]
