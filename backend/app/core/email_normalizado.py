"""Regla única de normalización del email: sin espacios al borde y en minúsculas."""


def normalizar_email(valor: str) -> str:
    """Devuelve el email recortado y en minúsculas (también la parte local: ningún proveedor real la distingue)."""
    return valor.strip().lower()
