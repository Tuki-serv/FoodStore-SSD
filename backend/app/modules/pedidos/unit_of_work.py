from sqlmodel import Session
from fastapi import Depends
from app.core.database import get_session
from app.core.unit_of_work import UnitOfWork
from app.modules.productos.repository import ProductoRepository
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.detalles_pedido.repository import DetallePedidoRepository
from app.modules.estados_pedido.repository import EstadoPedidoRepository
from app.modules.formas_pago.repository import FormaPagoRepository
from app.modules.historiales_estado_pedido.repository import HistorialEstadoPedidoRepository
from app.modules.pedidos.repository import PedidoRepository

class PedidoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session = Depends(get_session)):
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
