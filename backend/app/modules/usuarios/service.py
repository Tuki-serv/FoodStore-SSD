from app.core.errors import AppError, ErrorCode
from typing import List, Optional

from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork
from app.modules.usuarios.schemas import UserCreate, UserUpdateAdmin, UserUpdateClient
from app.modules.usuarios.models import Rol, Usuario
from app.core.security import hash_password
from app.core.enums import EstadoFiltro
from app.core.pagination import PageParams
from app.core.timestamps import utc_now
from app.core.schemas import PaginatedResponse

ROL_ADMIN = "ADMIN"
MOTIVO_BAJA = "BAJA"


class UsuarioService:
    def __init__(self, uow: UsuarioUnitOfWork):
        self.uow = uow

    def _get_user_of_404(self, usuario_id: int) -> Usuario:
        user = self.uow.usuarios.get_by_id(usuario_id)
        
        if not user or user.deleted_at is not None:
            raise AppError.http(404, "Usuario no encontrado")
        
        return user

    def _crear_usuario_core(self, user_in: UserCreate, roles: List[Rol], asignado_por_id: Optional[int] = None) -> Usuario:
        """
        Método interno centralizado. 
        Maneja hashing, validación de email y persistencia.
        """
        # La verificación de email se hace aquí para que afecte a ambos flujos
        if self.uow.usuarios.get_by_email(user_in.email):
            raise AppError.http(409, "El email ya está registrado")

        nuevo_usuario = Usuario(
            nombre=user_in.nombre,
            apellido=user_in.apellido,
            email=user_in.email,
            celular=user_in.celular,
            password_hash=hash_password(user_in.password),
        )

        self.uow.usuarios.add(nuevo_usuario)
        self.uow.usuarios.reemplazar_roles(nuevo_usuario, roles, asignado_por_id)
        return nuevo_usuario
    
    def _update_user_core(self, usuario_id: int, data_dict: dict) -> Usuario:
        user = self._get_user_of_404(usuario_id)

        for key, value in data_dict.items():
            setattr(user, key, value)

        return user

    def _resolver_roles(self, codigos: List[str]) -> List[Rol]:
        """Roles del catálogo para `codigos` (RN-US-02): un código inexistente es 400 y no se cambia nada."""
        roles = []
        for codigo in codigos:
            rol = self.uow.roles.get_by_codigo(codigo)
            if not rol:
                raise AppError.http(400, f"El código de rol '{codigo}' no es válido.")
            roles.append(rol)
        return roles

    def _proteger_ultimo_admin(self, user: Usuario) -> None:
        """Serializa la operación que puede reducir los ADMIN activos y exige que quede otro (D2).

        Solo toma el bloqueo del rol cuando el usuario afectado lo tiene; tras obtenerlo, vuelve a leerlo porque otra
        operación pudo haberlo cambiado o dado de baja mientras se esperaba (404 si ya no está activo).
        """
        if not self.uow.usuarios.tiene_rol(user.id, ROL_ADMIN):
            return
        self.uow.roles.bloquear(ROL_ADMIN)
        self.uow.usuarios.recargar(user)
        if user.deleted_at is not None:
            raise AppError.http(404, "Usuario no encontrado")
        if not self.uow.usuarios.tiene_rol(user.id, ROL_ADMIN):
            return
        if self.uow.usuarios.contar_activos_con_rol(ROL_ADMIN, excluir_id=user.id) == 0:
            raise AppError(409, ErrorCode.LAST_ADMIN, "Tiene que quedar al menos un administrador activo.")

    @staticmethod
    def _exigir_otra_cuenta(actor_id: int, usuario_id: int, detail: str) -> None:
        if actor_id == usuario_id:
            raise AppError(409, ErrorCode.SELF_ACTION_NOT_ALLOWED, detail)


    # ==========================================
    # --- FLUJOS PÚBLICOS Y ADMINISTRATIVOS ---
    # ==========================================

    def register(self, user_in: UserCreate) -> Usuario:
        """Flujo para clientes: setea rol 'CLIENT' automáticamente."""
        with self.uow:
            rol_default = self.uow.roles.get_by_codigo("CLIENT")
            if not rol_default:
                raise AppError.http(500, "Configuración de sistema inválida: Rol 'CLIENT' no existe.")
            return self._crear_usuario_core(user_in, [rol_default])


    def create_user_admin(self, user_in: UserCreate, roles_codigos: List[str], actor_id: Optional[int] = None) -> Usuario:
        """Flujo para Admin: crea el usuario con los roles indicados, registrando a `actor_id` como asignador de cada uno."""
        with self.uow:
            roles = self._resolver_roles(roles_codigos)
            return self._crear_usuario_core(user_in, roles, asignado_por_id=actor_id)

    def update_profile(self, usuario_id: int, user_in: UserUpdateClient) -> Usuario:
        with self.uow:
            data = user_in.model_dump(exclude_unset=True)
            return self._update_user_core(usuario_id, data_dict=data)
    

    def update_user_by_admin(self, actor_id: int, user_id: int, user_in: UserUpdateAdmin) -> Usuario:
        """Edita datos y/o roles. Orden de verificación (D1): 404 → roles válidos (400) → propia cuenta → último ADMIN."""
        with self.uow:
            data = user_in.model_dump(exclude_unset=True)
            roles_codigos = data.pop("roles_codigos", None)

            user = self._get_user_of_404(user_id)

            nuevos_roles = None
            if roles_codigos is not None:
                nuevos_roles = self._resolver_roles(roles_codigos)
                if ROL_ADMIN not in roles_codigos and self.uow.usuarios.tiene_rol(user_id, ROL_ADMIN):
                    # Quitar ADMIN es lo único que puede reducir los administradores en una edición.
                    self._exigir_otra_cuenta(actor_id, user_id, "No podés quitarte tu propio rol de administrador.")
                    self._proteger_ultimo_admin(user)

            user = self._update_user_core(user_id, data)
            if nuevos_roles is not None:
                self.uow.usuarios.reemplazar_roles(user, nuevos_roles, asignado_por_id=actor_id)
            return user


    # ==========================================
    # --- FLUJO DE ADMIN (Privado) ---
    # ==========================================

    # def get_all_users(self,offset: int = 0, limit: int = 20, rol_codigo: Optional[str] = None):
    #     with self.uow:
    #         usuarios_paginados = self.uow.usuarios.get_paged_users(offset=offset, limit=limit, rol_codigo=rol_codigo, state = EstadoFiltro.ACTIVO)

    #         total = self.uow.usuarios.count_users(rol_codigo=rol_codigo, state=EstadoFiltro.ACTIVO)
    #     return{
    #         "data": usuarios_paginados,
    #         "total": total
    #     }

    def get_all_users(self, params: PageParams, rol_codigo: Optional[str] = None):
        with self.uow:
            if rol_codigo and not self.uow.roles.get_by_codigo(rol_codigo):
                raise AppError.http(400, f"El código de rol '{rol_codigo}' no es válido.")

            usuarios, total = self.uow.usuarios.listar_paginado(params, rol_codigo)
            return PaginatedResponse.desde(usuarios, total, params)

    def desactivar_usuario(self, actor_id: int, user_id: int) -> None:
        """Baja lógica: cierra las sesiones abiertas del usuario con motivo `BAJA` en la misma transacción."""
        with self.uow as uow:
            user = self._get_user_of_404(user_id)
            self._exigir_otra_cuenta(actor_id, user_id, "No podés desactivar tu propia cuenta.")
            self._proteger_ultimo_admin(user)

            uow.usuarios.delete(user)
            uow.sesiones.revocar_abiertas_de_usuario(user_id, MOTIVO_BAJA, utc_now())
