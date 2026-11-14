from sqlmodel import Session
from app.core.uow import UnitOfWork
from app.modules.categorias.repository import CategoriaRepository
from app.modules.productos.repository import ProductoRepository

class CategoriaUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.categorias = CategoriaRepository(self._session)
        self.productos = ProductoRepository(self._session)
