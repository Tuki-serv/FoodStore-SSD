from sqlmodel import Session
from app.core.uow import UnitOfWork
from app.modules.usuarios.repository import UsuarioRepository, RolRepository
from app.modules.direcciones.repository import DireccionRepository
from app.modules.refreshtokens.repository import SesionRepository

class UsuarioUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        super().__init__(session)
        self.usuarios = UsuarioRepository(session)
        self.roles = RolRepository(session)
        self.direcciones = DireccionRepository(self._session)
        self.sesiones = SesionRepository(session)
