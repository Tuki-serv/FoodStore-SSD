from typing import Annotated, Any
from fastapi import APIRouter, Depends, status, Query

from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.core.deps import get_current_active_user, get_uow, require_role
from app.modules.usuarios.schemas import (
    UserCreate, UserPublic, UserUpdateClient, UserUpdateAdmin, 
    UserPublicAdminPanel, UserCreateAdmin
)
from app.modules.usuarios.service import UsuarioService
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork


# ==========================================
# DEPENDENCIAS DEL MÓDULO
# ==========================================
def get_usuario_service(uow: Annotated[UsuarioUnitOfWork, Depends(get_uow)]) -> UsuarioService:
    return UsuarioService(uow)

UsuarioServiceDep = Annotated[UsuarioService, Depends(get_usuario_service)]
CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]

# ==========================================
# GRUPO 2: PERFIL DEL CLIENTE (Privado)
# ==========================================
usuarios_router = APIRouter(prefix="/usuarios", tags=["Usuarios (Mi Perfil)"])

@usuarios_router.get("/me", response_model=UserPublicAdminPanel)
def read_user_me(current_user: CurrentUser) -> Any:
    """Devuelve los datos del usuario logueado actualmente."""
    return current_user

@usuarios_router.patch("/me", response_model=UserPublic)
def update_user_me(data: UserUpdateClient, current_user: CurrentUser, svc: UsuarioServiceDep) -> Any:
    """Actualiza los datos básicos del usuario logueado (sin tocar roles)."""
    return svc.update_profile(current_user.id, data)


# ==========================================
# GRUPO 3: PANEL ADMINISTRATIVO
# ==========================================
admin_router = APIRouter(
    prefix="/admin/usuarios", 
    tags=["Panel de Administración - Usuarios"],
    dependencies=[Depends(require_role(["ADMIN"]))]
)

@admin_router.post("/createUser", response_model=UserPublicAdminPanel, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    data: UserCreateAdmin,
    svc: UsuarioServiceDep
) -> Any:
    """El Admin crea un usuario asignándole roles específicos manualmente."""
    datos_usuario = data.model_dump(exclude={"roles_codigos"})
    user_in = UserCreate(**datos_usuario)
    return svc.create_user_admin(user_in=user_in, roles_codigos=data.roles_codigos)


@admin_router.get("/", response_model=PaginatedResponse[UserPublicAdminPanel])
def get_all_users(
    svc: UsuarioServiceDep, 
    params: PageQuery,
    rol_codigo: str | None = None
) -> Any:
    """Lista todos los usuarios activos. Permite paginación y filtrado por rol."""
    return svc.get_all_users(params=params, rol_codigo=rol_codigo)


@admin_router.patch("/{user_id}", response_model=UserPublicAdminPanel)
def update_user_by_admin(user_id: int, data: UserUpdateAdmin, svc: UsuarioServiceDep) -> Any:
    """El Admin actualiza los datos y/o los roles de cualquier usuario."""
    return svc.update_user_by_admin(user_id, data)


@admin_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, svc: UsuarioServiceDep) -> None:
    """Aplica un borrado lógico (soft delete) a un usuario."""
    svc.desactivar_usuario(user_id)
    return None
