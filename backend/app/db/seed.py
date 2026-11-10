"""
Seed principal. Ejecutar: python -m app.db.seed
Catálogos (roles, estados, formas de pago) → admin → datos de demostración. Idempotente: se puede correr N veces.
"""
from decimal import Decimal
from typing import Any, NamedTuple, TypeVar

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, select

from app.core.database import engine as app_engine
from app.core.security import hash_password
from app.db.migrations import SchemaNotReadyError, ensure_schema_ready
from app.db.models import import_all_models
from app.modules.usuarios.models import Usuario, Rol
from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import Ingrediente
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.unidades_medida.models import UnidadMedida
from app.modules.estados_pedido.models import EstadoPedido
from app.modules.formas_pago.models import FormaPago

ROLES: tuple[dict[str, object], ...] = (
    {"codigo": "ADMIN",   "nombre": "Administrador",     "descripcion": "Acceso total sin restricciones"},
    {"codigo": "STOCK",   "nombre": "Gestor de Stock",   "descripcion": "Actualiza stock y disponible"},
    {"codigo": "PEDIDOS", "nombre": "Gestor de Pedidos", "descripcion": "Avanza estados CONFIRMADO->ENTREGADO"},
    {"codigo": "CLIENT",  "nombre": "Cliente",           "descripcion": "Opera solo sus propios datos"},
)

ESTADOS_PEDIDO: tuple[dict[str, object], ...] = (
    {"codigo": "PENDIENTE",  "descripcion": "Pedido ingresado y pendiente de confirmación", "orden": 1, "es_terminal": False},
    {"codigo": "CONFIRMADO", "descripcion": "Pedido confirmado por el comercio",            "orden": 2, "es_terminal": False},
    {"codigo": "EN_PREP",    "descripcion": "Pedido en preparación",                        "orden": 3, "es_terminal": False},
    {"codigo": "EN_CAMINO",  "descripcion": "Pedido en camino al cliente",                  "orden": 4, "es_terminal": False},
    {"codigo": "ENTREGADO",  "descripcion": "Pedido entregado exitosamente",                "orden": 5, "es_terminal": True},
    {"codigo": "CANCELADO",  "descripcion": "Pedido cancelado",                             "orden": 6, "es_terminal": True},
)

FORMAS_PAGO: tuple[dict[str, object], ...] = (
    {"codigo": "MERCADOPAGO",   "descripcion": "Mercado Pago",           "habilitado": True},
    {"codigo": "EFECTIVO",      "descripcion": "Pago en efectivo",       "habilitado": True},
    {"codigo": "TRANSFERENCIA", "descripcion": "Transferencia bancaria", "habilitado": True},
)

# Credencial de desarrollo fijada por la spec (documentada en la KB y en backend/README.md). No es un secreto de
# servicio: es pública por definición y se cambia en producción. En la base solo se guarda su hash bcrypt.
ADMIN_PASSWORD_DESARROLLO = "Admin1234!"
ADMIN_EMAIL = "admin@foodstore.com"

ModeloT = TypeVar("ModeloT", bound=SQLModel)


# ══════════════════════════════════════════════════════════════════════════════
# Catálogos (spec): roles, estados de pedido y formas de pago
# ══════════════════════════════════════════════════════════════════════════════


def _reconciliar_catalogo(
    session: Session,
    modelo: type[SQLModel],
    registros: tuple[dict[str, object], ...],
    solo_al_insertar: frozenset[str] = frozenset(),
) -> None:
    """Lleva cada registro del catálogo a su valor de la spec, buscándolo por su PK semántica `codigo`.

    Si falta se inserta; si existe se asignan solo los campos que difieren (así no se emite UPDATE sin cambios).
    Los campos de `solo_al_insertar` se fijan únicamente al crear la fila: en una existente son decisión operativa.
    """
    for datos in registros:
        existente = session.get(modelo, datos["codigo"])
        if existente is None:
            print(f"  Creando {modelo.__tablename__}: {datos['codigo']}")
            session.add(modelo(**datos))
            continue
        for campo, valor in datos.items():
            if campo not in solo_al_insertar and getattr(existente, campo) != valor:
                setattr(existente, campo, valor)
    session.flush()


