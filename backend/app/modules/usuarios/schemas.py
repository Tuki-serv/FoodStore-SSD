from typing import Annotated, Any, List, Optional
from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator
from sqlmodel import SQLModel

from app.core.email_normalizado import normalizar_email

# Nombre o apellido: sin espacios al borde, obligatorio (no vacío tras recortar) y de hasta 80 caracteres.
NombrePersona = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

# --- Sub-Schemas para mostrar en la respuesta pública ---
class RolPublic(SQLModel):
    codigo: str
    nombre: str
    # descripcion: Optional[str] = None

# --- Entrada de datos (POST /register) ---
class UserCreate(SQLModel):
    nombre: NombrePersona
    apellido: NombrePersona
    email: EmailStr
    celular: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(min_length=8)

    @field_validator("email", mode="before")
    @classmethod
    def _normalizar_email(cls, valor: Any) -> Any:
        """Recorta y pasa a minúsculas antes de validar el formato (un valor que no es texto lo rechaza `EmailStr`)."""
        return normalizar_email(valor) if isinstance(valor, str) else valor

class UserCreateAdmin(UserCreate):
    roles_codigos: List[str]
 
 # Agregar campos: email, password
class UserUpdateClient(BaseModel):
    nombre: Optional[NombrePersona] = None
    apellido: Optional[NombrePersona] = None
    celular: Optional[str] = Field(default=None, max_length=20)

    @field_validator("nombre", "apellido", mode="before")
    @classmethod
    def _rechazar_null_explicito(cls, valor: Any) -> Any:
        """Omitir el campo significa «no cambiar»; `null` explícito no es un nombre válido (la columna es NOT NULL)."""
        if valor is None:
            raise ValueError("No puede ser nulo")
        return valor

class UserUpdateAdmin(UserUpdateClient):
    roles_codigos: Optional[List[str]] = None

    
# --- Salida de datos (GET /me, Respuesta de Login/Register) ---
class UserPublic(SQLModel):
    id: int
    nombre: str
    apellido: str
    email: str
    celular: Optional[str] = None

class UserPublicAdminPanel(UserPublic):
    roles: List[RolPublic]
    
class UserPaginationResponse(SQLModel):
    data: List[UserPublicAdminPanel]  # Aquí sí usamos UserPublic para filtrar cada usuario de la lista
    total: int
