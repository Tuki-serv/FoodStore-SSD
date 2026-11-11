"""Servicio único de stock (spec `order-stock`, C-10): verifica, descuenta y devuelve stock por producto.

Agnóstico de pedidos: trabaja con `LineaStock` (producto + cantidad). Agrupa las líneas del mismo producto y bloquea
las filas (`SELECT ... FOR UPDATE`) siempre en orden ascendente de `producto_id`, así dos transacciones no se
bloquean mutuamente aunque pidan los productos en distinto orden. El bloqueo dura hasta el commit del UoW que llama.
"""
from collections import defaultdict
from dataclasses import dataclass

from app.modules.productos.models import Producto
from app.modules.productos.repository import ProductoRepository


@dataclass(frozen=True)
class LineaStock:
    """Una línea a verificar/descontar/devolver: solo producto y cantidad."""

    producto_id: int
    cantidad: int


class StockInsuficiente(Exception):
    """El stock actual de un producto no alcanza para la cantidad pedida (o el producto ya fue eliminado)."""

    def __init__(self, producto_nombre: str) -> None:
        super().__init__(f"No hay stock suficiente para {producto_nombre}")
        self.producto_nombre = producto_nombre


class ProductoNoDisponible(Exception):
    """El producto está marcado como no disponible (o no existe / fue eliminado)."""

    def __init__(self, producto_nombre: str) -> None:
        super().__init__(f"Producto no disponible: {producto_nombre}")
        self.producto_nombre = producto_nombre


def _esta_activo(producto: Producto | None) -> bool:
    return producto is not None and getattr(producto, "deleted_at", None) is None


class StockService:
    def __init__(self, productos: ProductoRepository) -> None:
        self._productos = productos

    def verificar(self, lineas: list[LineaStock]) -> None:
        """Valida disponibilidad y stock (sumando líneas del mismo producto) sin bloquear ni escribir."""
        for producto_id, cantidad in self._agrupar(lineas):
            producto = self._productos.get_by_id(producto_id)
            if producto is None or not _esta_activo(producto) or not producto.disponible:
                raise ProductoNoDisponible(producto.nombre if producto else f"#{producto_id}")
            if producto.stock_cantidad < cantidad:
                raise StockInsuficiente(producto.nombre)

    def alcanza(self, lineas: list[LineaStock]) -> Producto | None:
        """Bloquea las filas y devuelve el primer producto cuyo stock no alcanza, o `None` si todo alcanza."""
        _, faltante = self._bloquear(lineas, exigir_activos=True)
        return faltante

    def descontar(self, lineas: list[LineaStock]) -> None:
        """Resta todas las líneas o ninguna: lanza `StockInsuficiente` antes de escribir si alguna no alcanza."""
        bloqueados, faltante = self._bloquear(lineas, exigir_activos=True)
        if faltante is not None:
            raise StockInsuficiente(faltante.nombre)
        self._aplicar(bloqueados, signo=-1)

    def devolver(self, lineas: list[LineaStock]) -> None:
        """Suma cada línea al stock; los productos eliminados se saltean (no vuelven al catálogo)."""
        bloqueados, _ = self._bloquear(lineas, exigir_activos=False)
        self._aplicar(bloqueados, signo=1)

    @staticmethod
    def _agrupar(lineas: list[LineaStock]) -> list[tuple[int, int]]:
        """Suma las cantidades por producto y ordena por `producto_id` (orden de bloqueo uniforme)."""
        totales: dict[int, int] = defaultdict(int)
        for linea in lineas:
            totales[linea.producto_id] += linea.cantidad
        return sorted(totales.items())

    def _bloquear(
        self, lineas: list[LineaStock], *, exigir_activos: bool
    ) -> tuple[list[tuple[Producto, int]], Producto | None]:
        """Bloquea en orden; devuelve los (producto activo, cantidad) y el primero que no alcanza.

        Con `exigir_activos` un producto eliminado cuenta como faltante; sin él se saltea.
        """
        bloqueados: list[tuple[Producto, int]] = []
        faltante: Producto | None = None
        for producto_id, cantidad in self._agrupar(lineas):
            producto = self._productos.get_for_update(producto_id)
            if producto is None:
                continue
            if not _esta_activo(producto):
                if exigir_activos and faltante is None:
                    faltante = producto
                continue
            bloqueados.append((producto, cantidad))
            if faltante is None and producto.stock_cantidad < cantidad:
                faltante = producto
        return bloqueados, faltante

    def _aplicar(self, bloqueados: list[tuple[Producto, int]], *, signo: int) -> None:
        for producto, cantidad in bloqueados:
            producto.stock_cantidad += signo * cantidad
            self._productos.update(producto)
        self._productos.flush()