def _deshabilitar_formas_de_pago_fuera_del_catalogo(session: Session) -> None:
    """Una forma de pago que ya no es del catálogo (p. ej. `TARJETA`) se deshabilita, no se borra: hay pedidos que la usan."""
    codigos = {datos["codigo"] for datos in FORMAS_PAGO}
    for forma in session.exec(select(FormaPago).where(FormaPago.codigo.not_in(codigos))).all():
        if forma.habilitado:
            forma.habilitado = False
    session.flush()


def seed_catalogos(session: Session) -> None:
    """Siembra roles, estados de pedido y formas de pago. Solo `add`/`flush`: la transacción la maneja el llamador."""
    _reconciliar_catalogo(session, Rol, ROLES)
    _reconciliar_catalogo(session, EstadoPedido, ESTADOS_PEDIDO)
    _reconciliar_catalogo(session, FormaPago, FORMAS_PAGO, solo_al_insertar=frozenset({"habilitado"}))
    _deshabilitar_formas_de_pago_fuera_del_catalogo(session)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers de alta idempotente
# ══════════════════════════════════════════════════════════════════════════════


def _obtener_o_crear(
    session: Session, modelo: type[ModeloT], columna: Any, valor: object, **datos: object
) -> tuple[ModeloT, bool]:
    """Busca por clave natural (`columna == valor`) incluyendo las filas dadas de baja; si no existe la crea.

    Devuelve `(fila, creada)`. Una fila existente nunca se modifica: no se resucita lo dado de baja ni se pisa lo editado.
    """
    existente = session.exec(select(modelo).where(columna == valor)).first()
    if existente is not None:
        return existente, False
    nueva = modelo(**datos)
    session.add(nueva)
    session.flush()
    return nueva, True


def _crear_usuario_si_falta(
    session: Session, email: str, nombre: str, apellido: str, celular: str, password: str, rol_codigo: str
) -> None:
    """Crea el usuario con su rol si no existe ningún usuario con ese email (activo o dado de baja)."""
    usuario, creado = _obtener_o_crear(
        session, Usuario, Usuario.email, email,
        nombre=nombre, apellido=apellido, email=email, celular=celular, password_hash=hash_password(password),
    )
    if not creado:
        print(f"  ✅ Usuario {email} ya existe, se omite.")
        return
    usuario.roles.append(session.get(Rol, rol_codigo))
    session.flush()
    print(f"  ✅ Usuario creado ({email})")


# ══════════════════════════════════════════════════════════════════════════════
# Admin inicial
# ══════════════════════════════════════════════════════════════════════════════


def seed_admin(session: Session) -> None:
    """Crea el admin inicial si no existe; nunca modifica uno existente (no se pisa la contraseña de nadie)."""
    _crear_usuario_si_falta(session, ADMIN_EMAIL, "Super", "Admin", "2611234567", ADMIN_PASSWORD_DESARROLLO, "ADMIN")


# ══════════════════════════════════════════════════════════════════════════════
# Datos de demostración (D8)
# ══════════════════════════════════════════════════════════════════════════════

USUARIOS_DEMO: tuple[tuple[str, str, str, str, str, str], ...] = (  # (email, nombre, apellido, celular, password, rol)
    ("cliente@foodstore.com", "Cliente", "Prueba",  "2610000000", "cliente123", "CLIENT"),
    ("pedidos@foodstore.com", "Gestor",  "Pedidos", "2610000002", "pedidos123", "PEDIDOS"),
    ("stock@foodstore.com",   "Gestor",  "Stock",   "2610000003", "stock123",   "STOCK"),
)

UNIDADES_DEMO: tuple[tuple[str, str, str], ...] = (  # (nombre, simbolo, tipo)
    ("Kilogramo", "kg", "peso"), ("Gramo", "g", "peso"), ("Litro", "L", "volumen"), ("Mililitro", "mL", "volumen"),
    ("Unidad", "u", "unidad"), ("Docena", "doc", "unidad"), ("Metro cuadrado", "m²", "superficie"),
)

