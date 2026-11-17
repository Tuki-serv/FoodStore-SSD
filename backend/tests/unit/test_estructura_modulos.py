"""Estructura objetivo de módulos del backend (C-25a, D6): carpetas de `app/modules` y archivos del núcleo."""
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app"

MODULOS_ESPERADOS = {
    "auth",
    "refreshtokens",
    "usuarios",
    "direcciones",
    "categorias",
    "productos",
    "pedidos",
    "pagos",
    "admin",
    "ingredientes",
    "unidades_medida",
    "health",
}


def _carpetas_de_modulos() -> set[str]:
    return {
        p.name
        for p in (APP / "modules").iterdir()
        if p.is_dir() and p.name != "__pycache__" and any(p.glob("*.py"))
    }


def test_modulos_carpetas_coinciden_con_la_estructura_objetivo() -> None:
    reales = _carpetas_de_modulos()
    assert reales == MODULOS_ESPERADOS, (
        f"sobrantes: {sorted(reales - MODULOS_ESPERADOS)}; faltantes: {sorted(MODULOS_ESPERADOS - reales)}"
    )


def test_core_expone_uow_y_no_conserva_archivos_viejos() -> None:
    assert (APP / "core" / "uow.py").is_file()
    assert not (APP / "core" / "unit_of_work.py").exists()
    assert not (APP / "core" / "deps.py").exists()
