"""Primitivas puras de autorización por roles (sin FastAPI ni imports de `app.modules`).

Un usuario puede tener varios roles y sus permisos son la **unión** de los de cada rol (spec rbac-authorization).
"""
from collections.abc import Iterable, Mapping
from collections.abc import Set as AbstractSet
from typing import TypeVar

K = TypeVar("K")
V = TypeVar("V")


def tiene_algun_rol(roles: AbstractSet[str], permitidos: Iterable[str]) -> bool:
    """True si el usuario tiene al menos uno de los roles `permitidos`."""
    return any(rol in roles for rol in permitidos)


def puede_acceder_a_propio(
    propietario_id: int,
    usuario_id: int,
    roles: AbstractSet[str],
    privilegiados: Iterable[str],
) -> bool:
    """True si el usuario es el dueño del recurso o tiene alguno de los roles `privilegiados`."""
    return propietario_id == usuario_id or tiene_algun_rol(roles, privilegiados)


def union_por_roles(
    mapa: Mapping[str, Mapping[K, AbstractSet[V]]],
    roles: AbstractSet[str],
    clave: K,
) -> frozenset[V]:
    """Une `mapa[rol][clave]` de cada rol del usuario; un rol sin fila o una clave ausente aportan el conjunto vacío."""
    resultado: set[V] = set()
    for rol in roles:
        resultado |= mapa.get(rol, {}).get(clave, frozenset())
    return frozenset(resultado)
