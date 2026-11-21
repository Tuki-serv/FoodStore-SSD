"""Swagger completo (US-030, CE-08, C-25b1 D8): cada operación bajo `/api/v1` está documentada en `/openapi.json`."""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app

METODOS = {"get", "post", "put", "patch", "delete"}


@pytest.fixture(name="openapi", scope="module")
def openapi_fixture() -> dict:
    return create_app().openapi()


def _operaciones(openapi: dict) -> list[tuple[str, str, dict]]:
    return [
        (metodo.upper(), ruta, operacion)
        for ruta, item in openapi["paths"].items()
        if ruta.startswith("/api/v1")
        for metodo, operacion in item.items()
        if metodo in METODOS
    ]


def _summary_autogenerado(operacion: dict) -> bool:
    """FastAPI deriva el summary del nombre de la función («Read Me») cuando no se declara uno propio."""
    nombre_funcion = operacion["operationId"].split("_api_v1")[0]
    return operacion["summary"] == nombre_funcion.replace("_", " ").title()


def test_todas_las_operaciones_tienen_summary_propio_y_tags(openapi: dict) -> None:
    incompletas = [
        f"{metodo} {ruta}"
        for metodo, ruta, operacion in _operaciones(openapi)
        if not operacion.get("summary") or _summary_autogenerado(operacion) or not operacion.get("tags")
    ]

    assert incompletas == []


def test_crear_pedido_documenta_sus_respuestas_de_error(openapi: dict) -> None:
    respuestas = openapi["paths"]["/api/v1/pedidos/"]["post"]["responses"]

    assert {"400", "401", "403", "404", "422"} <= set(respuestas)


def test_las_operaciones_de_gestion_documentan_el_contrato_de_error_de_auth(openapi: dict) -> None:
    respuestas = openapi["paths"]["/api/v1/pedidos/{pedido_id}/estado"]["patch"]["responses"]

    assert {"401", "403", "404", "409"} <= set(respuestas)


def test_los_endpoints_protegidos_declaran_seguridad_bearer_y_el_arbol_publico_no(openapi: dict) -> None:
    protegido = openapi["paths"]["/api/v1/pedidos/"]["get"]
    publico = openapi["paths"]["/api/v1/categorias/arbol"]["get"]

    assert protegido.get("security")
    assert not publico.get("security")


@pytest.mark.parametrize("ruta,metodo,codigos", [
    ("/api/v1/auth/login", "post", {"401", "429"}),
    ("/api/v1/pagos/crear", "post", {"401", "403", "404", "409"}),
    ("/api/v1/direcciones/{direccion_id}/principal", "patch", {"401", "403", "404", "409"}),
])
def test_los_errores_documentados_usan_el_cuerpo_comun(openapi: dict, ruta: str, metodo: str, codigos: set[str]) -> None:
    respuestas = openapi["paths"][ruta][metodo]["responses"]

    assert codigos <= set(respuestas)
    esquema = respuestas[sorted(codigos)[0]]["content"]["application/json"]["schema"]
    assert esquema["$ref"].endswith("/ErrorRespuesta")


def test_swagger_ui_esta_disponible(client: TestClient) -> None:
    response = client.get("/docs")

    assert response.status_code == 200


def test_crear_pedido_documenta_el_201_y_cada_error_con_el_cuerpo_comun(openapi: dict) -> None:
    respuestas = openapi["paths"]["/api/v1/pedidos/"]["post"]["responses"]

    creado = respuestas["201"]["content"]["application/json"]["schema"]
    assert creado["$ref"].endswith("/PedidoDetalle")
    for codigo in ("400", "401", "403", "404", "422"):
        esquema = respuestas[codigo]["content"]["application/json"]["schema"]
        assert esquema["$ref"].endswith("/ErrorRespuesta"), codigo


def test_el_esquema_de_error_expone_detail_code_y_field(openapi: dict) -> None:
    esquema = openapi["components"]["schemas"]["ErrorRespuesta"]

    assert {"detail", "code", "field"} <= set(esquema["properties"])


def test_todo_422_documentado_usa_el_cuerpo_comun_porque_asi_responde_la_api(openapi: dict) -> None:
    """El handler de validación devuelve `{detail, code, field}`; Swagger no debe anunciar el HTTPValidationError por defecto."""
    distintos = [
        f"{metodo} {ruta}"
        for metodo, ruta, operacion in _operaciones(openapi)
        if "422" in operacion["responses"]
        and not operacion["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorRespuesta")
    ]

    assert distintos == []
    assert "HTTPValidationError" not in openapi["components"]["schemas"]
