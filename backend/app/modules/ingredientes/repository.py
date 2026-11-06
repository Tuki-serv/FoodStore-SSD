from sqlmodel import Session, select, func
from typing import Optional
from sqlalchemy.orm import selectinload
from app.core.repository import BaseRepository
from app.core.enums import EstadoFiltro
from app.modules.ingredientes.models import Ingrediente

class IngredienteRepository(BaseRepository[Ingrediente]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Ingrediente)

    def get_by_name(self, name: str, include_deleted: bool = False) -> Optional[Ingrediente]:
        query = select(Ingrediente).where(Ingrediente.nombre == name)
        if not include_deleted:
            query = query.where(Ingrediente.deleted_at.is_(None))
        return self.session.exec(query).first()

    # Unificamos las búsquedas usando el generico + filtro específico
    def get_all_filtered(
        self, 
        state: EstadoFiltro = EstadoFiltro.ACTIVO, 
        is_alergeno: Optional[bool] = None, 
        offset: int = 0, 
        limit: int = 20
    ) -> list[Ingrediente]:
        statement = select(Ingrediente).options(selectinload(Ingrediente.unidad_medida),selectinload(Ingrediente.productos))
        statement = self._filter_state(statement, state)
        
        if is_alergeno is not None:
            statement = statement.where(Ingrediente.es_alergeno == is_alergeno)
            
        statement = statement.order_by(Ingrediente.id.asc())
        return list(self.session.exec(statement.offset(offset).limit(limit)).all())

    def count_filtered(self, state: EstadoFiltro = EstadoFiltro.ACTIVO, is_alergeno: Optional[bool] = None) -> int:
        statement = select(func.count()).select_from(Ingrediente)
        statement = self._filter_state(statement, state)
        
        if is_alergeno is not None:
            statement = statement.where(Ingrediente.es_alergeno == is_alergeno)
            
        return self.session.exec(statement).one()
