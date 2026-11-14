"""Composición del módulo `pedidos`: arma `PedidoService` (con su unidad de trabajo) para inyectarlo (D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.pedidos.service import PedidoService, construir_pedido_service


def get_pedido_service(session: SessionDep) -> PedidoService:
    return construir_pedido_service(session)


PedidoServiceDep = Annotated[PedidoService, Depends(get_pedido_service)]
