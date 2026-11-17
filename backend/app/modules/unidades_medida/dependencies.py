"""Composición del módulo `unidades_medida`: arma el service para inyectarlo en el router (raíz de composición, D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.unidades_medida.service import UnidadMedidaService


def get_unidad_medida_service(session: SessionDep) -> UnidadMedidaService:
    return UnidadMedidaService(session)


UnidadMedidaServiceDep = Annotated[UnidadMedidaService, Depends(get_unidad_medida_service)]
