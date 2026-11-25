"""Ventas de demostración para el seed (`python -m app.db.seed`): historial de ~12 meses con pedidos activos recientes.

Dos partes (D1 del change `seed-demo-ampliado`):

1. `planificar_ventas`: función PURA (sin `Session`) que devuelve el plan de pedidos como dataclasses congeladas. Toda la
   lógica de fechas, mezcla de estados y coherencia vive acá y se prueba con un `ahora` fijo y un `random.Random` sembrado.
2. `sembrar_ventas`: lee el catálogo y los clientes de demo, planifica y persiste con la `Session` y fechas explícitas.

El plan no copia reglas del dominio: cada transición se valida con `fsm.destinos_permitidos` y los importes salen de
`PedidoService` (envío y descuento). Todas las fechas son UTC con zona: los reportes agrupan por día UTC.
"""
from __future__ import annotations

import random
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlmodel import Session, select

from app.modules.categorias.models import Categoria
from app.modules.direcciones.models import DireccionEntrega
from app.modules.ingredientes.models import Ingrediente
from app.modules.pagos.decision_webhook import ESTADO_APROBADO
from app.modules.pagos.models import Pago
from app.modules.pedidos import fsm
from app.modules.pedidos.models import DetallePedido, HistorialEstadoPedido, Pedido
from app.modules.pedidos.service import PedidoService
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente
from app.modules.usuarios.models import Usuario

# ─── Constantes del plan ─────────────────────────────────────────────────────

SEMILLA_VENTAS = 20261123
MESES_DE_HISTORIA = 11  # además del mes en curso: la ventana abarca 12 meses calendario (<= 365 días)

DIAS_DE_CALOR = 30  # los últimos 30 días llevan al menos una venta por día
PEDIDOS_HOY = (4, 6)
PEDIDOS_DIAS_1_A_6 = (4, 7)
PEDIDOS_DIAS_7_A_29 = (2, 3)
PROBABILIDAD_DIA_RALO = 0.65  # días de 30 en adelante: 0 o 1 pedido
PISO_PEDIDOS_POR_MES = 14
PISO_VENTAS_POR_MES = 12

ACTIVOS_RECIENTES = (8, 12)
PROBABILIDAD_CANCELACION = 0.10
PROBABILIDAD_SIN_DIRECCION = 0.15
PROBABILIDAD_PERSONALIZAR = 0.10
PROBABILIDAD_GESTOR_PEDIDOS = 0.80

FORMAS_PAGO: tuple[tuple[str, int], ...] = ((fsm.MERCADOPAGO, 50), (fsm.EFECTIVO, 30), (fsm.TRANSFERENCIA, 20))
ESTADOS_ACTIVOS_RECIENTES: tuple[str, ...] = (fsm.PENDIENTE, fsm.CONFIRMADO, fsm.EN_PREP, fsm.EN_CAMINO)

# Franjas horarias en segundos UTC (almuerzo y cena en hora argentina, UTC-3): 11-15 h y 19-21 h locales.
FRANJAS_UTC: tuple[tuple[int, int], ...] = ((14 * 3600, 18 * 3600 - 1), (22 * 3600, 24 * 3600 - 1))
FRACCION_DE_HOY_PARA_CREAR = 0.9  # un pedido de hoy se crea en el primer 90 % de lo transcurrido del día

# Minutos entre estados: (mínimo, máximo)
ESPERA_CONFIRMAR = (2, 10)
ESPERA_PREPARAR = (5, 15)
ESPERA_DESPACHAR = (15, 30)
ESPERA_ENTREGAR = (15, 40)
ESPERA_CANCELAR = (3, 30)

ACTOR_CLIENTE = fsm.CLIENT
ACTOR_SISTEMA = fsm.SISTEMA

