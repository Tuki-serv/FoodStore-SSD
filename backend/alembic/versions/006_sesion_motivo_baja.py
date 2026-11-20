"""motivo de cierre de sesión BAJA

Revision ID: 006
Revises: 005
Create Date: 2026-11-20 12:00:00

Amplía `ck_sesion_revoked_reason` con el motivo `BAJA`: la desactivación de un usuario por un ADMIN (C-23) cierra
todas sus sesiones abiertas con ese motivo, para distinguirlo del cierre pedido por el propio usuario (`LOGOUT_ALL`).
Escrita a mano (Alembic no detecta cambios en CHECK).
El downgrade no falla si hay filas `BAJA`: las pasa a `LOGOUT_ALL` (el cierre masivo más parecido) antes de restaurar
el CHECK anterior; el motivo exacto se pierde pero la sesión sigue cerrada.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '006'
down_revision: Union[str, Sequence[str], None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CHECK = 'ck_sesion_revoked_reason'


def upgrade() -> None:
    op.drop_constraint(_CHECK, 'sesion', type_='check')
    op.create_check_constraint(_CHECK, 'sesion', "revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO','BAJA')")


def downgrade() -> None:
    op.execute("UPDATE sesion SET revoked_reason = 'LOGOUT_ALL' WHERE revoked_reason = 'BAJA'")
    op.drop_constraint(_CHECK, 'sesion', type_='check')
    op.create_check_constraint(_CHECK, 'sesion', "revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO')")
