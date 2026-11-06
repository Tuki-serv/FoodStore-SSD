"""
Utilidades de seguridad: hashing de contraseñas y manejo de JWT.

- hash_password / verify_password: bcrypt vía passlib.
- create_access_token / decode_access_token: JWT con python-jose (HS256).

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
def create_access_token(data: dict) -> str:
    """
    Crea exclusivamente el Access Token.
    """
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_jwt_token(data, expires_delta, token_type="access")


# 3. HANDLER: REFRESH TOKEN
def create_refresh_token(data: dict) -> tuple[str, str, datetime]:
    """
    Crea el Refresh Token (JWT), lo encripta y calcula su expiración exacta.
    Retorna: (refresh_token_plain, token_hash, expires_at)
    """
    expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # A) Generamos el JWT llamando a la función base
    refresh_token_plain = create_jwt_token(data, expires_delta, token_type="refresh")
    
    # B) Generamos el hash para la base de datos
    token_hash = hashlib.sha256(refresh_token_plain.encode()).hexdigest()
    
    # C) Calculamos la expiración para guardarla en la tabla
    expires_at = datetime.now(timezone.utc) + expires_delta
    
    return refresh_token_plain, token_hash, expires_at


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
