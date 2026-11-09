"""Entorno de Alembic: URL de `Settings.DATABASE_URL`, metadata de todos los modelos."""
from logging.config import fileConfig

from alembic import context

from app.core.config import settings
from app.core.database import build_engine
from app.db.migrations import render_item
from app.db.models import import_all_models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = import_all_models()

_CONFIGURE_OPTS = {
    "target_metadata": target_metadata,
    "compare_type": True,
    "compare_server_default": True,
    "render_item": render_item,
}


def run_migrations_offline() -> None:
    """Genera SQL (`--sql`) con la URL de la aplicación, sin conectarse."""
    context.configure(
        url=settings.DATABASE_URL,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_CONFIGURE_OPTS,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Migra con la conexión inyectada (tests) o con un engine de la aplicación."""
    injected = config.attributes.get("connection")
    if injected is not None:
        context.configure(connection=injected, **_CONFIGURE_OPTS)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, **_CONFIGURE_OPTS)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
