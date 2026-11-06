from sqlalchemy import text
from app.core.database import engine

def nuke_database():
    with engine.connect() as conn:
        conn.execute(text("""
            DROP TABLE IF EXISTS
                historial_estado_pedido,
                detalle_pedido,
                pagos,
                pedidos,
                forma_pago,
                estado_pedido,
                producto_ingrediente,
                producto_categoria,
                productos,
                ingredientes,
                categorias,
                unidadmedida,
                unidades_medida,
                refresh_token,
                direccion_entrega,
                usuario_rol,
                usuario,
                rol
            CASCADE;
        """))
        conn.commit()
    print("[OK] Tuki-Base de datos reseteada.")

if __name__ == "__main__":
    nuke_database()
