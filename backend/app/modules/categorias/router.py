from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Path, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import require_role
from app.core.enums import EstadoFiltro
from app.core.schemas import PaginatedResponse
from app.modules.categorias.schemas import (
    CategoriaCreate, CategoriaRead, 
    CategoriaReadFull, CategoriaTreeList, CategoriaUpdate
)
from app.modules.categorias.service import CategoriaService

router = APIRouter(tags=["Categorías"])

def get_categoria_service(session: Session = Depends(get_session)) -> CategoriaService:
    return CategoriaService(session)

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(["ADMIN"]))])
def create_categoria(data: CategoriaCreate, svc: CategoriaService = Depends(get_categoria_service)):
    return svc.create(data)


@router.get("/", response_model=PaginatedResponse[CategoriaReadFull], summary="Listar y filtrar categorías")
def list_categorias(
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Cantidad de items por página")] = 20,
    is_principal: Annotated[Optional[bool], Query(description="Traer solo principales (sin padre)")] = None,
    parent_id: Annotated[Optional[int], Query(description="Traer subcategorías de un padre")] = None,
    estado: Annotated[EstadoFiltro, Query(description="Filtrar por estado")] = EstadoFiltro.ACTIVO,
    svc: CategoriaService = Depends(get_categoria_service)
):
    # Reemplace 4 endpoints en 1 solo llamado dinámico, Tuki aguanten los query params
    return svc.get_all_categorias(page=page, size=size, is_main=is_principal, parent_id=parent_id, estado=estado)


@router.get("/arbol", response_model=CategoriaTreeList, summary="Obtener árbol completo")
def get_tree(svc: CategoriaService = Depends(get_categoria_service)):
    return svc.get_tree()


@router.get("/{categoria_id}", response_model=CategoriaReadFull, summary="Obtener categoría por ID")
def get_categoria(
    categoria_id: Annotated[int, Path(ge=1)],
    incluir_eliminado: Annotated[bool, Query(description="Permitir ver el registro aunque esté eliminado")] = False,
    svc: CategoriaService = Depends(get_categoria_service)
):
    return svc.get_by_id_full(categoria_id, allow_deleted=incluir_eliminado)


@router.patch("/{categoria_id}", response_model=CategoriaReadFull, dependencies=[Depends(require_role(["ADMIN"]))])
def update_categoria(
    categoria_id: Annotated[int, Path(ge=1)], 
    data: CategoriaUpdate, 
    svc: CategoriaService = Depends(get_categoria_service)
):
    return svc.update(categoria_id, data)


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN"]))])
def delete_categoria(
    categoria_id: Annotated[int, Path(ge=1)], 
    svc: CategoriaService = Depends(get_categoria_service)
):
    svc.delete(categoria_id)
    return None
