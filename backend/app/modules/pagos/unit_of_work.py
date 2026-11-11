from app.core.unit_of_work import UnitOfWork
from app.modules.pagos.repository import PagoRepository
from app.modules.pedidos.repository import PedidoRepository

class PagoUnitOfWork(UnitOfWork):
    def __enter__(self):
        super().__enter__()
        self.pagos = PagoRepository(self._session)
        self.pedidos = PedidoRepository(self._session)
        return self
