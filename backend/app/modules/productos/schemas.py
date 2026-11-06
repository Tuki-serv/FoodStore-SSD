from decimal import Decimal
from typing import Optional, List
from sqlmodel import SQLModel, Field


class CategoriaBasicRead(SQLModel):
    id: int
    nombre: str
    es_principal: bool = Field(default=False, description="Si es categoría principal")


class IngredienteBasicRead(SQLModel):
    id: int
    nombre: str
    es_alergeno: bool = Field(default=False, description="Si es alérgeno")


class ProductoIngredienteRead(IngredienteBasicRead):
    es_removible: bool = Field(default=False, description="Indica si el ingrediente es removible del producto")
    cantidad: Decimal = Field(..., description="Cantidad requerida del ingrediente")
    unidad_medida_id: int = Field(..., description="ID de la unidad de medida")


# ─── Base ─────────────────────────────────────────────────────────────────────────────────

class ProductoBase(SQLModel):
    nombre: str = Field(..., description="Nombre del producto", max_length=150)
    descripcion: Optional[str] = Field(default=None, description="Descripción del producto")

    unidad_venta_id: Optional[int] = Field(default=None, description="ID de la unidad de medida en la que se vende el producto")
    precio_base: Decimal = Field(..., description="Precio del producto", ge=0)
    imagenes_url: Optional[list[str]] = Field(
        default=None, description="URLs de imágenes del producto")
    imagenes_public_id: Optional[list[str]] = Field(
        default=None,
        description="Public IDs de las imágenes en Cloudinary, paralelos a imagenes_url",
    )
    stock_cantidad: int = Field(
        default=0, ge=0, description="Cantidad en stock")
    disponible: bool = Field(
        default=True, description="Indica si el producto está disponible")

# ─── Request schemas ──────────────────────────────────────────────────────────────────────

class ProductoIngredienteCreate(SQLModel):
    ingrediente_id: int = Field(..., description="ID del ingrediente")
    cantidad: Decimal = Field(..., gt=0, description="Cantidad a descontar del stock")
    unidad_medida_id: int = Field(..., description="ID de la unidad de medida (ej: gramos, fetas)")
    es_removible: bool = Field(default=False, description="Indica si el cliente puede remover este ingrediente")


class ProductoCreate(ProductoBase):
    categoria_ids: list[int] = Field(
        ..., 
        min_length=1, 
        description="Lista de IDs de categorías a las que pertenece (obligatorio, mínimo 1)"
    )
    ingredientes: Optional[list[ProductoIngredienteCreate]] = Field(
        default=None, 
        description="Lista opcional de ingredientes con su configuración para este producto"
    )


class ProductoUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, description="Nombre del producto", max_length=150)
    descripcion: Optional[str] = Field(default=None, description="Descripción del producto")
    unidad_venta_id: Optional[int] = Field(default=None, description="ID de la unidad de medida en la que se vende el producto")
    precio_base: Optional[Decimal] = Field(
        default=None, description="Precio del producto", ge=0)
    imagenes_url: Optional[list[str]] = Field(
        default=None, description="URLs de imágenes del producto")
    imagenes_public_id: Optional[list[str]] = Field(
        default=None,
        description="Public IDs de las imágenes en Cloudinary, paralelos a imagenes_url",
    )
    stock_cantidad: Optional[int] = Field(
        default=None, ge=0, description="Cantidad en stock")
    disponible: Optional[bool] = Field(
        default=None, description="Indica si el producto está disponible")
    categoria_ids: Optional[list[int]] = Field(
        default=None, min_length=1, description="Lista opcional de IDs de categorías para actualizar"
    )
    ingredientes: Optional[list[ProductoIngredienteCreate]] = Field(
        default=None, description="Lista opcional de ingredientes para actualizar"
    )


# ─── Response schemas ────────────────────────────────────────────────────────────────────

class ProductoRead(ProductoBase):
    id: int = Field(..., description="ID del producto")


class ProductoBasicRead(SQLModel):
    id: int = Field(..., description="ID del producto")
    nombre: str = Field(..., description="Nombre del producto")
    precio_base: Decimal = Field(..., description="Precio del producto", ge=0)
    imagenes_url: Optional[list[str]] = Field(
        default=None, description="URLs de imágenes del producto")
    imagenes_public_id: Optional[list[str]] = Field(
        default=None,
        description="Public IDs de las imágenes en Cloudinary, paralelos a imagenes_url",
    )


class ProductoReadFull(ProductoRead):
    """Producto con categorías e ingredientes"""
    categorias: list[CategoriaBasicRead] = Field(default_factory=list)
    ingredientes: list[ProductoIngredienteRead] = Field(default_factory=list)


# ─── Schemas Específicos (Rúbrica) ────────────────────────────────────────────────────────

class ProductoUpdateImagenes(SQLModel):
    imagenes_url: List[str]
    imagenes_public_id: List[str]
