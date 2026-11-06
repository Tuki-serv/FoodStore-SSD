from sqlmodel import SQLModel, Field

class FormaPago(SQLModel, table=True):
    __tablename__ = "forma_pago"

    codigo: str = Field(primary_key=True, max_length=20)
    descripcion: str = Field(max_length=80 , nullable=False)
    habilitado: bool = Field(nullable=False, default=True) 
