"""
Seed principal. Ejecutar: python -m app.db.seed
Catálogos (roles, estados, formas de pago) → admin → datos de demostración. Idempotente: se puede correr N veces.
"""
import argparse
from collections.abc import Sequence
from decimal import Decimal
from typing import Any, NamedTuple, TypeVar

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, select

from app.core.database import engine as app_engine
from app.core.security import hash_password
from app.db.migrations import SchemaNotReadyError, ensure_schema_ready
from app.core.timestamps import utc_now
from app.db.models import import_all_models
from app.db.ventas_demo import ElencoVentas, sembrar_ventas
from app.modules.direcciones.models import DireccionEntrega
from app.modules.usuarios.models import Usuario, Rol
from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import Ingrediente
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.unidades_medida.models import UnidadMedida
from app.modules.pedidos.models import EstadoPedido
from app.modules.pagos.models import FormaPago

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
    session: Session, email: str, nombre: str, apellido: str, celular: str, password_hash: str, rol_codigo: str
) -> Usuario | None:
    """Crea el usuario con su rol si no existe ningún usuario con ese email (activo o dado de baja).

    Devuelve el usuario creado, o `None` si ya existía. Recibe el hash ya calculado: bcrypt (cost >= 12) es lento y
    quien llama lo calcula una sola vez cuando varios usuarios comparten contraseña.
    """
    usuario, creado = _obtener_o_crear(
        session, Usuario, Usuario.email, email,
        nombre=nombre, apellido=apellido, email=email, celular=celular, password_hash=password_hash,
    )
    if not creado:
        print(f"  [OK] Usuario {email} ya existe, se omite.")
        return None
    usuario.roles.append(session.get(Rol, rol_codigo))
    session.flush()
    print(f"  [OK] Usuario creado ({email})")
    return usuario


# ══════════════════════════════════════════════════════════════════════════════
# Admin inicial
# ══════════════════════════════════════════════════════════════════════════════


def seed_admin(session: Session) -> None:
    """Crea el admin inicial si no existe; nunca modifica uno existente (no se pisa la contraseña de nadie)."""
    _crear_usuario_si_falta(
        session, ADMIN_EMAIL, "Super", "Admin", "2611234567", hash_password(ADMIN_PASSWORD_DESARROLLO), "ADMIN")


# ══════════════════════════════════════════════════════════════════════════════
# Datos de demostración (D8)
# ══════════════════════════════════════════════════════════════════════════════

USUARIOS_DEMO: tuple[tuple[str, str, str, str, str, str], ...] = (  # (email, nombre, apellido, celular, password, rol)
    ("cliente@foodstore.com", "Cliente", "Prueba",  "2610000000", "cliente123", "CLIENT"),
    ("pedidos@foodstore.com", "Gestor",  "Pedidos", "2610000002", "pedidos123", "PEDIDOS"),
    ("stock@foodstore.com",   "Gestor",  "Stock",   "2610000003", "stock123",   "STOCK"),
)

PASSWORD_CLIENTES_DEMO = "cliente123"
CLIENTE_BASE_EMAIL = "cliente@foodstore.com"


class ClienteEjemplo(NamedTuple):
    email: str
    nombre: str
    apellido: str
    celular: str
    direccion: str  # línea 1 de la dirección principal
    ciudad: str
    codigo_postal: str


