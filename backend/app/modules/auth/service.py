import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, hash_refresh_token, new_refresh_token, verify_password
from app.core.timestamps import utc_now
from app.modules.auth.unit_of_work import AuthUnitOfWork
from app.modules.refreshtokens.models import RefreshToken, Sesion
from app.modules.usuarios.models import Usuario


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SessionTokens:
    """Resultado de login/renovación: el access va al body y el refresh (si hay uno nuevo) a la cookie."""

    access_token: str
    expires_in: int
    refresh_token: Optional[str]
    refresh_max_age: int


class _Rechazo:
    """Resultado interno: el refresh no sirve (se traduce en 401 fuera de la transacción)."""


class RefreshRechazado(HTTPException):
    """401 de `/auth/refresh`: el router lo traduce en una respuesta que además borra la cookie."""

    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o expirado")


class AuthService:
    def __init__(self, uow: AuthUnitOfWork) -> None:
        self.uow = uow

    def login(self, email: str, password: str, ip: Optional[str], user_agent: Optional[str]) -> SessionTokens:
        with self.uow as uow:
            user = uow.usuarios.get_by_email(email)

            # Siempre se verifica bcrypt (contra un hash de relleno si no hay usuario) para que el tiempo de
            # respuesta no revele si el email existe (D20).
            hash_a_verificar = user.password_hash if user else DUMMY_PASSWORD_HASH
            password_ok = verify_password(password, hash_a_verificar)
            if not user or not password_ok or user.deleted_at:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            expires_at = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            sesion = uow.sesiones.add(
                Sesion(usuario_id=user.id, expires_at=expires_at, ip=ip, user_agent=user_agent)
            )
            plano, token_hash = new_refresh_token()
            uow.refresh_tokens.add(RefreshToken(sesion_id=sesion.id, token_hash=token_hash))

            return SessionTokens(
                access_token=self._access_de(user, sesion),
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                refresh_token=plano,
                refresh_max_age=int((sesion.expires_at - utc_now()).total_seconds()),
            )

    def logout(self, sid: UUID, usuario_id: int) -> None:
        """Cierra la sesión `sid` si es del usuario y está abierta (idempotente: si no, no hace nada).

        Los refresh de la sesión no se tocan: su `revoked_at` solo significa «rotado» y quedan inservibles porque la
        sesión está cerrada.
        """
        with self.uow as uow:
            sesion = uow.sesiones.get_by_id(sid)
            if sesion is None or sesion.usuario_id != usuario_id or sesion.revoked_at is not None:
                return
            sesion.revoked_at = utc_now()
            sesion.revoked_reason = "LOGOUT"
            uow.sesiones.update(sesion)

    def logout_all(self, usuario_id: int) -> None:
        """Cierra todas las sesiones abiertas del usuario con motivo `LOGOUT_ALL`."""
        with self.uow:
            self.revocar_sesiones_abiertas(usuario_id, "LOGOUT_ALL")

    def revocar_sesiones_abiertas(self, usuario_id: int, motivo: str) -> int:
        """Cierra todas las sesiones abiertas del usuario con `motivo`; las ya cerradas conservan el suyo (D8).

        Única operación de revocación masiva: la usan el reuso y logout-all. Debe llamarse dentro del
        `with self.uow` del llamador (no abre su propia transacción).
        """
        return self.uow.sesiones.revocar_abiertas_de_usuario(usuario_id, motivo, utc_now())

    # ── Renovación (tabla de decisión de D6.3) ───────────────────────────────
    def refresh(self, valor: Optional[str]) -> SessionTokens:
        """Renueva el access presentando el refresh de la cookie.

        La decisión se toma dentro del `with uow` (que confirma) y el 401 se levanta DESPUÉS de salir del bloque:
        si se levantara adentro, el rollback desharía la revocación por reuso (D16).
        """
        resultado = self._resolver_refresh(valor)
        if isinstance(resultado, _Rechazo):
            raise RefreshRechazado()
        return resultado

    def _resolver_refresh(self, valor: Optional[str]) -> "SessionTokens | _Rechazo":
        with self.uow as uow:
            if not valor:
                return _Rechazo()
            rt = uow.refresh_tokens.get_by_hash(hash_refresh_token(valor), for_update=True)
            if rt is None:
                return _Rechazo()

            sesion = uow.sesiones.get_by_id(rt.sesion_id)
            ahora = utc_now()
            # Sesión vencida o cerrada: hay que volver a loguearse, sin alarma y sin cerrar otras sesiones.
            if sesion.revoked_at is not None or sesion.expires_at <= ahora:
                return _Rechazo()
            user = uow.usuarios.get_by_id(sesion.usuario_id)
            if user is None or user.deleted_at is not None:
                return _Rechazo()

            if rt.revoked_at is None:
                return self._rotar(uow, rt, sesion, user)

            # Refresh ya rotado: dentro de la gracia es una carrera legítima (otra pestaña); solo access nuevo.
            if (ahora - rt.revoked_at).total_seconds() <= settings.REFRESH_REUSE_GRACE_SECONDS:
                return SessionTokens(
                    access_token=self._access_de(user, sesion),
                    expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    refresh_token=None,
                    refresh_max_age=0,
                )

            # Refresh rotado hace más que la gracia: alguien tiene una copia vieja → REUSO. No hay forma de saber
            # cuál navegador está comprometido, así que se cierran TODAS las sesiones abiertas del usuario.
            self.revocar_sesiones_abiertas(user.id, "REUSO")
            logger.warning("Reuso de refresh token detectado: se cerraron las sesiones abiertas del usuario_id=%s", user.id)
            return _Rechazo()

    def _rotar(self, uow: AuthUnitOfWork, rt: RefreshToken, sesion: Sesion, user: Usuario) -> SessionTokens:
        # Se confirma el `revoked_at` (flush) ANTES de insertar el nuevo: el índice único parcial
        # `uq_refresh_token_sesion_activo` solo admite un activo por sesión (D17).
        rt.revoked_at = utc_now()
        uow.refresh_tokens.update(rt)
        uow.refresh_tokens.flush()
        plano, token_hash = new_refresh_token()
        uow.refresh_tokens.add(RefreshToken(sesion_id=sesion.id, token_hash=token_hash))
        return SessionTokens(
            access_token=self._access_de(user, sesion),
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=plano,
            refresh_max_age=int((sesion.expires_at - utc_now()).total_seconds()),
        )

    @staticmethod
    def _access_de(user: Usuario, sesion: Sesion) -> str:
        """Access con los roles ACTUALES del usuario y el `sid` de la sesión."""
        return create_access_token(sub=str(user.id), roles=[rol.codigo for rol in user.roles], sid=str(sesion.id))
