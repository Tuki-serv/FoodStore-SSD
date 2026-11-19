"""email de usuario normalizado

Revision ID: 005
Revises: 004
Create Date: 2026-11-19 12:00:00

Normaliza `usuario.email` (sin espacios al borde y en minúsculas, regla `normalizar_email`) y agrega el CHECK
`ck_usuario_email_normalizado` para que la base no acepte emails sin normalizar. Conserva `uq_usuario_email_activo`
(índice único parcial sobre `email`): con todos los emails normalizados, equivale a unicidad sin distinguir mayúsculas.
Antes de tocar datos, el upgrade verifica que ningún par de usuarios ACTIVOS quede con el mismo email normalizado; si lo
hay, aborta con un error que lista email e ids y no modifica nada (se resuelve a mano y se vuelve a migrar). Los usuarios
dados de baja se normalizan igual y no impiden la migración (el índice único es parcial). Escrita a mano.
El downgrade solo quita el CHECK: los emails no vuelven a su forma original (no se guardó).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005'
down_revision: Union[str, Sequence[str], None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COLISIONES_ACTIVAS = sa.text(
    "SELECT lower(btrim(email)) AS email, array_agg(id ORDER BY id) AS ids "
    "FROM usuario WHERE deleted_at IS NULL "
    "GROUP BY lower(btrim(email)) HAVING count(*) > 1 ORDER BY 1"
)


def upgrade() -> None:
    conn = op.get_bind()
    colisiones = conn.execute(_COLISIONES_ACTIVAS).all()
    if colisiones:
        detalle = "; ".join(f"{fila.email} (ids {', '.join(str(i) for i in fila.ids)})" for fila in colisiones)
        raise RuntimeError(
            "No se puede normalizar el email de usuario: hay usuarios activos que quedarían con el mismo email. "
            f"Dé de baja o corrija uno de cada par y vuelva a migrar: {detalle}"
        )
    op.execute("UPDATE usuario SET email = lower(btrim(email)) WHERE email <> lower(btrim(email))")
    op.create_check_constraint('ck_usuario_email_normalizado', 'usuario', 'email = lower(btrim(email))')


def downgrade() -> None:
    op.drop_constraint('ck_usuario_email_normalizado', 'usuario', type_='check')