# 16 clientes de ejemplo (rol CLIENT, contraseña compartida de desarrollo) con una dirección principal en Mendoza. Van
# aparte de USUARIOS_DEMO (una cuenta por rol): son el elenco de las ventas de demostración.
CLIENTES_DEMO: tuple[ClienteEjemplo, ...] = (
    ClienteEjemplo("sofia.fernandez@demo.foodstore.com", "Sofía", "Fernández", "2615100001", "Av. San Martín 1250", "Ciudad de Mendoza", "5500"),
    ClienteEjemplo("mateo.gomez@demo.foodstore.com", "Mateo", "Gómez", "2615100002", "Calle Rivadavia 480", "Ciudad de Mendoza", "5500"),
    ClienteEjemplo("valentina.diaz@demo.foodstore.com", "Valentina", "Díaz", "2615100003", "Belgrano 322", "Godoy Cruz", "5501"),
    ClienteEjemplo("santiago.lopez@demo.foodstore.com", "Santiago", "López", "2615100004", "Av. San Martín 3400", "Godoy Cruz", "5501"),
    ClienteEjemplo("camila.rodriguez@demo.foodstore.com", "Camila", "Rodríguez", "2615100005", "Mitre 915", "Guaymallén", "5521"),
    ClienteEjemplo("lucas.martinez@demo.foodstore.com", "Lucas", "Martínez", "2615100006", "Bandera de los Andes 2100", "Guaymallén", "5521"),
    ClienteEjemplo("martina.perez@demo.foodstore.com", "Martina", "Pérez", "2615100007", "Av. Libertador 760", "Las Heras", "5539"),
    ClienteEjemplo("joaquin.sanchez@demo.foodstore.com", "Joaquín", "Sánchez", "2615100008", "San Miguel 245", "Las Heras", "5539"),
    ClienteEjemplo("lucia.romero@demo.foodstore.com", "Lucía", "Romero", "2615100009", "Ozamis 1130", "Maipú", "5515"),
    ClienteEjemplo("tomas.alvarez@demo.foodstore.com", "Tomás", "Álvarez", "2615100010", "Pescara 540", "Maipú", "5515"),
    ClienteEjemplo("julieta.torres@demo.foodstore.com", "Julieta", "Torres", "2615100011", "Ruta 15 Km 4", "Luján de Cuyo", "5507"),
    ClienteEjemplo("benjamin.ruiz@demo.foodstore.com", "Benjamín", "Ruiz", "2615100012", "Perito Moreno 870", "Luján de Cuyo", "5507"),
    ClienteEjemplo("emilia.suarez@demo.foodstore.com", "Emilia", "Suárez", "2615100013", "Lavalle 655", "Ciudad de Mendoza", "5500"),
    ClienteEjemplo("facundo.benitez@demo.foodstore.com", "Facundo", "Benítez", "2615100014", "Remedios de Escalada 1480", "Godoy Cruz", "5501"),
    ClienteEjemplo("renata.acosta@demo.foodstore.com", "Renata", "Acosta", "2615100015", "Tirasso 390", "Guaymallén", "5521"),
    ClienteEjemplo("bruno.medina@demo.foodstore.com", "Bruno", "Medina", "2615100016", "Sarmiento 1020", "Las Heras", "5539"),
)

UNIDADES_DEMO: tuple[tuple[str, str, str], ...] = (  # (nombre, simbolo, tipo)
    ("Kilogramo", "kg", "peso"), ("Gramo", "g", "peso"), ("Litro", "L", "volumen"), ("Mililitro", "mL", "volumen"),
    ("Unidad", "u", "unidad"), ("Docena", "doc", "unidad"), ("Metro cuadrado", "m²", "superficie"),
)

# (nombre, descripcion, nombre de la categoría padre); los padres van antes que sus hijas. Sin imagen: el frontend muestra
# un respaldo tipográfico y las imágenes reales llegarán con Cloudinary (C-28); nunca hosts externos en el seed.
CATEGORIAS_DEMO: tuple[tuple[str, str, str | None], ...] = (
    ("Hamburguesas", "Nuestras burgers artesanales", None),
    ("Bebidas",      "Frías y calientes",            None),
    ("Postres",      "Para cerrar con dulzura",      None),
    ("Veganas",      "100% plant-based",             "Hamburguesas"),
    ("Sin TACC",     "Libres de gluten",             "Hamburguesas"),
    ("Gaseosas",     "Bebidas con gas",              "Bebidas"),
    ("Pizzas",          "Al molde y a la piedra",     None),
    ("Acompañamientos", "Para compartir o sumar",     None),
)

