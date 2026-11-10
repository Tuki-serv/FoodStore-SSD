from typing import Generic, TypeVar, Type
from fastapi import HTTPException
from pydantic import BaseModel
from sqlmodel import SQLModel, Session

from app.core.unit_of_work import UnitOfWork
from app.core.repository import BaseRepository

from datetime import datetime, timezone

ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)
UoWType = TypeVar("UowType", bound=UnitOfWork)
RepositoryType = TypeVar("RepositoryType", bound=BaseRepository)



"""

Aplicacion del service generico en los services particulares

class HeroService(base_service[Hero, HeroCreate, HeroUpdate, HeroUnitOfWork]):
    def __init__(self, session: Session):
        super().__init__(session=session,uow_class=HeroUnitOfWork,repo_name="heroes", model_class=Hero)
"""


class base_service(Generic[ModelType, CreateSchemaType, UpdateSchemaType, UoWType]):
    def __init__(self, session: Session, uow_instance: UoWType, repo_name: str, model_class: Type[ModelType]):
        self.session = session
        self.uow = uow_instance
        self._repo = repo_name
        self.model = model_class

    @property
    def repo(self) -> BaseRepository[ModelType]:
        return getattr(self.uow, self._repo)


    # def get_all(self, offset: int = 0, limit: int = 20):
    #     with self.uow:
    #         items = self.repo.get_all_by_state(offset=offset, limit= limit)
    #         total = self.repo.count_model()
    #         return {"data": items, "total": total}

    def get_all(self, page: int = 1, size: int = 20):
        with self.uow:
            offset = (page - 1) * size
            limit = size

            items = self.repo.get_all_by_state(offset=offset, limit= limit)
            total  =self.repo.count_model()

            pages = (total + size - 1) // size if total > 0 else 0

            return {
                "items": items,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
        

    @staticmethod
    def _pagina_vacia(page: int, size: int) -> dict:
        """Respuesta paginada sin resultados (p. ej. un filtro que la visibilidad del lector deja vacío)."""
        return {"items": [], "total": 0, "page": page, "size": size, "pages": 0}


    def _get_or_404(self, item_id, allow_deleted: bool = False) -> ModelType:
        item = self.repo.get_by_id(item_id)
        if not item or (not allow_deleted and getattr(item, "deleted_at", None) is not None):
            raise HTTPException(status_code=404, detail=f"{self.model.__name__} no encontrado/a")
        return item


    def get_by_id(self, item_id: int, allow_deleted: bool = False, *, ver_eliminados: bool) -> ModelType:
        """`allow_deleted` solo se respeta si el lector puede ver eliminados (`ver_eliminados`, obligatorio: sin default)."""
        with self.uow:
            return self._get_or_404(item_id, allow_deleted and ver_eliminados)
        

    def create(self, item_in: CreateSchemaType) -> ModelType:
        with self.uow:
            nuevo_item = self.model(**item_in.model_dump())
            self.repo.add(nuevo_item)
            return nuevo_item
        

    def _apply_update_fields(self, item_db: ModelType, item_in: UpdateSchemaType) -> ModelType:
        update_data = item_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item_db, key, value)

        if hasattr(item_db, "updated_at"):
            item_db.updated_at = datetime.now(timezone.utc)
            
        return item_db


    def delete(self, item_id: int | str):
        with self.uow:
            item_db = self._get_or_404(item_id)
            self.repo.delete(item_db)
        return {"message": f"{self.model.__name__} eliminado/a correctamente"}
    