_IMG = "https://via.placeholder.com/400x300?text="

# (nombre, descripcion, imagen, nombre de la categoría padre); los padres van antes que sus hijas.
CATEGORIAS_DEMO: tuple[tuple[str, str, str, str | None], ...] = (
    ("Hamburguesas", "Nuestras burgers artesanales", _IMG + "Hamburguesas", None),
    ("Bebidas",      "Frías y calientes",            _IMG + "Bebidas",      None),
    ("Postres",      "Para cerrar con dulzura",      _IMG + "Postres",      None),
    ("Veganas",      "100% plant-based",             _IMG + "Veganas",      "Hamburguesas"),
    ("Sin TACC",     "Libres de gluten",             _IMG + "SinTACC",      "Hamburguesas"),
    ("Gaseosas",     "Bebidas con gas",              _IMG + "Gaseosas",     "Bebidas"),
)

INGREDIENTES_DEMO: tuple[tuple[str, str, bool], ...] = (  # (nombre, descripcion, es_alergeno)
    ("Pan Brioche", "Pan suave y esponjoso", True), ("Pan Sin TACC", "Pan libre de gluten", False),
    ("Carne Vacuna 250g", "Medallón de res premium", False), ("Medallón Vegano", "Base de legumbres y avena", False),
    ("Queso Cheddar", "Cheddar fundido americano", True), ("Queso Vegano", "Alternativa plant-based", False),
    ("Lechuga", "Lechuga fresca", False), ("Tomate", "Tomate perita en rodajas", False),
    ("Cebolla Caramelizada", "Cebolla dulce", False), ("Bacon Crocante", "Panceta ahumada", False),
    ("Salsa BBQ", "Salsa ahumada casera", False), ("Mayonesa", "Mayo artesanal", True),
)


class ProductoDemo(NamedTuple):
    nombre: str
    descripcion: str
    precio: str
    stock: int
    imagen: str | None
    categorias: tuple[tuple[str, bool], ...]  # (nombre de categoría, es_principal)
    ingredientes: tuple[tuple[str, bool], ...]  # (nombre de ingrediente, es_removible)


PRODUCTOS_DEMO: tuple[ProductoDemo, ...] = (
    ProductoDemo(
        "Hamburguesa Clásica", "La de siempre, perfecta de siempre.", "1500.00", 50, "Clasica",
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Carne Vacuna 250g", False), ("Queso Cheddar", True), ("Lechuga", True),
         ("Tomate", True), ("Mayonesa", True)),
    ),
    ProductoDemo(
        "Burger BBQ Bacon", "Ahumada, crocante y con todo.", "1900.00", 30, "BBQ",
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Carne Vacuna 250g", False), ("Bacon Crocante", True), ("Queso Cheddar", True),
         ("Cebolla Caramelizada", True), ("Salsa BBQ", True)),
    ),
    ProductoDemo(
        "Burger Vegana", "Plant-based sin culpa.", "1800.00", 25, "Vegana",
        (("Hamburguesas", True), ("Veganas", False)),
        (("Pan Brioche", False), ("Medallón Vegano", False), ("Queso Vegano", True), ("Lechuga", True),
         ("Tomate", True)),
    ),
    ProductoDemo(
        "Burger Sin TACC", "Para celíacos, sin sacrificar sabor.", "1700.00", 20, "SinTACC",
        (("Hamburguesas", True), ("Sin TACC", False)),
        (("Pan Sin TACC", False), ("Carne Vacuna 250g", False), ("Queso Cheddar", True), ("Lechuga", True),
         ("Tomate", True)),
    ),
    ProductoDemo(
        "Coca-Cola 500ml", "La clásica bien fría.", "800.00", 100, None,
        (("Bebidas", True), ("Gaseosas", False)), (),
    ),
    ProductoDemo(
        "Limonada Natural", "Exprimida al momento.", "700.00", 60, None,
        (("Bebidas", True),), (),
    ),
)


