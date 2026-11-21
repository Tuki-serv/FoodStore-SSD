"""
Routers del panel de administración: imágenes (Cloudinary), usuarios (admin) y estadísticas.

Imágenes: endpoint transversal para subir imágenes a Cloudinary.

Devuelve la `imagen_url` y el `imagen_public_id` que el cliente deberá
enviar luego en el cuerpo JSON de los endpoints de creación/actualización
de los módulos que soportan imagen (Categoría, Ingrediente, Producto).

Convención del proyecto: los CRUDs siguen aceptando JSON, por lo que
el upload es un paso previo separado (multipart/form-data). Esto evita
romper contratos existentes y mantiene el patrón JSON del proyecto.
"""

from typing import Annotated, Any, List, Literal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.core.cloudinary.schemas import CloudinaryResponse
from app.core.cloudinary.service import ImagenSubida, subir_imagen, eliminar_imagen
from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.modules.admin.dependencies import EstadisticasServiceDep, RangoFechasDep
from app.modules.admin.schemas import (
    VentasPeriodoItem,
    ProductoTopItem,
    PedidosEstadoItem,
    IngresosResponse,
    ResumenResponse,
)
from app.modules.auth.dependencies import get_current_active_user, require_role
from app.modules.usuarios.dependencies import UsuarioServiceDep
from app.modules.usuarios.schemas import (
    UserCreate,
    UserCreateAdmin,
    UserPublic,
    UserPublicAdminPanel,
    UserUpdateAdmin,
)
from app.core.api_responses import respuestas_error


TipoEntidadImagen = Literal["categoria", "ingrediente", "producto"]


imagenes_router = APIRouter(prefix="/uploads", tags=["Uploads"])


@imagenes_router.post(
    "/imagen",
    response_model=CloudinaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sube una imagen a Cloudinary",
    description=(
        "Sube un archivo de imagen (jpg/png/webp/gif/avif, máx 5 MB) a "
        "la carpeta correspondiente al `tipo` de entidad y devuelve la "
        "URL pública junto con el public_id. Reservado a ADMIN."
    ),
    dependencies=[Depends(require_role(["ADMIN"]))],
)
def upload_imagen(
    archivo: Annotated[UploadFile, File(description="Archivo de imagen")],
    tipo: Annotated[
        TipoEntidadImagen,
        Form(description="Carpeta destino en Cloudinary según la entidad"),
    ] = "categoria",
) -> CloudinaryResponse:
    resultado: ImagenSubida = subir_imagen(archivo, tipo=tipo)
    return CloudinaryResponse(
        secure_url=resultado.imagen_url,
        public_id=resultado.imagen_public_id,
    )


@imagenes_router.delete(
    "/imagen/{public_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una imagen de Cloudinary",
    description="Elimina una imagen de Cloudinary por su public_id. Reservado a ADMIN.",
    dependencies=[Depends(require_role(["ADMIN"]))],
)
def delete_imagen(public_id: str):
    eliminar_imagen(public_id)
    return None


# ==========================================
# GRUPO 3: PANEL ADMINISTRATIVO
# ==========================================
# El ADMIN que actúa (ya autorizado por `require_role` del router): el service lo recibe como `actor_id`.
AdminActual = Annotated[UserPublic, Depends(get_current_active_user)]

usuarios_admin_router = APIRouter(
    prefix="/admin/usuarios", 
    tags=["Panel de Administración - Usuarios"],
    dependencies=[Depends(require_role(["ADMIN"]))]
)

@usuarios_admin_router.post("/createUser", summary="Crear un usuario (ADMIN)", responses=respuestas_error(401, 403, 409), response_model=UserPublicAdminPanel, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    data: UserCreateAdmin,
    svc: UsuarioServiceDep,
    actor: AdminActual,
) -> Any:
    """El Admin crea un usuario asignándole roles específicos manualmente."""
    datos_usuario = data.model_dump(exclude={"roles_codigos"})
    user_in = UserCreate(**datos_usuario)
    return svc.create_user_admin(user_in=user_in, roles_codigos=data.roles_codigos, actor_id=actor.id)


@usuarios_admin_router.get("/", summary="Listar usuarios (ADMIN)", responses=respuestas_error(401, 403), response_model=PaginatedResponse[UserPublicAdminPanel])
def get_all_users(
    svc: UsuarioServiceDep, 
    params: PageQuery,
    rol_codigo: str | None = None
) -> Any:
    """Lista todos los usuarios activos. Permite paginación y filtrado por rol."""
    return svc.get_all_users(params=params, rol_codigo=rol_codigo)


@usuarios_admin_router.patch("/{user_id}", summary="Actualizar un usuario y sus roles (ADMIN)", responses=respuestas_error(401, 403, 404, 409), response_model=UserPublicAdminPanel)
def update_user_by_admin(user_id: int, data: UserUpdateAdmin, svc: UsuarioServiceDep, actor: AdminActual) -> Any:
    """El Admin actualiza los datos y/o los roles de cualquier usuario."""
    return svc.update_user_by_admin(actor.id, user_id, data)


@usuarios_admin_router.delete("/{user_id}", summary="Dar de baja a un usuario (ADMIN)", responses=respuestas_error(401, 403, 404, 409), status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, svc: UsuarioServiceDep, actor: AdminActual) -> None:
    """Aplica un borrado lógico (soft delete) a un usuario."""
    svc.desactivar_usuario(actor.id, user_id)
    return None


# ==========================================
# ESTADÍSTICAS (solo ADMIN)
# ==========================================
estadisticas_router = APIRouter(
    prefix="/estadisticas",
    tags=["Estadisticas"],
    dependencies=[Depends(require_role(["ADMIN"]))]
)

@estadisticas_router.get("/ventas", summary="Ventas por período", responses=respuestas_error(401, 403), response_model=List[VentasPeriodoItem])
def get_ventas(
    rango: RangoFechasDep,
    service: EstadisticasServiceDep,
    agrupacion: Literal["day", "week", "month"] = "day",
):
    return service.ventas_por_periodo(rango.desde, rango.hasta, agrupacion)

@estadisticas_router.get("/productos-top", summary="Productos más vendidos", responses=respuestas_error(401, 403), response_model=List[ProductoTopItem])
def get_productos_top(
    rango: RangoFechasDep,
    service: EstadisticasServiceDep,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
):
    return service.productos_top(rango.desde, rango.hasta, limit)

@estadisticas_router.get("/pedidos-por-estado", summary="Pedidos por estado", responses=respuestas_error(401, 403), response_model=List[PedidosEstadoItem])
def get_pedidos_estado(rango: RangoFechasDep, service: EstadisticasServiceDep):
    return service.pedidos_por_estado(rango.desde, rango.hasta)

@estadisticas_router.get("/ingresos", summary="Ingresos por período", responses=respuestas_error(401, 403), response_model=List[IngresosResponse])
def get_ingresos(rango: RangoFechasDep, service: EstadisticasServiceDep):
    return service.ingresos_por_forma_pago(rango.desde, rango.hasta)

@estadisticas_router.get("/resumen", summary="Resumen del dashboard", responses=respuestas_error(401, 403), response_model=ResumenResponse)
def get_resumen(rango: RangoFechasDep, service: EstadisticasServiceDep):
    return service.resumen(rango.desde, rango.hasta)
