"""Configuración del backend por variables de entorno.

Convención (ver knowledge-base/09, DD-18):
- Toda variable es explícita: vive en `.env` / `.env.example` y se declara acá. Nada se deriva de otras.
- Sin valores por defecto ocultos. Una variable es obligatoria (sin default) cuando la app la necesita
  para funcionar: si falta, `Settings()` falla nombrándola y la app no arranca.
- Las variables de integraciones opcionales (MercadoPago, Cloudinary) son `Optional[...] = None`:
  `None` significa «funcionalidad no configurada», nunca un valor sustituto.
"""
from typing import Literal, Optional

from pydantic import Field, field_validator, model_validator
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
    REFRESH_TOKEN_EXPIRE_DAYS: int  # vencimiento fijo de la sesión
    REFRESH_REUSE_GRACE_SECONDS: int = Field(ge=0)
    REFRESH_COOKIE_SECURE: bool
    REFRESH_COOKIE_SAMESITE: Literal["lax", "strict", "none"]

    # ─── Logging ─────────────────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

    # ─── CORS (array JSON de strings) ────────────────────────────────────────
    CORS_ORIGINS: list[str]

    # ─── Pagos — MercadoPago (opcionales) ────────────────────────────────────
    MP_ACCESS_TOKEN: Optional[str] = None
    MP_PUBLIC_KEY: Optional[str] = None
    MP_WEBHOOK_SECRET: Optional[str] = None  # clave secreta de Webhooks (panel MP); sin ella el webhook responde 503
    MP_NOTIFICATION_URL: Optional[str] = None
    BACKEND_PUBLIC_URL: Optional[str] = None
    FRONTEND_URL: Optional[str] = None

    # ─── Imágenes — Cloudinary (opcionales) ──────────────────────────────────
    CLOUDINARY_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _cors_sin_comodin(cls, origenes: list[str]) -> list[str]:
        # La cookie del refresh exige CORS con credenciales: el estándar no admite `*` con credenciales.
        if "*" in origenes:
            raise ValueError("CORS_ORIGINS no puede contener '*' (se usa con credenciales)")
        return origenes

    @model_validator(mode="after")
    def _samesite_none_exige_secure(self) -> "Settings":
        if self.REFRESH_COOKIE_SAMESITE == "none" and not self.REFRESH_COOKIE_SECURE:
            raise ValueError(
                "REFRESH_COOKIE_SAMESITE=none exige REFRESH_COOKIE_SECURE=true "
                "(los navegadores rechazan la cookie)"
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )


settings = Settings()
