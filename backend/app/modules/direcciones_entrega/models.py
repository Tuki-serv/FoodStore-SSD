from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import BigInteger, Text
from sqlmodel import SQLModel, Field, Relationship

from app.core.timestamps import aware_datetime_field

if TYPE_CHECKING:
    from app.modules.usuarios.models import Usuario

class DireccionEntrega(SQLModel, table=True):
    __tablename__ = "direccion_entrega"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    # usuario_id: int = Field(foreign_key="usuario.id", sa_type=BigInteger)
    usuario_id: int = Field(foreign_key="usuario.id", sa_type=BigInteger)
    
    alias: Optional[str] = Field(default=None, max_length=50)
    linea1: str = Field(sa_type=Text)
    linea2: Optional[str] = None
    ciudad: str = Field(max_length=100)
    provincia: Optional[str] = Field(default=None, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, max_length=10)
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    es_principal: bool = Field(default=False)

    # Audit
    created_at: datetime = aware_datetime_field(default_now=True)
    updated_at: datetime = aware_datetime_field(default_now=True)
    deleted_at: Optional[datetime] = aware_datetime_field(nullable=True)

    usuario: Optional["Usuario"] = Relationship(back_populates="direcciones")
