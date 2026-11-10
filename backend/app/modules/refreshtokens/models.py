"""Sesión de usuario y su historial de refresh tokens (C-02, D5).

- `Sesion`: nace en el login y vence a los `REFRESH_TOKEN_EXPIRE_DAYS` días fijos; agrupa los refresh.
- `RefreshToken`: valor opaco (solo su hash SHA-256). `revoked_at` significa «rotado»; NULL = activo.
  El vencimiento y el usuario salen de la sesión.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CHAR, CheckConstraint, Column, ForeignKeyConstraint, Index, Uuid, text
from sqlalchemy.orm import declared_attr
from sqlmodel import Field, SQLModel

from app.core.timestamps import aware_datetime_field


class Sesion(SQLModel, table=True):
    __tablename__ = "sesion"

    @declared_attr
    def __table_args__(cls):
        return (
            ForeignKeyConstraint(["usuario_id"], ["usuario.id"], name="fk_sesion_usuario_id_usuario"),
            CheckConstraint("revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO')", name="ck_sesion_revoked_reason"),
            CheckConstraint(
                "(revoked_at IS NULL) = (revoked_reason IS NULL)", name="ck_sesion_revocacion_consistente"
            ),
        )

    # Aleatorio (v4): es el claim `sid` del access token.
    id: UUID = Field(default_factory=uuid4, sa_column=Column(Uuid, primary_key=True))
    usuario_id: int = Field(sa_column=Column(BigInteger, nullable=False, index=True))
    expires_at: datetime = aware_datetime_field()
    revoked_at: Optional[datetime] = aware_datetime_field(nullable=True)
    revoked_reason: Optional[str] = Field(default=None, max_length=20)
    created_at: datetime = aware_datetime_field(default_now=True)
    # Solo auditoría: no se comparan en el refresh (D9).
    ip: Optional[str] = Field(default=None, max_length=45)
    user_agent: Optional[str] = Field(default=None)


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_token"

    @declared_attr
    def __table_args__(cls):
        return (
            ForeignKeyConstraint(["sesion_id"], ["sesion.id"], name="fk_refresh_token_sesion_id_sesion"),
            # Última defensa: la base garantiza un solo refresh activo por sesión.
            Index(
                "uq_refresh_token_sesion_activo",
                "sesion_id",
                unique=True,
                postgresql_where=text("revoked_at IS NULL"),
            ),
        )

    id: Optional[int] = Field(default=None, primary_key=True)
    sesion_id: UUID = Field(sa_column=Column(Uuid, nullable=False, index=True))
    token_hash: str = Field(sa_column=Column(CHAR(64), unique=True, nullable=False))
    revoked_at: Optional[datetime] = aware_datetime_field(nullable=True)
    created_at: datetime = aware_datetime_field(default_now=True)
