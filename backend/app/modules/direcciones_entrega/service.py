from typing import List
from fastapi import HTTPException, status
from sqlmodel import Session

from app.core.service import base_service
from app.core.enums import EstadoFiltro
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork
from app.modules.direcciones_entrega.models import DireccionEntrega
from app.modules.direcciones_entrega.schemas import DireccionCreate, DireccionUpdate
from app.modules.direcciones_entrega.repository import DireccionRepository

class DireccionService(base_service[DireccionEntrega, DireccionCreate, DireccionUpdate, UsuarioUnitOfWork]):
    def __init__(self, session: Session):
        super().__init__(
            session,
            UsuarioUnitOfWork(session),
            "direcciones",
            DireccionEntrega
        )

    @property
    def repo(self) -> DireccionRepository:
        return self.uow.direcciones

    def _get_direccion_segura_or_404(self, direccion_id: int, usuario_id: int) -> DireccionEntrega:
        direccion = self._get_or_404(direccion_id)
        if direccion.usuario_id != usuario_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para operar sobre esta dirección"
            )
        return direccion

    def obtener_direccion_propia(self, direccion_id: int, usuario_id: int) -> DireccionEntrega:
        with self.uow:
            return self._get_direccion_segura_or_404(direccion_id, usuario_id)

    # ================= OVERRIDES CON LÓGICA DE NEGOCIO =================

    def crear_direccion_propia(self, usuario_id: int, item_in: DireccionCreate) -> DireccionEntrega:
        with self.uow:
            mis_direcciones = self.repo.get_by_usuario(usuario_id)
            es_primera = len(mis_direcciones) == 0

            nueva_direccion = self.model(
                **item_in.model_dump(),
                usuario_id=usuario_id,
                es_principal=es_primera
            )
            
            self.repo.add(nueva_direccion)
            return nueva_direccion

    def listar_mis_direcciones(self, usuario_id: int) -> List[DireccionEntrega]:
        with self.uow:
            return self.repo.get_by_usuario(usuario_id, state=EstadoFiltro.ACTIVO)

    def actualizar_direccion_propia(self, direccion_id: int, usuario_id: int, item_in: DireccionUpdate) -> DireccionEntrega:
        with self.uow:
            direccion_db = self._get_direccion_segura_or_404(direccion_id, usuario_id)
            
            self._apply_update_fields(direccion_db, item_in)
            
            self.repo.update(direccion_db)
            return direccion_db

    def eliminar_direccion_propia(self, direccion_id: int, usuario_id: int):
        with self.uow:
            direccion_db = self._get_direccion_segura_or_404(direccion_id, usuario_id)
            self.repo.delete(direccion_db)
            return {"message": "Dirección eliminada correctamente"}

    def marcar_como_principal(self, direccion_id: int, usuario_id: int) -> DireccionEntrega:
        with self.uow:
            nueva_principal = self._get_direccion_segura_or_404(direccion_id, usuario_id)

            if nueva_principal.es_principal:
                return nueva_principal

            vieja_principal = self.repo.get_principal_by_usuario(usuario_id)
            if vieja_principal:
                vieja_principal.es_principal = False
                self.repo.update(vieja_principal)

            nueva_principal.es_principal = True
            self.repo.update(nueva_principal)
            return nueva_principal
