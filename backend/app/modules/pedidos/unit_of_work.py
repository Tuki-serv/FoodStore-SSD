from sqlmodel import Session
from app.core.uow import UnitOfWork
from app.modules.productos.repository import ProductoRepository
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.pedidos.repository import DetallePedidoRepository
from app.modules.pedidos.repository import EstadoPedidoRepository
from app.modules.pagos.repository import FormaPagoRepository
from app.modules.pedidos.repository import HistorialEstadoPedidoRepository
from app.modules.pedidos.repository import PedidoRepository

class PedidoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session):
        # Inicializa la session en el UnitOfWork base
        super().__init__(session)
        # Repositories que participan en crear/consultar pedidos
        self.pedidos = PedidoRepository(session)
        self.detalles = DetallePedidoRepository(session)
        self.historial = HistorialEstadoPedidoRepository(session)
        self.estados = EstadoPedidoRepository(session)
        self.formas_pago = FormaPagoRepository(session)
        self.productos = ProductoRepository(session)
        self.ingredientes = IngredienteRepository(session)
        self.usuarios = UsuarioRepository(session)
