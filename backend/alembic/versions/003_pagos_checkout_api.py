"""pagos con Checkout API

Revision ID: 003
Revises: 002
Create Date: 2026-11-11 12:00:00

`pagos.external_reference` pasa a UUID obligatorio y único (una referencia por intento de pago, DT-26) y se retiran
`mp_preference_id` y `mp_init_point` (Checkout Pro). Revisada a mano: las filas existentes reciben un UUID nuevo
(ninguna tiene hoy un UUID: eran ids de pedido o NULL) y la restricción de unicidad lleva nombre explícito.
El downgrade devuelve el esquema de la 002 pero no restaura las referencias numéricas ni las preferencias.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '003'
down_revision: Union[str, Sequence[str], None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # gen_random_uuid() es nativa desde PostgreSQL 13 (el proyecto usa 15).
    op.execute("UPDATE pagos SET external_reference = gen_random_uuid()::text")
    op.alter_column(
        'pagos', 'external_reference',
        existing_type=sa.String(length=100), type_=sa.Uuid(), existing_nullable=True, nullable=False,
        postgresql_using='external_reference::uuid',
    )
    op.create_unique_constraint('uq_pagos_external_reference', 'pagos', ['external_reference'])
    op.drop_column('pagos', 'mp_preference_id')
    op.drop_column('pagos', 'mp_init_point')


def downgrade() -> None:
    op.add_column('pagos', sa.Column('mp_init_point', sa.String(length=500), nullable=True))
    op.add_column('pagos', sa.Column('mp_preference_id', sa.String(length=255), nullable=True))
    op.drop_constraint('uq_pagos_external_reference', 'pagos', type_='unique')
    op.alter_column(
        'pagos', 'external_reference',
        existing_type=sa.Uuid(), type_=sa.String(length=100), existing_nullable=False, nullable=True,
        postgresql_using='external_reference::text',
    )
