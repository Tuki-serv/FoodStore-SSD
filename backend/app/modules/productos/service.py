from fastapi import HTTPException
from typing import Optional, cast
from pydantic import BaseModel
from sqlmodel import Session

from app.core.cloudinary.service import eliminar_imagen, eliminar_multiples_imagenes
from app.core.enums import EstadoFiltro, restringir_estado
from app.core.pagination import PageParams
from app.core.schemas import PaginatedResponse
from app.core.service import base_service
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.productos.schemas import (
    CategoriaBasicRead,
    ProductoCreate,
    ProductoDisponibilidadUpdate,
    ProductoReadFull,
    ProductoStockUpdate,
    ProductoUpdate,
    ProductoIngredienteCreate,
    ProductoIngredienteRead
)
from app.modules.productos.unit_of_work import ProductoUnitOfWork


class ProductoService(base_service[Producto, ProductoCreate, ProductoUpdate, ProductoUnitOfWork]):
    def __init__(self, session: Session) -> None:
        super().__init__(
            session=session,
            uow_instance=ProductoUnitOfWork(session),
            repo_name="productos",
            model_class=Producto
        )

    # ── Helpers privados ─────────────────────────────────────────────────────

    def _limpiar_imagenes_cloudinary(self, public_ids_viejos: list[str], public_ids_nuevos: list[str]) -> None:
        set_viejo = {pid for pid in public_ids_viejos if pid}
        set_nuevo = {pid for pid in public_ids_nuevos if pid}
        imagenes_a_borrar = set_viejo - set_nuevo
        for pid in imagenes_a_borrar:
            eliminar_imagen(pid)

    @staticmethod
    def _ingredientes_de(producto: Producto) -> list[ProductoIngredienteRead]:
        """Ingredientes no eliminados del producto (links precargados), con su configuración en la receta."""
        return [
            ProductoIngredienteRead(
                id=cast(int, link.ingrediente.id),
                nombre=link.ingrediente.nombre,
                es_alergeno=link.ingrediente.es_alergeno,
                es_removible=link.es_removible,
                cantidad=link.cantidad,
                unidad_medida_id=link.unidad_medida_id,
            )
            for link in producto.links_ingredientes
            if getattr(link.ingrediente, "deleted_at", None) is None
        ]

    def _obtener_producto_visible(
        self, producto_id: int, allow_deleted: bool = False, *, ver_no_disponibles: bool, ver_eliminados: bool
    ) -> Producto:
        """Producto que el lector puede ver (misma regla de visibilidad para el detalle y sus ingredientes): si no, 404."""
        producto = self._get_or_404(producto_id, allow_deleted and ver_eliminados)
        if not ver_no_disponibles and not producto.disponible:
            raise HTTPException(status_code=404, detail=f"{self.model.__name__} no encontrado/a")
        return producto

    def _to_read_full(self, producto: Producto) -> ProductoReadFull:
        from typing import cast

        # ─────────── 1. Categorías — iterás los links precargados ──────────────────────────────────
        categorias = [
            CategoriaBasicRead(
                id=cast(int, link.categoria.id),
                nombre=link.categoria.nombre,
                es_principal=link.es_principal,
            )
            for link in producto.links_categorias
            if getattr(link.categoria, "deleted_at", None) is None
        ]

        # ─────────── 2. Ingredientes — iterás los links precargados ──────────────────────────────────
        ingredientes = self._ingredientes_de(producto)

        # ─────────── 3. Armado de la respuesta final ──────────────────────────────────
        """
        Se hace uso del schema ya que se deben mapear las relaciones,
        y esta logica no tiene porque ir en el router
        """
        return ProductoReadFull(
            id=cast(int, producto.id),
            nombre=producto.nombre,
            descripcion=producto.descripcion,
            precio_base=producto.precio_base,
            imagenes_url=producto.imagenes_url,
            imagenes_public_id=producto.imagenes_public_id,
            stock_cantidad=producto.stock_cantidad,
            disponible=producto.disponible,
            categorias=categorias,
            ingredientes=ingredientes,
        )

    # ── Overrides y Métodos públicos ─────────────────────────────────────────

    # def get_all_productos(
    #     self,
    #     offset: int = 0,
    #     limit: int = 20,
    #     estado: EstadoFiltro = EstadoFiltro.ACTIVO,
    #     disponible: Optional[bool] = None,
    #     categoria_ids: Optional[list[int]] = None,
    #     ingrediente_ids: Optional[list[int]] = None,
    #     q: Optional[str] = None
    # ):
    #     with self.uow:
    #         productos = self.repo.get_all_filtered(
    #             state=estado, disponible=disponible,
    #             categoria_ids=categoria_ids, ingrediente_ids=ingrediente_ids,
    #             q=q, offset=offset, limit=limit
    #         )
    #         total = self.repo.count_filtered(
    #             state=estado, disponible=disponible,
    #             categoria_ids=categoria_ids, ingrediente_ids=ingrediente_ids, q=q
    #         )
    #         return {"data": [self._to_read_full(p) for p in productos], "total": total}

    def get_all_productos(
        self,
        params: PageParams,
        estado: EstadoFiltro = EstadoFiltro.ACTIVO,
        disponible: Optional[bool] = None,
        categoria_ids: Optional[list[int]] = None,
        ingrediente_ids: Optional[list[int]] = None,
        q: Optional[str] = None,
        *,
        ver_no_disponibles: bool,
        ver_eliminados: bool,
    ):
        # Visibilidad: el público solo ve disponibles y no eliminados; los filtros intersectan, nunca amplían.
        estado_efectivo = restringir_estado(estado, solo_publicos=not ver_eliminados)
        if estado_efectivo is None or (not ver_no_disponibles and disponible is False):
            return PaginatedResponse[ProductoReadFull].vacia(params)
        estado = estado_efectivo
        if not ver_no_disponibles:
            disponible = True

        with self.uow:
            # 1. Consultas al repositorio con todos los filtros intactos
            productos = self.repo.get_all_filtered(
                state=estado, disponible=disponible,
                categoria_ids=categoria_ids, ingrediente_ids=ingrediente_ids,
                q=q, offset=params.offset, limit=params.size
            )
            total = self.repo.count_filtered(
                state=estado, disponible=disponible,
                categoria_ids=categoria_ids, ingrediente_ids=ingrediente_ids, q=q
            )

            # 2. Formato exacto de PaginatedResponse
            return PaginatedResponse[ProductoReadFull].desde([self._to_read_full(p) for p in productos], total, params)

    def get_by_id_full(
        self,
        producto_id: int,
        allow_deleted: bool = False,
        *,
        ver_no_disponibles: bool,
        ver_eliminados: bool,
    ) -> ProductoReadFull:
        with self.uow:
            producto = self._obtener_producto_visible(
                producto_id, allow_deleted, ver_no_disponibles=ver_no_disponibles, ver_eliminados=ver_eliminados
            )
            return self._to_read_full(producto)

    def listar_ingredientes(
        self, producto_id: int, *, ver_no_disponibles: bool, ver_eliminados: bool
    ) -> list[ProductoIngredienteRead]:
        """Ingredientes no eliminados del producto, ordenados por nombre; respeta la visibilidad del producto."""
        with self.uow:
            producto = self._obtener_producto_visible(
                producto_id, ver_no_disponibles=ver_no_disponibles, ver_eliminados=ver_eliminados
            )
            return sorted(self._ingredientes_de(producto), key=lambda i: i.nombre)

    def quitar_ingrediente(self, producto_id: int, ingrediente_id: int) -> None:
        """Borra la asociación producto-ingrediente (producto activo, 404 si no existe); no toca producto ni ingrediente."""
        with self.uow as uow:
            producto = self._get_or_404(producto_id)
            relacion = uow.producto_ingredientes.get(producto.id, ingrediente_id)
            if relacion is None:
                raise HTTPException(status_code=404, detail="El producto no tiene asociado ese ingrediente")
            uow.producto_ingredientes.delete(relacion)

    def create(self, data: ProductoCreate) -> ProductoReadFull:
        with self.uow:
            self._validar_unicos(data.model_dump(include=set(Producto._unique_fields)))

            data_dict = data.model_dump(
                exclude={"categoria_ids", "ingredientes"})
            nuevo_producto = Producto(**data_dict)
            self.repo.add(nuevo_producto)

            for i, cat_id in enumerate(data.categoria_ids):
                cat = self.uow.categorias.get_by_id(cat_id)
                if not cat or getattr(cat, "deleted_at", None) is not None:
                    raise HTTPException(
                        status_code=404, detail=f"Categoría con ID {cat_id} no encontrada o eliminada")

                link = ProductoCategoria(
                    producto_id=cast(int, nuevo_producto.id),
                    categoria_id=cat_id,
                    es_principal=(i == 0)
                )
                self.uow.producto_categorias.add(link)

            if data.ingredientes:
                for ing_input in data.ingredientes:
                    ing = self.uow.ingredientes.get_by_id(
                        ing_input.ingrediente_id)
                    if not ing or getattr(ing, "deleted_at", None) is not None:
                        raise HTTPException(
                            status_code=404, detail=f"Ingrediente con ID {ing_input.ingrediente_id} no encontrado o eliminado")

                    link_ing = ProductoIngrediente(
                        producto_id=cast(int, nuevo_producto.id),
                        ingrediente_id=ing_input.ingrediente_id,
                        es_removible=ing_input.es_removible
                    )
                    self.uow.producto_ingredientes.add(link_ing)

            return self._to_read_full(nuevo_producto)

    def update(self, producto_id: int, data: ProductoUpdate) -> ProductoReadFull:
        with self.uow:
            producto = self._get_or_404(producto_id)
            # Capturamos los public_ids viejos ANTES del patch para poder
            # detectar cuáles imágenes fueron removidas del set nuevo.
            public_ids_viejos = list(producto.imagenes_public_id or [])
            patch = data.model_dump(exclude_unset=True, exclude={
                                    "categoria_ids", "ingredientes"})

            if "unidad_venta_id" in patch and patch["unidad_venta_id"] is not None:
                unidad = self.uow.unidad_medida.get_by_id(
                    patch["unidad_venta_id"])
                if not unidad:
                    raise HTTPException(
                        status_code=404, detail=f"Unidad de medida con ID {patch['unidad_venta_id']} no encontrada")

            self._validar_unicos(patch, excluir_id=producto_id)

            for key, value in patch.items():
                setattr(producto, key, value)
            if hasattr(producto, "updated_at"):
                from datetime import datetime, timezone
                producto.updated_at = datetime.now(timezone.utc)

            self.repo.update(producto)

            if data.categoria_ids is not None:
                viejas_cats = self.uow.producto_categorias.list_by_producto(
                    producto_id)
                for vc in viejas_cats:
                    self.uow.producto_categorias.delete(vc)

                for i, cat_id in enumerate(data.categoria_ids):
                    cat = self.uow.categorias.get_by_id(cat_id)
                    if not cat or getattr(cat, "deleted_at", None) is not None:
                        raise HTTPException(
                            status_code=404, detail=f"Categoría con ID {cat_id} no encontrada")

                    link = ProductoCategoria(
                        producto_id=producto_id, categoria_id=cat_id, es_principal=(i == 0))
                    self.uow.producto_categorias.add(link)

            if data.ingredientes is not None:
                viejos_ings = self.uow.producto_ingredientes.list_by_producto(
                    producto_id)
                for vi in viejos_ings:
                    self.uow.producto_ingredientes.delete(vi)

                for ing_input in data.ingredientes:
                    ing = self.uow.ingredientes.get_by_id(
                        ing_input.ingrediente_id)
                    if not ing or getattr(ing, "deleted_at", None) is not None:
                        raise HTTPException(
                            status_code=404, detail=f"Ingrediente con ID {ing_input.ingrediente_id} no encontrado")

                    link_ing = ProductoIngrediente(
                        producto_id=producto_id,
                        ingrediente_id=ing_input.ingrediente_id,
                        es_removible=ing_input.es_removible
                    )
                    self.uow.producto_ingredientes.add(link_ing)

            read = self._to_read_full(producto)
            public_ids_nuevos = list(producto.imagenes_public_id or [])

        # Limpieza de Cloudinary fuera de la transacción. Si la lista de
        # public_ids cambió (se removieron imágenes, o se reemplazaron
        # todas), los public_ids viejos que ya no estén en el set nuevo
        # quedan huérfanos y se eliminan.
        # Reemplazá todo ese bloque viejo por estas 2 líneas:
        if "imagenes_public_id" in patch:
            self._limpiar_imagenes_cloudinary(public_ids_viejos, public_ids_nuevos)

        return read


    def actualizar_imagenes(self, producto_id: int, imagenes_url: list[str], imagenes_public_id: list[str]) -> ProductoReadFull:
        with self.uow:
            producto = self._get_or_404(producto_id)
            public_ids_viejos = list(producto.imagenes_public_id or [])

            producto.imagenes_url = imagenes_url
            producto.imagenes_public_id = imagenes_public_id

            if hasattr(producto, "updated_at"):
                from datetime import datetime, timezone
                producto.updated_at = datetime.now(timezone.utc)

            self.repo.update(producto)
            read = self._to_read_full(producto)

        # Limpiamos Cloudinary fuera del Unit of Work
        self._limpiar_imagenes_cloudinary(
            public_ids_viejos, imagenes_public_id)
        return read

    def delete(self, producto_id: int):
        with self.uow:
            producto = self._get_or_404(producto_id)
            public_ids_imagenes = list(producto.imagenes_public_id or [])
            self.repo.delete(producto)
        # Soft delete ya commiteado; eliminamos todas las imágenes del
        # producto en Cloudinary.
        eliminar_multiples_imagenes(public_ids_imagenes)
        return {"mensaje": f"Producto {producto_id} eliminado/a correctamente"}

    # NOTA DE MERGE: Este método fue conservado tras integrar la rama de "Tuki-Lucas"
    # porque permite asociar ingredientes con su cantidad EXACTA y unidad de medida.

    def asociar_ingrediente(self, producto_id: int, data: ProductoIngredienteCreate) -> ProductoIngredienteRead:
        """Asocia (o actualiza) un ingrediente en un producto con su cantidad exacta."""
        with self.uow as uow:
            producto = self._get_or_404(producto_id)

            ingrediente = uow.ingredientes.get_by_id(data.ingrediente_id)
            if not ingrediente or getattr(ingrediente, "deleted_at", None) is not None:
                raise HTTPException(
                    status_code=404, detail="Ingrediente no encontrado")

            unidad = uow.unidad_medida.get_by_id(data.unidad_medida_id)
            if not unidad or getattr(unidad, "deleted_at", None) is not None:
                raise HTTPException(
                    status_code=404, detail="Unidad de medida no encontrada")

            # Buscamos si ya existe la relación (para no duplicar la PK compuesta)
            relacion = uow.producto_ingredientes.get(
                producto.id, data.ingrediente_id)

            if relacion:
                # Si la relacion ya existia, la actualizamos
                relacion.cantidad = data.cantidad
                relacion.unidad_medida_id = data.unidad_medida_id
                relacion.es_removible = data.es_removible
                uow.producto_ingredientes.update(relacion)
            else:
                # Si no existe, creamos la relacion
                nueva_relacion = ProductoIngrediente(
                    producto_id=producto.id,
                    ingrediente_id=data.ingrediente_id,
                    cantidad=data.cantidad,
                    unidad_medida_id=data.unidad_medida_id,
                    es_removible=data.es_removible
                )
                uow.producto_ingredientes.add(nueva_relacion)

            return ProductoIngredienteRead(
                id=cast(int, ingrediente.id),
                nombre=ingrediente.nombre,
                es_alergeno=ingrediente.es_alergeno,
                es_removible=data.es_removible,
                cantidad=data.cantidad,
                unidad_medida_id=data.unidad_medida_id
            )

    def _aplicar_cambio_parcial(
        self, producto_id: int, cambio: BaseModel, *, bloquear: bool = False
    ) -> ProductoReadFull:
        """Aplica un cambio parcial a un producto no eliminado (404 si no existe o está eliminado).

        Con `bloquear` la fila se lee `FOR UPDATE`, serializando el cambio con otras escrituras de stock.
        """
        with self.uow:
            producto = self._get_or_404(producto_id) if not bloquear else self._get_bloqueado_or_404(producto_id)
            self._apply_update_fields(producto, cambio)
            self.repo.update(producto)
            return self._to_read_full(producto)

    def _get_bloqueado_or_404(self, producto_id: int) -> Producto:
        producto = self.repo.get_for_update(producto_id)
        if producto is None or producto.deleted_at is not None:
            raise HTTPException(status_code=404, detail=f"{self.model.__name__} no encontrado/a")
        return producto

    def fijar_disponibilidad(self, producto_id: int, disponible: bool) -> ProductoReadFull:
        """Fija `disponible` (idempotente; no toca el stock: RN-PR-02)."""
        return self._aplicar_cambio_parcial(producto_id, ProductoDisponibilidadUpdate(disponible=disponible))

    def fijar_stock(self, producto_id: int, stock_cantidad: int) -> ProductoReadFull:
        """Setea `stock_cantidad` en forma absoluta (idempotente; no toca `disponible`)."""
        return self._aplicar_cambio_parcial(
            producto_id, ProductoStockUpdate(stock_cantidad=stock_cantidad), bloquear=True
        )