def seed_demo(session: Session) -> None:
    """Siembra usuarios de prueba y el catálogo de demostración, cada registro buscado por su clave natural.

    Las relaciones (rol, categoría padre, producto↔categoría, producto↔ingrediente) se crean solo junto con la
    entidad dueña: nunca se agregan a entidades preexistentes.
    """
    for email, nombre, apellido, celular, password, rol in USUARIOS_DEMO:
        _crear_usuario_si_falta(session, email, nombre, apellido, celular, password, rol)

    for nombre, simbolo, tipo in UNIDADES_DEMO:
        _obtener_o_crear(session, UnidadMedida, UnidadMedida.simbolo, simbolo, nombre=nombre, simbolo=simbolo, tipo=tipo)
    unidad_u = session.exec(select(UnidadMedida).where(UnidadMedida.simbolo == "u")).first()

    categorias: dict[str, Categoria] = {}
    for nombre, descripcion, imagen, padre in CATEGORIAS_DEMO:
        categorias[nombre], _ = _obtener_o_crear(
            session, Categoria, Categoria.nombre, nombre,
            nombre=nombre, descripcion=descripcion, imagen_url=imagen,
            parent_id=categorias[padre].id if padre else None,
        )

    ingredientes: dict[str, Ingrediente] = {}
    for nombre, descripcion, es_alergeno in INGREDIENTES_DEMO:
        ingredientes[nombre], _ = _obtener_o_crear(
            session, Ingrediente, Ingrediente.nombre, nombre,
            nombre=nombre, descripcion=descripcion, es_alergeno=es_alergeno, unidad_medida_id=unidad_u.id,
        )

    for prod in PRODUCTOS_DEMO:
        datos: dict[str, object] = {
            "nombre": prod.nombre, "descripcion": prod.descripcion,
            "precio_base": Decimal(prod.precio), "stock_cantidad": prod.stock,
        }
        if prod.imagen:
            datos["imagenes_url"] = [_IMG + prod.imagen]
        producto, creado = _obtener_o_crear(session, Producto, Producto.nombre, prod.nombre, **datos)
        if not creado:
            continue
        for categoria, es_principal in prod.categorias:
            session.add(ProductoCategoria(
                producto_id=producto.id, categoria_id=categorias[categoria].id, es_principal=es_principal))
        for ingrediente, es_removible in prod.ingredientes:
            session.add(ProductoIngrediente(
                producto_id=producto.id, ingrediente_id=ingredientes[ingrediente].id, cantidad=Decimal("1.0"),
                unidad_medida_id=unidad_u.id, es_removible=es_removible))
        session.flush()


def seed(engine: Engine | None = None) -> None:
    """Siembra los datos iniciales. Exige el esquema migrado (`alembic upgrade head`); nunca crea tablas."""
    engine = engine or app_engine
    import_all_models()
    with engine.connect() as conn:
        ensure_schema_ready(conn)

    print("--- INICIANDO SEED ---")
    # Una sola transacción (D7): si algo falla, la base queda como estaba antes de la corrida.
    with Session(engine) as session, session.begin():
        seed_catalogos(session)
        seed_admin(session)
        seed_demo(session)

    print("--- SEED FINALIZADO ✅ ---")
    print("   • 4 roles + usuarios de prueba")
    print("   • 6 estados de pedido + 3 formas de pago")
    print("   • 6 categorías + 12 ingredientes + 7 unidades de medida + 6 productos")
    print("\n--- CUENTAS DE PRUEBA ---")
    print(f"   👤 Admin:   {ADMIN_EMAIL}   / {ADMIN_PASSWORD_DESARROLLO}")
    print("   📦 Pedidos: pedidos@foodstore.com / pedidos123")
    print("   📊 Stock:   stock@foodstore.com   / stock123")
    print("   🍔 Cliente: cliente@foodstore.com / cliente123")
    print("-------------------------")


if __name__ == "__main__":
    try:
        seed()
    except SchemaNotReadyError as exc:
        print(f"[ERROR] {exc}")
        raise SystemExit(1)
