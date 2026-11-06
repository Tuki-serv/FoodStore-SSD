"""
Servicio transversal de Cloudinary.

Centraliza la configuración del SDK y expone operaciones de alto nivel
(subir, eliminar) usadas por los servicios de los módulos del dominio.

Reglas del servicio:
- La configuración del SDK es perezosa y opcional: se aplica una sola vez, al primer uso, y solo si las tres
  variables CLOUDINARY_* están definidas. Sin ellas la app arranca igual; subir una imagen responde 503 y
  eliminar es un no-op (devuelve False).
- Ninguna función de este módulo aborta una transacción de base de datos:
  los errores se traducen a HTTPException para uploads (operación principal)
  y se loggean + devuelven False para deletes (operación secundaria de
  limpieza). Esto último es deliberado: si la DB ya hizo commit, un fallo
  de Cloudinary no debe revertir el estado de negocio.
"""

import logging
from dataclasses import dataclass
from typing import Iterable, Optional

import cloudinary
import cloudinary.uploader
import cloudinary.exceptions
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Configuración del SDK (perezosa, idempotente y opcional) ───────────────

MENSAJE_NO_CONFIGURADO = (
    "El servicio de imágenes no está configurado "
    "(faltan variables CLOUDINARY_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET)."
)

_configurado = False


def _asegurar_configuracion() -> bool:
    """
    Configura el SDK la primera vez que se necesita y devuelve True.
    Devuelve False, sin tocar el SDK, si falta alguna variable CLOUDINARY_*.
    """
    global _configurado
    if _configurado:
        return True

    if not (settings.CLOUDINARY_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET):
        return False

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configurado = True
    return True


# ── Constantes del proyecto ────────────────────────────────────────────────

CARPETA_RAIZ = "foodstore"
CARPETAS = {
    "categoria": f"{CARPETA_RAIZ}/categorias",
    "ingrediente": f"{CARPETA_RAIZ}/ingredientes",
    "producto": f"{CARPETA_RAIZ}/productos",
}

TIPOS_IMAGEN_PERMITIDOS = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
}
TAMANIO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5 MB


# ── DTOs ───────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ImagenSubida:
    """Resultado normalizado de una subida a Cloudinary."""
    imagen_url: str
    imagen_public_id: str


# ── Validaciones ───────────────────────────────────────────────────────────

def _validar_archivo_imagen(archivo: UploadFile) -> None:
    """
    Valida tipo MIME y tamaño. Falla rápido con 400 antes de gastar
    un request a Cloudinary con un archivo inválido.
    """
    content_type = (archivo.content_type or "").lower()
    if content_type not in TIPOS_IMAGEN_PERMITIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Tipo de archivo no permitido: '{content_type}'. "
                f"Tipos aceptados: {sorted(TIPOS_IMAGEN_PERMITIDOS)}"
            ),
        )

    # SpooledTemporaryFile expone size; UploadFile.size puede no estar
    # disponible según el backend, por eso leemos del file subyacente.
    archivo.file.seek(0, 2)  # end
    tamanio = archivo.file.tell()
    archivo.file.seek(0)      # rewind

    if tamanio > TAMANIO_MAXIMO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"La imagen excede el tamaño máximo permitido "
                f"({TAMANIO_MAXIMO_BYTES // (1024 * 1024)} MB)."
            ),
        )


# ── Operaciones públicas ───────────────────────────────────────────────────

def subir_imagen(
    archivo: UploadFile,
    tipo: str,
    public_id_existente: Optional[str] = None,
) -> ImagenSubida:
    """
    Sube `archivo` a Cloudinary dentro de la carpeta correspondiente al `tipo`
    de entidad (`categoria`, `ingrediente` o `producto`).

    Si se pasa `public_id_existente` y existe, lo sobrescribe. Útil para
    reemplazar in-place sin dejar el archivo viejo huérfano en Cloudinary.

    Returns:
        ImagenSubida con la URL segura y el public_id normalizado.

    Raises:
        HTTPException 400 si el archivo no es una imagen válida.
        HTTPException 503 si las variables CLOUDINARY_* no están configuradas.
        HTTPException 500 si Cloudinary falla por motivos no-controlados
        (red, credenciales, etc).
    """
    if tipo not in CARPETAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de entidad no soportado para imágenes: '{tipo}'.",
        )

    _validar_archivo_imagen(archivo)

    if not _asegurar_configuracion():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=MENSAJE_NO_CONFIGURADO,
        )

    opciones: dict = {
        "folder": CARPETAS[tipo],
        "resource_type": "image",
        "overwrite": True,
        "unique_filename": public_id_existente is None,
        "invalidate": True,
    }
    if public_id_existente:
        opciones["public_id"] = public_id_existente

    try:
        resultado = cloudinary.uploader.upload(archivo.file, **opciones)
    except cloudinary.exceptions.Error as exc:
        logger.exception("Error de Cloudinary al subir imagen")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo subir la imagen a Cloudinary: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Error inesperado al subir imagen a Cloudinary")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al subir la imagen.",
        ) from exc

    secure_url = resultado.get("secure_url") or resultado.get("url")
    public_id = resultado.get("public_id")
    if not secure_url or not public_id:
        logger.error("Respuesta inesperada de Cloudinary: %s", resultado)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Respuesta inválida del servicio de imágenes.",
        )

    return ImagenSubida(imagen_url=secure_url, imagen_public_id=public_id)


def eliminar_imagen(public_id: Optional[str]) -> bool:
    """
    Elimina una imagen de Cloudinary por su public_id.

    Diseñada para NO abortar el flujo principal:
    - Si `public_id` es None/ vacío, no hace nada y retorna True.
    - Si Cloudinary no está configurado, loggea una advertencia y retorna False.
    - Si Cloudinary devuelve "not found", se considera éxito (idempotente).
    - Ante cualquier otro error, loggea y retorna False. La entidad ya fue
      marcada como eliminada en DB; el archivo huérfano puede limpiarse
      con un job posterior.
    """
    if not public_id:
        return True

    if not _asegurar_configuracion():
        logger.warning(
            "Cloudinary no está configurado: no se elimina la imagen (public_id=%s)", public_id,
        )
        return False

    try:
        respuesta = cloudinary.uploader.destroy(
            public_id,
            resource_type="image",
            invalidate=True,
        )
        resultado = respuesta.get("result", "")
        if resultado not in {"ok", "not found"}:
            logger.warning(
                "Cloudinary destroy devolvió resultado inesperado: %s (public_id=%s)",
                respuesta, public_id,
            )
        return True
    except Exception as exc:
        logger.exception(
            "No se pudo eliminar la imagen de Cloudinary (public_id=%s)", public_id,
        )
        return False


def eliminar_multiples_imagenes(public_ids: Optional[Iterable[str]]) -> int:
    """
    Variante para Producto, que admite una lista de imágenes. Retorna
    la cantidad de public_ids que se intentó eliminar (excluyendo nulos).
    Los errores individuales ya se loggean dentro de `eliminar_imagen`.
    """
    if not public_ids:
        return 0
    eliminados = 0
    for pid in public_ids:
        if pid:
            eliminar_imagen(pid)
            eliminados += 1
    return eliminados
