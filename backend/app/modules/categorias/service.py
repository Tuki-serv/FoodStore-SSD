from fastapi import HTTPException
from typing import cast, Optional
from sqlmodel import Session

from app.core.cloudinary.service import eliminar_imagen
from app.core.enums import EstadoFiltro
from app.core.service import base_service
from app.modules.categorias.models import Categoria
from app.modules.categorias.schemas import (
    CategoriaCreate, CategoriaUpdate, CategoriaRead,
    CategoriaReadFull, ProductoBasicRead, CategoriaTreeList, CategoriaTreeNode
)
from app.modules.categorias.unit_of_work import CategoriaUnitOfWork

class CategoriaService(base_service[Categoria, CategoriaCreate, CategoriaUpdate, CategoriaUnitOfWork]):
    def __init__(self, session: Session) -> None:
        super().__init__(
            session,
            CategoriaUnitOfWork(session),
            "categorias",
            Categoria
        )


    # ── Helpers Privados ─────────────────────────────────
    def _validar_nombre_unico(self, name: str, exclude_id: Optional[int] = None) -> None:
        existente = self.repo.get_by_name(name, include_deleted=True)
        if existente and existente.id != exclude_id:
            raise HTTPException(status_code=400, detail=f"El nombre '{name}' ya está en uso por otra categoría")


    def _validar_jerarquia_padre(self, categoria_id: int, parent_id: Optional[int]) -> None:
        current_parent_id = parent_id
        while current_parent_id is not None:
            if current_parent_id == categoria_id:
                raise HTTPException(status_code=400, detail="No se puede generar un ciclo en el árbol de categorías")
            parent = self._get_or_404(current_parent_id) 
            current_parent_id = parent.parent_id


    def _to_read_full(self, categoria: Categoria) -> CategoriaReadFull:
        productos = [
            ProductoBasicRead(id=cast(int, p.id), nombre=p.nombre)
            for p in categoria.productos if getattr(p, "deleted_at", None) is None
        ]
        return CategoriaReadFull(
            id=cast(int, categoria.id),
            parent_id=categoria.parent_id,
            nombre=categoria.nombre,
            descripcion=categoria.descripcion,
            imagen_url=categoria.imagen_url,
            imagen_public_id=categoria.imagen_public_id,
            productos=productos,
        )
    

    def _build_tree_node(self, categoria_id: int, children_by_parent: dict[int | None, list[Categoria]]) -> CategoriaTreeNode:
        categoria = next(
            child for child_list in children_by_parent.values() for child in child_list
            if child.id == categoria_id
        )
        subcategorias = [
            self._build_tree_node(cast(int, child.id), children_by_parent)
            for child in children_by_parent.get(categoria.id, [])
        ]
        return CategoriaTreeNode(
            id=cast(int, categoria.id),
            parent_id=categoria.parent_id,
            nombre=categoria.nombre,
            descripcion=categoria.descripcion,
            imagen_url=categoria.imagen_url,
            imagen_public_id=categoria.imagen_public_id,
            subcategorias=subcategorias,
        )
    

    # ── Overrides y Métodos Públicos ─────────────────────────────────────────

    # def get_all_categorias(self, offset: int = 0, limit: int = 20, is_main: Optional[bool] = None, parent_id: Optional[int] = None, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
    #     with self.uow:
    #         if parent_id is not None:
    #             self._get_or_404(parent_id, allow_deleted=True)
                
    #         items = self.repo.get_all_filtered(state=estado, is_main=is_main, parent_id=parent_id, offset=offset, limit=limit)
    #         total = self.repo.count_filtered(state=estado, is_main=is_main, parent_id=parent_id)
    #         return {"data": [self._to_read_full(i) for i in items], "total": total}

    def get_all_categorias(self, page: int = 1, size: int = 20, is_main: Optional[bool] = None, parent_id: Optional[int] = None, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
        with self.uow:
            if parent_id is not None:
                self._get_or_404(parent_id, allow_deleted=True)
                
            offset = (page - 1) * size
            limit = size

            items = self.repo.get_all_filtered(state=estado, is_main=is_main, parent_id=parent_id, offset=offset, limit=limit)
            total = self.repo.count_filtered(state=estado, is_main=is_main, parent_id=parent_id)
            
            pages = (total + size - 1) // size if total > 0 else 0
            
            return {
                "items": [self._to_read_full(i) for i in items],
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }


    def get_by_id_full(self, categoria_id: int, allow_deleted: bool = False) -> CategoriaReadFull:
        with self.uow:
            item = self._get_or_404(categoria_id, allow_deleted)
            return self._to_read_full(item)


    def get_tree(self) -> CategoriaTreeList:
        with self.uow:
            categorias = self.repo.get_all_ordered()
            children_by_parent: dict[int | None, list[Categoria]] = {}

            for categoria in categorias:
                children_by_parent.setdefault(categoria.parent_id, []).append(categoria)

            data = [
                self._build_tree_node(cast(int, root.id), children_by_parent)
                for root in children_by_parent.get(None, [])
            ]
            return CategoriaTreeList(data=data, total=len(data))


    def create(self, item_in: CategoriaCreate) -> CategoriaRead:
        with self.uow:
            self._validar_nombre_unico(item_in.nombre)
            if item_in.parent_id is not None:
                self._get_or_404(item_in.parent_id)

            nuevo_item = super().create(item_in)
            return CategoriaRead.model_validate(nuevo_item)


    def update(self, item_id: int, item_in: CategoriaUpdate) -> CategoriaReadFull:
        with self.uow:
            categoria_db = self._get_or_404(item_id)
            public_id_viejo = categoria_db.imagen_public_id
            patch = item_in.model_dump(exclude_unset=True)

            if "nombre" in patch and patch["nombre"] != categoria_db.nombre:
                self._validar_nombre_unico(patch["nombre"], exclude_id=item_id)

            if "parent_id" in patch:
                if patch["parent_id"] == item_id:
                    raise HTTPException(status_code=400, detail="Una categoría no puede ser padre de sí misma")
                if patch["parent_id"] is not None and patch["parent_id"] != categoria_db.parent_id:
                    self._get_or_404(patch["parent_id"])
                    self._validar_jerarquia_padre(item_id, patch["parent_id"])

            item_actualizado = self._apply_update_fields(categoria_db, item_in)
            self.repo.update(item_actualizado)
            read = self._to_read_full(item_actualizado)
            public_id_nuevo = item_actualizado.imagen_public_id

        # Limpieza de Cloudinary fuera de la transacción: si la imagen fue
        # reemplazada, la vieja queda huérfana y debe borrarse. Si la API
        # externa falla, la DB ya está commiteada y el registro queda
        # consistente (loggeo de error en cloudinary_service).
        if public_id_nuevo != public_id_viejo:
            eliminar_imagen(public_id_viejo)

        return read


    def delete(self, item_id: int):
        with self.uow:
            categoria = self._get_or_404(item_id)
            public_id_imagen = categoria.imagen_public_id

            hijas = self.repo.get_all_filtered(parent_id=item_id, limit=1000)
            for hija in hijas:
                hija.parent_id = categoria.parent_id
                self.repo.update(hija)

            self.repo.delete(categoria)
        # Soft delete ya commiteado; eliminamos la imagen en Cloudinary
        # aunque no se pueda deshacer el delete (la consigna lo pide así).
        eliminar_imagen(public_id_imagen)
        return {"mensaje": f"Categoría {item_id} eliminada correctamente"}
