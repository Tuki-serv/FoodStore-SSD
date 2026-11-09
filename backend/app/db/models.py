"""Registro único de modelos: descubre e importa cada `app.modules.<modulo>.models`."""
import importlib
from pathlib import Path

from sqlalchemy import MetaData
from sqlmodel import SQLModel

import app.modules as _modules_pkg


def import_all_models() -> MetaData:
    """Importa todos los `models.py` de `app.modules` y devuelve la metadata compartida de SQLModel.

    Un módulo nuevo con `models.py` queda registrado sin tocar ninguna lista. Es idempotente.
    Se recorre el filesystem porque `app.modules` es un paquete de espacios de nombres (sin `__init__.py`)
    y `pkgutil.iter_modules` no lista sus subdirectorios.
    """
    for base in _modules_pkg.__path__:
        for models_file in sorted(Path(base).glob("*/models.py")):
            importlib.import_module(f"{_modules_pkg.__name__}.{models_file.parent.name}.models")
    return SQLModel.metadata
