from typing import Annotated, Any
from fastapi import APIRouter, Depends, status

from app.core.deps import get_current_active_user, get_uow
from app.modules.usuarios.schemas import UserPublic
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork
from app.modules.direcciones_entrega.schemas import DireccionCreate, DireccionRead, DireccionUpdate
from app.modules.direcciones_entrega.service import DireccionService

router = APIRouter(prefix="/direcciones", tags=["Direcciones de Entrega"])

# ==========================================
# DEPENDENCIAS
# ==========================================
def get_direccion_service(uow: Annotated[UsuarioUnitOfWork, Depends(get_uow)]) -> DireccionService:
    return DireccionService(session=uow._session)

DireccionServiceDep = Annotated[DireccionService, Depends(get_direccion_service)]
CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]

# ==========================================
# ENDPOINTS (Exclusivos del usuario logueado)
# ==========================================

@router.post("/", response_model=DireccionRead, status_code=status.HTTP_201_CREATED)
def crear_direccion(data: DireccionCreate, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.crear_direccion_propia(usuario_id=current_user.id, item_in=data)

@router.get("/", response_model=list[DireccionRead])
def listar_direcciones(current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.listar_mis_direcciones(usuario_id=current_user.id)

@router.get("/{direccion_id}", response_model=DireccionRead)
def get_direccion(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.obtener_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id)

@router.patch("/{direccion_id}", response_model=DireccionRead)
def actualizar_direccion(direccion_id: int, data: DireccionUpdate, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.actualizar_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id, item_in=data)

@router.patch("/{direccion_id}/principal", response_model=DireccionRead)
def marcar_como_principal(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> Any:
    return svc.marcar_como_principal(direccion_id=direccion_id, usuario_id=current_user.id)

@router.delete("/{direccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_direccion(direccion_id: int, current_user: CurrentUser, svc: DireccionServiceDep) -> None:
    svc.eliminar_direccion_propia(direccion_id=direccion_id, usuario_id=current_user.id)
    return None
