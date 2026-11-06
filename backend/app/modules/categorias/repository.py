from sqlmodel import Session, select, func
from typing import Optional
from sqlalchemy.orm import selectinload
from app.core.repository import BaseRepository
from app.core.enums import EstadoFiltro
from app.modules.categorias.models import Categoria

class CategoriaRepository(BaseRepository[Categoria]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Categoria)


    def get_by_name(self, name: str, include_deleted: bool = False) -> Optional[Categoria]:
        query = select(Categoria).options(selectinload(Categoria.children)).where(Categoria.nombre == name)
        if not include_deleted:
            query = query.where(Categoria.deleted_at.is_(None))
        return self.session.exec(query).first()


    def get_all_filtered(
        self,
        state: EstadoFiltro = EstadoFiltro.ACTIVO,
        is_main: Optional[bool] = None,
        parent_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20
    ) -> list[Categoria]:
        statement = select(Categoria).options(selectinload(Categoria.children))
        statement = self._filter_state(statement, state)

        if is_main is True:
            statement = statement.where(Categoria.parent_id.is_(None))

        if parent_id is not None:
            statement = statement.where(Categoria.parent_id == parent_id)

        statement = statement.order_by(Categoria.id.asc()) 
        return list(self.session.exec(statement.offset(offset).limit(limit)).all())

    def count_filtered(
        self,
        state: EstadoFiltro = EstadoFiltro.ACTIVO,
        is_main: Optional[bool] = None,
        parent_id: Optional[int] = None
    ) -> int:
        statement = select(func.count()).select_from(Categoria)
        statement = self._filter_state(statement, state)

        if is_main is True:
            statement = statement.where(Categoria.parent_id.is_(None))

        if parent_id is not None:
            statement = statement.where(Categoria.parent_id == parent_id)

        return self.session.exec(statement).one()


    def get_all_ordered(self) -> list[Categoria]:
        # Método construcción del árbol en memoria
        statement = select(Categoria).options(selectinload(Categoria.children)).where(Categoria.deleted_at.is_(None)).order_by(Categoria.nombre.asc())
        return list(self.session.exec(statement).all())
