"""Matriz RBAC ejecutable: cada endpoint HTTP × cada perfil (simple y multi-rol).

Reglas verificadas (spec rbac-authorization): permitido => ni 401 ni 403 (puede ser 404/422: la autorización se
resuelve antes de validar el body y de buscar el recurso); denegado a un autenticado => 403; anónimo en ruta
protegida => 401. El acceso esperado de un perfil multi-rol es la UNIÓN de sus roles, calculada acá con
operaciones de conjuntos y nunca con código de producción.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from tests.support.auth_helpers import bearer_con_roles
from tests.support.rbac_matriz import (
    AUTENTICADO,
    EXCLUIDAS,
    FILAS,
    PERFILES_MULTIROL,
    PERFILES_SIMPLES,
    PUBLICO,
    Fila,
)

_METODOS_HTTP = {"get", "post", "put", "patch", "delete"}


def _rutas_http_registradas() -> set[tuple[str, str]]:
    """(método, plantilla) de toda ruta HTTP publicada en el esquema OpenAPI (API pública de FastAPI)."""
    return {
        (metodo.upper(), plantilla)
        for plantilla, operaciones in app.openapi()["paths"].items()
        for metodo in operaciones
        if metodo in _METODOS_HTTP
    }


def test_matriz_cubre_toda_ruta_http_registrada_y_no_tiene_filas_huerfanas() -> None:
    registradas = _rutas_http_registradas()
    en_matriz = {(fila.metodo, fila.plantilla.replace(":path}", "}")) for fila in FILAS}
    excluidas_http = {clave for clave in EXCLUIDAS if clave[0] != "WS"}

    assert registradas - en_matriz - excluidas_http == set(), "rutas registradas sin fila ni exclusión"
    assert en_matriz - registradas == set(), "filas de la matriz sin ruta registrada"
    assert en_matriz & excluidas_http == set(), "una ruta no puede estar a la vez en la matriz y excluida"


def _permitido(fila: Fila, roles: list[str] | None) -> bool:
    if fila.acceso == PUBLICO:
        return True
    if roles is None:
        return False
    if fila.acceso == AUTENTICADO:
        return True
    return bool(set(roles) & fila.acceso)


def _enviar(client: TestClient, fila: Fila, headers: dict[str, str]):
    json = fila.body if fila.body is not None else None
    return client.request(fila.metodo, fila.ruta, headers=headers, json=json)


_PERFILES: dict[str, list[str] | None] = {**PERFILES_SIMPLES, **PERFILES_MULTIROL}


@pytest.fixture(autouse=True)
def _sin_nube(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cloudinary es un borde externo: la matriz solo verifica autorización, nunca sube ni borra imágenes."""
    monkeypatch.setattr("app.core.cloudinary.router.subir_imagen", lambda *a, **k: None)
    monkeypatch.setattr("app.core.cloudinary.router.eliminar_imagen", lambda *a, **k: True)


@pytest.mark.slow  # ~600 casos (~145 s): se marca pero NO se excluye de la corrida por defecto
@pytest.mark.parametrize("perfil", list(_PERFILES))
@pytest.mark.parametrize("fila", FILAS, ids=lambda f: f"{f.metodo} {f.plantilla}")
def test_matriz_rbac_endpoint_por_perfil(client: TestClient, session: Session, fila: Fila, perfil: str) -> None:
    roles = _PERFILES[perfil]
    headers = {} if roles is None else bearer_con_roles(session, roles)

    response = _enviar(client, fila, headers)

    if roles is None:
        if fila.acceso == PUBLICO:
            assert response.status_code != 403
            if not fila.credencial_propia:
                assert response.status_code != 401
        else:
            assert response.status_code == 401
    elif _permitido(fila, roles):
        assert response.status_code != 403
        if not fila.credencial_propia:
            assert response.status_code != 401
    else:
        assert response.status_code == 403
