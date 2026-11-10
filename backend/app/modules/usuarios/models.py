from typing import Optional, List, ClassVar, TYPE_CHECKING
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import BigInteger, Column, CHAR

from app.core.mixins.auditable_mixin import UniqueAuditableMixin
from app.core.timestamps import aware_datetime_field
from app.modules.direcciones_entrega.models import DireccionEntrega

if TYPE_CHECKING:
    from app.modules.direcciones_entrega.models import DireccionEntrega

# ==========================================
# 1. TABLAS INTERMEDIAS (Link Models)
# ==========================================

class UsuarioRol(SQLModel, table=True):
    __tablename__ = "usuario_rol"
    
    # PK Compuesta
    usuario_id: int = Field(foreign_key="usuario.id", primary_key=True, sa_type=BigInteger)
    rol_codigo: str = Field(foreign_key="rol.codigo", primary_key=True)

    # Atributos extra de la tabla intermedia según UML
    asignado_por_id: Optional[int] = Field(default=None, foreign_key="usuario.id", sa_type=BigInteger)
    expires_at: Optional[datetime] = aware_datetime_field(nullable=True)
    created_at: datetime = aware_datetime_field(default_now=True)

# ==========================================
# 2. TABLAS PRINCIPALES
# ==========================================

class Rol(SQLModel, table=True):
    __tablename__ = "rol"
    
    # PK Semántica (El ID es el texto "ADMIN", "CLIENT", etc.)
    codigo: str = Field(primary_key=True, max_length=20) 
    nombre: str = Field(unique=True, index=True, max_length=50)
    descripcion: Optional[str] = None
    
    # Relaciones (N:M)
    usuarios: List["Usuario"] = Relationship(back_populates="roles", link_model=UsuarioRol, sa_relationship_kwargs={"foreign_keys": "[UsuarioRol.usuario_id, UsuarioRol.rol_codigo]"})


class Usuario(UniqueAuditableMixin, SQLModel, table=True):
    __tablename__ = "usuario"
    
    _unique_fields: ClassVar[List[str]] = ["email"]

    # id: Optional[int] = Field(default=None, primary_key=True)
    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigInteger)
    nombre: str = Field(max_length=80)
    apellido: str = Field(max_length=80)
    email: str = Field(max_length=254)
    celular: Optional[str] = Field(default=None, max_length=20)
    
    # Se fuerza el uso de CHAR(60) exacto para el hash de bcrypt
    password_hash: str = Field(sa_column=Column(CHAR(60), nullable=False))

    # Relaciones
    roles: List[Rol] = Relationship(back_populates="usuarios", link_model=UsuarioRol, sa_relationship_kwargs={"foreign_keys": "[UsuarioRol.usuario_id, UsuarioRol.rol_codigo]"})
    direcciones: List["DireccionEntrega"] = Relationship(back_populates="usuario")
