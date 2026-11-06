from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.modules.usuarios.models import Usuario

class DireccionEntrega(SQLModel, table=True):
    __tablename__ = "direccion_entrega"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    # usuario_id: int = Field(foreign_key="usuario.id")
    usuario_id: int = Field(foreign_key="usuario.id")
    
    alias: Optional[str] = Field(default=None, max_length=50)
    linea1: str
    linea2: Optional[str] = None
    ciudad: str = Field(max_length=100)
    provincia: Optional[str] = Field(default=None, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, max_length=10)
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    es_principal: bool = Field(default=False)

    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = None

    usuario: Optional["Usuario"] = Relationship(back_populates="direcciones")
