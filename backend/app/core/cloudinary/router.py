"""
Endpoint transversal para subir imágenes a Cloudinary.

Devuelve la `imagen_url` y el `imagen_public_id` que el cliente deberá
enviar luego en el cuerpo JSON de los endpoints de creación/actualización
de los módulos que soportan imagen (Categoría, Ingrediente, Producto).

Convención del proyecto: los CRUDs siguen aceptando JSON, por lo que
el upload es un paso previo separado (multipart/form-data). Esto evita
romper contratos existentes y mantiene el patrón JSON del proyecto.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.core.cloudinary.schemas import CloudinaryResponse
from app.core.cloudinary.service import ImagenSubida, subir_imagen, eliminar_imagen
from app.core.deps import require_role


TipoEntidadImagen = Literal["categoria", "ingrediente", "producto"]


router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post(
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


@router.delete(
    "/imagen/{public_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina una imagen de Cloudinary",
    description="Elimina una imagen de Cloudinary por su public_id. Reservado a ADMIN.",
    dependencies=[Depends(require_role(["ADMIN"]))],
)
def delete_imagen(public_id: str):
    eliminar_imagen(public_id)
    return None
