from typing import Optional, Sequence
from sqlmodel import select, Session, func
from sqlalchemy.orm import selectinload
from app.modules.usuarios.models import Usuario, Rol, RefreshToken
from app.core.repository import BaseRepository
from app.core.enums import EstadoFiltro

class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def get_by_email(self, email: str, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> Optional[Usuario]:
        statement = select(Usuario).options(selectinload(Usuario.roles)).where(Usuario.email == email)
        statement = self._filter_state(statement, state)
        return self.session.exec(statement).first()
    
    def get_paged_users(self, offset: int = 0, limit: int = 20, rol_codigo: Optional[str] = None, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> Sequence[Usuario]:
        statement = select(Usuario).options(selectinload(Usuario.roles))
        statement = self._filter_state(statement, state)

        if rol_codigo:
            statement = statement.join(Usuario.roles).where(Rol.codigo == rol_codigo)

        statement = statement.order_by(Usuario.created_at.asc()).offset(offset).limit(limit)

        return self.session.exec(statement).all()

    def count_users(self, rol_codigo: Optional[str] = None, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> int:
        statement = select(func.count()).select_from(Usuario)
        statement = self._filter_state(statement, state)

        if rol_codigo:
            statement = statement.join(Usuario.roles).where(Rol.codigo == rol_codigo)

        return self.session.exec(statement).one()


class RolRepository(BaseRepository[Rol]):
    def __init__(self, session: Session):
        super().__init__(session, Rol)

    def get_by_codigo(self, codigo: str) -> Optional[Rol]:
        statement = select(Rol).where(Rol.codigo == codigo)
        return self.session.exec(statement).first()
        #return self.session.get(Rol, codigo)
        """Busca por el campo 'codigo', no por PK. Retorna None si está eliminado."""

class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, session: Session):
        super().__init__(session, RefreshToken)
        
    def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        statement = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return self.session.exec(statement).first()
