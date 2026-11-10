"""
Utilidades de seguridad: hashing de contraseñas y manejo de JWT.

- hash_password / verify_password: bcrypt vía passlib.
- create_access_token / decode_access_token: JWT con python-jose (HS256).
- new_refresh_token / hash_refresh_token: refresh opaco y su hash SHA-256.

Separado del router para poder reutilizarse en seeds, tests, etc.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import logging

logger = logging.getLogger("app.core.security")

# ─── Hashing (bcrypt) ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica una contraseña en texto plano contra su hash bcrypt."""
    return pwd_context.verify(plain, hashed)


# Hash bcrypt (cost 12) de relleno: no es un secreto ni protege nada. El login lo verifica cuando el usuario no
# existe o está dado de baja, para que la respuesta tarde lo mismo que con una contraseña incorrecta y no permita
# enumerar emails registrados por diferencia de tiempo. Se calcula una sola vez al importar el módulo.
DUMMY_PASSWORD_HASH: str = pwd_context.hash("relleno-para-igualar-el-tiempo-de-login")


# ─── JWT ──────────────────────────────────────────────────────────────────────
# 1. FUNCIÓN BASE (Core)
def create_jwt_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
    """
    Crea un JWT genérico firmado con HS256.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"type": token_type, "exp": expire})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# 2. HANDLER: ACCESS TOKEN
def create_access_token(*, sub: str, roles: list[str], sid: str) -> str:
    """
    Crea el Access Token (JWT HS256) con `sub` (id de usuario), `roles` y `sid` (id de la sesión).
    """
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_jwt_token({"sub": sub, "roles": roles, "sid": sid}, expires_delta, token_type="access")


# 3. REFRESH TOKEN: valor opaco; en la BD solo se guarda su hash SHA-256
def hash_refresh_token(valor: str) -> str:
    """SHA-256 (hex, 64 caracteres) de un refresh token en texto plano."""
    return hashlib.sha256(valor.encode()).hexdigest()


def new_refresh_token() -> tuple[str, str]:
    """Genera un refresh opaco aleatorio. Retorna: (valor_plano, hash)."""
    plano = secrets.token_urlsafe(32)
    return plano, hash_refresh_token(plano)


def decode_access_token(token: str) -> dict | None:
    """
    Decodifica y verifica un JWT.

    Retorna el payload si la firma y expiración son válidas,
    o None si cualquier verificación falla.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError as e:
        logger.debug(f"JWT ERROR: {e}")
        return None
