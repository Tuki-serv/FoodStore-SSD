from sqlmodel import Session

from app.core.uow import UnitOfWork
from app.modules.refreshtokens.repository import RefreshTokenRepository, SesionRepository
from app.modules.usuarios.repository import UsuarioRepository


class AuthUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.usuarios = UsuarioRepository(session)
        self.sesiones = SesionRepository(session)
        self.refresh_tokens = RefreshTokenRepository(session)
