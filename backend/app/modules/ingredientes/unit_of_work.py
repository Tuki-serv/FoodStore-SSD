from app.core.uow import UnitOfWork
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.productos.repository import ProductoRepository
from app.modules.unidades_medida.repository import UnidadMedidaRepository
from sqlmodel import Session

class IngredienteUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.ingredientes = IngredienteRepository(self._session)
        self.productos = ProductoRepository(self._session)
        self.unidades_medida = UnidadMedidaRepository(self._session)
