"""Las migraciones son el único mecanismo que crea el esquema: ningún módulo de `app/` llama a `create_all(`."""
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"


def test_ningun_archivo_de_app_llama_a_create_all() -> None:
    archivos = sorted(APP_DIR.rglob("*.py"))
    assert len(archivos) > 20  # el recorrido encuentra el código de la app

    ofensores = [
        str(path.relative_to(APP_DIR))
        for path in archivos
        if "create_all(" in path.read_text(encoding="utf-8")
    ]

    assert ofensores == []
