from typing import Optional

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel
from app.core.mixins.auditable_mixin import UniqueAuditableMixin

class UnidadMedida(UniqueAuditableMixin, SQLModel, table=True):
    __tablename__ = "unidades_medida"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(sa_column=Column(String(50), unique=True, nullable=False), description="Nombre de la unidad de medida")
    simbolo: str = Field(sa_column=Column(String(10), unique=True, nullable=False), description="simbolo de la unidad de medida")
    tipo: str = Field(sa_column=Column(String(20), nullable=False), description="tipo de unidad de medida (peso, volumen, etc)")
