"""`AppError.http`: error de dominio con el código `HTTP_<status>` que los services lanzan sin importar FastAPI (C-25a, D3)."""
from app.core.errors import AppError


def test_http_arma_estado_codigo_y_detalle_a_partir_del_status() -> None:
    error = AppError.http(404, "Categoría no encontrada")

    assert (error.status_code, error.code, error.detail, error.field, error.headers) == (
        404,
        "HTTP_404",
        "Categoría no encontrada",
        None,
        None,
    )


def test_http_con_otro_status_deriva_el_codigo_de_ese_status() -> None:
    error = AppError.http(409, "Duplicado")

    assert (error.status_code, error.code) == (409, "HTTP_409")


def test_http_conserva_los_headers_recibidos() -> None:
    error = AppError.http(401, "Credenciales incorrectas", headers={"WWW-Authenticate": "Bearer"})

    assert dict(error.headers) == {"WWW-Authenticate": "Bearer"}


def test_http_es_un_app_error_y_su_mensaje_es_el_detalle() -> None:
    error = AppError.http(400, "Dato inválido")

    assert isinstance(error, AppError)
    assert str(error) == "Dato inválido"
