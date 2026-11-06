from sqlmodel import SQLModel, Field

class EstadoPedido(SQLModel, table=True):
    __tablename__ = "estado_pedido"

    codigo: str = Field(primary_key=True, max_length=20)
    descripcion: str = Field(max_length=255, nullable=False)
    orden: int = Field(nullable=False)
    es_terminal: bool = Field(default=False, nullable=False)
