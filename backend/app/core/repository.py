from typing import Generic, TypeVar, Type, Sequence, Optional
from sqlmodel import Session, SQLModel, func, select
from sqlmodel.sql._expression_select_cls import SelectOfScalar
from sqlalchemy.sql import Select
from app.core.enums import EstadoFiltro
from app.core.pagination import PageParams
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
    

    def get_for_update(self, record_id: int | UUID) -> Optional[T]:
        """Registro por id con bloqueo de fila (`SELECT ... FOR UPDATE`) y atributos refrescados desde la base."""
        statement = (
            select(self.model)
            .where(self.model.id == record_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return self.session.exec(statement).first()


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
    

    def paginar(self, statement: Select, params: PageParams) -> tuple[list, int]:
        """Cuenta el total del `select` filtrado y trae solo la página pedida: `(items, total)`.

        El `select` ya viene filtrado y ordenado por quien llama; el conteo ignora el orden.
        """
        total = self.session.exec(
            select(func.count()).select_from(statement.order_by(None).subquery())
        ).one()
        items = self.session.exec(statement.offset(params.offset).limit(params.size)).all()
        return list(items), total


    def existe_activo(self, campo: str, valor: object, excluir_id: int | None = None) -> bool:
        """True si hay otro registro activo (no eliminado) con `campo == valor`; comparación exacta, como el índice parcial."""
        statement = select(func.count()).select_from(self.model).where(getattr(self.model, campo) == valor)
        if hasattr(self.model, "deleted_at"):
            statement = statement.where(self.model.deleted_at.is_(None))
        if excluir_id is not None:
            statement = statement.where(self.model.id != excluir_id)
        return self.session.exec(statement).one() > 0


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
