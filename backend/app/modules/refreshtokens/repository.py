"""Repositorios de sesiones y refresh tokens (C-02). Todo acceso a datos de auth pasa por acá."""
from datetime import datetime
from typing import Optional

from sqlalchemy import update
from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.refreshtokens.models import RefreshToken, Sesion


class SesionRepository(BaseRepository[Sesion]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Sesion)

    def revocar_abiertas_de_usuario(self, usuario_id: int, motivo: str, instante: datetime) -> int:
        """UPDATE masivo: cierra todas las sesiones abiertas del usuario con `motivo`. Devuelve cuántas cerró."""
        statement = (
            update(Sesion)
            .where(Sesion.usuario_id == usuario_id, Sesion.revoked_at.is_(None))
            .values(revoked_at=instante, revoked_reason=motivo)
            .execution_options(synchronize_session="fetch")
        )
        return self.session.exec(statement).rowcount  # type: ignore[no-any-return]


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, RefreshToken)

    def get_by_hash(self, token_hash: str, *, for_update: bool = False) -> Optional[RefreshToken]:
        """Busca por hash; con `for_update=True` bloquea la fila (`SELECT ... FOR UPDATE`, D17)."""
        statement = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        if for_update:
            statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.exec(statement).first()
