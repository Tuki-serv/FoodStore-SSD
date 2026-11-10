from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import AccessClaims, get_access_claims, get_current_active_user
from app.modules.auth.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from app.modules.auth.schemas import Token
from app.modules.auth.service import AuthService, RefreshRechazado
from app.modules.auth.unit_of_work import AuthUnitOfWork, get_auth_uow
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.router import UsuarioServiceDep
from app.modules.usuarios.schemas import UserCreate, UserPublic, UserPublicAdminPanel

auth_router = APIRouter(prefix="/auth", tags=["Autenticación"])


def get_auth_service(uow: Annotated[AuthUnitOfWork, Depends(get_auth_uow)]) -> AuthService:
    return AuthService(uow)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@auth_router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, svc: UsuarioServiceDep) -> Any:
    """Registra un cliente nuevo (rol CLIENT). La creación sigue centralizada en `UsuarioService`."""
    return svc.register(data)


@auth_router.post("/login", response_model=Token)
def login(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    svc: AuthServiceDep,
) -> Any:
    """Abre una sesión: el access va en el body y el refresh en una cookie HttpOnly."""
    ip = request.client.host if request.client else None
    tokens = svc.login(form_data.username, form_data.password, ip, request.headers.get("user-agent"))
    if tokens.refresh_token is not None:
        set_refresh_cookie(response, tokens.refresh_token, tokens.refresh_max_age)
    return Token(access_token=tokens.access_token, expires_in=tokens.expires_in)


@auth_router.get("/me", response_model=UserPublicAdminPanel)
def read_me(current_user: Annotated[Usuario, Depends(get_current_active_user)]) -> Any:
    """Devuelve el usuario autenticado por el access, con sus roles."""
    return current_user


@auth_router.post("/refresh", response_model=Token)
def refresh(
    response: Response,
    svc: AuthServiceDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> Any:
    """Renueva el access con el refresh de la cookie (sin cuerpo). Rota la cookie salvo en el período de gracia."""
    try:
        tokens = svc.refresh(refresh_token)
    except RefreshRechazado as exc:
        rechazo = JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc.detail), "code": f"HTTP_{exc.status_code}", "field": None},
        )
        clear_refresh_cookie(rechazo)
        return rechazo
    if tokens.refresh_token is not None:
        set_refresh_cookie(response, tokens.refresh_token, tokens.refresh_max_age)
    return Token(access_token=tokens.access_token, expires_in=tokens.expires_in)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response, claims: Annotated[AccessClaims, Depends(get_access_claims)], svc: AuthServiceDep
) -> None:
    """Cierra la sesión del access (`sid`) y borra la cookie del refresh. Sin cuerpo; idempotente."""
    svc.logout(claims.sid, claims.usuario_id)
    clear_refresh_cookie(response)


@auth_router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response, claims: Annotated[AccessClaims, Depends(get_access_claims)], svc: AuthServiceDep
) -> None:
    """Cierra todas las sesiones abiertas del usuario autenticado y borra la cookie del refresh."""
    svc.logout_all(claims.usuario_id)
    clear_refresh_cookie(response)
