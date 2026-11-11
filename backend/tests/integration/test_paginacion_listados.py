"""Límites de paginación uniformes en los listados (spec `api-conventions`)."""
from fastapi.testclient import TestClient


def test_size_mayor_a_100_es_422_con_field_size(client: TestClient):
    response = client.get("/api/v1/productos?size=101")
    assert response.status_code == 422
    assert response.json()["field"] == "size"
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_page_cero_es_422_con_field_page(client: TestClient):
    response = client.get("/api/v1/categorias?page=0")
    assert response.status_code == 422
    assert response.json()["field"] == "page"


def test_size_cero_en_ingredientes_es_422(client: TestClient):
    response = client.get("/api/v1/ingredientes?size=0")
    assert response.status_code == 422
    assert response.json()["field"] == "size"


def test_pagina_posterior_a_la_ultima_trae_items_vacios_con_total_real(client: TestClient, admin_auth_headers: dict):
    for nombre, simbolo in (("Pag A", "pa"), ("Pag B", "pb"), ("Pag C", "pc")):
        client.post("/api/v1/unidades-medida/", json={"nombre": nombre, "simbolo": simbolo, "tipo": "peso"}, headers=admin_auth_headers)
    total_real = client.get("/api/v1/unidades-medida?size=100").json()["total"]

    response = client.get("/api/v1/unidades-medida?page=50&size=2")

    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["items"] == []
    assert cuerpo["total"] == total_real
    assert cuerpo["page"] == 50
    assert cuerpo["size"] == 2
    assert cuerpo["pages"] == (total_real + 1) // 2


def test_listado_sin_parametros_usa_page_1_size_20(client: TestClient):
    cuerpo = client.get("/api/v1/unidades-medida").json()
    assert cuerpo["page"] == 1
    assert cuerpo["size"] == 20
