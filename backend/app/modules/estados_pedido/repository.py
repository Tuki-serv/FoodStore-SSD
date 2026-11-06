from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.estados_pedido.models import EstadoPedido

# sirve para obtener el estado de un pedido y validar que existe
# tambien puede utilizarse para cambiar el estado de un pedido

class EstadoPedidoRepository(BaseRepository[EstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, EstadoPedido)

    def get_by_codigo(self, codigo: str) -> EstadoPedido | None:
        statement = select(EstadoPedido).where(EstadoPedido.codigo == codigo)
        return self.session.exec(statement).first()