INGREDIENTES_DEMO: tuple[tuple[str, str, bool], ...] = (  # (nombre, descripcion, es_alergeno)
    ("Pan Brioche", "Pan suave y esponjoso", True), ("Pan Sin TACC", "Pan libre de gluten", False),
    ("Carne Vacuna 250g", "Medallón de res premium", False), ("Medallón Vegano", "Base de legumbres y avena", False),
    ("Queso Cheddar", "Cheddar fundido americano", True), ("Queso Vegano", "Alternativa plant-based", False),
    ("Lechuga", "Lechuga fresca", False), ("Tomate", "Tomate perita en rodajas", False),
    ("Cebolla Caramelizada", "Cebolla dulce", False), ("Bacon Crocante", "Panceta ahumada", False),
    ("Salsa BBQ", "Salsa ahumada casera", False), ("Mayonesa", "Mayo artesanal", True),
    ("Masa de Pizza", "Masa de trigo de fermentación lenta", True), ("Muzzarella", "Queso muzzarella en horma", True),
    ("Salsa de Tomate", "Salsa de tomate natural", False), ("Orégano", "Orégano seco", False),
    ("Ajo", "Ajo fresco", False), ("Cebolla", "Cebolla de verdeo y blanca", False),
    ("Pollo Rebozado", "Pechuga de pollo rebozada", True), ("Papas", "Papas cortadas en bastones", False),
    ("Huevo", "Huevo de campo", True), ("Dulce de Leche", "Dulce de leche repostero", True),
    ("Chocolate", "Chocolate semiamargo", True), ("Queso Crema", "Queso crema untable", True),
)


class ProductoDemo(NamedTuple):
    nombre: str
    descripcion: str
    precio: str
    stock: int
    categorias: tuple[tuple[str, bool], ...]  # (nombre de categoría, es_principal)
    ingredientes: tuple[tuple[str, bool], ...]  # (nombre de ingrediente, es_removible)


