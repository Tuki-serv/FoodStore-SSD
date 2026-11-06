"""Configuración del backend por variables de entorno.

Convención (ver knowledge-base/09, DD-18):
- Toda variable es explícita: vive en `.env` / `.env.example` y se declara acá. Nada se deriva de otras.
- Sin valores por defecto ocultos. Una variable es obligatoria (sin default) cuando la app la necesita
  para funcionar: si falta, `Settings()` falla nombrándola y la app no arranca.
- Las variables de integraciones opcionales (MercadoPago, Cloudinary) son `Optional[...] = None`:
  `None` significa «funcionalidad no configurada», nunca un valor sustituto.
"""
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ─── Entorno ─────────────────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "production", "test"]

    # ─── Base de datos (única variable de BD del backend; se usa tal cual) ───
    DATABASE_URL: str
    SQL_ECHO: bool

    # ─── Seguridad / JWT ─────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # ─── Logging ─────────────────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

    # ─── Rate Limiting ───────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT_PER_MINUTE: int
    RATE_LIMIT_DEFAULT_BURST: int
    RATE_LIMIT_AUTH_PER_MINUTE: int
    RATE_LIMIT_AUTH_BURST: int

    # ─── CORS (array JSON de strings) ────────────────────────────────────────
    CORS_ORIGINS: list[str]

    # ─── Pagos — MercadoPago (opcionales) ────────────────────────────────────
    MP_ACCESS_TOKEN: Optional[str] = None
    MP_PUBLIC_KEY: Optional[str] = None
    MP_NOTIFICATION_URL: Optional[str] = None
    BACKEND_PUBLIC_URL: Optional[str] = None
    FRONTEND_URL: Optional[str] = None

    # ─── Imágenes — Cloudinary (opcionales) ──────────────────────────────────
    CLOUDINARY_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    @property
    def rate_limit_default_burst(self) -> int:
        return self.RATE_LIMIT_DEFAULT_BURST

    @property
    def rate_limit_default_per_minute(self) -> int:
        return self.RATE_LIMIT_DEFAULT_PER_MINUTE

    @property
    def rate_limit_auth_burst(self) -> int:
        return self.RATE_LIMIT_AUTH_BURST

    @property
    def rate_limit_auth_per_minute(self) -> int:
        return self.RATE_LIMIT_AUTH_PER_MINUTE

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )


settings = Settings()
