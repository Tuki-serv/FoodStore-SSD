from sqlmodel import Session
from app.core.unit_of_work import UnitOfWork
from app.core.database import SessionDep
from app.modules.usuarios.repository import UsuarioRepository, RolRepository, RefreshTokenRepository
from app.modules.direcciones_entrega.repository import DireccionRepository

class UsuarioUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        super().__init__(session)
        self.usuarios = UsuarioRepository(session)
        self.roles = RolRepository(session)
        self.direcciones = DireccionRepository(self._session)
        self.refresh_tokens = RefreshTokenRepository(self._session)

def get_uow(session: SessionDep) -> UsuarioUnitOfWork:
    return UsuarioUnitOfWork(session)