PRODUCTOS_DEMO: tuple[ProductoDemo, ...] = (
    ProductoDemo(
        "Hamburguesa Clásica", "La de siempre, perfecta de siempre.", "1500.00", 50,
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Carne Vacuna 250g", False), ("Queso Cheddar", True), ("Lechuga", True),
         ("Tomate", True), ("Mayonesa", True)),
    ),
    ProductoDemo(
        "Burger BBQ Bacon", "Ahumada, crocante y con todo.", "1900.00", 30,
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Carne Vacuna 250g", False), ("Bacon Crocante", True), ("Queso Cheddar", True),
         ("Cebolla Caramelizada", True), ("Salsa BBQ", True)),
    ),
    ProductoDemo(
        "Burger Vegana", "Plant-based sin culpa.", "1800.00", 25,
        (("Hamburguesas", True), ("Veganas", False)),
        (("Pan Brioche", False), ("Medallón Vegano", False), ("Queso Vegano", True), ("Lechuga", True),
         ("Tomate", True)),
    ),
    ProductoDemo(
        "Burger Sin TACC", "Para celíacos, sin sacrificar sabor.", "1700.00", 20,
        (("Hamburguesas", True), ("Sin TACC", False)),
        (("Pan Sin TACC", False), ("Carne Vacuna 250g", False), ("Queso Cheddar", True), ("Lechuga", True),
         ("Tomate", True)),
    ),
    ProductoDemo(
        "Coca-Cola 500ml", "La clásica bien fría.", "800.00", 100,
        (("Bebidas", True), ("Gaseosas", False)), (),
    ),
    ProductoDemo(
        "Limonada Natural", "Exprimida al momento.", "700.00", 60,
        (("Bebidas", True),), (),
    ),

    # Hamburguesas (nuevas)
    ProductoDemo(
        "Doble Cheddar", "Doble queso, doble sabor.", "2300.00", 35,
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Carne Vacuna 250g", False), ("Queso Cheddar", True),
         ("Cebolla Caramelizada", True), ("Mayonesa", True)),
    ),
    ProductoDemo(
        "Burger Crispy Chicken", "Pollo crocante con vegetales frescos.", "1850.00", 28,
        (("Hamburguesas", True),),
        (("Pan Brioche", False), ("Pollo Rebozado", False), ("Lechuga", True), ("Tomate", True), ("Mayonesa", True)),
    ),
    # Pizzas
    ProductoDemo(
        "Pizza Muzzarella", "Clásica, con mucha muzzarella.", "2400.00", 40,
        (("Pizzas", True),),
        (("Masa de Pizza", False), ("Salsa de Tomate", False), ("Muzzarella", False), ("Orégano", True)),
    ),
    ProductoDemo(
        "Pizza Napolitana", "Con rodajas de tomate y ajo.", "2700.00", 30,
        (("Pizzas", True),),
        (("Masa de Pizza", False), ("Salsa de Tomate", False), ("Muzzarella", False), ("Tomate", True),
         ("Ajo", True), ("Orégano", True)),
    ),
    ProductoDemo(
        "Pizza Fugazzeta", "Cebolla y muzzarella, sin salsa.", "2600.00", 25,
        (("Pizzas", True),),
        (("Masa de Pizza", False), ("Muzzarella", False), ("Cebolla", True), ("Orégano", True)),
    ),
    # Acompañamientos
    ProductoDemo(
        "Papas Fritas", "Crocantes y recién hechas.", "900.00", 80,
        (("Acompañamientos", True),), (("Papas", False),),
    ),
    ProductoDemo(
        "Papas Cheddar y Bacon", "Con cheddar fundido y bacon crocante.", "1500.00", 45,
        (("Acompañamientos", True),),
        (("Papas", False), ("Queso Cheddar", True), ("Bacon Crocante", True)),
    ),
    ProductoDemo(
        "Aros de Cebolla", "Rebozados y dorados.", "1000.00", 50,
        (("Acompañamientos", True),), (("Cebolla", False),),
    ),
    ProductoDemo(
        "Nuggets x6", "Seis nuggets de pollo con salsa.", "1300.00", 60,
        (("Acompañamientos", True),), (("Pollo Rebozado", False),),
    ),
    # Postres
    ProductoDemo(
        "Brownie con Helado", "Tibio, con una bocha de crema americana.", "1400.00", 30,
        (("Postres", True),), (("Chocolate", False), ("Huevo", False)),
    ),
    ProductoDemo(
        "Flan con Dulce de Leche", "Casero, con dulce de leche y crema.", "1100.00", 0,
        (("Postres", True),), (("Huevo", False), ("Dulce de Leche", False)),
    ),
    ProductoDemo(
        "Cheesecake de Frutos Rojos", "Cremoso, con salsa de frutos rojos.", "1600.00", 4,
        (("Postres", True),), (("Queso Crema", False), ("Huevo", False)),
    ),
    # Bebidas (nuevas)
    ProductoDemo(
        "Sprite 500ml", "Lima-limón bien fría.", "800.00", 90,
        (("Bebidas", True), ("Gaseosas", False)), (),
    ),
    ProductoDemo(
        "Agua Mineral 500ml", "Sin gas.", "600.00", 100,
        (("Bebidas", True),), (),
    ),
    ProductoDemo(
        "Café con Leche", "Café de filtro con leche espumada.", "1000.00", 70,
        (("Bebidas", True),), (),
    ),
)


def _crear_direccion_principal(session: Session, usuario: Usuario, linea1: str, ciudad: str, codigo_postal: str) -> None:
    session.add(DireccionEntrega(
        usuario_id=usuario.id, alias="Casa", linea1=linea1, ciudad=ciudad, provincia="Mendoza",
        codigo_postal=codigo_postal, es_principal=True))
    session.flush()


def _seed_clientes_de_ejemplo(session: Session) -> None:
    """Crea los clientes de ejemplo que falten, cada uno con su dirección principal (solo junto con el usuario).

    El hash de la contraseña compartida se calcula una vez y solo si hay algún cliente por crear.
    """
    existentes = set(session.exec(
        select(Usuario.email).where(Usuario.email.in_([c.email for c in CLIENTES_DEMO]))).all())
    faltantes = [c for c in CLIENTES_DEMO if c.email not in existentes]
    for email in existentes:
        print(f"  [OK] Usuario {email} ya existe, se omite.")
    if not faltantes:
        return
    password_hash = hash_password(PASSWORD_CLIENTES_DEMO)
    for cliente in faltantes:
        usuario = _crear_usuario_si_falta(
            session, cliente.email, cliente.nombre, cliente.apellido, cliente.celular, password_hash, "CLIENT")
        if usuario is not None:
            _crear_direccion_principal(session, usuario, cliente.direccion, cliente.ciudad, cliente.codigo_postal)


