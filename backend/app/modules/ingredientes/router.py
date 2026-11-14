from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Path, Query, status

from app.modules.auth.dependencies import lector_privilegiado, require_role
from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.modules.ingredientes.schemas import (
    IngredienteCreate,
    IngredienteRead,
    IngredienteReadFull,
    IngredienteUpdate
)
from app.modules.ingredientes.dependencies import IngredienteServiceDep
from app.core.enums import EstadoFiltro

router = APIRouter()

# Lectura pública: los eliminados solo los ve ADMIN (el rol se declara acá).
VeEliminados = Annotated[bool, Depends(lector_privilegiado(["ADMIN"]))]


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/", response_model=IngredienteRead, status_code=status.HTTP_201_CREATED, summary="Crear ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def create_ingrediente(data: IngredienteCreate, svc: IngredienteServiceDep):
    return svc.create(data)


@router.get("/", response_model=PaginatedResponse[IngredienteReadFull], summary="Listar ingredientes (paginado y filtrado)")
def list_ingredientes(
    ver_eliminados: VeEliminados,
    params: PageQuery,
    estado: Annotated[EstadoFiltro, Query(description="Filtrar por estado (activo/eliminado)")] = EstadoFiltro.ACTIVO,
    is_alergeno: Annotated[Optional[bool], Query(description="Filtrar por alérgeno (true/false)")] = None,
    *, svc: IngredienteServiceDep
):
    # ¡Unificamos dos endpoints en uno solo!
    return svc.get_all_ingredientes(
        params=params, is_alergeno=is_alergeno, estado=estado, ver_eliminados=ver_eliminados
    )


@router.get("/{ingrediente_id}", response_model=IngredienteReadFull, summary="Obtener ingrediente")
def get_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)],
    ver_eliminados: VeEliminados,
    incluir_eliminado: Annotated[bool, Query(description="Permitir ver el registro aunque esté eliminado")] = False,
    *, svc: IngredienteServiceDep
):
    return svc.get_by_id_full(ingrediente_id, allow_deleted=incluir_eliminado, ver_eliminados=ver_eliminados)


@router.patch("/{ingrediente_id}", response_model=IngredienteRead, summary="Actualizar ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def update_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)], 
    data: IngredienteUpdate, 
    svc: IngredienteServiceDep
):
    return svc.update(ingrediente_id, data)


@router.delete("/{ingrediente_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar ingrediente", dependencies=[Depends(require_role(["ADMIN"]))])
def delete_ingrediente(
    ingrediente_id: Annotated[int, Path(ge=1)], 
    svc: IngredienteServiceDep
):
    svc.delete(ingrediente_id)
    return None
