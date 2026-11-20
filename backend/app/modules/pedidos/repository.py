from typing import List
from sqlalchemy import Date, Row, and_, cast, text
from sqlmodel import Session, select, func
from collections.abc import Set as AbstractSet
from datetime import date, datetime, time, timedelta, timezone
from app.modules.pagos.models import FormaPago
from app.modules.pedidos.fsm import ESTADOS_ACTIVOS, ESTADOS_VENDIDOS
from app.core.pagination import PageParams
from app.core.repository import BaseRepository
from app.modules.pedidos.models import DetallePedido, EstadoPedido, HistorialEstadoPedido, Pedido
from app.modules.productos.models import Producto
from app.modules.pedidos.filtros import FiltrosPedidos
from app.modules.usuarios.models import Usuario

_UNIDADES_AGRUPACION = {"day": "day", "week": "week", "month": "month"}


def _fecha_utc():
    """Día UTC de creación del pedido, sin depender de la zona horaria de la sesión de la BD."""
    return cast(func.timezone("UTC", Pedido.created_at), Date)


def condiciones_vendido(desde: date, hasta: date) -> list:
    """Predicado único de «pedido vendido» (spec `sales-metrics`): estado vendido, no eliminado y creado en el rango UTC."""
    return [Pedido.estado_codigo.in_(ESTADOS_VENDIDOS), Pedido.deleted_at.is_(None), _fecha_utc().between(desde, hasta)]


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

    def ventas_por_periodo(self, desde: date, hasta: date, agrupacion: str) -> list[Row]:
        """Una fila `(fecha, total_ventas, cantidad_pedidos)` por cada período que toca el rango, con 0 donde no hay ventas.

        `agrupacion` es `day`, `week` (lunes ISO) o `month`; se toma de un mapa fijo, nunca del cliente tal cual.
        """
        unidad = _UNIDADES_AGRUPACION[agrupacion]
        consulta = text(
            f"""
            SELECT s.periodo::date AS fecha,
                   COALESCE(SUM(p.total), 0) AS total_ventas,
                   COUNT(p.id) AS cantidad_pedidos
            FROM generate_series(
                     date_trunc('{unidad}', CAST(:desde AS timestamp)),
                     date_trunc('{unidad}', CAST(:hasta AS timestamp)),
                     INTERVAL '1 {unidad}') AS s(periodo)
            LEFT JOIN pedidos p
                   ON date_trunc('{unidad}', p.created_at AT TIME ZONE 'UTC') = s.periodo
                  AND p.estado_codigo = ANY(:estados)
                  AND p.deleted_at IS NULL
                  AND CAST(p.created_at AT TIME ZONE 'UTC' AS date) BETWEEN :desde AND :hasta
            GROUP BY s.periodo
            ORDER BY s.periodo
            """
        )
        return list(self.session.execute(consulta, {"desde": desde, "hasta": hasta, "estados": sorted(ESTADOS_VENDIDOS)}))

    def resumen_ventas(self, desde: date, hasta: date) -> Row:
        """`(ventas, ingresos)` de los pedidos vendidos del rango (`ingresos` es 0 sin ventas)."""
        stmt = select(func.count(Pedido.id).label("ventas"), func.coalesce(func.sum(Pedido.total), 0).label("ingresos")).where(
            *condiciones_vendido(desde, hasta)
        )
        return self.session.exec(stmt).one()

    def contar_activos(self) -> int:
        """Pedidos que ahora están en curso (`CONFIRMADO`, `EN_PREP`, `EN_CAMINO`), sin importar la fecha."""
        stmt = select(func.count(Pedido.id)).where(Pedido.deleted_at.is_(None), Pedido.estado_codigo.in_(ESTADOS_ACTIVOS))
        return self.session.exec(stmt).one()

    def pedidos_por_estado(self, desde: date, hasta: date) -> list[Row]:
        """Una fila `(estado_codigo, cantidad)` por cada estado del catálogo, en el orden de la FSM, con 0 sin pedidos."""
        stmt = (
            select(EstadoPedido.codigo.label("estado_codigo"), func.count(Pedido.id).label("cantidad"))
            .select_from(EstadoPedido)
            .join(
                Pedido,
                and_(Pedido.estado_codigo == EstadoPedido.codigo, Pedido.deleted_at.is_(None), _fecha_utc().between(desde, hasta)),
                isouter=True,
            )
            .group_by(EstadoPedido.codigo, EstadoPedido.orden)
            .order_by(EstadoPedido.orden)
        )
        return list(self.session.exec(stmt).all())

    def ingresos_por_forma_pago(self, desde: date, hasta: date) -> list[Row]:
        """Una fila `(forma_pago_codigo, total, cantidad)` por cada forma de pago del catálogo, con 0 sin ventas."""
        total = func.coalesce(func.sum(Pedido.total), 0)
        stmt = (
            select(FormaPago.codigo.label("forma_pago_codigo"), total.label("total"), func.count(Pedido.id).label("cantidad"))
            .select_from(FormaPago)
            .join(
                Pedido,
                and_(Pedido.forma_pago_codigo == FormaPago.codigo, *condiciones_vendido(desde, hasta)),
                isouter=True,
            )
            .group_by(FormaPago.codigo)
            .order_by(total.desc(), FormaPago.codigo)
        )
        return list(self.session.exec(stmt).all())


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
    
    def productos_top(self, desde: date, hasta: date, limit: int) -> list[Row]:
        """Ranking de productos de las ventas del rango, agrupado por producto (no por nombre).

        Orden: cantidad vendida, luego ingresos (suma de subtotales de línea) y luego `producto_id`.
        """
        cantidad = func.sum(self.model.cantidad)
        ingresos = func.sum(self.model.subtotal_snapshot)
        stmt = (
            select(
                Producto.id.label("producto_id"),
                Producto.nombre,
                cantidad.label("cantidad_vendida"),
                ingresos.label("ingresos"),
            )
            .join(Producto, self.model.producto_id == Producto.id)
            .join(Pedido, self.model.pedido_id == Pedido.id)
            .where(*condiciones_vendido(desde, hasta))
            .group_by(Producto.id, Producto.nombre)
            .order_by(cantidad.desc(), ingresos.desc(), Producto.id)
            .limit(limit)
        )
        return list(self.session.exec(stmt).all())
