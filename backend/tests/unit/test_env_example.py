"""Las plantillas de entorno documentan el contrato de `Settings` (D11).

- `backend/.env.example` y `backend/tests/.env.test.example` se validan contra `Settings`.
- El `.env.example` de la RAÍZ solo trae variables de docker-compose (`POSTGRES_*`, `PGADMIN_*`): NO se valida
  contra `Settings`; se comprueba que contiene exactamente esas claves.

`ENV_EXAMPLES_DIR` (opcional) permite validar plantillas desde otro directorio con los mismos nombres de archivo
(`.env.example`, `.env.test.example`) antes de copiarlas.
"""
import os
import re
from pathlib import Path

import pytest
from dotenv import dotenv_values

from app.core.config import Settings
from tests.support.settings_env import OPTIONAL_FIELDS

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
_OVERRIDE = os.environ.get("ENV_EXAMPLES_DIR")
# Nombre mostrado -> ruta real de cada plantilla validada contra `Settings`.
EXAMPLE_PATHS: dict[str, Path] = (
    {".env.example": Path(_OVERRIDE) / ".env.example", ".env.test.example": Path(_OVERRIDE) / ".env.test.example"}
    if _OVERRIDE
    else {".env.example": BACKEND_DIR / ".env.example", ".env.test.example": BACKEND_DIR / "tests" / ".env.test.example"}
)
ROOT_COMPOSE_EXAMPLE = Path(_OVERRIDE) / "root.env.example" if _OVERRIDE else PROJECT_ROOT / ".env.example"
COMPOSE_KEYS = {"POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "PGADMIN_EMAIL", "PGADMIN_PASSWORD"}
EXAMPLE_FILES = list(EXAMPLE_PATHS)
KEY_PATTERN = re.compile(r"^\s*#?\s*([A-Z][A-Z0-9_]*)=")
WITHDRAWN = ("MP_WEBHOOK_URL", "NGROK_URL", "VITE_FRONTEND_URL")


def _read(name: str) -> list[str]:
    return EXAMPLE_PATHS[name].read_text(encoding="utf-8").splitlines()


def _keys(lines: list[str]) -> set[str]:
    """Claves presentes, activas o comentadas (`# KEY=`)."""
    return {m.group(1) for line in lines if (m := KEY_PATTERN.match(line))}


def _block_of(lines: list[str], index: int) -> list[str]:
    """Líneas contiguas (sin línea en blanco) que rodean a `lines[index]`."""
    start = index
    while start > 0 and lines[start - 1].strip():
        start -= 1
    end = index
    while end + 1 < len(lines) and lines[end + 1].strip():
        end += 1
    return lines[start : end + 1]


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_carga_settings_solo_con_sus_valores(name: str) -> None:
    cfg = Settings(_env_file=EXAMPLE_PATHS[name])

    assert cfg.ENVIRONMENT in {"development", "test"}
    assert cfg.DATABASE_URL.startswith("postgresql+psycopg://")
    assert isinstance(cfg.CORS_ORIGINS, list) and cfg.CORS_ORIGINS


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_incluye_toda_variable_declarada_en_settings(name: str) -> None:
    missing = set(Settings.model_fields) - _keys(_read(name))

    assert missing == set()


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_claves_extra_solo_en_bloques_de_docker_compose_o_frontend(name: str) -> None:
    lines = _read(name)
    extras = _keys(lines) - set(Settings.model_fields)

    allowed = {k for k in extras if k.startswith(("POSTGRES_", "PGADMIN_", "VITE_"))}
    assert extras == allowed
    text = "\n".join(lines).lower()
    if any(k.startswith(("POSTGRES_", "PGADMIN_")) for k in extras):
        assert "docker-compose" in text
    if any(k.startswith("VITE_") for k in extras):
        assert "frontend" in text


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_no_contiene_variables_retiradas(name: str) -> None:
    keys = _keys(_read(name))

    assert keys.isdisjoint(WITHDRAWN)


@pytest.mark.parametrize("name", EXAMPLE_FILES)
@pytest.mark.parametrize("field", OPTIONAL_FIELDS)
def test_example_marca_cada_opcional_como_opcional_en_su_bloque(name: str, field: str) -> None:
    lines = _read(name)
    index = next(i for i, line in enumerate(lines) if (m := KEY_PATTERN.match(line)) and m.group(1) == field)

    block = "\n".join(_block_of(lines, index)).lower()

    assert "opcional" in block


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_cada_variable_tiene_un_comentario_en_su_bloque(name: str) -> None:
    lines = _read(name)
    sin_comentario = [
        m.group(1)
        for i, line in enumerate(lines)
        if (m := KEY_PATTERN.match(line)) and not any(l.lstrip().startswith("#") and not KEY_PATTERN.match(l) for l in _block_of(lines, i))
    ]

    assert sin_comentario == []


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_usa_placeholders_evidentes_y_ningun_secreto_real(name: str) -> None:
    values = {k: v for k, v in dotenv_values(EXAMPLE_PATHS[name]).items() if v}

    assert "CHANGE_ME" in values["DATABASE_URL"]
    assert "CHANGE_ME" in values["SECRET_KEY"] or values["SECRET_KEY"].startswith("test-only-not-a-secret")


def test_example_de_la_raiz_solo_define_variables_de_docker_compose() -> None:
    """El `.env.example` de la raíz alimenta solo al compose: exactamente POSTGRES_* y PGADMIN_*."""
    lines = ROOT_COMPOSE_EXAMPLE.read_text(encoding="utf-8").splitlines()

    assert _keys(lines) == COMPOSE_KEYS
    values = dotenv_values(ROOT_COMPOSE_EXAMPLE)
    assert "CHANGE_ME" in (values["POSTGRES_PASSWORD"] or "")
    assert "CHANGE_ME" in (values["PGADMIN_PASSWORD"] or "")


def test_example_de_la_raiz_no_se_valida_contra_settings() -> None:
    """Documenta la decisión D11: las claves de la raíz no son campos de `Settings`."""
    assert COMPOSE_KEYS.isdisjoint(Settings.model_fields)
