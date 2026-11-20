from typing import List
from sqlmodel import Session, select, func
from collections.abc import Set as AbstractSet
from datetime import date, datetime, time, timedelta, timezone
from app.modules.pagos.models import Pago
from app.core.pagination import PageParams
from app.core.repository import BaseRepository
from app.modules.pedidos.models import DetallePedido, EstadoPedido, HistorialEstadoPedido, Pedido
from app.modules.productos.models import Producto
from app.modules.pedidos.filtros import FiltrosPedidos
from app.modules.usuarios.models import Usuario

class PedidoRepository(BaseRepository[Pedido]):
    def __init__(self, session: Session):
        super().__init__(session, Pedido)

    def listar(
        self,
        filtros: FiltrosPedidos,
        params: PageParams,
        usuario_id: int | None = None,
        estados: AbstractSet[str] | None = None,
        ascendente: bool = False,
    ) -> tuple[list[tuple[Pedido, str]], int]:
        """Pedidos no eliminados con el nombre de su dueño (un solo JOIN, sin N+1): `([(pedido, nombre)], total)`.

        `usuario_id` limita el alcance al dueño; `estados` restringe en la consulta (cocina); `filtros` nunca amplía.
        El rango de fechas es inclusivo sobre `created_at` en UTC: `>= desde` y `< hasta + 1 día`.
        """
        statement = (
            select(Pedido, Usuario.nombre)
            .join(Usuario, Usuario.id == Pedido.usuario_id)
            .where(Pedido.deleted_at.is_(None))
        )
        if usuario_id is not None:
            statement = statement.where(Pedido.usuario_id == usuario_id)
        if estados is not None:
            statement = statement.where(Pedido.estado_codigo.in_(estados))
        if filtros.estado is not None:
            statement = statement.where(Pedido.estado_codigo == filtros.estado)
        if filtros.desde is not None:
            statement = statement.where(Pedido.created_at >= datetime.combine(filtros.desde, time.min, tzinfo=timezone.utc))
        if filtros.hasta is not None:
            statement = statement.where(
                Pedido.created_at < datetime.combine(filtros.hasta + timedelta(days=1), time.min, tzinfo=timezone.utc)
            )
        orden = (Pedido.created_at.asc(), Pedido.id.asc()) if ascendente else (Pedido.created_at.desc(), Pedido.id.desc())
        rows, total = self.paginar(statement.order_by(*orden), params)
        return [(pedido, nombre) for pedido, nombre in rows], total

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


# sirve para obtener el estado de un pedido y validar que existe
# tambien puede utilizarse para cambiar el estado de un pedido

class EstadoPedidoRepository(BaseRepository[EstadoPedido]):
    def __init__(self, session: Session):
        super().__init__(session, EstadoPedido)

    def get_by_codigo(self, codigo: str) -> EstadoPedido | None:
        statement = select(EstadoPedido).where(EstadoPedido.codigo == codigo)
        return self.session.exec(statement).first()



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

    def get_all_con_usuario_by_pedido_id(self, pedido_id: int) -> list[tuple[HistorialEstadoPedido, str | None]]:
        """Historial con el nombre de quien hizo cada cambio (`LEFT JOIN`, un solo query): `[(evento, nombre | None)]`."""
        statement = (
            select(HistorialEstadoPedido, Usuario.nombre)
            .join(Usuario, Usuario.id == HistorialEstadoPedido.usuario_id, isouter=True)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc(), HistorialEstadoPedido.id.asc())
        )
        return [(evento, nombre) for evento, nombre in self.session.exec(statement).all()]

    def update(self, data: HistorialEstadoPedido) -> HistorialEstadoPedido:
        raise HistorialInmutableError("El historial de estados es append-only: no se puede modificar")

    def delete(self, instance: HistorialEstadoPedido) -> None:
        raise HistorialInmutableError("El historial de estados es append-only: no se puede borrar")



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
