"""Rate limiting del login: solo cuentan los intentos fallidos, por IP, en una ventana deslizante (RN-AU-08)."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from freezegun import freeze_time
from sqlmodel import Session, func, select

from app.modules.refreshtokens.models import Sesion
from tests.support.login import fallar_login, login

T0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
ADMIN = ("admin@foodstore.com", "admin123")


def _cliente_desde(client: TestClient, ip: str) -> TestClient:
    """Otro cliente contra la misma app y BD pero con otra IP de conexión."""
    return TestClient(client.app, client=(ip, 50000))


def _cantidad_sesiones(session: Session) -> int:
    return session.exec(select(func.count()).select_from(Sesion)).one()


class TestBloqueoPorFallos:
    def test_sexto_login_con_credenciales_correctas_tras_cinco_fallos_da_429_sin_sesion(
        self, client: TestClient, session: Session
    ) -> None:
        fallos = fallar_login(client, 5)
        sesiones_antes = _cantidad_sesiones(session)

        bloqueado = login(client, *ADMIN)

        assert [r.status_code for r in fallos] == [401] * 5
        assert bloqueado.status_code == 429
        cuerpo = bloqueado.json()
        assert cuerpo["code"] == "RATE_LIMIT_EXCEEDED"
        assert cuerpo["field"] is None
        assert cuerpo["detail"]
        assert "error" not in cuerpo
        assert int(bloqueado.headers["retry-after"]) > 0
        assert "set-cookie" not in bloqueado.headers
        assert _cantidad_sesiones(session) == sesiones_antes

    def test_diez_logins_correctos_seguidos_no_se_bloquean(self, client: TestClient) -> None:
        estados = [login(client, *ADMIN).status_code for _ in range(10)]

        assert estados == [200] * 10

    def test_requests_sin_password_422_no_cuentan_como_fallo(self, client: TestClient) -> None:
        invalidos = [client.post("/api/v1/auth/login", data={"username": "a@b.com"}).status_code for _ in range(6)]

        assert invalidos == [422] * 6
        assert login(client, *ADMIN).status_code == 200

    def test_fallos_de_una_ip_no_bloquean_a_otra(self, client: TestClient) -> None:
        fallar_login(client, 5)

        otra = _cliente_desde(client, "10.0.0.2")

        assert login(otra, *ADMIN).status_code == 200
        assert login(client, *ADMIN).status_code == 429

    def test_x_forwarded_for_no_permite_evadir_el_bloqueo(self, client: TestClient) -> None:
        fallar_login(client, 5)

        respuesta = login(client, *ADMIN, headers={"X-Forwarded-For": "203.0.113.9"})

        assert respuesta.status_code == 429

    def test_email_inexistente_y_usuario_dado_de_baja_tambien_cuentan(
        self, client: TestClient, normal_user: dict, normal_user_data: dict, session: Session
    ) -> None:
        from app.core.timestamps import utc_now
        from app.modules.usuarios.models import Usuario

        usuario = session.get(Usuario, normal_user["id"])
        usuario.deleted_at = utc_now()
        session.add(usuario)
        session.commit()

        mixtos = [
            login(client, "fantasma@example.com", "x").status_code,
            login(client, normal_user_data["email"], normal_user_data["password"]).status_code,
            login(client, "fantasma@example.com", "y").status_code,
            login(client, "otro@example.com", "x").status_code,
            login(client, normal_user_data["email"], "mala").status_code,
        ]

        assert mixtos == [401] * 5
        assert login(client, *ADMIN).status_code == 429


class TestVentanaDeslizante:
    def test_bloqueo_dura_quince_minutos_exactos_desde_el_primer_fallo(self, client: TestClient) -> None:
        with freeze_time(T0) as reloj:
            fallar_login(client, 5)

            reloj.move_to("2026-01-01 12:14:00")
            a_los_14 = login(client, *ADMIN)
            reloj.move_to("2026-01-01 12:15:00")
            a_los_15 = login(client, *ADMIN)

        assert a_los_14.status_code == 429
        assert a_los_15.status_code == 200

    def test_fallos_viejos_salen_de_la_ventana(self, client: TestClient) -> None:
        with freeze_time(T0) as reloj:
            fallar_login(client, 4)
            reloj.move_to("2026-01-01 12:16:00")
            fallar_login(client, 1)

            siguiente = fallar_login(client, 1)[0]

        assert siguiente.status_code == 401

    def test_retry_after_refleja_el_tiempo_restante(self, client: TestClient) -> None:
        with freeze_time(T0) as reloj:
            fallar_login(client, 5)
            reloj.move_to("2026-01-01 12:01:00")

            bloqueado = login(client, *ADMIN)

        assert bloqueado.status_code == 429
        assert bloqueado.headers["retry-after"] == "840"


class TestReinicioPorLoginExitoso:
    def test_login_correcto_reinicia_la_cuenta(self, client: TestClient) -> None:
        fallar_login(client, 4)
        assert login(client, *ADMIN).status_code == 200

        despues = fallar_login(client, 4)

        assert [r.status_code for r in despues] == [401] * 4
        assert login(client, *ADMIN).status_code == 200

    def test_cinco_fallos_tras_un_login_correcto_bloquean(self, client: TestClient) -> None:
        fallar_login(client, 4)
        assert login(client, *ADMIN).status_code == 200
        fallar_login(client, 5)

        assert login(client, *ADMIN).status_code == 429

    def test_login_correcto_de_otra_ip_no_reinicia_los_fallos_de_la_primera(self, client: TestClient) -> None:
        fallar_login(client, 5)
        otra = _cliente_desde(client, "10.0.0.2")
        assert login(otra, *ADMIN).status_code == 200

        assert login(client, *ADMIN).status_code == 429


class TestSinLimiteEnOtrosEndpoints:
    """Solo el login tiene rate limiting: el resto de la API no cuenta ni emite `X-RateLimit-*`."""

    def test_register_veinte_veces_seguidas_no_da_429(self, client: TestClient) -> None:
        estados = [
            client.post(
                "/api/v1/auth/register",
                json={"email": f"nuevo{i}@example.com", "password": "TestPass123!", "nombre": "N", "apellido": "U"},
            ).status_code
            for i in range(20)
        ]

        assert 429 not in estados
        assert estados == [201] * 20

    @pytest.mark.parametrize(
        ("metodo", "url"),
        [
            ("post", "/api/v1/auth/refresh"),
            ("post", "/api/v1/auth/logout"),
            ("post", "/api/v1/auth/logout-all"),
            ("get", "/api/v1/auth/me"),
        ],
    )
    def test_endpoints_de_auth_distintos_del_login_no_dan_429_en_veinte_requests(
        self, client: TestClient, metodo: str, url: str
    ) -> None:
        estados = {getattr(client, metodo)(url).status_code for _ in range(20)}

        assert 429 not in estados

    def test_catalogo_cien_requests_no_da_429_ni_headers_x_ratelimit(self, client: TestClient) -> None:
        respuestas = [client.get("/api/v1/productos/") for _ in range(100)]

        assert {r.status_code for r in respuestas} == {200}
        assert not any(h.lower().startswith("x-ratelimit") for r in respuestas for h in r.headers)

    def test_me_y_refresh_validos_siguen_en_200_con_la_ip_bloqueada_en_login(self, client: TestClient) -> None:
        sesion = login(client, *ADMIN)
        access = sesion.json()["access_token"]
        fallar_login(client, 5)
        assert login(client, *ADMIN).status_code == 429

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
        refresh = client.post("/api/v1/auth/refresh")

        assert me.status_code == 200
        assert refresh.status_code == 200
