from sqlmodel import Session,select
from typing import List

from app.core.repository import BaseRepository
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido


class HistorialInmutableError(Exception):
    """El historial de estados es append-only: no se modifica ni se borra (spec order-lifecycle)."""


class HistorialEstadoPedidoRepository(BaseRepository[HistorialEstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, HistorialEstadoPedido)

    def get_all_by_pedido_id(self, pedido_id: int) -> List[HistorialEstadoPedido]:
        statement = (
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc(), HistorialEstadoPedido.id.asc())
        )
        return self.session.exec(statement).all()

    def update(self, data: HistorialEstadoPedido) -> HistorialEstadoPedido:
        raise HistorialInmutableError("El historial de estados es append-only: no se puede modificar")

    def delete(self, instance: HistorialEstadoPedido) -> None:
        raise HistorialInmutableError("El historial de estados es append-only: no se puede borrar")
