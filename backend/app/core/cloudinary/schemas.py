from sqlmodel import SQLModel, Field

class CloudinaryResponse(SQLModel):
    """Respuesta normalizada que el cliente persiste junto a la entidad."""
    secure_url: str = Field(..., description="URL pública (https) de la imagen")
    public_id: str = Field(
        ...,
        description="ID interno en Cloudinary, requerido para reemplazo/borrado",
    )
