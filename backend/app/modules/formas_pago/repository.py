from sqlmodel import Session, select

from app.core.repository import BaseRepository
from app.modules.formas_pago.models import FormaPago

#============= POR SI HACE FALTA ===============
# Puede ser utilizado para verificar que la forma de pago existe

class FormaPagoRepository (BaseRepository[FormaPago]):
    def __init__(self, session: Session):
        super().__init__(session, FormaPago)

    def get_by_codigo(self, codigo: str) -> FormaPago | None:
        statement = select(FormaPago).where(FormaPago.codigo == codigo)
        return self.session.exec(statement).first()
