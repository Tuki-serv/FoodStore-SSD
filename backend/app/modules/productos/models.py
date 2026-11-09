from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional, ClassVar, List
from pydantic import field_validator
from sqlmodel import Field, Relationship, Column, Integer, ForeignKey, SQLModel, ARRAY, String
from sqlalchemy import CheckConstraint, Numeric
from app.core.mixins.auditable_mixin import UniqueAuditableMixin
from app.core.timestamps import aware_datetime_field
from sqlalchemy.orm import declared_attr



if TYPE_CHECKING:
    from ..unidades_medida.models import UnidadMedida
    from ..categorias.models import Categoria
    from ..ingredientes.models import Ingrediente


class ProductoCategoria(SQLModel, table=True):
    __tablename__ = "producto_categoria"
    
    # La combinación de producto_id y categoria_id para evitar duplicados de relacion
    producto_id: int = Field(
        sa_column=Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"),  #borra relaciones si se borra el producto
        primary_key=True, nullable=False)
    )
    categoria_id: int = Field(
        sa_column=Column(Integer, ForeignKey("categorias.id", ondelete="RESTRICT"), #no permite borrar categoria si tiene productos relacionados
        primary_key=True, nullable=False)
    )
    es_principal: bool = Field(default=False, description="Indica si es categoría principal del producto")
    created_at: datetime = aware_datetime_field(default_now=True)

    categoria: "Categoria" = Relationship()

class ProductoIngrediente(SQLModel, table=True):
    __tablename__ = "producto_ingrediente"
    
    @declared_attr
    def __table_args__(cls):
        return (CheckConstraint("cantidad > 0", name="ck_producto_ingrediente_cantidad_positiva"),)

    producto_id: int = Field(
        sa_column=Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    )
    ingrediente_id: int = Field(
        sa_column=Column(Integer, ForeignKey("ingredientes.id", ondelete="RESTRICT"), primary_key=True, nullable=False)
    )
    cantidad: Decimal = Field(
        sa_column=Column(Numeric(10, 3), nullable=False), description="Cantidad requerida para la receta"
    )
    unidad_medida_id: int = Field(
        sa_column=Column(Integer, ForeignKey("unidades_medida.id", ondelete="RESTRICT"), nullable=False)
    )
    es_removible: bool = Field(default=False, description="Indica si el ingrediente es removible")
    created_at: datetime = aware_datetime_field(default_now=True)
    
    ingrediente: "Ingrediente" = Relationship()

class Producto(UniqueAuditableMixin, SQLModel, table=True):
    __tablename__ = "productos"

    # Constraint a nivel de BD: última línea de defensa
    # __table_args__ = (
    #     CheckConstraint("precio_base >= 0", name="ck_producto_precio_no_negativo"),
    # )

    _unique_fields: ClassVar[List[str]] = ["nombre"]

    @declared_attr
    def __table_args__(cls):
        parent_args = super().__table_args__
        return parent_args + (
            CheckConstraint("precio_base >= 0", name="ck_producto_precio_no_negativo"),
            CheckConstraint("stock_cantidad >= 0", name="ck_producto_stock_no_negativo"),
        )

    id: Optional[int] = Field(default=None, primary_key=True)
    #no puede ser nulo

    unidad_venta_id: Optional[int] = Field(default=None, foreign_key="unidades_medida.id", description="Unidad de medida en la que se vende el producto")
    nombre: str = Field(..., description="Nombre del producto", max_length=150)
    descripcion: Optional[str] = Field(default=None, description="Descripción del producto")
    #no puede ser nulo y checar que sea mayor o igual a 0
    precio_base: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False),
        description="Precio base del producto"
    )
    imagenes_url: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(String)))
    imagenes_public_id: Optional[list[str]] = Field(
        default=None, sa_column=Column(ARRAY(String)),
        description="Public IDs de las imágenes en Cloudinary, paralelos a imagenes_url",
    )
    stock_cantidad: int = Field(default=0, ge=0, description="Cantidad en stock")
    disponible: bool = Field(default=True, description="Si el producto está disponible para venta")
    
    # ── Validador de dominio (capa Python) ────────────────────────────────
    @field_validator("precio_base")
    @classmethod
    def precio_no_negativo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El precio base no puede ser negativo")
        return v

    # Relaciones N:N Bidireccional
    categorias: list["Categoria"] = Relationship(
        back_populates="productos",
        link_model=ProductoCategoria
    )
    ingredientes: list["Ingrediente"] = Relationship(
        back_populates="productos",
        link_model=ProductoIngrediente
    )

    unidad_venta: Optional["UnidadMedida"] = Relationship()
    links_categorias: list["ProductoCategoria"] = Relationship()
    links_ingredientes: list["ProductoIngrediente"] = Relationship()
