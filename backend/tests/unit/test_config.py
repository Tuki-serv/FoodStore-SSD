"""Contrato de configuración (`Settings`): obligatorias, opcionales, formatos y variables retiradas.

Sin BD ni `.env`: cada test instancia `Settings(_env_file=None)` sobre un entorno controlado.
"""
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.support.settings_env import OPTIONAL_FIELDS, REQUIRED_ENV, RETIRED_VARS


def _load() -> Settings:
    return Settings(_env_file=None)


def _error_fields(exc: ValidationError) -> set[str]:
    return {str(err["loc"][0]) for err in exc.errors()}


# ── Obligatorias ────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "missing",
    ["DATABASE_URL", "SECRET_KEY", "ACCESS_TOKEN_EXPIRE_MINUTES", "SQL_ECHO", "ALGORITHM", "CORS_ORIGINS"],
)
def test_settings_obligatoria_faltante_falla_nombrandola(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str], missing: str
) -> None:
    monkeypatch.delenv(missing)

    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert missing in _error_fields(exc_info.value)


@pytest.mark.parametrize("missing", ["SECRET_KEY", "DATABASE_URL"])
def test_settings_obligatoria_faltante_con_todas_las_opcionales_presentes_sigue_fallando(
    monkeypatch: pytest.MonkeyPatch, full_env: dict[str, str], missing: str
) -> None:
    monkeypatch.delenv(missing)

    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert _error_fields(exc_info.value) == {missing}


def test_settings_entorno_vacio_enumera_solo_las_obligatorias() -> None:
    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert _error_fields(exc_info.value) == set(REQUIRED_ENV)


