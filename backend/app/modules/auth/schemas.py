from pydantic import BaseModel


class Token(BaseModel):
    """Respuesta de login y renovación. El refresh token NUNCA va en el cuerpo (viaja en cookie HttpOnly)."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
