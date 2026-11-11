"""Error de dominio agnóstico de FastAPI y catálogo de códigos de negocio (spec `api-conventions`)."""
from collections.abc import Mapping
from enum import StrEnum


class ErrorCode(StrEnum):
    """Códigos de error de negocio que el cliente puede ramificar."""

    INVALID_TRANSITION = "INVALID_TRANSITION"
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    DUPLICATE_VALUE = "DUPLICATE_VALUE"
    CATEGORY_HAS_PRODUCTS = "CATEGORY_HAS_PRODUCTS"
    CATEGORY_HAS_CHILDREN = "CATEGORY_HAS_CHILDREN"
    PAYMENT_NOT_ALLOWED = "PAYMENT_NOT_ALLOWED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class AppError(Exception):
    """Error de negocio con estado HTTP, código estable, mensaje y campo opcional.

    Las capas inferiores lo lanzan sin conocer FastAPI; `utils.errores.app_error_handler` lo traduce al cuerpo único.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str,
        field: str | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.code = str(code)
        self.detail = detail
        self.field = field
        self.headers = headers
