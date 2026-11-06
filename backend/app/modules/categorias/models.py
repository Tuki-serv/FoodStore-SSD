from typing import TYPE_CHECKING, Optional, List, ClassVar
from sqlmodel import SQLModel

from app.modules.productos.models import ProductoCategoria
from app.core.mixins.auditable_mixin import UniqueAuditableMixin

from sqlmodel import Field, Relationship

# Evitar las importaciones circulares
if TYPE_CHECKING:
    from ..productos.models import Producto


class Categoria(UniqueAuditableMixin, SQLModel, table=True):
    __tablename__ = "categorias"

    _unique_fields: ClassVar[List[str]] = ["nombre"]

    id: Optional[int] = Field(default=None, primary_key=True)
    parent_id: Optional[int] = Field(
        default=None,
        foreign_key="categorias.id",
        description="FK a categoría padre"
    )
    
    nombre: str = Field(..., max_length=100, description="Nombre de la categoría")
    
    descripcion: Optional[str] = Field(default=None, description="Descripción")
    
    imagen_url: Optional[str] = Field(..., description="URL de imagen de la categoría")
    imagen_public_id: Optional[str] = Field(
        default=None, description="Public ID de la imagen en Cloudinary"
    )

    parent: Optional["Categoria"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Categoria.id"}
    )
    
    children: list["Categoria"] = Relationship(
        back_populates="parent"
    )

    # Relación con productos a través de la tabla intermedia
    productos: List["Producto"] = Relationship(
        back_populates="categorias",
        link_model=ProductoCategoria
    )
