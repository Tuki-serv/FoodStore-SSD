from fastapi import HTTPException
from typing import cast, Optional
from sqlmodel import Session

from app.core.cloudinary.service import eliminar_imagen
from app.core.enums import EstadoFiltro
# IMPORTANTE: Acá importás tu base_service desde donde lo tengas
from app.core.service import base_service
from app.modules.ingredientes.models import Ingrediente
from app.modules.ingredientes.schemas import (
    IngredienteCreate,
    ProductoBasicRead,
    IngredienteRead,
    IngredienteReadFull,
    IngredienteUpdate,
)
from app.modules.ingredientes.unit_of_work import IngredienteUnitOfWork

class IngredienteService(base_service[Ingrediente, IngredienteCreate, IngredienteUpdate, IngredienteUnitOfWork]):
    def __init__(self, session: Session) -> None:
        super().__init__(
            session=session, 
            uow_instance=IngredienteUnitOfWork(session), 
            repo_name="ingredientes", 
            model_class=Ingrediente
        )

    # ── Reglas de Negocio Específicas ────────────────────────────────────────
    def _validar_nombre_unico(self, name: str, exclude_id: Optional[int] = None) -> None:
        existente = self.repo.get_by_name(name, include_deleted=True)
        if existente and existente.id != exclude_id:
            raise HTTPException(
                status_code=400,
                detail=f"El nombre '{name}' ya está en uso por otro ingrediente"
            )

    def _to_read_full(self, ingrediente: Ingrediente) -> IngredienteReadFull:
        productos = [
            ProductoBasicRead(id=cast(int, p.id), nombre=p.nombre)
            for p in ingrediente.productos if p.deleted_at is None
        ]
        return IngredienteReadFull(
            id=cast(int, ingrediente.id),
            nombre=ingrediente.nombre,
            es_alergeno=ingrediente.es_alergeno,
            descripcion=ingrediente.descripcion,
            imagen_url=ingrediente.imagen_url,
            imagen_public_id=ingrediente.imagen_public_id,
            productos=productos,
        )

    # ── Overrides del Service Genérico ───────────────────────────────────────
    
    # def get_all_ingredientes(self, offset: int = 0, limit: int = 20, is_alergeno: Optional[bool] = None, estado: EstadoFiltro = EstadoFiltro.ACTIVO ):
    #     with self.uow:
    #         items = self.repo.get_all_filtered(estado, is_alergeno, offset, limit)
    #         total = self.repo.count_filtered(estado, is_alergeno)
    #         return {"data": [self._to_read_full(i) for i in items], "total": total}

    def get_all_ingredientes(self, page: int = 1, size: int = 20, is_alergeno: Optional[bool] = None, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
        with self.uow:
            offset = (page - 1) * size
            limit = size

            items = self.repo.get_all_filtered(estado, is_alergeno, offset, limit)
            total = self.repo.count_filtered(estado, is_alergeno)
            
            pages = (total + size - 1) // size if total > 0 else 0
            
            return {
                "items": [self._to_read_full(i) for i in items],
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }


    def get_by_id_full(self, ingrediente_id: int, allow_deleted: bool = False) -> IngredienteReadFull:
        with self.uow:
            item = self._get_or_404(ingrediente_id, allow_deleted)
            return self._to_read_full(item)
        

    def create(self, item_in: IngredienteCreate) -> IngredienteRead:
        with self.uow:
            self._validar_nombre_unico(item_in.nombre)
            nuevo_item = super().create(item_in) 
            return IngredienteRead.model_validate(nuevo_item)
        

    def update(self, item_id: int, item_in: IngredienteUpdate) -> IngredienteRead:
        with self.uow:
            item_db = self._get_or_404(item_id)
            public_id_viejo = item_db.imagen_public_id

            if item_in.nombre and item_in.nombre != item_db.nombre:
                self._validar_nombre_unico(item_in.nombre, exclude_id=item_id)

            item_actualizado = self._apply_update_fields(item_db, item_in)
            self.repo.update(item_actualizado)
            read = IngredienteRead.model_validate(item_actualizado)
            public_id_nuevo = item_actualizado.imagen_public_id

        if public_id_nuevo != public_id_viejo:
            eliminar_imagen(public_id_viejo)

        return read


    def delete(self, item_id: int):
        with self.uow:
            item_db = self._get_or_404(item_id)
            public_id_imagen = item_db.imagen_public_id
            self.repo.delete(item_db)
        # Soft delete ya commiteado; eliminamos la imagen en Cloudinary.
        eliminar_imagen(public_id_imagen)
        return {"message": f"Ingrediente {item_id} eliminado/a correctamente"}