MOTIVO_CREACION = "Pedido creado"
MOTIVO_PAGO_MP = "Pago aprobado por MercadoPago"
MOTIVO_PAGO_MANUAL = "Pago recibido y verificado"
MOTIVOS_CANCELA_CLIENTE = ("Me equivoqué de dirección", "Ya no lo necesito")
MOTIVOS_CANCELA_GESTOR = ("Sin repartidor disponible", "Cliente no responde")

# Popularidad por categoría principal del producto (hamburguesas y papas son lo más vendido) y tope de cantidad.
PESO_POR_CATEGORIA: dict[str, int] = {"Hamburguesas": 5, "Acompañamientos": 4, "Pizzas": 3, "Bebidas": 3, "Postres": 2}
CATEGORIAS_DE_MAS_UNIDADES = frozenset({"Bebidas", "Acompañamientos"})
METODOS_DE_PAGO_DEMO = ("visa", "master", "amex")
PREFIJO_PAGOS_DEMO = "SEED"

# ─── Plan (dominio del seed) ─────────────────────────────────────────────────


@dataclass(frozen=True)
class ProductoVendible:
    """Producto del catálogo de demo que puede aparecer en una línea (precio vigente y stock declarado)."""

    id: int
    nombre: str
    precio: Decimal
    stock: int
    peso: int = 1  # popularidad relativa
    max_cantidad: int = 3
    removibles: tuple[tuple[int, str], ...] = ()  # (id de ingrediente, nombre) que el cliente puede quitar


@dataclass(frozen=True)
class ClienteDemo:
    """Cliente con rol CLIENT; `direccion_id` es su dirección principal (None si no tiene)."""

    id: int
    email: str
    direccion_id: int | None = None
    peso: int = 1
    pedidos_garantizados: int = 0  # pedidos propios mínimos (incluye uno activo), p. ej. el cliente de la demo


@dataclass(frozen=True)
class LineaPlan:
    producto: ProductoVendible
    cantidad: int
    personalizacion: tuple[int, ...] = ()
    personalizacion_nombres: tuple[str, ...] = ()

    @property
    def subtotal(self) -> Decimal:
        return self.producto.precio * self.cantidad


@dataclass(frozen=True)
class TransicionPlan:
    """Una fila de historial. `actor` es el rol de quien actúa: CLIENT (el dueño), PEDIDOS, ADMIN o SISTEMA."""

    desde: str | None
    hacia: str
    actor: str
    motivo: str | None
    cuando: datetime


@dataclass(frozen=True)
class PedidoPlan:
    indice: int  # 1..N en orden cronológico
    cliente: ClienteDemo
    creado_en: datetime
    forma_pago: str
    con_direccion: bool
    lineas: tuple[LineaPlan, ...]
    estado_final: str
    transiciones: tuple[TransicionPlan, ...]

    @property
    def subtotal(self) -> Decimal:
        return sum((linea.subtotal for linea in self.lineas), Decimal("0.00"))

    @property
    def descuento(self) -> Decimal:
        return PedidoService.DESCUENTO_INICIAL

    @property
    def costo_envio(self) -> Decimal:
        return PedidoService.COSTO_ENVIO_FIJO

    @property
    def total(self) -> Decimal:
        return self.subtotal - self.descuento + self.costo_envio

    @property
    def ultima_actualizacion(self) -> datetime:
        return self.transiciones[-1].cuando


@dataclass
class _Borrador:
    """Pedido a medio planificar (mutable, interno)."""

    atras: int  # días hacia atrás desde hoy
    creado_en: datetime
    estado: str = fsm.ENTREGADO
    forma_pago: str = fsm.EFECTIVO
    cliente: ClienteDemo | None = None
    lineas: tuple[LineaPlan, ...] = ()


# ─── Fechas ──────────────────────────────────────────────────────────────────


