"""Primitivas de seguridad: refresh opaco con hash SHA-256 y access JWT con `sid` (sin BD)."""
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_refresh_token,
    new_refresh_token,
)

SID = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"


# ── Refresh opaco ───────────────────────────────────────────────────────────

def test_hash_refresh_token_devuelve_el_sha256_hex_conocido() -> None:
    assert hash_refresh_token("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_hash_refresh_token_otra_entrada_da_otro_hash_de_64_caracteres() -> None:
    resultado = hash_refresh_token("")

    assert resultado == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert len(resultado) == 64


def test_new_refresh_token_devuelve_plano_y_su_hash() -> None:
    plano, hash_ = new_refresh_token()

    assert hash_ == hash_refresh_token(plano)
    assert len(hash_) == 64


def test_new_refresh_token_no_tiene_forma_de_jwt() -> None:
    plano, _ = new_refresh_token()

    assert "." not in plano
    assert len(plano) >= 43  # 32 bytes en base64 url-safe


def test_new_refresh_token_dos_llamadas_dan_valores_distintos() -> None:
    primero, hash_primero = new_refresh_token()
    segundo, hash_segundo = new_refresh_token()

    assert primero != segundo
    assert hash_primero != hash_segundo


# ── Access token ────────────────────────────────────────────────────────────

def test_create_access_token_incluye_sub_roles_sid_type_y_exp() -> None:
    antes = datetime.now(timezone.utc)

    token = create_access_token(sub="5", roles=["CLIENT"], sid=SID)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "5"
    assert payload["roles"] == ["CLIENT"]
    assert payload["sid"] == SID
    assert payload["type"] == "access"
    esperado = antes + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    assert abs((exp - esperado).total_seconds()) < 10


def test_create_access_token_con_varios_roles_los_conserva_en_orden() -> None:
    token = create_access_token(sub="12", roles=["ADMIN", "STOCK"], sid=SID)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["roles"] == ["ADMIN", "STOCK"]
    assert payload["sub"] == "12"


def test_decode_access_token_rechaza_un_jwt_de_tipo_refresh() -> None:
    token = jwt.encode(
        {"sub": "5", "type": "refresh", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    assert decode_access_token(token) is None


def test_decode_access_token_rechaza_un_token_vencido() -> None:
    token = jwt.encode(
        {"sub": "5", "type": "access", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    assert decode_access_token(token) is None


# ── Hash de relleno (login sin diferencia de tiempo) ────────────────────────

def test_hash_de_relleno_es_un_bcrypt_valido_de_cost_12_que_no_coincide_con_contrasenas_comunes() -> None:
    from app.core.security import DUMMY_PASSWORD_HASH, verify_password

    assert DUMMY_PASSWORD_HASH.startswith("$2b$12$")
    assert len(DUMMY_PASSWORD_HASH) == 60
    assert verify_password("cualquier-contrasena", DUMMY_PASSWORD_HASH) is False
    assert verify_password("", DUMMY_PASSWORD_HASH) is False
