"""Composición del módulo `pagos`: arma `PaymentService` para inyectarlo (D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.pagos.service import PaymentService


def get_payment_service(session: SessionDep) -> PaymentService:
    return PaymentService(session)


PaymentServiceDep = Annotated[PaymentService, Depends(get_payment_service)]
