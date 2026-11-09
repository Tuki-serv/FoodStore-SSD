"""esquema inicial

Revision ID: 001
Revises:
Create Date: 2026-11-09 16:44:21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('categorias',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('nombre', sa.String(length=100), nullable=False),
    sa.Column('descripcion', sa.String(), nullable=True),
    sa.Column('imagen_url', sa.String(), nullable=True),
    sa.Column('imagen_public_id', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['parent_id'], ['categorias.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_categorias_nombre_activo', 'categorias', ['nombre'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('estado_pedido',
    sa.Column('codigo', sa.String(length=20), nullable=False),
    sa.Column('descripcion', sa.String(length=255), nullable=False),
    sa.Column('orden', sa.Integer(), nullable=False),
    sa.Column('es_terminal', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('codigo')
    )
    op.create_table('forma_pago',
    sa.Column('codigo', sa.String(length=20), nullable=False),
    sa.Column('descripcion', sa.String(length=80), nullable=False),
    sa.Column('habilitado', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('codigo')
    )
    op.create_table('rol',
    sa.Column('codigo', sa.String(length=20), nullable=False),
    sa.Column('nombre', sa.String(length=50), nullable=False),
    sa.Column('descripcion', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('codigo')
    )
    op.create_index(op.f('ix_rol_nombre'), 'rol', ['nombre'], unique=True)
    op.create_table('unidades_medida',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=50), nullable=False),
    sa.Column('simbolo', sa.String(length=10), nullable=False),
    sa.Column('tipo', sa.String(length=20), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_unidades_medida_nombre_activo', 'unidades_medida', ['nombre'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('uq_unidades_medida_simbolo_activo', 'unidades_medida', ['simbolo'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('usuario',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('nombre', sa.String(length=80), nullable=False),
    sa.Column('apellido', sa.String(length=80), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('celular', sa.String(length=20), nullable=True),
    sa.Column('password_hash', sa.CHAR(length=60), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_usuario_email_activo', 'usuario', ['email'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('direccion_entrega',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.BigInteger(), nullable=False),
    sa.Column('alias', sa.String(length=50), nullable=True),
    sa.Column('linea1', sa.Text(), nullable=False),
    sa.Column('linea2', sa.String(), nullable=True),
    sa.Column('ciudad', sa.String(length=100), nullable=False),
    sa.Column('provincia', sa.String(length=100), nullable=True),
    sa.Column('codigo_postal', sa.String(length=10), nullable=True),
    sa.Column('latitud', sa.Float(), nullable=True),
    sa.Column('longitud', sa.Float(), nullable=True),
    sa.Column('es_principal', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('ingredientes',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(), nullable=False),
    sa.Column('es_alergeno', sa.Boolean(), nullable=False),
    sa.Column('descripcion', sa.String(), nullable=True),
    sa.Column('imagen_url', sa.String(), nullable=True),
    sa.Column('imagen_public_id', sa.String(), nullable=True),
    sa.Column('unidad_medida_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['unidad_medida_id'], ['unidades_medida.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_ingredientes_nombre_activo', 'ingredientes', ['nombre'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('productos',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('unidad_venta_id', sa.Integer(), nullable=True),
    sa.Column('nombre', sa.String(length=150), nullable=False),
    sa.Column('descripcion', sa.String(), nullable=True),
    sa.Column('precio_base', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('imagenes_url', postgresql.ARRAY(sa.String()), nullable=True),
    sa.Column('imagenes_public_id', postgresql.ARRAY(sa.String()), nullable=True),
    sa.Column('stock_cantidad', sa.Integer(), nullable=False),
    sa.Column('disponible', sa.Boolean(), nullable=False),
    sa.CheckConstraint('precio_base >= 0', name='ck_producto_precio_no_negativo'),
    sa.CheckConstraint('stock_cantidad >= 0', name='ck_producto_stock_no_negativo'),
    sa.ForeignKeyConstraint(['unidad_venta_id'], ['unidades_medida.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_productos_nombre_activo', 'productos', ['nombre'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('refresh_token',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.BigInteger(), nullable=False),
    sa.Column('token_hash', sa.CHAR(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id']),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_table('usuario_rol',
    sa.Column('usuario_id', sa.BigInteger(), nullable=False),
    sa.Column('rol_codigo', sa.String(), nullable=False),
    sa.Column('asignado_por_id', sa.BigInteger(), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['asignado_por_id'], ['usuario.id']),
    sa.ForeignKeyConstraint(['rol_codigo'], ['rol.codigo']),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id']),
    sa.PrimaryKeyConstraint('usuario_id', 'rol_codigo')
    )
    op.create_table('pedidos',
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.BigInteger(), nullable=False),
    sa.Column('direccion_id', sa.Integer(), nullable=True),
    sa.Column('estado_codigo', sa.String(length=20), nullable=False),
    sa.Column('forma_pago_codigo', sa.String(length=20), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('descuento', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('costo_envio', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('notas', sa.Text(), nullable=True),
    sa.CheckConstraint('costo_envio >= 0', name='chk_pedido_costo_envio_positivo'),
    sa.CheckConstraint('descuento >= 0', name='chk_pedido_descuento_positivo'),
    sa.CheckConstraint('subtotal >= 0', name='chk_pedido_subtotal_positivo'),
    sa.CheckConstraint('total >= 0', name='chk_pedido_total_positivo'),
    sa.ForeignKeyConstraint(['direccion_id'], ['direccion_entrega.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['estado_codigo'], ['estado_pedido.codigo']),
    sa.ForeignKeyConstraint(['forma_pago_codigo'], ['forma_pago.codigo']),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('producto_categoria',
    sa.Column('producto_id', sa.Integer(), nullable=False),
    sa.Column('categoria_id', sa.Integer(), nullable=False),
    sa.Column('es_principal', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['producto_id'], ['productos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('producto_id', 'categoria_id')
    )
    op.create_table('producto_ingrediente',
    sa.Column('producto_id', sa.Integer(), nullable=False),
    sa.Column('ingrediente_id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.Numeric(precision=10, scale=3), nullable=False),
    sa.Column('unidad_medida_id', sa.Integer(), nullable=False),
    sa.Column('es_removible', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('cantidad > 0', name='ck_producto_ingrediente_cantidad_positiva'),
    sa.ForeignKeyConstraint(['ingrediente_id'], ['ingredientes.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['producto_id'], ['productos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['unidad_medida_id'], ['unidades_medida.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('producto_id', 'ingrediente_id')
    )
    op.create_table('detalle_pedido',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pedido_id', sa.Integer(), nullable=False),
    sa.Column('producto_id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.SmallInteger(), nullable=False),
    sa.Column('nombre_snapshot', sa.String(length=200), nullable=False),
    sa.Column('precio_snapshot', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('subtotal_snapshot', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('personalizacion', postgresql.ARRAY(sa.Integer()), nullable=True),
    sa.Column('personalizacion_snapshot', postgresql.ARRAY(sa.String()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('cantidad >= 1', name='chk_detalle_cantidad_positiva'),
    sa.CheckConstraint('precio_snapshot >= 0', name='chk_detalle_precio_positivo'),
    sa.CheckConstraint('subtotal_snapshot >= 0', name='chk_detalle_subtotal_positivo'),
    sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['producto_id'], ['productos.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('historial_estado_pedido',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pedido_id', sa.Integer(), nullable=False),
    sa.Column('estado_desde', sa.String(), nullable=True),
    sa.Column('estado_hacia', sa.String(), nullable=False),
    sa.Column('usuario_id', sa.BigInteger(), nullable=True),
    sa.Column('motivo', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['estado_desde'], ['estado_pedido.codigo']),
    sa.ForeignKeyConstraint(['estado_hacia'], ['estado_pedido.codigo']),
    sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('pagos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pedido_id', sa.Integer(), nullable=False),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('mp_preference_id', sa.String(length=255), nullable=True),
    sa.Column('mp_init_point', sa.String(length=500), nullable=True),
    sa.Column('mp_payment_id', sa.BigInteger(), nullable=True),
    sa.Column('mp_merchant_order_id', sa.BigInteger(), nullable=True),
    sa.Column('mp_status', sa.String(length=30), nullable=True),
    sa.Column('mp_status_detail', sa.String(length=100), nullable=True),
    sa.Column('external_reference', sa.String(length=100), nullable=True),
    sa.Column('idempotency_key', sa.String(length=100), nullable=False),
    sa.Column('transaction_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('payment_method_id', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id']),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('idempotency_key'),
    sa.UniqueConstraint('mp_payment_id')
    )


def downgrade() -> None:
    op.drop_table('pagos')
    op.drop_table('historial_estado_pedido')
    op.drop_table('detalle_pedido')
    op.drop_table('producto_ingrediente')
    op.drop_table('producto_categoria')
    op.drop_table('pedidos')
    op.drop_table('usuario_rol')
    op.drop_table('refresh_token')
    op.drop_index('uq_productos_nombre_activo', table_name='productos', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('productos')
    op.drop_index('uq_ingredientes_nombre_activo', table_name='ingredientes', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('ingredientes')
    op.drop_table('direccion_entrega')
    op.drop_index('uq_usuario_email_activo', table_name='usuario', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('usuario')
    op.drop_index('uq_unidades_medida_simbolo_activo', table_name='unidades_medida', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('uq_unidades_medida_nombre_activo', table_name='unidades_medida', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('unidades_medida')
    op.drop_index(op.f('ix_rol_nombre'), table_name='rol')
    op.drop_table('rol')
    op.drop_table('forma_pago')
    op.drop_table('estado_pedido')
    op.drop_index('uq_categorias_nombre_activo', table_name='categorias', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('categorias')
