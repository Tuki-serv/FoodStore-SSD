from typing import Optional
from sqlmodel import Field, SQLModel


class ProductoBasicRead(SQLModel):
    id: int
    nombre: str


# ─── Base ─────────────────────────────────────────────────────────────────────────────────


class CategoriaBase(SQLModel):
    parent_id: Optional[int] = None
    nombre: str = Field(...,
                        description="Nombre de la categoría", max_length=100)
    descripcion: Optional[str] = Field(default=None, description="Descripción de la categoría")
    imagen_url: str = Field(..., description="URL de imagen de la categoría")
    imagen_public_id: Optional[str] = Field(
        default=None, description="Public ID de la imagen en Cloudinary"
    )


# ─── Request schemas ──────────────────────────────────────────────────────────────────────
class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(SQLModel):
    parent_id: Optional[int] = None
    nombre: Optional[str] = Field(
        default=None, description="Nombre de la categoría", max_length=100)
    descripcion: Optional[str] = Field(
        default=None, description="Descripción de la categoría")
    imagen_url: Optional[str] = Field(
        default=None, description="URL de imagen de la categoría")
    imagen_public_id: Optional[str] = Field(
        default=None, description="Public ID de la imagen en Cloudinary"
    )


# ─── Response schemas ────────────────────────────────────────────────────────────────────


class CategoriaRead(CategoriaBase):
    id: int = Field(..., description="ID de la categoría")


class CategoriaReadSimple(CategoriaRead):
    """Categoría sin subcategorías - para listados"""
    pass


class CategoriaReadFull(CategoriaRead):
    productos: list[ProductoBasicRead] = Field(
        default_factory=list, description="Lista de productos")


#Se puede borrar? Revisar a lo ultimo
class CategoriaReadWithSubs(CategoriaRead):
    """Categoría con subcategorías - para árbol"""
    subcategorias: list[CategoriaReadSimple] = Field(
        default_factory=list,
        description="Subcategorías hijo"
    )


class CategoriaTreeNode(CategoriaRead):
    subcategorias: list["CategoriaTreeNode"] = Field(
        default_factory=list,
        description="Subcategorías anidadas"
    )


class CategoriaList(SQLModel):
    data: list[CategoriaReadFull]
    total: int


class CategoriaTreeList(SQLModel):
    data: list[CategoriaTreeNode]
    total: int


CategoriaTreeNode.model_rebuild()
