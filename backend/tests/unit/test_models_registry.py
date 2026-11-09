"""Registro único de modelos: `import_all_models()` expone toda la metadata sin lista manual."""
import subprocess
import sys
from pathlib import Path

from app.db.models import import_all_models
from tests.support.schema_expectations import TABLAS_ESPERADAS

MODULES_DIR = Path(__file__).resolve().parents[2] / "app" / "modules"


def test_import_all_models_devuelve_exactamente_las_17_tablas_esperadas() -> None:
    metadata = import_all_models()

    assert set(metadata.tables) == set(TABLAS_ESPERADAS)


def test_import_all_models_importa_cada_modulo_que_tiene_models_py() -> None:
    modulos_con_models = sorted(p.parent.name for p in MODULES_DIR.glob("*/models.py"))
    assert modulos_con_models  # el descubrimiento por filesystem no puede quedar vacío

    import_all_models()

    for nombre in modulos_con_models:
        assert f"app.modules.{nombre}.models" in sys.modules


def test_import_all_models_llamada_dos_veces_devuelve_la_misma_metadata_sin_duplicar_tablas() -> None:
    primera = import_all_models()
    cantidad = len(primera.tables)

    segunda = import_all_models()

    assert segunda is primera
    assert len(segunda.tables) == cantidad == len(TABLAS_ESPERADAS)


def test_import_all_models_en_un_proceso_limpio_registra_las_17_tablas_sin_depender_de_otros_imports() -> None:
    """Un proceso nuevo (como `alembic` o el seed) no tiene los modelos importados de antemano."""
    codigo = (
        "from app.db.models import import_all_models; "
        "print(','.join(sorted(import_all_models().tables)))"
    )

    resultado = subprocess.run(
        [sys.executable, "-c", codigo],
        cwd=MODULES_DIR.parents[1],
        capture_output=True,
        text=True,
        check=True,
    )

    assert set(resultado.stdout.strip().split(",")) == set(TABLAS_ESPERADAS)
