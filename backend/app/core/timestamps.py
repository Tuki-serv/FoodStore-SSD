"""Definición compartida de fechas: todo instante es UTC con zona (`TIMESTAMPTZ`)."""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime
from sqlmodel import Field


def utc_now() -> datetime:
    """Instante actual en UTC con zona (`tzinfo=timezone.utc`)."""
    return datetime.now(timezone.utc)


def aware_datetime_field(*, default_now: bool = False, nullable: bool = False) -> Any:
    """`Field` de SQLModel para una columna `TIMESTAMPTZ`.

    - `default_now=True`: se completa con `utc_now()` al crear el registro (columna NOT NULL).
    - `nullable=True`: opcional, `None` por defecto (la anotación del campo debe ser `Optional`).
    - sin flags: obligatorio, lo informa quien crea el registro.
    """
    sa_type = DateTime(timezone=True)
    if default_now:
        return Field(default_factory=utc_now, sa_type=sa_type)
    if nullable:
        return Field(default=None, sa_type=sa_type)
    return Field(sa_type=sa_type)
