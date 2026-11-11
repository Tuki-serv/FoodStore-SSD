"""Helpers de login para los tests de rate limiting."""
from fastapi.testclient import TestClient
from httpx import Response

LOGIN_URL = "/api/v1/auth/login"


def login(client: TestClient, email: str, password: str, **kwargs) -> Response:
    return client.post(LOGIN_URL, data={"username": email, "password": password}, **kwargs)


def fallar_login(client: TestClient, n: int, email: str = "nadie@example.com", **kwargs) -> list[Response]:
    """Hace `n` logins con contraseña incorrecta y devuelve las respuestas."""
    return [login(client, email, "contraseña-incorrecta", **kwargs) for _ in range(n)]
