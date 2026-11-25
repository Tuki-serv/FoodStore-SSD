from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from slowapi.util import get_remote_address

from app.modules.auth.dependencies import (
    AccessClaims,
    AuthServiceDep,
    get_access_claims,
    get_access_claims_firmados,
    get_current_active_user,
)
from app.modules.auth.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from app.modules.auth.schemas import Token
from app.modules.auth.service import RefreshRechazado
from app.modules.usuarios.dependencies import UsuarioServiceDep
from app.modules.usuarios.schemas import UserCreate, UserPublic, UserPublicAdminPanel
from app.core.api_responses import respuestas_error

auth_router = APIRouter(prefix="/auth", tags=["Autenticación"])


@auth_router.post("/register", summary="Registrar un cliente", responses=respuestas_error(409), response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, svc: UsuarioServiceDep) -> Any:
    """Registra un cliente nuevo (rol CLIENT). La creación sigue centralizada en `UsuarioService`."""
    return svc.register(data)


@auth_router.post("/login", summary="Iniciar sesión", responses=respuestas_error(401, 429), response_model=Token)
def login(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    svc: AuthServiceDep,
) -> Any:
    """Abre una sesión: el access va en el body y el refresh en una cookie HttpOnly."""
    ip = get_remote_address(request)
    tokens = svc.login(form_data.username, form_data.password, ip, request.headers.get("user-agent"))
    if tokens.refresh_token is not None:
        set_refresh_cookie(response, tokens.refresh_token, tokens.refresh_max_age)
    return Token(access_token=tokens.access_token, expires_in=tokens.expires_in)


@auth_router.get("/me", summary="Obtener el usuario autenticado", responses=respuestas_error(401), response_model=UserPublicAdminPanel)
def read_me(current_user: Annotated[UserPublic, Depends(get_current_active_user)]) -> Any:
    """Devuelve el usuario autenticado por el access, con sus roles."""
    return current_user


@auth_router.post("/refresh", summary="Renovar la sesión con el refresh token", responses=respuestas_error(401), response_model=Token)
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


@auth_router.post("/logout", summary="Cerrar la sesión actual", responses=respuestas_error(401), status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response, claims: Annotated[AccessClaims, Depends(get_access_claims_firmados)], svc: AuthServiceDep
) -> None:
    """Cierra la sesión del access (`sid`) y borra la cookie del refresh. Sin cuerpo; idempotente.

    Basta un access bien firmado y vigente: no exige que la sesión siga abierta, así un cierre repetido (o tras un
    logout-all) responde 204 y borra la cookie igual.
    """
    svc.logout(claims.sid, claims.usuario_id)
    clear_refresh_cookie(response)


@auth_router.post("/logout-all", summary="Cerrar todas las sesiones del usuario", responses=respuestas_error(401), status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response, claims: Annotated[AccessClaims, Depends(get_access_claims)], svc: AuthServiceDep
) -> None:
    """Cierra todas las sesiones abiertas del usuario autenticado y borra la cookie del refresh."""
    svc.logout_all(claims.usuario_id)
    clear_refresh_cookie(response)
