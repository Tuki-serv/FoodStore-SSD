from typing import Optional, List
from sqlmodel import Session, select
from app.core.repository import BaseRepository
from app.modules.pagos.models import Pago

class PagoRepository(BaseRepository[Pago]):
    """Repositorio de pagos con métodos de búsqueda específicos de MP."""

    def __init__(self, session: Session):
        super().__init__(session, Pago)

    def get_by_pedido(self, pedido_id: int) -> List[Pago]:
        return list(
            self.session.exec(
                select(Pago)
                .where(Pago.pedido_id == pedido_id)
                .order_by(Pago.created_at.desc())
            ).all()
        )

    def get_ultimo_by_pedido(self, pedido_id: int) -> Optional[Pago]:
        pagos = self.get_by_pedido(pedido_id)
        return pagos[0] if pagos else None

    def get_by_idempotency_key(self, key: str) -> Optional[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.idempotency_key == key)
        ).first()

    def get_by_mp_payment_id(self, mp_payment_id: int) -> Optional[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.mp_payment_id == mp_payment_id)
        ).first()

    def get_by_mp_merchant_order_id(self, merchant_order_id: int) -> Optional[Pago]:
        return self.session.exec(
            select(Pago).where(Pago.mp_merchant_order_id == merchant_order_id)
        ).first()
