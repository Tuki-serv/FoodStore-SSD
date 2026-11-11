"""Configuración de Alembic y hook de render de tipos (sin BD)."""
import os
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlmodel.sql.sqltypes import AutoString

from app.db.migrations import MultipleHeadsError, build_alembic_config, ensure_single_head, render_item

BACKEND_DIR = Path(__file__).resolve().parents[2]


def test_build_alembic_config_apunta_al_alembic_ini_del_backend_y_su_script_location_existe() -> None:
    cfg = build_alembic_config()

    assert Path(cfg.config_file_name) == BACKEND_DIR / "alembic.ini"
    script_location = Path(cfg.get_main_option("script_location"))
    assert script_location.is_dir()
    assert script_location == BACKEND_DIR / "alembic"


def test_build_alembic_config_con_conexion_la_deja_en_attributes() -> None:
    conexion = object()

    cfg = build_alembic_config(connection=conexion)  # type: ignore[arg-type]

    assert cfg.attributes["connection"] is conexion


def test_build_alembic_config_sin_conexion_no_define_attributes_connection() -> None:
    assert "connection" not in build_alembic_config().attributes


def test_historial_de_migraciones_tiene_una_sola_cabeza() -> None:
    script = ScriptDirectory.from_config(build_alembic_config())

    assert ensure_single_head(script) == "003"


def _script_dir_con_revisiones(tmp_path: Path, revisiones: dict[str, str | None]) -> ScriptDirectory:
    versions = tmp_path / "versions"
    versions.mkdir()
    for rev, down in revisiones.items():
        lineas = [
            f'revision = "{rev}"',
            f"down_revision = {down!r}",
            "branch_labels = None",
            "depends_on = None",
            "def upgrade() -> None: pass",
            "def downgrade() -> None: pass",
            "",
        ]
        contenido = os.linesep.join(lineas)
        (versions / f"{rev}_x.py").write_text(contenido, encoding="utf-8")
    cfg = Config()
    cfg.set_main_option("script_location", str(tmp_path))
    return ScriptDirectory.from_config(cfg)


def test_ensure_single_head_dos_migraciones_con_el_mismo_padre_falla_e_informa_las_cabezas(tmp_path: Path) -> None:
    script = _script_dir_con_revisiones(tmp_path, {"001": None, "002": "001", "003": "001"})

    with pytest.raises(MultipleHeadsError, match=r"002.*003|003.*002"):
        ensure_single_head(script)


def test_ensure_single_head_historial_lineal_devuelve_la_cabeza(tmp_path: Path) -> None:
    script = _script_dir_con_revisiones(tmp_path, {"001": None, "002": "001"})

    assert ensure_single_head(script) == "002"


def test_render_item_autostring_con_longitud_se_escribe_como_sa_string() -> None:
    assert render_item("type", AutoString(length=80), None) == "sa.String(length=80)"


def test_render_item_autostring_sin_longitud_se_escribe_como_sa_string_sin_argumentos() -> None:
    assert render_item("type", AutoString(), None) == "sa.String()"


def test_render_item_otro_tipo_devuelve_false_para_usar_el_render_por_defecto() -> None:
    assert render_item("type", sa.Integer(), None) is False
    assert render_item("column", AutoString(length=80), None) is False
