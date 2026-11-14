from typing import Annotated, Any
from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_active_user
from app.modules.usuarios.schemas import UserPublic, UserPublicAdminPanel, UserUpdateClient
from app.modules.usuarios.dependencies import UsuarioServiceDep


# ==========================================
# DEPENDENCIAS DEL MÓDULO
# ==========================================
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
