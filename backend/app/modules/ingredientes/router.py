from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Path, Query, status
from sqlmodel import Session

from app.core.deps import require_role
from app.core.database import get_session
from app.core.schemas import PaginatedResponse
from app.modules.ingredientes.schemas import (
    IngredienteCreate,
    IngredienteRead,
    IngredienteReadFull,
    IngredienteUpdate
)
from app.modules.ingredientes.service import IngredienteService
from app.core.enums import EstadoFiltro

router = APIRouter()

def get_ingrediente_service(session: Session = Depends(get_session)) -> IngredienteService:
    return IngredienteService(session)

# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/", response_model=IngredienteRead, status_code=status.HTTP_201_CREATED, summary="Crear ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def create_ingrediente(data: IngredienteCreate, svc: IngredienteService = Depends(get_ingrediente_service)):
    return svc.create(data)


@router.get("/", response_model=PaginatedResponse[IngredienteReadFull], summary="Listar ingredientes (paginado y filtrado)")
def list_ingredientes(
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Cantidad de items por página")] = 20,
    estado: Annotated[EstadoFiltro, Query(description="Filtrar por estado (activo/eliminado)")] = EstadoFiltro.ACTIVO,
    is_alergeno: Annotated[Optional[bool], Query(description="Filtrar por alérgeno (true/false)")] = None,
    svc: IngredienteService = Depends(get_ingrediente_service)
):
    # ¡Unificamos dos endpoints en uno solo!
    return svc.get_all_ingredientes(page=page, size=size, is_alergeno=is_alergeno, estado=estado)


@router.get("/{ingrediente_id}", response_model=IngredienteReadFull, summary="Obtener ingrediente")
def get_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)],
    incluir_eliminado: Annotated[bool, Query(description="Permitir ver el registro aunque esté eliminado")] = False,
    svc: IngredienteService = Depends(get_ingrediente_service)
):
    return svc.get_by_id_full(ingrediente_id, allow_deleted=incluir_eliminado)


@router.patch("/{ingrediente_id}", response_model=IngredienteRead, summary="Actualizar ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def update_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)], 
    data: IngredienteUpdate, 
    svc: IngredienteService = Depends(get_ingrediente_service)
):
    return svc.update(ingrediente_id, data)


@router.delete("/{ingrediente_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def delete_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)], 
    svc: IngredienteService = Depends(get_ingrediente_service)
):
    svc.delete(ingrediente_id)
    return None
