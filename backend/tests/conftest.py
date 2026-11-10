"""Fixtures globales: BD PostgreSQL real de tests (`foodstore_test`), aislamiento por test y helpers de auth."""
import os
from pathlib import Path

import pytest

_ENV_TEST = Path(__file__).resolve().parent / ".env.test"  # backend/tests/.env.test (no versionado)


def _abort_if_unsafe_environment() -> None:
    """Guardia temprana (antes de importar `app.*`): solo se corre contra `ENVIRONMENT=test` y una base `*_test`.

    `pytest-dotenv` ya cargó `backend/tests/.env.test` en `os.environ` (pytest.ini). Si no existe el archivo y las variables
    tampoco vienen del entorno del proceso (CI), se aborta con instrucciones.
    """
    from tests.support.db_guard import is_safe_test_database_url

    if not _ENV_TEST.exists() and "DATABASE_URL" not in os.environ:
        pytest.exit(
            "Falta backend/tests/.env.test: copiá backend/tests/.env.test.example y completá las credenciales",
            returncode=2,
        )
    if os.environ.get("ENVIRONMENT") != "test":
        pytest.exit("ENVIRONMENT debe ser 'test' para correr la suite (revisá backend/tests/.env.test).", returncode=2)
    if not is_safe_test_database_url(os.environ.get("DATABASE_URL", "")):
        pytest.exit(
            "DATABASE_URL no apunta a una base de tests: el nombre de la base debe terminar en '_test' "
            "(p. ej. foodstore_test). Se aborta para proteger los datos de desarrollo.",
            returncode=2,
        )


_abort_if_unsafe_environment()

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import build_engine, get_session  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.migrations import drop_all_tables, upgrade_to_head  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.usuarios.models import Usuario  # noqa: E402
from tests.support.db_admin import ensure_database_exists  # noqa: E402


# ===========================================================================
# 1. BASE DE DATOS Y ENGINE DE TEST (PostgreSQL real)
# ===========================================================================
@pytest.fixture(name="engine_test", scope="session")
def engine_test_fixture():
    """Engine sobre `foodstore_test`: crea la base si falta y la migra desde vacío (`alembic upgrade head`)."""
    ensure_database_exists(settings.DATABASE_URL)
    engine: Engine = build_engine(settings)
    try:
        with engine.begin() as conn:
            drop_all_tables(conn)
            upgrade_to_head(conn)
    except Exception as exc:
        engine.dispose()
        pytest.exit(f"Falló alembic upgrade head sobre foodstore_test: {exc}", returncode=2)
    yield engine
    engine.dispose()


# ===========================================================================
# 2. SESSION POR TEST (transacción externa + savepoint, rollback al terminar)
# ===========================================================================
@pytest.fixture(name="session", scope="function")
def session_fixture(engine_test: Engine):
    """Los `commit()`/`rollback()` del UnitOfWork operan sobre savepoints; nada persiste entre tests."""
    connection = engine_test.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# ===========================================================================
# 3. CLIENTE HTTP DE TEST
# ===========================================================================
@pytest.fixture(name="client", scope="function")
def client_fixture(session: Session):
    """TestClient de FastAPI con la sesión de test inyectada."""
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override

    # Resetear el rate limiter para evitar tests flaky (429 Too Many Requests)
    try:
        from app.core.rate_limit.rate_limit_middleware import RateLimitMiddleware
        RateLimitMiddleware.reset_all_limiters()
    except ImportError:
        pass

    _create_test_admin(session)

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(name="plain_client", scope="function")
def plain_client_fixture():
    """TestClient sin BD ni seed: para endpoints que no tocan la base (liveness, openapi, 404, CORS)."""
    try:
        from app.core.rate_limit.rate_limit_middleware import RateLimitMiddleware
        RateLimitMiddleware.reset_all_limiters()
    except ImportError:
        pass

    with TestClient(app) as client:
        yield client


def _create_test_admin(session: Session) -> None:
    # Usamos un admin fijo para los tests en base al que la app puede tener
    existing = session.exec(
        select(Usuario).where(Usuario.email == "admin@foodstore.com")
    ).first()
    if existing is not None:
        return

    admin = Usuario(
        email="admin@foodstore.com",
        password_hash=hash_password("admin123"),
        nombre="Admin",
        apellido="Test"
    )
    # Importante: Como en Food Store el RBAC lo manejamos con roles de muchos a muchos,
    # debemos asociar el rol ADMIN si hiciera falta. Pero si la app asume
    # roles por tabla relacional, lo creamos manualmente aquí.
    from app.modules.usuarios.models import Rol
    roles_necesarios = [
        {"codigo": "ADMIN",   "nombre": "Administrador",    "descripcion": "Acceso total sin restricciones"},
        {"codigo": "STOCK",   "nombre": "Gestor de Stock",   "descripcion": "Actualiza stock y disponible"},
        {"codigo": "PEDIDOS", "nombre": "Gestor de Pedidos", "descripcion": "Avanza estados CONFIRMADO->ENTREGADO"},
        {"codigo": "CLIENT",  "nombre": "Cliente",           "descripcion": "Opera solo sus propios datos"},
        {"codigo": "COCINA",  "nombre": "Cocina",            "descripcion": "Recibe pedidos para preparar"},
    ]
    
    roles_db = {}
    for rol_data in roles_necesarios:
        rol = session.exec(select(Rol).where(Rol.codigo == rol_data["codigo"])).first()
        if not rol:
            rol = Rol(**rol_data)
            session.add(rol)
        roles_db[rol_data["codigo"]] = rol
    
    admin.roles.append(roles_db["ADMIN"])
    
    session.add(admin)
    session.commit()

    # Seed Estados
    from app.modules.estados_pedido.models import EstadoPedido
    estados = [
        {"codigo": "PENDIENTE", "descripcion": "Pendiente", "orden": 1, "es_terminal": False},
        {"codigo": "CONFIRMADO", "descripcion": "Confirmado", "orden": 2, "es_terminal": False},
        {"codigo": "EN_PREP", "descripcion": "En Preparacion", "orden": 3, "es_terminal": False},
        {"codigo": "ENTREGADO", "descripcion": "Entregado", "orden": 5, "es_terminal": True},
        {"codigo": "CANCELADO", "descripcion": "Cancelado", "orden": 99, "es_terminal": True},
    ]
    for st_data in estados:
        if not session.exec(select(EstadoPedido).where(EstadoPedido.codigo == st_data["codigo"])).first():
            session.add(EstadoPedido(**st_data))

    # Seed FormaPago
    from app.modules.formas_pago.models import FormaPago
    fp_data = {"codigo": "EFECTIVO", "descripcion": "Efectivo", "habilitado": True}
    if not session.exec(select(FormaPago).where(FormaPago.codigo == fp_data["codigo"])).first():
        session.add(FormaPago(**fp_data))
    
    session.commit()

