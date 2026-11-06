from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import SQLModel

# --- Sub-Schemas para mostrar en la respuesta pública ---
class RolPublic(SQLModel):
    codigo: str
    nombre: str
    # descripcion: Optional[str] = None

# --- Entrada de datos (POST /register) ---
class UserCreate(SQLModel):
    nombre: str = Field(..., max_length=80)
    apellido: str = Field(..., max_length=80)
    email: EmailStr
    celular: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(min_length=8)

class UserCreateAdmin(UserCreate):
    roles_codigos: List[str]
 
 # Agregar campos: email, password
class UserUpdateClient(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=80)
    apellido: Optional[str] = Field(default=None, max_length=80)
    celular: Optional[str] = Field(default=None, max_length=20)

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

# --- Respuesta del Login ---
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class RefreshTokenRequest(BaseModel):
    refresh_token: str