def _primer_dia_del_mes(dia: date, meses_atras: int) -> date:
    indice = dia.year * 12 + (dia.month - 1) - meses_atras
    return date(indice // 12, indice % 12 + 1, 1)


def _inicio_del_dia(dia: date) -> datetime:
    return datetime(dia.year, dia.month, dia.day, tzinfo=timezone.utc)


def _pedidos_del_dia(rng: random.Random, atras: int) -> int:
    if atras == 0:
        return rng.randint(*PEDIDOS_HOY)
    if atras < 7:
        return rng.randint(*PEDIDOS_DIAS_1_A_6)
    if atras < DIAS_DE_CALOR:
        return rng.randint(*PEDIDOS_DIAS_7_A_29)
    return 1 if rng.random() < PROBABILIDAD_DIA_RALO else 0


def _hora_de_creacion(rng: random.Random, dia: date, atras: int, ahora: datetime) -> datetime:
    """Instante de creación: franja de almuerzo o cena; para hoy, antes de `ahora` (en el primer 90 % de lo transcurrido)."""
    inicio = _inicio_del_dia(dia)
    if atras == 0:
        transcurrido = (ahora - inicio).total_seconds()
        return inicio + timedelta(seconds=rng.uniform(0, transcurrido * FRACCION_DE_HOY_PARA_CREAR))
    desde, hasta = rng.choice(FRANJAS_UTC)
    return inicio + timedelta(seconds=rng.randint(desde, hasta))


def _generar_borradores(rng: random.Random, ahora: datetime) -> list[_Borrador]:
    hoy = ahora.date()
    inicio = _primer_dia_del_mes(hoy, MESES_DE_HISTORIA)
    dias_atras = (hoy - inicio).days
    borradores: list[_Borrador] = []
    for atras in range(dias_atras, -1, -1):
        dia = hoy - timedelta(days=atras)
        for _ in range(_pedidos_del_dia(rng, atras)):
            borradores.append(_Borrador(atras, _hora_de_creacion(rng, dia, atras, ahora)))
    _completar_piso_mensual(rng, borradores, hoy, inicio, ahora)
    borradores.sort(key=lambda b: b.creado_en)
    return borradores


def _completar_piso_mensual(
    rng: random.Random, borradores: list[_Borrador], hoy: date, inicio: date, ahora: datetime
) -> None:
    """Cada mes completo anterior al actual llega al piso de pedidos (suma pedidos en días de 30 atrás en adelante)."""
    mes_actual = (hoy.year, hoy.month)
    mes = inicio
    while (mes.year, mes.month) != mes_actual:
        siguiente = _primer_dia_del_mes(mes, -1)
        del_mes = [b for b in borradores if mes <= b.creado_en.date() < siguiente]
        dias_ralos = [
            mes + timedelta(days=n) for n in range((siguiente - mes).days) if (hoy - (mes + timedelta(days=n))).days >= DIAS_DE_CALOR
        ]
        for _ in range(max(0, PISO_PEDIDOS_POR_MES - len(del_mes))):
            if not dias_ralos:
                break
            dia = rng.choice(dias_ralos)
            borradores.append(_Borrador((hoy - dia).days, _hora_de_creacion(rng, dia, (hoy - dia).days, ahora)))
        mes = siguiente


# ─── Estados, pagos y clientes ───────────────────────────────────────────────


def _asignar_estados(rng: random.Random, borradores: list[_Borrador]) -> None:
    recientes = [b for b in borradores if b.atras <= 1]
    cantidad_activos = min(rng.randint(*ACTIVOS_RECIENTES), len(recientes) - 1)
    elegidos = rng.sample(recientes, cantidad_activos)
    estados = list(ESTADOS_ACTIVOS_RECIENTES)
    rng.shuffle(estados)
    estados += [rng.choice(ESTADOS_ACTIVOS_RECIENTES) for _ in range(cantidad_activos - len(estados))]
    for borrador, estado in zip(elegidos, estados):
        borrador.estado = estado

    for borrador in borradores:
        if borrador.atras > 1 and rng.random() < PROBABILIDAD_CANCELACION and not _es_primero_de_su_dia(borrador, borradores):
            borrador.estado = fsm.CANCELADO
    _asegurar_ventas_recientes(borradores)
    _asegurar_ventas_por_mes(borradores)


def _es_primero_de_su_dia(borrador: _Borrador, borradores: list[_Borrador]) -> bool:
    """Los días de los últimos 30 conservan su primer pedido como venta (cobertura diaria del dashboard)."""
    if borrador.atras >= DIAS_DE_CALOR:
        return False
    dia = borrador.creado_en.date()
    del_dia = [b for b in borradores if b.creado_en.date() == dia]
    return borrador is min(del_dia, key=lambda b: b.creado_en)


def _es_venta(borrador: _Borrador) -> bool:
    return borrador.estado in fsm.ESTADOS_VENDIDOS


def _asegurar_ventas_recientes(borradores: list[_Borrador]) -> None:
    """Hoy y ayer tienen al menos una venta: si todo es PENDIENTE, se intercambia con un pedido vendido de la ventana."""
    for atras in (0, 1):
        del_dia = [b for b in borradores if b.atras == atras]
        if not del_dia or any(_es_venta(b) for b in del_dia):
            continue
        pendiente = del_dia[0]
        donante = next(b for b in borradores if b.atras <= 1 and b.atras != atras and _es_venta(b))
        pendiente.estado, donante.estado = donante.estado, pendiente.estado


def _asegurar_ventas_por_mes(borradores: list[_Borrador]) -> None:
    por_mes: dict[tuple[int, int], list[_Borrador]] = {}
    for borrador in borradores:
        por_mes.setdefault((borrador.creado_en.year, borrador.creado_en.month), []).append(borrador)
    for del_mes in por_mes.values():
        faltan = PISO_VENTAS_POR_MES - sum(1 for b in del_mes if _es_venta(b))
        for borrador in (b for b in del_mes if b.estado == fsm.CANCELADO):
            if faltan <= 0:
                break
            borrador.estado = fsm.ENTREGADO
            faltan -= 1


def _asignar_formas_de_pago(rng: random.Random, borradores: list[_Borrador]) -> None:
    formas, pesos = zip(*FORMAS_PAGO)
    for borrador in borradores:
        borrador.forma_pago = rng.choices(formas, weights=pesos)[0]
    pendientes = [b for b in borradores if b.estado == fsm.PENDIENTE]
    if pendientes and all(b.forma_pago == fsm.MERCADOPAGO for b in pendientes):
        # Un gestor solo puede confirmar a mano EFECTIVO/TRANSFERENCIA: la demo siempre deja uno para mostrar ese flujo.
        pendientes[0].forma_pago = fsm.EFECTIVO


def _asignar_clientes(rng: random.Random, borradores: list[_Borrador], clientes: Sequence[ClienteDemo]) -> None:
    activos = [b for b in borradores if b.estado in ESTADOS_ACTIVOS_RECIENTES]
    for cliente in (c for c in clientes if c.pedidos_garantizados > 0):
        libres_activos = [b for b in activos if b.cliente is None]
        if libres_activos:
            rng.choice(libres_activos).cliente = cliente
        pendientes_de_asignar = cliente.pedidos_garantizados - sum(1 for b in borradores if b.cliente is cliente)
        libres = [b for b in borradores if b.cliente is None and b.atras >= 2]
        for borrador in rng.sample(libres, max(0, pendientes_de_asignar)):
            borrador.cliente = cliente
    habituales = [c for c in clientes if c.pedidos_garantizados == 0] or list(clientes)
    pesos = [c.peso for c in habituales]
    for borrador in borradores:
        if borrador.cliente is None:
            borrador.cliente = rng.choices(habituales, weights=pesos)[0]


# ─── Líneas ──────────────────────────────────────────────────────────────────


def _elegir_lineas(
    rng: random.Random, productos: Sequence[ProductoVendible], restante: dict[int, int] | None
) -> tuple[LineaPlan, ...]:
    """1-4 productos distintos. Con `restante` (pedidos PENDIENTE) solo productos con stock sin comprometer (D6)."""
    candidatos = [p for p in productos if restante is None or restante[p.id] >= 1]
    if not candidatos:
        raise ValueError("No hay productos con stock para planificar los pedidos pendientes")
    lineas: list[LineaPlan] = []
    for _ in range(min(rng.randint(1, 4), len(candidatos))):
        producto = rng.choices(candidatos, weights=[p.peso for p in candidatos])[0]
        candidatos.remove(producto)
        tope = producto.max_cantidad if restante is None else min(producto.max_cantidad, restante[producto.id])
        cantidad = rng.choices(range(1, tope + 1), weights=[6, 3, 2, 1][:tope])[0]
        if restante is not None:
            restante[producto.id] -= cantidad
        lineas.append(_personalizar(rng, LineaPlan(producto, cantidad)))
    return tuple(lineas)


def _personalizar(rng: random.Random, linea: LineaPlan) -> LineaPlan:
    if not linea.producto.removibles or rng.random() >= PROBABILIDAD_PERSONALIZAR:
        return linea
    return _quitar_ingrediente(rng, linea)


def _quitar_ingrediente(rng: random.Random, linea: LineaPlan) -> LineaPlan:
    ingrediente_id, nombre = rng.choice(linea.producto.removibles)
    return replace(linea, personalizacion=(ingrediente_id,), personalizacion_nombres=(nombre,))


def _asignar_lineas(rng: random.Random, borradores: list[_Borrador], productos: Sequence[ProductoVendible]) -> None:
    restante = {p.id: p.stock for p in productos}
    for borrador in (b for b in borradores if b.estado == fsm.PENDIENTE):
        borrador.lineas = _elegir_lineas(rng, productos, restante)
    for borrador in (b for b in borradores if b.estado != fsm.PENDIENTE):
        borrador.lineas = _elegir_lineas(rng, productos, None)
    if not any(linea.personalizacion for b in borradores for linea in b.lineas):
        _forzar_una_personalizacion(rng, borradores)


def _forzar_una_personalizacion(rng: random.Random, borradores: list[_Borrador]) -> None:
    for borrador in borradores:
        for posicion, linea in enumerate(borrador.lineas):
            if linea.producto.removibles:
                lineas = list(borrador.lineas)
                lineas[posicion] = _quitar_ingrediente(rng, linea)
                borrador.lineas = tuple(lineas)
                return


# ─── Historial ───────────────────────────────────────────────────────────────

_CAMINO = (fsm.PENDIENTE, fsm.CONFIRMADO, fsm.EN_PREP, fsm.EN_CAMINO, fsm.ENTREGADO)
_ESPERAS = {
    fsm.CONFIRMADO: ESPERA_CONFIRMAR,
    fsm.EN_PREP: ESPERA_PREPARAR,
    fsm.EN_CAMINO: ESPERA_DESPACHAR,
    fsm.ENTREGADO: ESPERA_ENTREGAR,
}


def _actor_de_dominio(rol: str) -> fsm.Actor:
    return fsm.ACTOR_SISTEMA if rol == ACTOR_SISTEMA else fsm.Actor.usuario(0, {rol})


def _validar(forma_pago: str, rol: str, desde: str, hacia: str) -> None:
    """Una transición que la máquina de estados no admite es un bug del seed: se falla en voz alta (D2)."""
    if hacia not in fsm.destinos_permitidos(_actor_de_dominio(rol), desde, forma_pago):
        raise ValueError(f"Transición inválida en el seed: {desde} -> {hacia} por {rol} ({forma_pago})")


def _gestor(rng: random.Random) -> str:
    return fsm.PEDIDOS if rng.random() < PROBABILIDAD_GESTOR_PEDIDOS else fsm.ADMIN


def _pasos_del_historial(rng: random.Random, borrador: _Borrador) -> list[tuple[str | None, str, str, str | None, int]]:
    """Pasos `(desde, hacia, actor, motivo, espera_en_segundos)` del recorrido que termina en el estado del borrador."""
    forma_pago = borrador.forma_pago
    pasos: list[tuple[str | None, str, str, str | None, int]] = [(None, fsm.PENDIENTE, ACTOR_CLIENTE, MOTIVO_CREACION, 0)]
    if borrador.estado == fsm.CANCELADO:
        if forma_pago == fsm.MERCADOPAGO:
            origen = fsm.PENDIENTE  # nunca se pagó: lo cancela el cliente
        else:
            origen = rng.choices(_CAMINO[:3], weights=[4, 3, 3])[0]
        destino_camino = origen
    else:
        origen = borrador.estado
        destino_camino = borrador.estado
    for desde, hacia in zip(_CAMINO, _CAMINO[1:]):
        if _CAMINO.index(desde) >= _CAMINO.index(destino_camino):
            break
        actor = ACTOR_SISTEMA if (hacia == fsm.CONFIRMADO and forma_pago == fsm.MERCADOPAGO) else _gestor(rng)
        motivo = None
        if hacia == fsm.CONFIRMADO:
            motivo = MOTIVO_PAGO_MP if actor == ACTOR_SISTEMA else MOTIVO_PAGO_MANUAL
        pasos.append((desde, hacia, actor, motivo, 60 * rng.randint(*_ESPERAS[hacia])))
    if borrador.estado == fsm.CANCELADO:
        if origen == fsm.PENDIENTE and (forma_pago == fsm.MERCADOPAGO or rng.random() < 0.6):
            actor, motivo = ACTOR_CLIENTE, rng.choice(MOTIVOS_CANCELA_CLIENTE)
        else:
            actor, motivo = _gestor(rng), rng.choice(MOTIVOS_CANCELA_GESTOR)
        pasos.append((origen, fsm.CANCELADO, actor, motivo, 60 * rng.randint(*ESPERA_CANCELAR)))
    return pasos


def _historial(rng: random.Random, borrador: _Borrador, ahora: datetime) -> tuple[TransicionPlan, ...]:
    pasos = _pasos_del_historial(rng, borrador)
    for desde, hacia, actor, _motivo, _espera in pasos[1:]:
        _validar(borrador.forma_pago, actor, desde or fsm.PENDIENTE, hacia)
    total = sum(espera for *_, espera in pasos)
    disponible = (ahora - borrador.creado_en).total_seconds()
    factor = 1.0 if total < disponible else disponible * 0.9 / total  # comprime lo que se pasaría de `ahora`
    transiciones: list[TransicionPlan] = []
    acumulado = 0.0
    for desde, hacia, actor, motivo, espera in pasos:
        acumulado += espera * factor
        transiciones.append(TransicionPlan(desde, hacia, actor, motivo, borrador.creado_en + timedelta(seconds=acumulado)))
    return tuple(transiciones)


# ─── API pública ─────────────────────────────────────────────────────────────


def planificar_ventas(
    ahora: datetime,
    productos: Sequence[ProductoVendible],
    clientes: Sequence[ClienteDemo],
    rng: random.Random,
) -> list[PedidoPlan]:
    """Plan de ~300 pedidos de los últimos 12 meses terminando en `ahora` (UTC con zona). Función pura y determinística."""
    if not productos or not clientes:
        raise ValueError("Se necesitan productos y clientes para planificar ventas")
    borradores = _generar_borradores(rng, ahora)
    _asignar_estados(rng, borradores)
    _asignar_formas_de_pago(rng, borradores)
    _asignar_clientes(rng, borradores, clientes)
    _asignar_lineas(rng, borradores, productos)
    planes: list[PedidoPlan] = []
    for indice, borrador in enumerate(borradores, start=1):
        assert borrador.cliente is not None
        con_direccion = borrador.cliente.direccion_id is not None and rng.random() >= PROBABILIDAD_SIN_DIRECCION
        planes.append(
            PedidoPlan(
                indice, borrador.cliente, borrador.creado_en, borrador.forma_pago, con_direccion, borrador.lineas,
                borrador.estado, _historial(rng, borrador, ahora),
            )
        )
    return planes


# ─── Escritura ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ElencoVentas:
    """Quiénes y qué participan de las ventas (lo define el seed; este módulo no importa `seed.py`)."""

    emails_clientes: tuple[str, ...]  # clientes de ejemplo: también son el marcador de «ya se sembraron ventas» (D7)
    email_destacado: str  # cliente de la demo: recibe historia propia con un pedido activo
    email_pedidos: str
    email_admin: str
    nombres_productos: tuple[str, ...]
    pedidos_del_destacado: int = 10


def _hay_ventas_sembradas(session: Session, elenco: ElencoVentas) -> bool:
    """D7: algún pedido (incluso de un usuario dado de baja) de un cliente de ejemplo marca que las ventas ya existen."""
    emails = [*elenco.emails_clientes]
    return session.exec(
        select(Pedido.id).join(Usuario, Usuario.id == Pedido.usuario_id).where(Usuario.email.in_(emails)).limit(1)
    ).first() is not None


def _cargar_clientes(session: Session, elenco: ElencoVentas) -> list[ClienteDemo]:
    emails = [*elenco.emails_clientes, elenco.email_destacado]
    usuarios = session.exec(select(Usuario).where(Usuario.email.in_(emails), Usuario.deleted_at.is_(None))).all()
    principales = {
        d.usuario_id: d.id
        for d in session.exec(
            select(DireccionEntrega).where(
                DireccionEntrega.usuario_id.in_([u.id for u in usuarios]),
                DireccionEntrega.es_principal.is_(True),
                DireccionEntrega.deleted_at.is_(None),
            )
        ).all()
    }
    garantizados = {elenco.email_destacado: elenco.pedidos_del_destacado}
    return [
        ClienteDemo(u.id, u.email, principales.get(u.id), pedidos_garantizados=garantizados.get(u.email, 0))
        for u in sorted(usuarios, key=lambda u: u.email)
    ]


def _cargar_productos(session: Session, nombres: Sequence[str]) -> list[ProductoVendible]:
    productos = session.exec(
        select(Producto).where(Producto.nombre.in_(list(nombres)), Producto.deleted_at.is_(None)).order_by(Producto.id)
    ).all()
    principal = dict(session.exec(
        select(ProductoCategoria.producto_id, Categoria.nombre)
        .join(Categoria, Categoria.id == ProductoCategoria.categoria_id)
        .where(ProductoCategoria.es_principal.is_(True))
    ).all())
    removibles: dict[int, list[tuple[int, str]]] = {}
    for producto_id, ingrediente_id, nombre in session.exec(
        select(ProductoIngrediente.producto_id, Ingrediente.id, Ingrediente.nombre)
        .join(Ingrediente, Ingrediente.id == ProductoIngrediente.ingrediente_id)
        .where(ProductoIngrediente.es_removible.is_(True))
        .order_by(ProductoIngrediente.producto_id, Ingrediente.id)
    ).all():
        removibles.setdefault(producto_id, []).append((ingrediente_id, nombre))
    return [
        ProductoVendible(
            id=p.id, nombre=p.nombre, precio=p.precio_base, stock=p.stock_cantidad,
            peso=PESO_POR_CATEGORIA.get(principal.get(p.id, ""), 1),
            max_cantidad=4 if principal.get(p.id) in CATEGORIAS_DE_MAS_UNIDADES else 3,
            removibles=tuple(removibles.get(p.id, ())),
        )
        for p in productos
    ]


def _id_de(session: Session, email: str) -> int | None:
    return session.exec(select(Usuario.id).where(Usuario.email == email)).first()


def _persistir(
    session: Session, plan: PedidoPlan, direccion_id: int | None, actores: dict[str, int | None], pago_rng: random.Random
) -> None:
    pedido = Pedido(
        usuario_id=plan.cliente.id, direccion_id=direccion_id, estado_codigo=plan.estado_final,
        forma_pago_codigo=plan.forma_pago, subtotal=plan.subtotal, descuento=plan.descuento,
        costo_envio=plan.costo_envio, total=plan.total, created_at=plan.creado_en, updated_at=plan.ultima_actualizacion,
    )
    session.add(pedido)
    session.flush()
    for linea in plan.lineas:
        session.add(DetallePedido(
            pedido_id=pedido.id, producto_id=linea.producto.id, cantidad=linea.cantidad,
            nombre_snapshot=linea.producto.nombre, precio_snapshot=linea.producto.precio,
            subtotal_snapshot=linea.subtotal,
            personalizacion=list(linea.personalizacion) or None,
            personalizacion_snapshot=list(linea.personalizacion_nombres) or None,
            created_at=plan.creado_en,
        ))
    confirmacion: datetime | None = None
    for t in plan.transiciones:
        usuario_id = plan.cliente.id if t.actor == ACTOR_CLIENTE else actores.get(t.actor)
        session.add(HistorialEstadoPedido(
            pedido_id=pedido.id, estado_desde=t.desde, estado_hacia=t.hacia, usuario_id=usuario_id,
            motivo=t.motivo, created_at=t.cuando,
        ))
        if t.hacia == fsm.CONFIRMADO:
            confirmacion = t.cuando
    if plan.forma_pago == fsm.MERCADOPAGO and confirmacion is not None:
        _persistir_pago(session, plan, pedido.id, confirmacion, pago_rng)
    session.flush()


def _persistir_pago(session: Session, plan: PedidoPlan, pedido_id: int, confirmacion: datetime, rng: random.Random) -> None:
    """D5: pago aprobado sin pasarela; los ids `SEED-*` no chocan con los de MercadoPago y se reconocen a simple vista."""
    session.add(Pago(
        pedido_id=pedido_id, estado=ESTADO_APROBADO,
        mp_order_id=f"{PREFIJO_PAGOS_DEMO}-ORD-{plan.indice}", mp_payment_id=f"{PREFIJO_PAGOS_DEMO}-PAY-{plan.indice}",
        mp_status="processed", mp_status_detail="accredited",
        external_reference=uuid.UUID(int=rng.getrandbits(128), version=4),
        idempotency_key=f"seed-demo-{plan.indice}", transaction_amount=plan.total,
        payment_method_id=rng.choice(METODOS_DE_PAGO_DEMO),
        created_at=max(plan.creado_en, confirmacion - timedelta(minutes=1)), updated_at=confirmacion,
    ))


def sembrar_ventas(session: Session, ahora: datetime, elenco: ElencoVentas) -> int:
    """Siembra el historial de ventas una sola vez; devuelve cuántos pedidos creó (0 si ya existían o faltan datos).

    Solo `add`/`flush`: la transacción la maneja el llamador. No toca el stock (D6) ni la pasarela de pagos.
    """
    if _hay_ventas_sembradas(session, elenco):
        return 0
    clientes = _cargar_clientes(session, elenco)
    productos = _cargar_productos(session, elenco.nombres_productos)
    if not clientes or not productos:
        return 0
    admin_id = _id_de(session, elenco.email_admin)
    actores: dict[str, int | None] = {
        fsm.PEDIDOS: _id_de(session, elenco.email_pedidos) or admin_id, fsm.ADMIN: admin_id, ACTOR_SISTEMA: None,
    }
    planes = planificar_ventas(ahora, productos, clientes, random.Random(SEMILLA_VENTAS))
    pago_rng = random.Random(SEMILLA_VENTAS + 1)
    direcciones = {c.id: c.direccion_id for c in clientes}
    for plan in planes:
        _persistir(session, plan, direcciones[plan.cliente.id] if plan.con_direccion else None, actores, pago_rng)
    return len(planes)