# ===========================================================================
# 4. FIXTURES DE DATOS (Normal User, Payloads, etc)
# ===========================================================================
@pytest.fixture(name="normal_user_data")
def normal_user_data_fixture() -> dict:
    return {
        "email": "testuser@example.com",
        "password": "TestPass123!",
        "nombre": "Test",
        "apellido": "User",
        "celular": "123123"
    }

@pytest.fixture(name="normal_user")
def normal_user_fixture(client: TestClient, normal_user_data: dict) -> dict:
    response = client.post("/api/v1/auth/register", json=normal_user_data)
    assert response.status_code == 201
    return response.json()

# ===========================================================================
# 5. HELPERS DE AUTENTICACIÓN
# ===========================================================================
def _get_admin_auth_headers(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "admin@foodstore.com",
            "password": "admin123",
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"Login admin falló: {response.text}")
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def _get_user_auth_headers(client: TestClient, normal_user_data: dict) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": normal_user_data["email"],
            "password": normal_user_data["password"],
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"Login user falló: {response.text}")
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def presentar_refresh(client: TestClient, valor: str | None) -> None:
    """Deja en el cookie jar solo la cookie `refresh_token=valor` (con `path=/api/v1/auth`); `None` = sin cookie.

    Permite presentar un refresh concreto (p. ej. uno ya rotado) en lugar del último que recibió el cliente.
    """
    client.cookies.clear()
    if valor is not None:
        client.cookies.set("refresh_token", valor, domain="testserver.local", path="/api/v1/auth")


@pytest.fixture(name="admin_auth_headers")
def admin_auth_headers_fixture(client: TestClient) -> dict:
    return _get_admin_auth_headers(client)

@pytest.fixture(name="user_auth_headers")
def user_auth_headers_fixture(client: TestClient, normal_user: dict, normal_user_data: dict) -> dict:
    return _get_user_auth_headers(client, normal_user_data)

# Fixtures para Pedidos y Productos para ahorrar código en tests
@pytest.fixture(name="producto_db")
def producto_db_fixture(session: Session):
    from app.modules.productos.models import Producto
    producto = Producto(
        nombre="Hamb. Test",
        precio_base="1500.00",
        disponible=True,
        stock_cantidad=100
    )
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto

@pytest.fixture(name="direccion_db")
def direccion_db_fixture(session: Session, normal_user: dict):
    """Dirección real del usuario normal: evita ids hardcodeados (las secuencias de Postgres no se revierten)."""
    from app.modules.direcciones_entrega.models import DireccionEntrega

    direccion = DireccionEntrega(
        usuario_id=normal_user["id"], linea1="Calle Falsa 123", ciudad="Mendoza", es_principal=True
    )
    session.add(direccion)
    session.commit()
    session.refresh(direccion)
    return direccion


@pytest.fixture(name="unidad_medida_db")
def unidad_medida_db_fixture(session: Session):
    """Unidad de medida real para las FK de ingredientes (no asumir id=1)."""
    from app.modules.unidades_medida.models import UnidadMedida

    unidad = UnidadMedida(nombre="Gramo Test", simbolo="gt", tipo="peso")
    session.add(unidad)
    session.commit()
    session.refresh(unidad)
    return unidad


@pytest.fixture(name="pedido_db")
def pedido_db_fixture(session: Session, normal_user: dict, producto_db, direccion_db):
    from app.modules.pedidos.models import Pedido
    from app.modules.detalles_pedido.models import DetallePedido

    pedido = Pedido(
        usuario_id=normal_user["id"],
        estado_codigo="PENDIENTE",
        forma_pago_codigo="EFECTIVO",
        direccion_id=direccion_db.id,
        subtotal="1500.00",
        total="1500.00",
        costo_envio="0.00",
        descuento="0.00"
    )
    session.add(pedido)
    session.flush()

    detalle = DetallePedido(
        pedido_id=pedido.id,
        producto_id=producto_db.id,
        cantidad=1,
        precio_snapshot=producto_db.precio_base,
        subtotal_snapshot=producto_db.precio_base,
        nombre_snapshot=producto_db.nombre
    )
    session.add(detalle)
    session.commit()
    session.refresh(pedido)
    return pedido
