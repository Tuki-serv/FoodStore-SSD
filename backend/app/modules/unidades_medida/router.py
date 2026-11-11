from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status
from sqlmodel import Session

from app.core.deps import lector_privilegiado, require_role
from app.core.database import get_session
from app.core.enums import EstadoFiltro
from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.modules.unidades_medida.schemas import (
    UnidadMedidaCreate,
    UnidadMedidaRead,
    UnidadMedidaUpdate
)
from app.modules.unidades_medida.service import UnidadMedidaService

router = APIRouter()

# Lectura pública: los eliminados solo los ve ADMIN (el rol se declara acá).
VeEliminados = Annotated[bool, Depends(lector_privilegiado(["ADMIN"]))]

def get_unidad_medida_service(session: Session = Depends(get_session)) -> UnidadMedidaService:
    return UnidadMedidaService(session)

# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/", response_model=UnidadMedidaRead, status_code=status.HTTP_201_CREATED, summary="Crear unidad de medida", dependencies=[Depends(require_role(["ADMIN"]))])
def create_unidad_medida(data: UnidadMedidaCreate, svc: UnidadMedidaService = Depends(get_unidad_medida_service)):
    return svc.create(data)

@router.get("/", response_model=PaginatedResponse[UnidadMedidaRead], summary="Listar unidades de medida")
def list_unidades_medida(
    ver_eliminados: VeEliminados,
    params: PageQuery,
    estado: Annotated[EstadoFiltro, Query(description="Filtrar por estado")] = EstadoFiltro.ACTIVO,
    svc: UnidadMedidaService = Depends(get_unidad_medida_service)
):
    return svc.get_all_unidades(params=params, estado=estado, ver_eliminados=ver_eliminados)

@router.get("/{unidad_id}", response_model=UnidadMedidaRead, summary="Obtener unidad de medida")
def get_unidad_medida(
    unidad_id: Annotated[int, Path(ge=1)],
    ver_eliminados: VeEliminados,
    incluir_eliminado: Annotated[bool, Query(description="Permitir ver el registro aunque esté eliminado")] = False,
    svc: UnidadMedidaService = Depends(get_unidad_medida_service)
):
    return svc.get_by_id(unidad_id, allow_deleted=incluir_eliminado, ver_eliminados=ver_eliminados)

@router.patch("/{unidad_id}", response_model=UnidadMedidaRead, summary="Actualizar unidad de medida", dependencies=[Depends(require_role(["ADMIN"]))])
def update_unidad_medida(
    unidad_id: Annotated[int, Path(ge=1)], 
    data: UnidadMedidaUpdate, 
    svc: UnidadMedidaService = Depends(get_unidad_medida_service)
):
    return svc.update(unidad_id, data)

@router.delete("/{unidad_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar unidad de medida", dependencies=[Depends(require_role(["ADMIN"]))])
def delete_unidad_medida(
    unidad_id: Annotated[int, Path(ge=1)], 
    svc: UnidadMedidaService = Depends(get_unidad_medida_service)
):
    svc.delete(unidad_id)
    return None
