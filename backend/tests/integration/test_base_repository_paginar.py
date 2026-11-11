"""`BaseRepository.paginar` sobre una tabla real (unidades de medida)."""
from sqlmodel import Session, select

from app.core.pagination import PageParams
from app.modules.unidades_medida.models import UnidadMedida
from app.modules.unidades_medida.repository import UnidadMedidaRepository


def _sembrar_unidades(session: Session, cantidad: int) -> None:
    for i in range(cantidad):
        session.add(UnidadMedida(nombre=f"Unidad paginar {i}", simbolo=f"up{i}", tipo="peso"))
    session.flush()


def test_paginar_devuelve_la_pagina_pedida_y_el_total(session: Session):
    _sembrar_unidades(session, 5)
    repo = UnidadMedidaRepository(session)
    statement = select(UnidadMedida).where(UnidadMedida.nombre.like("Unidad paginar %")).order_by(UnidadMedida.id)

    items, total = repo.paginar(statement, PageParams(page=2, size=2))

    assert [u.nombre for u in items] == ["Unidad paginar 2", "Unidad paginar 3"]
    assert total == 5


def test_paginar_cuenta_solo_lo_filtrado(session: Session):
    _sembrar_unidades(session, 5)
    repo = UnidadMedidaRepository(session)
    statement = select(UnidadMedida).where(UnidadMedida.nombre == "Unidad paginar 4").order_by(UnidadMedida.id)

    items, total = repo.paginar(statement, PageParams(page=1, size=20))

    assert [u.simbolo for u in items] == ["up4"]
    assert total == 1


def test_paginar_pagina_posterior_a_la_ultima_trae_vacio_con_total_real(session: Session):
    _sembrar_unidades(session, 3)
    repo = UnidadMedidaRepository(session)
    statement = select(UnidadMedida).where(UnidadMedida.nombre.like("Unidad paginar %")).order_by(UnidadMedida.id)

    items, total = repo.paginar(statement, PageParams(page=5, size=2))

    assert items == []
    assert total == 3
