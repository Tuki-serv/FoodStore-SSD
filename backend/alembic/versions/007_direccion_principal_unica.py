"""una sola dirección principal activa por usuario

Revision ID: 007
Revises: 006
Create Date: 2026-11-21 12:00:00

Garantiza en la base la regla RN-DI-01 (a lo sumo una dirección principal por usuario) con un índice único parcial
`uq_direccion_principal_activa` sobre `direccion_entrega (usuario_id) WHERE es_principal AND deleted_at IS NULL`.
Las direcciones dadas de baja no cuentan.

Antes de crear el índice sanea los datos: si un usuario tiene varias principales activas deja como principal solo la de
`updated_at` más reciente (desempate: `id` mayor) y desmarca las demás (`es_principal = false`); no borra ninguna dirección.
Escrita a mano (el saneamiento es DML).
El downgrade solo elimina el índice: las direcciones y sus datos se conservan; las que se desmarcaron no se vuelven a marcar.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '007'
down_revision: Union[str, Sequence[str], None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDICE = 'uq_direccion_principal_activa'


def upgrade() -> None:
    # Una sola principal activa por usuario: se queda la más reciente (updated_at DESC, id DESC).
    op.execute(
        """
        UPDATE direccion_entrega
           SET es_principal = false
         WHERE id IN (
               SELECT id
                 FROM (
                       SELECT id,
                              ROW_NUMBER() OVER (
                                  PARTITION BY usuario_id
                                  ORDER BY updated_at DESC, id DESC
                              ) AS posicion
                         FROM direccion_entrega
                        WHERE es_principal AND deleted_at IS NULL
                      ) AS principales
                WHERE posicion > 1
         )
        """
    )
    op.execute(
        f"CREATE UNIQUE INDEX {_INDICE} ON direccion_entrega (usuario_id) WHERE es_principal AND deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX {_INDICE}")
