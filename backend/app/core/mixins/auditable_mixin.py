from typing import ClassVar, List, Optional
from datetime import datetime

from app.core.timestamps import aware_datetime_field
from sqlalchemy import Index, text
from sqlalchemy.orm import declared_attr

class UniqueAuditableMixin:
    """
    Mixin para modelos SQLModel que añade campos de auditoría y manejo de índices únicos con "soft delete".

    Proporciona campos para registrar la fecha de creación, actualización y 
    eliminación lógica (`deleted_at`). Además, soluciona el problema común de los 
    registros eliminados: genera dinámicamente índices únicos parciales para que 
    la restricción de unicidad solo se aplique a los registros activos.

    Attributes:
        _unique_fields (ClassVar[List[str]]): Lista de nombres de columnas que 
            deben ser únicas entre los registros activos.
        created_at (datetime): Fecha y hora exacta de creación del registro en UTC.
        updated_at (datetime): Fecha y hora de la última actualización en UTC.
        deleted_at (Optional[datetime]): Fecha de eliminación lógica. Si es `None`, 
            el registro se considera activo (no eliminado).
    """
    _unique_fields: ClassVar[List[str]] = []

    created_at: datetime = aware_datetime_field(default_now=True)
    updated_at: datetime = aware_datetime_field(default_now=True)
    deleted_at: Optional[datetime] = aware_datetime_field(nullable=True)

    @declared_attr
    def __table_args__(cls):
        """
        Genera dinámicamente la configuración de la tabla para SQLAlchemy.

        Itera sobre `_unique_fields` y crea un índice único parcial para cada uno.
        Utiliza `postgresql_where=text("deleted_at IS NULL")` para garantizar que 
        la base de datos (PostgreSQL) permita múltiples registros eliminados con el 
        mismo valor, pero solo un registro activo.

        Returns:
            tuple: Una tupla de objetos `Index` configurados para SQLAlchemy.
        """
        indexes = []
        tabla_nombre = cls.__tablename__
        
        for field_name in cls._unique_fields:
            idx = Index(
                f"uq_{tabla_nombre}_{field_name}_activo", 
                field_name,
                unique=True,
                postgresql_where=text("deleted_at IS NULL")
            )
            indexes.append(idx)
            
        return tuple(indexes)