def seed_demo(session: Session) -> None:
    """Siembra usuarios de prueba y el catálogo de demostración, cada registro buscado por su clave natural.

    Las relaciones (rol, categoría padre, producto↔categoría, producto↔ingrediente) se crean solo junto con la
    entidad dueña: nunca se agregan a entidades preexistentes.
    """
    for email, nombre, apellido, celular, password, rol in USUARIOS_DEMO:
        usuario = _crear_usuario_si_falta(session, email, nombre, apellido, celular, hash_password(password), rol)
        if usuario is not None and email == CLIENTE_BASE_EMAIL:
            _crear_direccion_principal(session, usuario, "Av. San Martín 100", "Ciudad de Mendoza", "5500")
    _seed_clientes_de_ejemplo(session)

    for nombre, simbolo, tipo in UNIDADES_DEMO:
        _obtener_o_crear(session, UnidadMedida, UnidadMedida.simbolo, simbolo, nombre=nombre, simbolo=simbolo, tipo=tipo)
    unidad_u = session.exec(select(UnidadMedida).where(UnidadMedida.simbolo == "u")).first()

    categorias: dict[str, Categoria] = {}
    for nombre, descripcion, padre in CATEGORIAS_DEMO:
        categorias[nombre], _ = _obtener_o_crear(
            session, Categoria, Categoria.nombre, nombre,
            nombre=nombre, descripcion=descripcion, imagen_url="",
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


ELENCO_VENTAS = ElencoVentas(
    emails_clientes=tuple(c.email for c in CLIENTES_DEMO),
    email_destacado=CLIENTE_BASE_EMAIL,
    email_pedidos="pedidos@foodstore.com",
    email_admin=ADMIN_EMAIL,
    nombres_productos=tuple(p.nombre for p in PRODUCTOS_DEMO),
)


def seed(engine: Engine | None = None, *, con_ventas: bool = True) -> None:
    """Siembra los datos iniciales. Exige el esquema migrado (`alembic upgrade head`); nunca crea tablas.

    `con_ventas=False` omite el historial de ventas de demostración (se puede sembrar en una corrida posterior).
    """
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
        ventas = sembrar_ventas(session, utc_now(), ELENCO_VENTAS) if con_ventas else None

    print("--- SEED FINALIZADO [OK] ---")
    print("   • 4 roles + usuarios de prueba")
    print("   • 6 estados de pedido + 3 formas de pago")
    print("   • 8 categorías + 24 ingredientes + 7 unidades de medida + 21 productos")
    print("   • 16 clientes de ejemplo (@demo.foodstore.com, contraseña cliente123) con dirección")
    if ventas is None:
        print("   • Ventas de demostración omitidas (--sin-ventas)")
    elif ventas == 0:
        print("   • Ventas de demostración: ya existían, no se agregó ninguna")
    else:
        print(f"   • {ventas} pedidos de demostración de los últimos 12 meses")
    print("\n--- CUENTAS DE PRUEBA ---")
    print(f"   - Admin:     {ADMIN_EMAIL}   / {ADMIN_PASSWORD_DESARROLLO}")
    print("   - Pedidos: pedidos@foodstore.com / pedidos123")
    print("   - Stock:    stock@foodstore.com   / stock123")
    print("   - Cliente: cliente@foodstore.com / cliente123")
    print("-------------------------")


def parsear_argumentos(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Siembra los datos iniciales y de demostración de Food Store.")
    parser.add_argument(
        "--sin-ventas", action="store_true", help="omite el historial de ventas de demostración (catálogo y clientes sí)"
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    argumentos = parsear_argumentos()
    try:
        seed(con_ventas=not argumentos.sin_ventas)
    except SchemaNotReadyError as exc:
        print(f"[ERROR] {exc}")
        raise SystemExit(1)
