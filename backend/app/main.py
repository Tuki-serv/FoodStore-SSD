from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError
from app.utils.errores import (
    app_error_handler,
    custom_http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logger import setup_logging
from app.core.rate_limit import limiter
from app.core.cloudinary.router import router as imagen_router
from app.modules.health.router import router as health_router

from app.modules.direcciones_entrega.router import router as direccion_router
from app.modules.auth.router import auth_router
from app.modules.usuarios.router import usuarios_router, admin_router

from app.modules.productos.router import router as producto_router
from app.modules.ingredientes.router import router as ingrediente_router
from app.modules.categorias.router import router as categoria_router
from app.modules.unidades_medida.router import router as unidad_medida_router

from app.modules.pagos.router import router as pago_router
from app.modules.estadisticas.router import router as estadisticas_router
from app.modules.pedidos.router import router as pedido_router


from app.core.config import settings

setup_logging()


def create_app() -> FastAPI:
    app = FastAPI(
        title="FoodStoreAPI",
        description="API del sistema FoodStore",
        version="1.0.0",
    )

    # Limitador de la app (login hoy; C-28 suma límites globales sobre el mismo storage).
    app.state.limiter = limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ======== ROUTERS ======== #

    app.include_router(health_router)

    # ── Dominio 1 ──────────────────────────────────────
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(usuarios_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(direccion_router, prefix="/api/v1")

    # ── Dominio 2 ──────────────────────────────────────
    app.include_router(categoria_router, prefix="/api/v1/categorias", tags=["Categorías"])
    app.include_router(producto_router, prefix="/api/v1/productos", tags=["Productos"])
    app.include_router(ingrediente_router, prefix="/api/v1/ingredientes", tags=["Ingredientes"])
    app.include_router(unidad_medida_router, prefix="/api/v1/unidades-medida", tags=["Unidades de Medida"])
    app.include_router(imagen_router, prefix="/api/v1", tags=["Imágenes"])

    # ── Dominio 3 ──────────────────────────────────────
    app.include_router(pedido_router,
                       prefix="/api/v1/pedidos",        tags=["Pedidos"])
    app.include_router(estadisticas_router)
    app.include_router(pago_router)


    #======== MANEJADORES DE ERRORES ===========
    app.add_exception_handler(StarletteHTTPException, custom_http_exception_handler)
    app.add_exception_handler(HTTPException, custom_http_exception_handler)
    app.add_exception_handler(RequestValidationError,
                              validation_exception_handler)
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    return app


app = create_app()
