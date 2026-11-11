from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.errors import AppError, ErrorCode
from app.core.logger import get_logger

logger = get_logger("app.errores")


def cuerpo_error(detail: str, code: str, field: str | None = None) -> dict[str, str | None]:
    """Único lugar que arma el cuerpo de error `{detail, code, field}` de toda la API."""
    return {"detail": detail, "code": str(code), "field": field}


async def custom_http_exception_handler(reques: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=cuerpo_error(
            str(exc.detail),
            getattr(exc, "code", f"HTTP_{exc.status_code}"),
            getattr(exc, "field", None),
        ),
    )


async def app_error_handler(reques: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=cuerpo_error(exc.detail, exc.code, exc.field),
        headers=exc.headers,
    )


async def unhandled_exception_handler(reques: Request, exc: Exception):
    logger.exception("Error no controlado", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=cuerpo_error("Error interno del servidor", ErrorCode.INTERNAL_ERROR),
    )


async def validation_exception_handler(reques: Request, exc: RequestValidationError):
    errores = exc.errors()
    campo_fallido = errores[0]["loc"][-1] if errores else None
    mensaje = errores[0]["msg"] if errores else "Error de validación en los datos enviados"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=cuerpo_error(
            f"Error de validación: {mensaje}", ErrorCode.VALIDATION_ERROR, str(campo_fallido)
        ),
    )
