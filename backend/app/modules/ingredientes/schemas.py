from typing import Optional
from sqlmodel import SQLModel, Field


# Esquema reducido local para evitar dependencia circular
class ProductoBasicRead(SQLModel):
    id: int
    nombre: str
# ─── Base ─────────────────────────────────────────────────────────────────────────────────


class IngredienteBase(SQLModel):
    nombre: str = Field(..., description="Nombre del ingrediente")
    es_alergeno: bool = Field(
        default=False, description="Indica si el ingrediente es un alérgeno")
    descripcion: Optional[str] = Field(default=None, description="Descripción del ingrediente")
    imagen_url: Optional[str] = Field(default=None, description="URL de imagen del ingrediente")
    imagen_public_id: Optional[str] = Field(
        default=None, description="Public ID de la imagen en Cloudinary"
    )


# ─── Request schemas ──────────────────────────────────────────────────────────────────────


class IngredienteCreate(IngredienteBase):
    unidad_medida_id: Optional[int] = Field(default=1, description="ID de la unidad de medida")


class IngredienteUpdate(SQLModel):
    nombre: Optional[str] = Field(
        default=None, description="Nombre del ingrediente")
    es_alergeno: Optional[bool] = Field(
        default=None, description="Indica si el ingrediente es un alérgeno")
    descripcion: Optional[str] = Field(
        default=None, description="Descripción del ingrediente")
    imagen_url: Optional[str] = Field(
        default=None, description="URL de imagen del ingrediente")
    imagen_public_id: Optional[str] = Field(
        default=None, description="Public ID de la imagen en Cloudinary"
    )


# ─── Response schemas ────────────────────────────────────────────────────────────────────

class IngredienteRead(IngredienteBase):
    id: int = Field(..., description="ID del ingrediente")


class IngredienteBasicRead(SQLModel):
    id: int = Field(..., description="ID del ingrediente")
    nombre: str = Field(..., description="Nombre del ingrediente")


class IngredienteReadFull(IngredienteRead):
    productos: list[ProductoBasicRead] = Field(
        default_factory=list, description="Lista de productos")


class IngredienteList(SQLModel):
    data: list[IngredienteReadFull]
    total: int
