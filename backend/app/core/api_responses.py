"""Respuestas de error compartidas para documentar la API en Swagger (US-030, C-25b1 D8).

Todos los routers declaran sus errores con `respuestas_error(...)` en vez de repetir bloques: el cuerpo de error es
siempre el mismo (`{detail, code, field}`, spec `api-conventions`) y solo cambia la descripción por status.
"""
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel


class ErrorRespuesta(BaseModel):
    """Cuerpo único de un error de la API."""

    detail: str
    code: str
    field: str | None = None


DESCRIPCIONES: dict[int, str] = {
    400: "Datos o regla de negocio inválidos (`code` y `field` indican cuál)",
    401: "Sin sesión válida: falta el access token Bearer, es inválido o venció",
    403: "El rol del usuario no permite la operación o el recurso no es suyo",
    404: "El recurso no existe",
    409: "Conflicto con el estado actual (transición inválida, valor duplicado, sin stock, etc.)",
    422: "Datos con formato inválido (`field` indica el campo)",
    429: "Demasiados intentos: reintentar después de `Retry-After`",
    502: "El servicio externo (MercadoPago) falló",
    503: "Integración externa sin configurar",
}


def respuestas_error(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    """Bloque `responses=` de FastAPI con el modelo de error común para cada status indicado."""
    return {codigo: {"model": ErrorRespuesta, "description": DESCRIPCIONES[codigo]} for codigo in status_codes}


def documentar_422_con_el_error_comun(app: FastAPI) -> None:
    """Hace que el `openapi.json` anuncie el 422 de validación con `ErrorRespuesta`, que es lo que la API devuelve de verdad.

    FastAPI agrega por su cuenta un 422 con `HTTPValidationError` a toda operación con parámetros o cuerpo, pero el
    handler de `RequestValidationError` responde `{detail, code, field}`.
    """
    generador = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is not None:
            return app.openapi_schema
        esquema = generador()
        referencia = {"$ref": "#/components/schemas/ErrorRespuesta"}
        for item in esquema["paths"].values():
            for operacion in item.values():
                respuesta = operacion.get("responses", {}).get("422")
                if respuesta is None:
                    continue
                respuesta["description"] = DESCRIPCIONES[422]
                respuesta["content"] = {"application/json": {"schema": referencia}}
        for nombre in ("HTTPValidationError", "ValidationError"):
            esquema.get("components", {}).get("schemas", {}).pop(nombre, None)
        if "ErrorRespuesta" not in esquema.get("components", {}).get("schemas", {}):
            esquema.setdefault("components", {}).setdefault("schemas", {})["ErrorRespuesta"] = ErrorRespuesta.model_json_schema()
        return esquema

    app.openapi = openapi  # type: ignore[method-assign]
