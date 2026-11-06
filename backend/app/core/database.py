from typing import Annotated

from fastapi import Depends
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import Settings, settings

if not settings.DATABASE_URL:
    raise ValueError(
        "DATABASE_URL is not set. Please configure it in the .env file or as an environment variable."
    )


def build_engine(cfg: Settings) -> Engine:
    """Crea el engine con la URL tal cual viene y `echo` según `SQL_ECHO`. No conecta a la BD."""
    return create_engine(cfg.DATABASE_URL, echo=cfg.SQL_ECHO)


engine = build_engine(settings)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
