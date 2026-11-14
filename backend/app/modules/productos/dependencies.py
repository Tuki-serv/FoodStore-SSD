"""Composición del módulo `productos`: arma el service para inyectarlo en el router (raíz de composición, D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.productos.service import ProductoService


def get_producto_service(session: SessionDep) -> ProductoService:
    return ProductoService(session)


ProductoServiceDep = Annotated[ProductoService, Depends(get_producto_service)]
