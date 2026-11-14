"""Detecta nombres usados en anotaciones que no están definidos ni importados en el módulo.

En Python 3.14 las anotaciones se evalúan de forma diferida y un `Any` sin importar pasa inadvertido; en la imagen de
Docker (3.11) el import del módulo falla con `NameError`. Este test lo detecta estáticamente, sin importar nada.
"""
import ast
import builtins
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"


def _nombres_de_modulo(arbol: ast.Module) -> set[str]:
    """Todo nombre ligado en cualquier punto del módulo (imports, defs, asignaciones, parámetros, bucles, `as`)."""
    ligados: set[str] = set(dir(builtins)) | {"__file__", "__name__"}
    for nodo in ast.walk(arbol):
        if isinstance(nodo, (ast.Import, ast.ImportFrom)):
            for alias in nodo.names:
                ligados.add((alias.asname or alias.name).split(".")[0])
        elif isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            ligados.add(nodo.name)
        elif isinstance(nodo, ast.Name) and isinstance(nodo.ctx, (ast.Store, ast.Del)):
            ligados.add(nodo.id)
        elif isinstance(nodo, ast.arg):
            ligados.add(nodo.arg)
        elif isinstance(nodo, ast.ExceptHandler) and nodo.name:
            ligados.add(nodo.name)
        elif isinstance(nodo, ast.TypeVar):
            ligados.add(nodo.name)
    return ligados


def _anotaciones(arbol: ast.Module) -> list[ast.expr]:
    anotaciones: list[ast.expr] = []
    for nodo in ast.walk(arbol):
        if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if nodo.returns is not None:
                anotaciones.append(nodo.returns)
            args = nodo.args
            for arg in [*args.posonlyargs, *args.args, *args.kwonlyargs, args.vararg, args.kwarg]:
                if arg is not None and arg.annotation is not None:
                    anotaciones.append(arg.annotation)
        elif isinstance(nodo, ast.AnnAssign):
            anotaciones.append(nodo.annotation)
    return anotaciones


def anotaciones_sin_resolver(codigo: str) -> list[str]:
    """Nombres usados en anotaciones (no entre comillas) que ningún import, definición ni builtin cubre."""
    arbol = ast.parse(codigo)
    ligados = _nombres_de_modulo(arbol)
    faltantes: set[str] = set()
    for anotacion in _anotaciones(arbol):
        for nodo in ast.walk(anotacion):
            if isinstance(nodo, ast.Name) and isinstance(nodo.ctx, ast.Load) and nodo.id not in ligados:
                faltantes.add(nodo.id)
    return sorted(faltantes)


def test_detecta_un_nombre_de_anotacion_sin_importar() -> None:
    assert anotaciones_sin_resolver("def f(x: Foo) -> Any:\n    return x\n") == ["Any", "Foo"]


def test_no_marca_nombres_importados_definidos_ni_builtins() -> None:
    codigo = "from typing import Any\nclass A: ...\ndef f(x: A, y: list[int]) -> Any:\n    return x\n"
    assert anotaciones_sin_resolver(codigo) == []


@pytest.mark.parametrize("archivo", sorted(APP.rglob("*.py")), ids=lambda a: a.relative_to(APP).as_posix())
def test_las_anotaciones_de_app_resuelven_a_nombres_definidos(archivo: Path) -> None:
    assert anotaciones_sin_resolver(archivo.read_text(encoding="utf-8")) == [], archivo.name
