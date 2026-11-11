from typing import Optional, Sequence
from sqlmodel import select, Session
from sqlalchemy.orm import selectinload
from app.core.pagination import PageParams
from app.core.repository import BaseRepository
from app.core.enums import EstadoFiltro
from app.modules.direcciones_entrega.models import DireccionEntrega

class DireccionRepository(BaseRepository[DireccionEntrega]):
    def __init__(self, session: Session):
        super().__init__(session, DireccionEntrega)

    def get_by_usuario(self, usuario_id: int, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> Sequence[DireccionEntrega]:
        statement = select(DireccionEntrega).options(selectinload(DireccionEntrega.usuario)).where(DireccionEntrega.usuario_id == usuario_id)
        
        statement = self._filter_state(statement, state)
        
        return self.session.exec(statement).all()

    def listar_por_usuario(self, usuario_id: int, params: PageParams) -> tuple[list[DireccionEntrega], int]:
        """Direcciones activas del usuario, la principal primero y luego por `id` ascendente: `(página, total)`."""
        statement = (
            select(DireccionEntrega)
            .where(DireccionEntrega.usuario_id == usuario_id, DireccionEntrega.deleted_at.is_(None))
            .order_by(DireccionEntrega.es_principal.desc(), DireccionEntrega.id.asc())
        )
        return self.paginar(statement, params)

    def get_principal_by_usuario(self, usuario_id: int) -> Optional[DireccionEntrega]:
        statement = select(DireccionEntrega).options(selectinload(DireccionEntrega.usuario)).where(
            DireccionEntrega.usuario_id == usuario_id,
            DireccionEntrega.es_principal,
            DireccionEntrega.deleted_at.is_(None)
        )
        return self.session.exec(statement).first()
