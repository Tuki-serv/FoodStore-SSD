from typing import Optional
from sqlmodel import Field, SQLModel

class UnidadMedidaBase(SQLModel):
    nombre: str = Field(..., max_length=50, description="Nombre de la unidad de medida")
    simbolo: str = Field(..., max_length=10, description="Símbolo de la unidad de medida")
    tipo: str = Field(..., max_length=20, description="Tipo de unidad de medida (peso, volumen, etc)")

class UnidadMedidaCreate(UnidadMedidaBase):
    pass

class UnidadMedidaUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, max_length=50)
    simbolo: Optional[str] = Field(default=None, max_length=10)
    tipo: Optional[str] = Field(default=None, max_length=20)

class UnidadMedidaRead(UnidadMedidaBase):
    id: int
    
class UnidadMedidaList(SQLModel):
    data: list[UnidadMedidaRead]
    total: int
