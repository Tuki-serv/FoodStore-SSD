"""sesiones y refresh rotado

Revision ID: 002
Revises: 001
Create Date: 2026-11-10 10:00:00

Tabla `sesion` nueva (vence a días fijos desde el login) y `refresh_token` ajustada: pierde `usuario_id` y
`expires_at` (salen de la sesión) y gana `sesion_id`. Revisada a mano (nombres explícitos, índice parcial, CHECKs).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '002'
down_revision: Union[str, Sequence[str], None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('sesion',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('usuario_id', sa.BigInteger(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_reason', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(), nullable=True),
    sa.CheckConstraint("revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO')", name='ck_sesion_revoked_reason'),
    sa.CheckConstraint('(revoked_at IS NULL) = (revoked_reason IS NULL)', name='ck_sesion_revocacion_consistente'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], name='fk_sesion_usuario_id_usuario'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sesion_usuario_id', 'sesion', ['usuario_id'], unique=False)

    # No hay sesión a la que asociar los refresh existentes: todos los usuarios vuelven a loguearse.
    # Es la única vez que se borran filas de refresh y ocurre acá, no en la operación normal.
    op.execute('DELETE FROM refresh_token')
    op.add_column('refresh_token', sa.Column('sesion_id', sa.Uuid(), nullable=False))
    op.create_index('ix_refresh_token_sesion_id', 'refresh_token', ['sesion_id'], unique=False)
    op.create_index('uq_refresh_token_sesion_activo', 'refresh_token', ['sesion_id'], unique=True, postgresql_where=sa.text('revoked_at IS NULL'))
    op.create_foreign_key('fk_refresh_token_sesion_id_sesion', 'refresh_token', 'sesion', ['sesion_id'], ['id'])
    op.drop_constraint('refresh_token_usuario_id_fkey', 'refresh_token', type_='foreignkey')
    op.drop_column('refresh_token', 'usuario_id')
    op.drop_column('refresh_token', 'expires_at')


def downgrade() -> None:
    op.execute('DELETE FROM refresh_token')
    op.add_column('refresh_token', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.add_column('refresh_token', sa.Column('usuario_id', sa.BigInteger(), nullable=False))
    op.create_foreign_key('refresh_token_usuario_id_fkey', 'refresh_token', 'usuario', ['usuario_id'], ['id'])
    op.drop_constraint('fk_refresh_token_sesion_id_sesion', 'refresh_token', type_='foreignkey')
    op.drop_index('uq_refresh_token_sesion_activo', table_name='refresh_token', postgresql_where=sa.text('revoked_at IS NULL'))
    op.drop_index('ix_refresh_token_sesion_id', table_name='refresh_token')
    op.drop_column('refresh_token', 'sesion_id')
    op.drop_index('ix_sesion_usuario_id', table_name='sesion')
    op.drop_table('sesion')
