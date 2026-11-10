"""
Dependencias de autenticación y autorización para FastAPI.

Este módulo define funciones que se inyectan con Depends() para:
- Extraer el token JWT desde el request
- Validar autenticación
- Validar estado del usuario
- Validar permisos (roles)

Flujo de ejecución típico:

    Request HTTP
        ↓
    oauth2_scheme → extrae el token Bearer del header Authorization
        ↓
    get_current_user → decodifica el JWT y busca el usuario en DB
        ↓
    get_current_active_user → valida que el usuario esté activo
        ↓
    get_current_roles → roles del usuario leídos de la BD en cada pedido
        ↓
    require_role([...]) → valida permisos (RBAC, unión de roles)

Autoridad de los roles (C-08, D1): la BD en cada pedido. `AccessClaims.roles` es informativo (UI) y NUNCA
autoriza: quitar o agregar un rol tiene efecto en el pedido siguiente, sin esperar a la renovación del access.

Convenciones HTTP:
    401 → No autenticado (token inválido, ausente o expirado)
    403 → Autenticado pero sin permisos suficientes

Arquitectura:
    - Capa Core (dependencias reutilizables)
    - Depende de:
        * Unit of Work (acceso a datos)
        * Seguridad (JWT)
        * Modelo Usuario
"""

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status  # Inyección y manejo de errores HTTP
from fastapi.security import OAuth2PasswordBearer  # Manejo estándar de OAuth2 con Bearer

from app.core.permissions import tiene_algun_rol  # Primitiva pura de autorización
from app.core.security import decode_access_token  # Función para decodificar JWT
# from app.core.unit_of_work import UnitOfWork, get_uow       # Patrón Unit of Work para DB
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork, get_uow # Patrón Unit of Work para DB
from app.modules.usuarios.models import Usuario     # Modelo de dominio Usuario

# El access viaja SOLO por `Authorization: Bearer` (una cookie `access_token` no autentica).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
# Variante para lecturas públicas: sin header no es un error (anónimo); con header inválido sí (401).
oauth2_scheme_opcional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@dataclass(frozen=True)
class AccessClaims:
    """Claims validados del access token (firma, `exp`, `type` y `sid`), sin consultar la BD."""

    usuario_id: int
    sid: UUID
    roles: list[str]


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o token expirado",
        headers={"WWW-Authenticate": "Bearer"},  # Obligatorio en OAuth2 por protocolo
    )


def _claims_desde_token(token: str) -> AccessClaims:
    """Decodifica el access y exige `sub` y `sid` (un access sin `sid` es inválido, aunque esté bien firmado)."""
    payload = decode_access_token(token)
    if payload is None:
        raise _credentials_exception()

    usuario_id = payload.get("sub")
    sid = payload.get("sid")
    if usuario_id is None or sid is None:
        raise _credentials_exception()
    try:
        sid_uuid = UUID(str(sid))
        usuario_id_int = int(usuario_id)
    except ValueError:
        raise _credentials_exception()

    return AccessClaims(usuario_id=usuario_id_int, sid=sid_uuid, roles=list(payload.get("roles", [])))


def _cargar_usuario(claims: AccessClaims, uow: UsuarioUnitOfWork) -> Usuario:
    """Carga el Usuario de los claims (401 si ya no existe)."""
    with uow:
        user = uow.usuarios.get_by_id(claims.usuario_id)

        if user is None:
            raise _credentials_exception()

        return user  # Usuario autenticado válido


def _exigir_usuario_activo(user: Usuario) -> Usuario:
    """Un usuario con `deleted_at` no puede operar.

    Se deja un 404 por motivos de seguridad para que no sepan que hay un usuario baneado/desactivado.
    """
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta de usuario desactivada",
        )

    return user  # Usuario válido y activo


async def get_access_claims(token: Annotated[str, Depends(oauth2_scheme)]) -> AccessClaims:
    """Claims validados del access que viaja por `Authorization: Bearer` (401 si falta o es inválido)."""
    return _claims_desde_token(token)


async def get_current_user(
    claims: Annotated[AccessClaims, Depends(get_access_claims)],
    uow: Annotated[UsuarioUnitOfWork, Depends(get_uow)],   # Inyección del Unit of Work
):
    """Retorna el Usuario del access (para roles y estado actuales). 401 si el usuario ya no existe."""
    return _cargar_usuario(claims, uow)


async def get_current_active_user(
    current_user: Annotated[Usuario, Depends(get_current_user)],
) :
    """Verifica que el usuario autenticado esté activo (ver `_exigir_usuario_activo`)."""
    return _exigir_usuario_activo(current_user)


async def get_current_roles(
    current_user: Annotated[Usuario, Depends(get_current_active_user)],
) -> frozenset[str]:
    """Códigos de rol del usuario según la BD en este pedido (única fuente de autoridad, D1)."""
    return frozenset(rol.codigo for rol in current_user.roles)


def require_role(allowed_roles: list[str]):
    """
    Factory de dependencias RBAC: exige AL MENOS UNO de `allowed_roles` (unión de los roles del usuario en la BD).

    Uso típico:
        @router.get("/admin", dependencies=[Depends(require_role(["ADMIN"]))])
    """

    async def role_checker(
        current_user: Annotated[Usuario, Depends(get_current_active_user)],
        roles: Annotated[frozenset[str], Depends(get_current_roles)],
    ) -> Usuario:
        if not tiene_algun_rol(roles, allowed_roles):
            # 403 neutral: no revela los roles del usuario ni los requeridos.
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")

        return current_user  # Usuario autorizado

    return role_checker  # Retorna la dependencia configurada


def lector_privilegiado(roles: list[str]):
    """
    Factory de dependencias para lecturas PÚBLICAS que muestran más a ciertos roles (visibilidad del catálogo).

    Devuelve `True` si hay un access válido de un usuario activo con AL MENOS UNO de `roles` (según la BD).
    Sin header `Authorization` devuelve `False` (anónimo); un access inválido, vencido o de un usuario dado de baja responde 401.
    """

    async def lector(
        token: Annotated[str | None, Depends(oauth2_scheme_opcional)],
        uow: Annotated[UsuarioUnitOfWork, Depends(get_uow)],
    ) -> bool:
        if token is None:
            return False
        usuario = _cargar_usuario(_claims_desde_token(token), uow)
        if usuario.deleted_at is not None:
            # Lectura pública: un usuario dado de baja equivale a un access inválido (401), no al 404 de las rutas protegidas.
            raise _credentials_exception()
        return tiene_algun_rol({rol.codigo for rol in usuario.roles}, roles)

    return lector
