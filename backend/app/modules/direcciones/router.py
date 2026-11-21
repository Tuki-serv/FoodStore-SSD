from typing import Annotated, Any
from fastapi import APIRouter, Depends, status

from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.modules.auth.dependencies import get_current_active_user
from app.modules.usuarios.schemas import UserPublic
from app.modules.direcciones.schemas import DireccionCreate, DireccionRead, DireccionUpdate
from app.modules.direcciones.dependencies import DireccionServiceDep
from app.core.api_responses import respuestas_error

router = APIRouter(prefix="/direcciones", tags=["Direcciones de Entrega"])

# ==========================================
# DEPENDENCIAS
# ==========================================
CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]

# ==========================================
# ENDPOINTS (Exclusivos del usuario logueado)
# ==========================================

@router.post("/", summary="Crear una dirección de entrega", responses=respuestas_error(401), response_model=DireccionRead, status_code=status.HTTP_201_CREATED)
def crear_direccion(data: DireccionCreate, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.crear_direccion_propia(usuario_id=current_user.id, item_in=data)

@router.get("/", summary="Listar mis direcciones de entrega", responses=respuestas_error(401), response_model=PaginatedResponse[DireccionRead])
def listar_direcciones(current_user: CurrentUser, svc: DireccionServiceDep, params: PageQuery) -> Any:
    return svc.listar_mis_direcciones(usuario_id=current_user.id, params=params)

@router.get("/{direccion_id}", summary="Obtener una dirección de entrega", responses=respuestas_error(401, 403, 404), response_model=DireccionRead)
def get_direccion(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.obtener_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id)

@router.patch("/{direccion_id}", summary="Actualizar una dirección de entrega", responses=respuestas_error(401, 403, 404), response_model=DireccionRead)
def actualizar_direccion(direccion_id: int, data: DireccionUpdate, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.actualizar_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id, item_in=data)

@router.patch("/{direccion_id}/principal", summary="Marcar una dirección como principal", responses=respuestas_error(401, 403, 404, 409), response_model=DireccionRead)
def marcar_como_principal(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.marcar_como_principal(direccion_id=direccion_id, usuario_id=current_user.id)

@router.delete("/{direccion_id}", summary="Eliminar una dirección de entrega", responses=respuestas_error(401, 403, 404), status_code=status.HTTP_204_NO_CONTENT)
def eliminar_direccion(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> None:
    svc.eliminar_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id)
    return None
