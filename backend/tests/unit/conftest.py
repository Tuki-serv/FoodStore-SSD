"""Fixtures de entorno para los tests unitarios de configuración (sin BD)."""
import pytest

from app.core.config import Settings
from tests.support.settings_env import OPTIONAL_ENV, POSTGRES_VARS, REQUIRED_ENV, RETIRED_VARS


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Quita del entorno todo lo que `pytest-dotenv` cargó desde `tests/.env.test`."""
    for key in (*Settings.model_fields, *RETIRED_VARS, *POSTGRES_VARS):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def required_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Solo las variables obligatorias, con placeholders falsos."""
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)
    return dict(REQUIRED_ENV)


@pytest.fixture
def full_env(monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]) -> dict[str, str]:
    """Obligatorias más las opcionales (MercadoPago, URLs de pago, Cloudinary) con dummies."""
    for key, value in OPTIONAL_ENV.items():
        monkeypatch.setenv(key, value)
    return {**required_env, **OPTIONAL_ENV}
