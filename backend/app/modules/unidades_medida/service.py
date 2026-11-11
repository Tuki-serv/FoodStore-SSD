from fastapi import HTTPException
from typing import Optional
from sqlmodel import Session

from app.core.enums import EstadoFiltro, restringir_estado
from app.core.pagination import PageParams
from app.core.schemas import PaginatedResponse
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
        

    # ── Overrides del Service Genérico ──────────────────────────────────────
    
    # def get_all_unidades(self, offset: int = 0, limit: int = 20, estado: EstadoFiltro = EstadoFiltro.ACTIVO):
    #     with self.uow:
    #         items = self.repo.get_all_by_state(state=estado, offset=offset, limit=limit)
    #         total = self.repo.count_model(state=estado)
    #         return {"data": items, "total": total}


    def get_all_unidades(
        self, params: PageParams, estado: EstadoFiltro = EstadoFiltro.ACTIVO, *, ver_eliminados: bool
    ):
        estado_efectivo = restringir_estado(estado, solo_publicos=not ver_eliminados)
        if estado_efectivo is None:
            return PaginatedResponse[UnidadMedidaRead].vacia(params)
        estado = estado_efectivo

        with self.uow:
            items = self.repo.get_all_by_state(state=estado, offset=params.offset, limit=params.size)
            total = self.repo.count_model(state=estado)

            return PaginatedResponse[UnidadMedidaRead].desde(items, total, params)


    def create(self, item_in: UnidadMedidaCreate) -> UnidadMedidaRead:
        with self.uow:
            self._validar_unicos(item_in.model_dump())
            nuevo_item = super().create(item_in)
            return UnidadMedidaRead.model_validate(nuevo_item)


    def update(self, item_id: int, item_in: UnidadMedidaUpdate) -> UnidadMedidaRead:
        with self.uow:
            item_db = self._get_or_404(item_id)
            
            self._validar_unicos(item_in.model_dump(exclude_unset=True), excluir_id=item_id)

            item_actualizado = self._apply_update_fields(item_db, item_in)
            self.repo.update(item_actualizado)
            
            return UnidadMedidaRead.model_validate(item_actualizado)
