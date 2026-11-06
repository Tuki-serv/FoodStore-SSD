from sqlmodel import Session
from app.core.unit_of_work import UnitOfWork
from app.modules.productos.repository import ProductoRepository
from app.modules.categorias.repository import CategoriaRepository
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.productos.repository import ProductoCategoriaRepository, ProductoIngredienteRepository
from app.modules.unidades_medida.repository import UnidadMedidaRepository

class ProductoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.productos = ProductoRepository(self._session)
        self.categorias = CategoriaRepository(self._session)
        self.ingredientes = IngredienteRepository(self._session)
        self.producto_categorias = ProductoCategoriaRepository(self._session)
        self.producto_ingredientes = ProductoIngredienteRepository(self._session)
        self.unidad_medida = UnidadMedidaRepository(self._session)
