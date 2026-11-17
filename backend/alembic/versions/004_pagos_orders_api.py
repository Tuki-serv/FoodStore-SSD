"""pagos con Orders API

Revision ID: 004
Revises: 003
Create Date: 2026-11-16 12:00:00

Los ids de la Orders API son alfanuméricos (`ORD…`, `PAY…`): `pagos.mp_payment_id` pasa a texto (conserva su unicidad y
los valores numéricos existentes como texto), se agrega `pagos.mp_order_id` (texto, único, nullable) y se retira
`mp_merchant_order_id` (Orders no usa merchant orders). Escrita a mano: nombres de restricción explícitos.
El downgrade devuelve `mp_payment_id` a BIGINT (los ids no numéricos, `PAY…`, se pierden: quedan NULL), re-agrega
`mp_merchant_order_id` vacía y elimina `mp_order_id`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004'
down_revision: Union[str, Sequence[str], None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pagos', sa.Column('mp_order_id', sa.String(length=64), nullable=True))
    op.create_unique_constraint('uq_pagos_mp_order_id', 'pagos', ['mp_order_id'])
    op.alter_column(
        'pagos', 'mp_payment_id',
        existing_type=sa.BigInteger(), type_=sa.String(length=64), existing_nullable=True,
        postgresql_using='mp_payment_id::text',
    )
    op.drop_column('pagos', 'mp_merchant_order_id')


def downgrade() -> None:
    op.add_column('pagos', sa.Column('mp_merchant_order_id', sa.BigInteger(), nullable=True))
    op.alter_column(
        'pagos', 'mp_payment_id',
        existing_type=sa.String(length=64), type_=sa.BigInteger(), existing_nullable=True,
        postgresql_using="CASE WHEN mp_payment_id ~ '^[0-9]+$' THEN mp_payment_id::bigint END",
    )
    op.drop_constraint('uq_pagos_mp_order_id', 'pagos', type_='unique')
    op.drop_column('pagos', 'mp_order_id')
