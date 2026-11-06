from sqlmodel import Session,select
from typing import List

from app.core.repository import BaseRepository
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido

class HistorialEstadoPedidoRepository(BaseRepository[HistorialEstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, HistorialEstadoPedido)

    def get_all_by_pedido_id(self, pedido_id: int) -> List[HistorialEstadoPedido]:
        statement = select(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == pedido_id).order_by(HistorialEstadoPedido.created_at.asc())
        return self.session.exec(statement).all()
