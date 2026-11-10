"""Renovación (`POST /auth/refresh`): rotación con historial, vencimiento fijo, gracia y reuso."""
import logging
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import decode_access_token, hash_refresh_token
from app.core.timestamps import utc_now
from tests.conftest import presentar_refresh
from tests.support.auth_helpers import (
    cookie_de_refresh_borrada,
    iniciar_sesion,
    renovar,
    refresh_tokens_de,
    sesion_del_access,
    todas_las_sesiones,
)


# ── Rotación ────────────────────────────────────────────────────────────────

def test_refresh_rota_el_token_conserva_sid_y_vencimiento_y_deja_un_solo_activo(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    sesion = sesion_del_access(session, login.json()["access_token"])
    vencimiento_antes = sesion.expires_at
    refresh_login = login.cookies.get("refresh_token")

    response = renovar(client, refresh_login)

    assert response.status_code == 200
    assert decode_access_token(response.json()["access_token"])["sid"] == str(sesion.id)
    nuevo = response.cookies.get("refresh_token")
    assert nuevo and nuevo != refresh_login
    assert "refresh_token" not in response.json()
    tokens = refresh_tokens_de(session, sesion)
    assert len(tokens) == 2
    anterior, actual = tokens
    assert anterior.revoked_at is not None
    assert actual.revoked_at is None
    sesion_despues = sesion_del_access(session, response.json()["access_token"])
    assert sesion_despues.expires_at == vencimiento_antes


def test_tres_renovaciones_encadenadas_dejan_cuatro_refresh_tres_rotados_y_uno_activo(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    sesion = sesion_del_access(session, login.json()["access_token"])
    valor = login.cookies.get("refresh_token")
    valores = [valor]

    for _ in range(3):
        response = renovar(client, valor)
        assert response.status_code == 200
        valor = response.cookies.get("refresh_token")
        valores.append(valor)

    tokens = refresh_tokens_de(session, sesion)
    assert len(tokens) == 4
    assert [t.revoked_at is not None for t in tokens] == [True, True, True, False]
    assert len(set(valores)) == 4


def test_renovar_despues_de_que_un_admin_agrega_un_rol_incluye_el_rol_nuevo_en_el_access(
    client: TestClient, admin_auth_headers: dict, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    refresh_cookie = login.cookies.get("refresh_token")
    assert decode_access_token(login.json()["access_token"])["roles"] == ["CLIENT"]
    cambio = client.patch(
        f"/api/v1/admin/usuarios/{normal_user['id']}",
        json={"roles_codigos": ["CLIENT", "STOCK"]},
        headers=admin_auth_headers,
    )
    assert cambio.status_code == 200

    response = renovar(client, refresh_cookie)

    assert response.status_code == 200
    assert sorted(decode_access_token(response.json()["access_token"])["roles"]) == ["CLIENT", "STOCK"]


def test_refresh_de_login_y_de_renovacion_tienen_la_misma_longitud_y_no_son_jwt(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    de_login = login.cookies.get("refresh_token")

    de_renovacion = renovar(client, de_login).cookies.get("refresh_token")

    assert len(de_login) == len(de_renovacion) == 43
    assert "." not in de_login and "." not in de_renovacion


# ── Rechazos sin alarma ─────────────────────────────────────────────────────

def test_refresh_sin_cookie_devuelve_401(client: TestClient) -> None:
    assert renovar(client, None).status_code == 401


def test_refresh_con_cookie_desconocida_devuelve_401_y_borra_la_cookie(client: TestClient) -> None:
    response = renovar(client, "valor-que-no-existe-en-ninguna-fila")

    assert response.status_code == 401
    assert cookie_de_refresh_borrada(response)


def test_refresh_valido_en_el_body_pero_sin_cookie_devuelve_401(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    valor = iniciar_sesion(client, normal_user_data).cookies.get("refresh_token")
    presentar_refresh(client, None)

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": valor})

    assert response.status_code == 401


def test_refresh_de_sesion_vencida_devuelve_401_sin_crear_refresh_ni_cerrar_sesiones(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    sesion = sesion_del_access(session, login.json()["access_token"])
    sesion.expires_at = utc_now() - timedelta(days=1)
    session.add(sesion)
    session.commit()

    response = renovar(client, login.cookies.get("refresh_token"))

    assert response.status_code == 401
    assert cookie_de_refresh_borrada(response)
    assert len(refresh_tokens_de(session, sesion)) == 1
    assert [s.revoked_at for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]] == [None]


def test_refresh_de_usuario_dado_de_baja_devuelve_401(
    client: TestClient, admin_auth_headers: dict, normal_user: dict, normal_user_data: dict
) -> None:
    valor = iniciar_sesion(client, normal_user_data).cookies.get("refresh_token")
    baja = client.delete(f"/api/v1/admin/usuarios/{normal_user['id']}", headers=admin_auth_headers)
    assert baja.status_code == 204

    assert renovar(client, valor).status_code == 401


def test_refresh_de_sesion_cerrada_por_logout_all_devuelve_401_y_conserva_el_motivo(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    celular = iniciar_sesion(client, normal_user_data)
    iniciar_sesion(client, normal_user_data)  # segunda sesión (otro navegador)
    ahora = utc_now()
    sesiones = [s for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]]
    assert len(sesiones) == 2
    for sesion in sesiones:
        sesion.revoked_at, sesion.revoked_reason = ahora, "LOGOUT_ALL"
        session.add(sesion)
    session.commit()

    response = renovar(client, celular.cookies.get("refresh_token"))

    assert response.status_code == 401
    estados = [(s.revoked_reason) for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]]
    assert estados == ["LOGOUT_ALL", "LOGOUT_ALL"]


# ── Período de gracia ───────────────────────────────────────────────────────

def _rotar_y_envejecer(client: TestClient, session: Session, user_data: dict, segundos: int):
    """Login + una rotación R1 -> R2; deja `R1.revoked_at` hace `segundos`. Devuelve (sesion, R1, R2)."""
    login = iniciar_sesion(client, user_data)
    sesion = sesion_del_access(session, login.json()["access_token"])
    r1 = login.cookies.get("refresh_token")
    r2 = renovar(client, r1).cookies.get("refresh_token")
    viejo = refresh_tokens_de(session, sesion)[0]
    viejo.revoked_at = utc_now() - timedelta(seconds=segundos)
    session.add(viejo)
    session.commit()
    return sesion, r1, r2


def test_refresh_rotado_dentro_de_la_gracia_devuelve_access_sin_cookie_y_sin_nuevo_activo(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    sesion, r1, r2 = _rotar_y_envejecer(client, session, normal_user_data, segundos=10)

    response = renovar(client, r1)  # segunda pestaña presenta R1 diez segundos después

    assert response.status_code == 200
    assert decode_access_token(response.json()["access_token"])["sid"] == str(sesion.id)
    assert response.headers.get_list("set-cookie") == []
    tokens = refresh_tokens_de(session, sesion)
    assert len(tokens) == 2
    activos = [t for t in tokens if t.revoked_at is None]
    assert len(activos) == 1
    assert activos[0].token_hash == hash_refresh_token(r2)


# ── Detección de reuso ──────────────────────────────────────────────────────

def test_refresh_rotado_fuera_de_la_gracia_cierra_todas_las_sesiones_abiertas_con_reuso(
    client: TestClient, session: Session, caplog, normal_user: dict, normal_user_data: dict
) -> None:
    sesion_1, r1, _ = _rotar_y_envejecer(client, session, normal_user_data, segundos=60)
    sesion_2 = sesion_del_access(session, iniciar_sesion(client, normal_user_data).json()["access_token"])
    sesion_3 = sesion_del_access(session, iniciar_sesion(client, normal_user_data).json()["access_token"])
    cierre_previo = utc_now() - timedelta(hours=1)
    sesion_3.revoked_at, sesion_3.revoked_reason = cierre_previo, "LOGOUT"
    session.add(sesion_3)
    session.commit()

    with caplog.at_level(logging.WARNING):
        response = renovar(client, r1)

    assert response.status_code == 401
    assert cookie_de_refresh_borrada(response)
    # `_todas_las_sesiones` relee de la base: la revocación debe persistir aunque la respuesta sea 401 (D16)
    motivos = {s.id: s.revoked_reason for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]}
    assert motivos == {sesion_1.id: "REUSO", sesion_2.id: "REUSO", sesion_3.id: "LOGOUT"}
    cerrada = next(s for s in todas_las_sesiones(session) if s.id == sesion_3.id)
    assert cerrada.revoked_at == cierre_previo
    avisos = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(avisos) == 1
    mensaje = avisos[0].getMessage()
    assert "reuso" in mensaje.lower()
    assert str(normal_user["id"]) in mensaje
    assert r1 not in mensaje and hash_refresh_token(r1) not in mensaje


def test_con_gracia_en_cero_un_refresh_rotado_hace_un_segundo_se_trata_como_reuso(
    client: TestClient, session: Session, monkeypatch, normal_user: dict, normal_user_data: dict
) -> None:
    monkeypatch.setattr(settings, "REFRESH_REUSE_GRACE_SECONDS", 0)
    sesion, r1, _ = _rotar_y_envejecer(client, session, normal_user_data, segundos=1)

    response = renovar(client, r1)

    assert response.status_code == 401
    assert [s.revoked_reason for s in todas_las_sesiones(session) if s.id == sesion.id] == ["REUSO"]


def test_renovar_con_otro_user_agent_responde_200_y_la_sesion_conserva_el_original(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data, user_agent="TestAgent/1.0")

    response = renovar(client, login.cookies.get("refresh_token"), user_agent="OtroAgente/2.0")

    assert response.status_code == 200
    sesion = sesion_del_access(session, response.json()["access_token"])
    assert sesion.user_agent == "TestAgent/1.0"
