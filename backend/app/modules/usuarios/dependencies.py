"""Composición del módulo `usuarios`: arma `UsuarioUnitOfWork` y `UsuarioService` para inyectarlos (D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.usuarios.service import UsuarioService
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork


def get_uow(session: SessionDep) -> UsuarioUnitOfWork:
    return UsuarioUnitOfWork(session)


def get_usuario_service(uow: Annotated[UsuarioUnitOfWork, Depends(get_uow)]) -> UsuarioService:
    return UsuarioService(uow)


UsuarioServiceDep = Annotated[UsuarioService, Depends(get_usuario_service)]
