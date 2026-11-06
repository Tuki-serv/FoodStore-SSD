from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

async def custom_http_exception_handler(reques: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": str(exc.detail),
            "code": getattr(exc, "code",f"HTTP_{exc.status_code}"),
            "field": getattr(exc, "field", None)
        }
    )

async def validation_exception_handler(reques: Request, exc: RequestValidationError):
    errores = exc.errors()
    campo_fallido = errores[0]["loc"][-1] if errores else None
    mensaje = errores[0]["msg"] if errores else "Error de validación en los datos enviados"

    return JSONResponse(
           status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
           content={
               "detail": f"Error de validación: {mensaje}",
               "code": "VALIDATION_ERROR",
               "field": str(campo_fallido)
           }
    )
