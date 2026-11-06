from sqlmodel import Session, select, func
from datetime import date
from app.modules.pagos.models import Pago
from app.core.repository import BaseRepository
from app.modules.pedidos.models import Pedido

class PedidoRepository(BaseRepository[Pedido]):
    def __init__(self, session: Session):
        super().__init__(session, Pedido)

    def get_all_by_usuario_id(self, usuario_id: int, offset: int = 0, limit: int = 20) -> list[Pedido]:
        statement = select(Pedido).where(Pedido.usuario_id == usuario_id).where(Pedido.deleted_at == None).order_by(Pedido.created_at.desc())
        return list(self.session.exec(statement.offset(offset).limit(limit)).all())
        
    def count_by_usuario_id(self, usuario_id: int) -> int:
        statement = select(func.count()).select_from(Pedido).where(Pedido.usuario_id == usuario_id).where(Pedido.deleted_at == None)
        return self.session.exec(statement).one()
    
    def get_all_active(self, offset: int = 0, limit: int = 20) -> list[Pedido]:
        statement = select(Pedido).where(Pedido.deleted_at == None).order_by(Pedido.created_at.desc())
        return list(self.session.exec(statement.offset(offset).limit(limit)).all())
        
    def count_all_active(self) -> int:
        statement = select(func.count()).select_from(Pedido).where(Pedido.deleted_at == None)
        return self.session.exec(statement).one()
    
    def get_ventas_periodo(self, desde: date, hasta: date, agrupacion: str = 'day'):
        from app.core.config import settings
        
        # AGREGADO PARA TESTS: Workaround para SQLite en memoria
        # Se usa durante la ejecución de los tests porque SQLite no soporta ARRAY nativo.
        if settings.ENVIRONMENT == "test":
            # Parche para tests (SQLite)
            if agrupacion == 'month':
                col_fecha = func.strftime('%Y-%m-01', self.model.created_at).label("fecha")
            else:
                col_fecha = func.date(self.model.created_at).label("fecha")
        else:
            col_fecha = func.date_trunc(agrupacion, self.model.created_at).label("fecha")
            
        stmt = select(
            col_fecha,
            func.sum(self.model.total).label("total_ventas"),
            func.count(self.model.id).label("cantidad_pedidos")
        ).join(
            Pago, self.model.id == Pago.pedido_id
        ).where(
            self.model.estado_codigo != "CANCELADO",
            Pago.mp_status == "approved",
            func.date(self.model.created_at) >= desde,
            func.date(self.model.created_at) <= hasta
        ).group_by(
            col_fecha
        ).order_by(
            col_fecha
        )
        
        return self.session.exec(stmt).all()

    
    def get_pedidos_por_estado(self, desde: date, hasta: date):
        stmt = select(
            self.model.estado_codigo,
            func.count(self.model.id).label("cantidad")
        ).where(
            self.model.estado_codigo != "CANCELADO",
            func.date(self.model.created_at) >= desde,
            func.date(self.model.created_at) <= hasta
        ).group_by(
            self.model.estado_codigo
        )
        return self.session.exec(stmt).all()
    
    
    def get_ingresos_por_forma_pago(self, desde: date, hasta: date):
        stmt = select(
            self.model.forma_pago_codigo,
            func.sum(self.model.total).label("total"),
            func.count(self.model.id).label("cantidad")
        ).join(
            Pago, self.model.id == Pago.pedido_id
        ).where(
            self.model.estado_codigo != "CANCELADO",
            Pago.mp_status == "approved",
            func.date(self.model.created_at) >= desde,
            func.date(self.model.created_at) <= hasta
        ).group_by(
            self.model.forma_pago_codigo
        ).order_by(
            func.sum(self.model.total).desc()
        )
        return self.session.exec(stmt).all()
