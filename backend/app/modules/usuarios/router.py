from typing import Annotated, Any
from fastapi import APIRouter, Depends, status, Response, Query
from fastapi.security import OAuth2PasswordRequestForm

from app.core.schemas import PaginatedResponse
from app.core.deps import get_current_active_user, get_uow, require_role
from app.modules.usuarios.schemas import (
    UserCreate, UserPublic, UserUpdateClient, UserUpdateAdmin, 
    UserPublicAdminPanel, UserCreateAdmin, RefreshTokenRequest
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
# GRUPO 1: AUTENTICACIÓN (Público)
# ==========================================
auth_router = APIRouter(prefix="/auth", tags=["Autenticación"])

@auth_router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, svc: UsuarioServiceDep) -> Any:
    """Registra un cliente nuevo y le asigna el rol CLIENT automáticamente."""
    return svc.register(data)


@auth_router.post("/login")
def login(
    response: Response, 
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    svc: UsuarioServiceDep
) -> Any:
    """
    El rate limit de 5/15min se maneja automáticamente por el RateLimitMiddleware.
    """
    token_obj = svc.login(form_data)
    
    response.set_cookie(
        key="access_token",
        value=token_obj.access_token,
        httponly=True,
        max_age=token_obj.expires_in,
        expires=token_obj.expires_in,
        samesite="lax",
        secure=False, 
        path="/"
    )
    # Devuelve 200 OK por defecto con la estructura del Token
    return token_obj


@auth_router.post("/refresh")
def refresh(response: Response, data: RefreshTokenRequest, svc: UsuarioServiceDep) -> Any:
    """Refresca el token de sesión usando un refresh_token."""
    # 1. Generamos los nuevos tokens desde el servicio
    token_obj = svc.refresh_token(data.refresh_token)
    
    # 2. Inyectamos el nuevo access token en la cookie para el frontend
    response.set_cookie(
        key="access_token",
        value=token_obj.access_token,
        httponly=True,
        max_age=token_obj.expires_in,
        expires=token_obj.expires_in,
        samesite="lax",
        secure=False, 
        path="/"
    )
    return token_obj


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(data: RefreshTokenRequest, response: Response, current_user: CurrentUser, svc: UsuarioServiceDep) -> None:
    """Cierra sesión borrando la cookie y revocando el refresh token."""
    # 1. Revocamos el token de la base de datos
    svc.logout(data.refresh_token)
    
    # 2. Borramos la cookie del navegador
    response.delete_cookie(key="access_token", path="/")
    return None


# @auth_router.get("/me", response_model=UserPublicAdminPanel)
# def read_user_me(current_user: CurrentUser) -> Any:
#     """Devuelve los datos del usuario logueado actualmente. (200 OK)"""
#     return current_user


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
    page: int = Query(1, ge=1, description="Número de página"), 
    size: int = Query(20, ge=1, le=100, description="Cantidad de items por página"), 
    rol_codigo: str | None = None
) -> Any:
    """Lista todos los usuarios activos. Permite paginación y filtrado por rol."""
    return svc.get_all_users(page=page, size=size, rol_codigo=rol_codigo)


@admin_router.patch("/{user_id}", response_model=UserPublicAdminPanel)
def update_user_by_admin(user_id: int, data: UserUpdateAdmin, svc: UsuarioServiceDep) -> Any:
    """El Admin actualiza los datos y/o los roles de cualquier usuario."""
    return svc.update_user_by_admin(user_id, data)


@admin_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, svc: UsuarioServiceDep) -> None:
    """Aplica un borrado lógico (soft delete) a un usuario."""
    svc.desactivar_usuario(user_id)
    return None
