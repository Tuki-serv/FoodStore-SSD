from fastapi import HTTPException
from typing import Optional
from sqlmodel import Session

from app.core.enums import EstadoFiltro
from app.core.service import base_service
from app.modules.unidades_medida.models import UnidadMedida
from app.modules.unidades_medida.schemas import UnidadMedidaCreate, UnidadMedidaUpdate, UnidadMedidaRead
from app.modules.unidades_medida.unit_of_work import UnidadMedidaUnitOfWork

class UnidadMedidaService(base_service[UnidadMedida, UnidadMedidaCreate, UnidadMedidaUpdate, UnidadMedidaUnitOfWork]):
    def __init__(self, session: Session) -> None:
        super().__init__(
            session, 
            UnidadMedidaUnitOfWork(session), 
            "unidades_medida", 
            UnidadMedida
        )
        

    # ── Reglas de Negocio ───────────────────────────────────────────────────
    def _validar_unicidad(self, nombre: Optional[str] = None, simbolo: Optional[str] = None, exclude_id: Optional[int] = None) -> None:
        if nombre:
            existente = self.repo.get_by_nombre(nombre, include_deleted=True)
            if existente and existente.id != exclude_id:
                raise HTTPException(status_code=400, detail=f"El nombre '{nombre}' ya está en uso por otra unidad de medida")
        
        if simbolo:
            existente = self.repo.get_by_simbolo(simbolo, include_deleted=True)
            if existente and existente.id != exclude_id:
                raise HTTPException(status_code=400, detail=f"El simbolo '{simbolo}' ya está en uso por otra unidad de medida")


    # ── Overrides del Service Genérico ──────────────────────────────────────
    
    # def get_all_unidades(self, offset: int = 0, limit: int = 20, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
    #     with self.uow:
    #         items = self.repo.get_all_by_state(state=estado, offset=offset, limit=limit)
    #         total = self.repo.count_model(state=estado)
    #         return {"data": items, "total": total}


    def get_all_unidades(self, page: int = 1, size: int = 20, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
        with self.uow:
            offset = (page - 1) * size
            limit = size

            items = self.repo.get_all_by_state(state=estado, offset=offset, limit=limit)
            total = self.repo.count_model(state=estado)
            
            pages = (total + size - 1) // size if total > 0 else 0
            
            return {
                "items": items,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }


    def create(self, item_in: UnidadMedidaCreate) -> UnidadMedidaRead:
        with self.uow:
            self._validar_unicidad(nombre=item_in.nombre, simbolo=item_in.simbolo)
            nuevo_item = super().create(item_in)
            return UnidadMedidaRead.model_validate(nuevo_item)


    def update(self, item_id: int, item_in: UnidadMedidaUpdate) -> UnidadMedidaRead:
        with self.uow:
            item_db = self._get_or_404(item_id)
            
            # Validamos unicidad, si enviaron un dato nuevo y distinto al actual
            if item_in.nombre and item_in.nombre != item_db.nombre:
                self._validar_unicidad(nombre=item_in.nombre, exclude_id=item_id)
            if item_in.simbolo and item_in.simbolo != item_db.simbolo:
                self._validar_unicidad(simbolo=item_in.simbolo, exclude_id=item_id)

            item_actualizado = self._apply_update_fields(item_db, item_in)
            self.repo.update(item_actualizado)
            
            return UnidadMedidaRead.model_validate(item_actualizado)
