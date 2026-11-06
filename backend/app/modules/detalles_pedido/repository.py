from sqlmodel import Session, select, func
from datetime import date
from app.core.repository import BaseRepository
from app.modules.detalles_pedido.models import DetallePedido
from app.modules.productos.models import Producto
from app.modules.pedidos.models import Pedido
from app.modules.pagos.models import Pago

class DetallePedidoRepository(BaseRepository[DetallePedido]):
    def __init__(self, session: Session):
        super().__init__(session, DetallePedido)

    def get_all_by_pedido_id(self, pedido_id: int) -> list[DetallePedido]:
        statement = select(DetallePedido).where(DetallePedido.pedido_id == pedido_id).order_by(DetallePedido.created_at.asc())
        return list(self.session.exec(statement).all())
    
    def get_productos_top(self,desde: date, hasta: date, limit: int = 5):
        stmt = select(
            Producto.nombre,
            func.sum(self.model.subtotal_snapshot).label("ingresos"),
            func.sum(self.model.cantidad).label("cantidad_vendida")
        ).join(
            Producto, self.model.producto_id == Producto.id
        ).join(
            Pedido, self.model.pedido_id == Pedido.id
        ).join(
            Pago, Pedido.id == Pago.pedido_id
        ).where(
            Pedido.estado_codigo != "CANCELADO",
            Pago.mp_status == "approved",
            func.date(Pedido.created_at) >= desde,
            func.date(Pedido.created_at) <= hasta
        ).group_by(
            Producto.nombre
        ).order_by(
            func.sum(self.model.subtotal_snapshot).desc()
        ).limit(limit)
        
        return self.session.exec(stmt).all()
