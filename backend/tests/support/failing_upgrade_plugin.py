"""Plugin de pytest solo para el test de «migración rota»: hace que `upgrade_to_head` falle.

Se carga con `-p` en un subproceso, antes del `conftest.py`, para que la fixture de sesión use la versión rota.
"""
import app.db.migrations as migrations

ERROR_SIMULADO = "migracion-rota-simulada"


def _upgrade_roto(connection: object) -> None:
    raise RuntimeError(ERROR_SIMULADO)


migrations.upgrade_to_head = _upgrade_roto  # type: ignore[assignment]
