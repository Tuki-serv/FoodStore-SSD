from typing import Optional, Sequence
from sqlmodel import select, Session, func
from sqlalchemy.orm import selectinload
from app.core.pagination import PageParams
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from app.core.repository import BaseRepository
from app.core.email_normalizado import normalizar_email
from app.core.enums import EstadoFiltro

class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def get_by_email(self, email: str, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> Optional[Usuario]:
        statement = select(Usuario).options(selectinload(Usuario.roles)).where(Usuario.email == normalizar_email(email))
        statement = self._filter_state(statement, state)
        return self.session.exec(statement).first()
    
    def listar_paginado(self, params: PageParams, rol_codigo: Optional[str] = None) -> tuple[list[Usuario], int]:
        """Usuarios activos con sus roles, ordenados por alta e id; `rol_codigo` filtra por «tiene ese rol» sin duplicar filas."""
        statement = select(Usuario).options(selectinload(Usuario.roles))
        statement = self._filter_state(statement, EstadoFiltro.ACTIVO)

        if rol_codigo:
            statement = statement.where(Usuario.roles.any(Rol.codigo == rol_codigo))

        return self.paginar(statement.order_by(Usuario.created_at.asc(), Usuario.id.asc()), params)

    def reemplazar_roles(self, usuario: Usuario, roles: Sequence[Rol], asignado_por_id: Optional[int]) -> None:
        """Deja al usuario con exactamente `roles`: conserva las asignaciones que siguen, borra las quitadas e inserta las nuevas.

        Cada asignación nueva registra a `asignado_por_id`; las conservadas mantienen su asignador y fecha originales.
        """
        existentes = {
            fila.rol_codigo: fila
            for fila in self.session.exec(select(UsuarioRol).where(UsuarioRol.usuario_id == usuario.id)).all()
        }
        deseados = {rol.codigo for rol in roles}

        for codigo, fila in existentes.items():
            if codigo not in deseados:
                self.session.delete(fila)
        for codigo in deseados - existentes.keys():
            self.session.add(UsuarioRol(usuario_id=usuario.id, rol_codigo=codigo, asignado_por_id=asignado_por_id))

        self.session.flush()
        self.session.expire(usuario, ["roles"])  # la colección cargada ya no refleja la tabla intermedia

    def tiene_rol(self, usuario_id: int, rol_codigo: str) -> bool:
        """Consulta fresca a `usuario_rol` (no usa la colección cargada del ORM, que puede estar desactualizada)."""
        statement = select(func.count()).select_from(UsuarioRol).where(
            UsuarioRol.usuario_id == usuario_id, UsuarioRol.rol_codigo == rol_codigo
        )
        return self.session.exec(statement).one() > 0

    def contar_activos_con_rol(self, rol_codigo: str, excluir_id: Optional[int] = None) -> int:
        """Cantidad de usuarios activos (no dados de baja) con `rol_codigo`, sin contar a `excluir_id`."""
        statement = (
            select(func.count())
            .select_from(UsuarioRol)
            .join(Usuario, Usuario.id == UsuarioRol.usuario_id)
            .where(UsuarioRol.rol_codigo == rol_codigo, Usuario.deleted_at.is_(None))
        )
        if excluir_id is not None:
            statement = statement.where(Usuario.id != excluir_id)
        return self.session.exec(statement).one()

    def recargar(self, usuario: Usuario) -> None:
        """Vuelve a leer al usuario de la base (estado de baja y roles), descartando lo cacheado en la sesión."""
        self.session.refresh(usuario)
        self.session.expire(usuario, ["roles"])


class RolRepository(BaseRepository[Rol]):
    def __init__(self, session: Session):
        super().__init__(session, Rol)

    def get_by_codigo(self, codigo: str) -> Optional[Rol]:
        statement = select(Rol).where(Rol.codigo == codigo)
        return self.session.exec(statement).first()
        #return self.session.get(Rol, codigo)
        """Busca por el campo 'codigo', no por PK. Retorna None si está eliminado."""

    def bloquear(self, codigo: str) -> None:
        """`SELECT ... FOR UPDATE` sobre la fila del rol: serializa las operaciones que pueden reducir sus miembros (D2)."""
        statement = select(Rol).where(Rol.codigo == codigo).with_for_update().execution_options(populate_existing=True)
        self.session.exec(statement).first()
