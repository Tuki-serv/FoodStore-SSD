from typing import Generic, TypeVar, Type, Sequence, Optional
from sqlmodel import Session, SQLModel, func, select
from sqlmodel.sql._expression_select_cls import SelectOfScalar
from app.core.enums import EstadoFiltro
from datetime import datetime, timezone
from uuid import UUID

T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    def __init__(self, session: Session, model: Type[T]) -> None:
        self.session = session
        self.model = model


    def _filter_state(self, statement: SelectOfScalar[T], state: EstadoFiltro)-> SelectOfScalar[T] | SelectOfScalar[int]:

        if hasattr(self.model, "deleted_at"):
            if state == EstadoFiltro.ACTIVO:
                statement = statement.where(self.model.deleted_at.is_(None))
                
            elif state == EstadoFiltro.ELIMINADO:
                statement = statement.where(self.model.deleted_at.is_not(None))

        return statement


    #===========Read============
    def get_by_id(self, record_id: int | UUID) -> Optional[T]:
        return self.session.get(self.model, record_id)
    

    def get_all_by_state(
            self,
            state: EstadoFiltro = EstadoFiltro.ACTIVO,
            offset: int = 0,
            limit: int = 20
    ) -> Sequence[T]:
        statement = select(self.model)
        statement = self._filter_state(statement, state)

        if hasattr(self.model, "created_at"):
            statement = statement.order_by(self.model.created_at.asc())
        elif hasattr(self.model, "id"):
            statement = statement.order_by(self.model.id.asc())

        return self.session.exec(statement.offset(offset).limit(limit)).all()


    def count_model(self, state: EstadoFiltro = EstadoFiltro.ACTIVO) -> int:
        statement = select(func.count()).select_from(self.model)
        statement = self._filter_state(statement, state)
        return self.session.exec(statement).one()
    

    #==========Create===========
    def add(self, instance: T) -> T:
        self.session.add(instance)
        self.session.flush()
        self.session.refresh(instance)
        return instance


    #==========Update===========
    def update(self, data: T) -> T:
        self.session.add(data)
        return data

    def flush(self) -> None:
        """Envía a la base los cambios pendientes sin confirmar la transacción."""
        self.session.flush()
    

    #==========Delete===========
    def delete(self, instance: T) -> None:
        if hasattr(self.model, "deleted_at"):
            setattr(instance,"deleted_at",datetime.now(timezone.utc))
            self.update(instance)
        else:
            self.session.delete(instance)
            self.session.flush()
