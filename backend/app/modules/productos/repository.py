from decimal import Decimal
from typing import Any, Optional, cast
from sqlalchemy import exists
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload, joinedload

from app.core.repository import BaseRepository
from app.core.enums import EstadoFiltro
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente

# ══════════════════════════════════════════════════════
# REPOSITORIO PRINCIPAL: PRODUCTO
# ══════════════════════════════════════════════════════
class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Producto)

    def get_by_name(self, name: str, include_deleted: bool = False) -> Producto | None:
        query = select(Producto).options(
            selectinload(Producto.links_categorias).joinedload(ProductoCategoria.categoria),
            selectinload(Producto.links_ingredientes).joinedload(ProductoIngrediente.ingrediente)
        ).where(Producto.nombre == name)

        if not include_deleted:
            query = query.where(Producto.deleted_at.is_(None))
        return self.session.exec(query).first()


    def _aplicar_filtros(
        self,
        statement: Any,
        *,
        state: EstadoFiltro,
        disponible: Optional[bool] = None,
        categoria_ids: Optional[list[int]] = None,
        ingrediente_ids: Optional[list[int]] = None,
        q: Optional[str] = None,
        precio_min: Optional[Decimal] = None,
        precio_max: Optional[Decimal] = None,
        con_stock: Optional[bool] = None,
    ) -> Any:
        """Agrega todos los filtros del catálogo a un `select` (listado y conteo comparten este único punto).

        Categorías e ingredientes usan `EXISTS` (no `JOIN`) para que un producto que coincide con
        varios ids aparezca y se cuente una sola vez.
        """
        statement = self._filter_state(statement, state)

        if disponible is not None:
            statement = statement.where(Producto.disponible == disponible)
        if q:
            statement = statement.where(Producto.nombre.ilike(f"%{q}%"))
        if precio_min is not None:
            statement = statement.where(Producto.precio_base >= precio_min)
        if precio_max is not None:
            statement = statement.where(Producto.precio_base <= precio_max)
        if con_stock:
            statement = statement.where(Producto.stock_cantidad > 0)
        if categoria_ids:
            statement = statement.where(
                exists().where(
                    ProductoCategoria.producto_id == Producto.id,
                    cast(Any, ProductoCategoria.categoria_id).in_(categoria_ids),
                )
            )
        if ingrediente_ids:
            statement = statement.where(
                exists().where(
                    ProductoIngrediente.producto_id == Producto.id,
                    cast(Any, ProductoIngrediente.ingrediente_id).in_(ingrediente_ids),
                )
            )
        return statement


    def get_all_filtered(
        self,
        state: EstadoFiltro = EstadoFiltro.ACTIVO,
        disponible: Optional[bool] = None,
        categoria_ids: Optional[list[int]] = None,
        ingrediente_ids: Optional[list[int]] = None,
        q: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
        precio_min: Optional[Decimal] = None,
        precio_max: Optional[Decimal] = None,
        con_stock: Optional[bool] = None,
    ) -> list[Producto]:
        statement = select(Producto).options(
            selectinload(Producto.links_categorias).joinedload(ProductoCategoria.categoria),
            selectinload(Producto.links_ingredientes).joinedload(ProductoIngrediente.ingrediente)
        )
        statement = self._aplicar_filtros(
            statement, state=state, disponible=disponible, categoria_ids=categoria_ids,
            ingrediente_ids=ingrediente_ids, q=q, precio_min=precio_min, precio_max=precio_max, con_stock=con_stock,
        )
        statement = statement.order_by(Producto.id.asc())
        return list(self.session.exec(statement.offset(offset).limit(limit)).all())


    def count_filtered(
        self,
        state: EstadoFiltro = EstadoFiltro.ACTIVO,
        disponible: Optional[bool] = None,
        categoria_ids: Optional[list[int]] = None,
        ingrediente_ids: Optional[list[int]] = None,
        q: Optional[str] = None,
        precio_min: Optional[Decimal] = None,
        precio_max: Optional[Decimal] = None,
        con_stock: Optional[bool] = None,
    ) -> int:
        statement = self._aplicar_filtros(
            select(func.count()).select_from(Producto), state=state, disponible=disponible,
            categoria_ids=categoria_ids, ingrediente_ids=ingrediente_ids, q=q,
            precio_min=precio_min, precio_max=precio_max, con_stock=con_stock,
        )
        return self.session.exec(statement).one()


# ══════════════════════════════════════════════════════
# REPOSITORIOS INTERMEDIOS (Heredan de BaseRepository)
# ══════════════════════════════════════════════════════
class ProductoCategoriaRepository(BaseRepository[ProductoCategoria]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, ProductoCategoria)


    def get(self, producto_id: int, categoria_id: int) -> ProductoCategoria | None:
        return self.session.exec(select(ProductoCategoria).where(ProductoCategoria.producto_id == producto_id).where(ProductoCategoria.categoria_id == categoria_id)).first()


    def list_by_producto(self, producto_id: int) -> list[ProductoCategoria]:
        return list(
            self.session.exec(select(ProductoCategoria).where(ProductoCategoria.producto_id == producto_id).order_by(cast(Any, ProductoCategoria.categoria_id))).all())


    def list_by_categoria(self, categoria_id: int) -> list[ProductoCategoria]:
        return list(self.session.exec(select(ProductoCategoria).where(ProductoCategoria.categoria_id == categoria_id).order_by(cast(Any, ProductoCategoria.producto_id))).all())


    def clear_principal_for_producto(self, producto_id: int, keep_categoria_id: int | None = None) -> None:
        relaciones = self.list_by_producto(producto_id)
        for relacion in relaciones:
            if keep_categoria_id is not None and relacion.categoria_id == keep_categoria_id:
                continue
            if relacion.es_principal:
                relacion.es_principal = False
                self.update(relacion) 


class ProductoIngredienteRepository(BaseRepository[ProductoIngrediente]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, ProductoIngrediente)


    def get(self, producto_id: int, ingrediente_id: int) -> ProductoIngrediente | None:
        return self.session.exec(select(ProductoIngrediente).where(ProductoIngrediente.producto_id == producto_id).where(ProductoIngrediente.ingrediente_id == ingrediente_id)).first()


    def list_by_producto(self, producto_id: int) -> list[ProductoIngrediente]:
        return list(self.session.exec(select(ProductoIngrediente).where(ProductoIngrediente.producto_id == producto_id).order_by(cast(Any, ProductoIngrediente.ingrediente_id)).all()))


    def list_by_ingrediente(self, ingrediente_id: int) -> list[ProductoIngrediente]:
        return list(self.session.exec(select(ProductoIngrediente).where(ProductoIngrediente.ingrediente_id == ingrediente_id).order_by(cast(Any, ProductoIngrediente.producto_id))).all())
