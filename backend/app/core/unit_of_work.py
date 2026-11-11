from sqlalchemy.orm.session import SessionTransaction
from sqlmodel import Session

_DEPTH_KEY = "uow_depth"


class UnitOfWork:
    """Unidad de trabajo reentrante sobre una `Session`.

    La más externa confirma (`commit`) al salir sin error y revierte (`rollback`) con error. Las anidadas sobre la misma
    sesión abren un SAVEPOINT: al salir sin error lo liberan sin confirmar; con error lo revierten y re-lanzan. Así varios
    services pueden componerse en una única transacción que solo confirma la UoW externa. La profundidad vive en
    `session.info`, de modo que dos instancias sobre la misma sesión la comparten.
    """

    def __init__(self, session: Session) -> None:
        self._session = session
        self._savepoints: list[SessionTransaction | None] = []

    @property
    def _depth(self) -> int:
        return self._session.info.get(_DEPTH_KEY, 0)

    def __enter__(self) -> "UnitOfWork":
        savepoint = self._session.begin_nested() if self._depth > 0 else None
        self._savepoints.append(savepoint)
        self._session.info[_DEPTH_KEY] = self._depth + 1
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        savepoint = self._savepoints.pop()
        try:
            if savepoint is None:  # UoW más externa: única que confirma o revierte la transacción
                if exc_type is None:
                    self._session.commit()
                else:
                    self._session.rollback()
            elif not savepoint.is_active:  # un rollback explícito ya cerró el SAVEPOINT
                pass
            elif exc_type is None:
                savepoint.commit()  # libera el SAVEPOINT; la transacción externa sigue abierta
            else:
                savepoint.rollback()
        finally:
            self._session.info[_DEPTH_KEY] = self._depth - 1

    def commit(self) -> None:
        if self._depth > 1:  # anidada: solo la externa confirma
            self._session.flush()
        else:
            self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
