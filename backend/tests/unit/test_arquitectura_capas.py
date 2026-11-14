"""Reglas de arquitectura del backend (C-25a, D7): análisis estático con `ast`, sin importar los módulos.

`models <- repository <- unit of work <- service <- router`: cada capa depende solo de las inferiores. Se parsean los
`.py` de `app/` (incluidos los imports diferidos dentro de funciones) y se verifica qué módulos importa cada capa.
"""
import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"
MODULES = APP / "modules"


def _paquete_de(archivo: Path) -> str:
    """Paquete (ruta de puntos) que contiene al archivo, p. ej. `app.modules.pedidos` para `.../pedidos/router.py`."""
    try:
        partes = archivo.relative_to(APP.parent).with_suffix("").parts
    except ValueError:
        return ""
    return ".".join(partes[:-1])


def _modulo_absoluto(nodo: ast.ImportFrom, paquete: str) -> str | None:
    """Resuelve `from <nivel><módulo> import ...` a un módulo absoluto; `None` si no se puede resolver."""
    if nodo.level == 0:
        return nodo.module
    base = paquete.split(".") if paquete else []
    if not base or nodo.level - 1 > len(base):
        return None
    base = base[: len(base) - (nodo.level - 1)]
    return ".".join([*base, *([nodo.module] if nodo.module else [])])


def _importados(archivo: Path, paquete: str | None = None) -> set[str]:
    """Nombres de módulo importados por el archivo (`import x.y` -> `x.y`; `from x import y` -> `x` y `x.y`).

    Los imports relativos se resuelven a absolutos según el paquete del archivo (o `paquete`, si se indica).
    """
    paquete = _paquete_de(archivo) if paquete is None else paquete
    arbol = ast.parse(archivo.read_text(encoding="utf-8"), filename=str(archivo))
    nombres: set[str] = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            nombres.update(alias.name for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom):
            modulo = _modulo_absoluto(nodo, paquete)
            if modulo:
                nombres.add(modulo)
                nombres.update(f"{modulo}.{alias.name}" for alias in nodo.names)
    return nombres


def _coincide(modulo: str, prohibido: str) -> bool:
    """`prohibido` es un módulo exacto (`sqlmodel`), un prefijo (`app.core.database`) o un sufijo `*.repository`."""
    if prohibido.startswith("*."):
        sufijo = prohibido[1:]  # ".repository"
        return modulo.endswith(sufijo) or f"{sufijo}." in modulo
    return modulo == prohibido or modulo.startswith(prohibido + ".")


def _ofensores(archivo: Path, prohibidos: tuple[str, ...], paquete: str | None = None) -> list[str]:
    return sorted(
        f"{modulo} (regla: {p})"
        for modulo in _importados(archivo, paquete)
        for p in prohibidos
        if _coincide(modulo, p)
    )


def _relativo(archivo: Path) -> str:
    return archivo.relative_to(APP).as_posix()


def _archivos(patron: str, base: Path = APP) -> list[Path]:
    return sorted(base.glob(patron))


def _verificar(archivo: Path, prohibidos: tuple[str, ...]) -> None:
    ofensores = _ofensores(archivo, prohibidos)
    assert not ofensores, f"{_relativo(archivo)} importa: {ofensores}"


# ─── R1: los routers no acceden a datos ──────────────────────────────────────────────────────────────────────────────
PROHIBIDO_EN_ROUTER = (
    "sqlmodel",
    "sqlalchemy",
    "app.core.database",
    "app.core.uow",
    "*.repository",
    "*.unit_of_work",
    "*.models",
)


@pytest.mark.parametrize("router", _archivos("modules/**/router.py"), ids=_relativo)
def test_router_no_importa_acceso_a_datos(router: Path) -> None:
    _verificar(router, PROHIBIDO_EN_ROUTER)


def test_el_recolector_detecta_imports_diferidos_y_sufijos(tmp_path: Path) -> None:
    archivo = tmp_path / "router.py"
    archivo.write_text(
        "from fastapi import APIRouter\n"
        "def f():\n"
        "    from app.modules.x.repository import XRepository\n"
        "    import sqlmodel\n",
        encoding="utf-8",
    )

    assert _ofensores(archivo, PROHIBIDO_EN_ROUTER) == [
        "app.modules.x.repository (regla: *.repository)",
        "app.modules.x.repository.XRepository (regla: *.repository)",
        "sqlmodel (regla: sqlmodel)",
    ]


def test_el_recolector_resuelve_imports_relativos(tmp_path: Path) -> None:
    archivo = tmp_path / "router.py"
    archivo.write_text(
        "from .repository import XRepository\n"
        "from . import models\n"
        "from ..otro.service import S\n",
        encoding="utf-8",
    )

    assert _importados(archivo, "app.modules.x") == {
        "app.modules.x.repository",
        "app.modules.x.repository.XRepository",
        "app.modules.x",
        "app.modules.x.models",
        "app.modules.otro.service",
        "app.modules.otro.service.S",
    }
    assert _ofensores(archivo, PROHIBIDO_EN_ROUTER, "app.modules.x") == [
        "app.modules.x.models (regla: *.models)",
        "app.modules.x.repository (regla: *.repository)",
        "app.modules.x.repository.XRepository (regla: *.repository)",
    ]


def test_el_paquete_de_un_archivo_de_app_se_deriva_de_su_ruta() -> None:
    assert _paquete_de(MODULES / "pedidos" / "router.py") == "app.modules.pedidos"


# ─── R2: el núcleo no depende de los módulos de negocio ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize("archivo", _archivos("core/**/*.py"), ids=_relativo)
def test_core_no_importa_modulos_de_negocio(archivo: Path) -> None:
    _verificar(archivo, ("app.modules",))


# ─── R3: dependencia unidireccional y capas inferiores sin framework web ─────────────────────────────────────────────
PROHIBIDO_EN_REPOSITORY = ("*.schemas", "*.service", "*.router", "*.dependencies", "fastapi", "starlette")
PROHIBIDO_EN_UNIT_OF_WORK = ("*.service", "*.router", "*.dependencies", "fastapi", "starlette", "app.core.database")
PROHIBIDO_EN_SERVICE = ("*.router", "*.dependencies", "fastapi", "starlette")
PROHIBIDO_EN_MODELS = ("*.repository", "*.service", "*.router", "*.dependencies", "fastapi", "starlette")

REGLAS_DE_CAPA = [
    ("modules/**/repository.py", PROHIBIDO_EN_REPOSITORY),
    ("modules/**/unit_of_work.py", PROHIBIDO_EN_UNIT_OF_WORK),
    ("core/uow.py", PROHIBIDO_EN_UNIT_OF_WORK),
    ("core/repository.py", PROHIBIDO_EN_REPOSITORY),
    ("modules/**/service.py", PROHIBIDO_EN_SERVICE),
    ("core/service.py", PROHIBIDO_EN_SERVICE),
    ("modules/**/models.py", PROHIBIDO_EN_MODELS),
]
CASOS_DE_CAPA = [(a, reglas) for patron, reglas in REGLAS_DE_CAPA for a in _archivos(patron)]


@pytest.mark.parametrize("archivo, prohibidos", CASOS_DE_CAPA, ids=[_relativo(a) for a, _ in CASOS_DE_CAPA])
def test_capa_inferior_no_importa_capas_superiores_ni_el_framework_web(archivo: Path, prohibidos: tuple[str, ...]) -> None:
    _verificar(archivo, prohibidos)
