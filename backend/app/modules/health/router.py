from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness: no consulta la BD ni requiere credenciales."""
    return {"status": "ok"}