def test_settings_obligatoria_vacia_cuenta_como_faltante(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("SECRET_KEY", "")

    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert "SECRET_KEY" in _error_fields(exc_info.value)


# ── Opcionales ──────────────────────────────────────────────────────────────

def test_settings_solo_obligatorias_deja_todas_las_opcionales_en_none(required_env: dict[str, str]) -> None:
    cfg = _load()

    assert [getattr(cfg, name) for name in OPTIONAL_FIELDS] == [None] * len(OPTIONAL_FIELDS)


def test_settings_opcional_definida_vacia_vale_none(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("MP_ACCESS_TOKEN", "")
    monkeypatch.setenv("CLOUDINARY_NAME", "")

    cfg = _load()

    assert cfg.MP_ACCESS_TOKEN is None
    assert cfg.CLOUDINARY_NAME is None


def test_settings_configuracion_completa_usa_exactamente_los_valores_provistos(full_env: dict[str, str]) -> None:
    cfg = _load()

    assert cfg.ENVIRONMENT == "test"
    assert cfg.SECRET_KEY == "k" * 64
    assert cfg.ACCESS_TOKEN_EXPIRE_MINUTES == 15
    assert cfg.LOG_LEVEL == "WARNING"
    assert cfg.SQL_ECHO is False
    assert cfg.MP_ACCESS_TOKEN == "mp-token-falso"
    assert cfg.MP_PUBLIC_KEY == "mp-public-falsa"
    assert cfg.CLOUDINARY_NAME == "nube-falsa"
    assert cfg.CLOUDINARY_API_KEY == "key-falsa"
    assert cfg.CLOUDINARY_API_SECRET == "secret-falso"


# ── ENVIRONMENT ─────────────────────────────────────────────────────────────

def test_settings_environment_production_es_valido(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")

    assert _load().ENVIRONMENT == "production"


def test_settings_environment_invalido_falla_nombrandolo(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")

    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert "ENVIRONMENT" in _error_fields(exc_info.value)


# ── SQL_ECHO ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw, expected", [("true", True), ("false", False)])
def test_settings_sql_echo_se_lee_como_booleano(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str], raw: str, expected: bool
) -> None:
    monkeypatch.setenv("SQL_ECHO", raw)

    assert _load().SQL_ECHO is expected


# ── CORS_ORIGINS ────────────────────────────────────────────────────────────

def test_settings_cors_origins_array_json_se_expone_como_lista_en_orden(required_env: dict[str, str]) -> None:
    assert _load().CORS_ORIGINS == ["http://localhost:5173", "http://localhost:3000"]


def test_settings_cors_origins_separado_por_comas_es_rechazado(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

    with pytest.raises((ValidationError, ValueError)) as exc_info:
        _load()

    assert "CORS_ORIGINS" in str(exc_info.value)


# ── Variables del flujo de pago: explícitas e independientes ────────────────

def test_settings_una_variable_de_pago_no_altera_a_otra(full_env: dict[str, str]) -> None:
    cfg = _load()

    assert cfg.MP_NOTIFICATION_URL == "https://abc.ngrok-free.app/api/v1/pagos/webhook"
    assert cfg.BACKEND_PUBLIC_URL == "https://abc.ngrok-free.app"
    assert cfg.FRONTEND_URL == "https://tienda.example"


def test_settings_frontend_url_no_se_toma_de_cors_origins(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", '["http://otro:3000"]')

    cfg = _load()

    assert cfg.CORS_ORIGINS == ["http://otro:3000"]
    assert cfg.FRONTEND_URL is None


def test_settings_backend_public_url_no_se_deriva_de_mp_notification_url(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("MP_NOTIFICATION_URL", "https://x.example/api/v1/pagos/webhook")

    cfg = _load()

    assert cfg.MP_NOTIFICATION_URL == "https://x.example/api/v1/pagos/webhook"
    assert cfg.BACKEND_PUBLIC_URL is None


# ── Variables retiradas ─────────────────────────────────────────────────────

def test_settings_carga_sin_variables_retiradas(required_env: dict[str, str]) -> None:
    cfg = _load()

    assert not any(hasattr(cfg, name) for name in RETIRED_VARS)


def test_settings_variables_retiradas_presentes_no_alteran_valores_efectivos(
    monkeypatch: pytest.MonkeyPatch, full_env: dict[str, str]
) -> None:
    monkeypatch.setenv("NGROK_URL", "https://viejo.example")
    monkeypatch.setenv("VITE_FRONTEND_URL", "https://viejo-front.example")
    monkeypatch.setenv("MP_WEBHOOK_URL", "https://viejo-hook.example")

    cfg = _load()

    assert cfg.MP_NOTIFICATION_URL == "https://abc.ngrok-free.app/api/v1/pagos/webhook"
    assert cfg.BACKEND_PUBLIC_URL == "https://abc.ngrok-free.app"
    assert cfg.FRONTEND_URL == "https://tienda.example"


def test_settings_variables_retiradas_no_rellenan_opcionales_ausentes(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("NGROK_URL", "https://viejo.example")

    cfg = _load()

    assert cfg.BACKEND_PUBLIC_URL is None
    assert cfg.MP_NOTIFICATION_URL is None


# ── Base de datos ───────────────────────────────────────────────────────────

def test_settings_falta_database_url_aunque_existan_postgres_falla_nombrandola(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.delenv("DATABASE_URL")
    monkeypatch.setenv("POSTGRES_USER", "u")
    monkeypatch.setenv("POSTGRES_PASSWORD", "p")
    monkeypatch.setenv("POSTGRES_DB", "d")

    with pytest.raises(ValidationError) as exc_info:
        _load()

    assert "DATABASE_URL" in _error_fields(exc_info.value)


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://u:p@h:5433/d",
        "postgresql://u:p@h:5432/otra",
    ],
)
def test_settings_database_url_se_usa_exactamente_tal_cual(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str], url: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", url)

    assert _load().DATABASE_URL == url


def test_settings_no_declara_ningun_campo_postgres() -> None:
    assert [name for name in Settings.model_fields if name.startswith("POSTGRES_")] == []


def test_settings_variables_postgres_presentes_no_cambian_la_url_efectiva(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str]
) -> None:
    monkeypatch.setenv("POSTGRES_USER", "otro")
    monkeypatch.setenv("POSTGRES_DB", "otra")

    assert _load().DATABASE_URL == "postgresql+psycopg://u:p@h:5433/d_test"
