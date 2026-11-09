"""Migración rota: la sesión de pytest aborta en el primer test que usa la BD (subproceso, no aborta la sesión real)."""
import os
import subprocess
import sys
from pathlib import Path

from tests.support.failing_upgrade_plugin import ERROR_SIMULADO

BACKEND_DIR = Path(__file__).resolve().parents[2]


def test_migracion_rota_aborta_la_sesion_con_el_mensaje_y_sin_ejecutar_tests_que_usen_la_base() -> None:
    resultado = subprocess.run(
        [
            sys.executable, "-m", "pytest",
            "-p", "tests.support.failing_upgrade_plugin",
            "-p", "no:cacheprovider",
            "tests/integration/test_session_isolation.py",
        ],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        timeout=120,
    )
    salida = resultado.stdout + resultado.stderr

    assert resultado.returncode == 2, salida
    assert "Falló alembic upgrade head sobre foodstore_test" in salida
    assert ERROR_SIMULADO in salida
    assert "PASSED" not in salida
    assert "FAILED" not in salida
