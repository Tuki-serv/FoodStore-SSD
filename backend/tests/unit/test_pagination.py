"""Paginación genérica: `PageParams` y `PaginatedResponse.desde/vacia` (spec `api-conventions`)."""
from app.core.pagination import PageParams
from app.core.schemas import PaginatedResponse


def test_page_params_offset_se_calcula_desde_pagina_y_tamano():
    assert PageParams(page=3, size=10).offset == 20
    assert PageParams(page=1, size=20).offset == 0


def test_paginated_response_desde_calcula_pages_hacia_arriba():
    resp = PaginatedResponse[int].desde([1, 2], total=5, params=PageParams(page=2, size=2))
    assert resp.model_dump() == {"items": [1, 2], "total": 5, "page": 2, "size": 2, "pages": 3}


def test_paginated_response_desde_con_division_exacta():
    resp = PaginatedResponse[int].desde([1, 2], total=4, params=PageParams(page=1, size=2))
    assert resp.pages == 2


def test_paginated_response_vacia_tiene_cero_paginas():
    resp = PaginatedResponse[int].vacia(PageParams(page=1, size=20))
    assert resp.model_dump() == {"items": [], "total": 0, "page": 1, "size": 20, "pages": 0}


def test_paginated_response_desde_con_total_cero_tiene_cero_paginas():
    resp = PaginatedResponse[str].desde([], total=0, params=PageParams(page=1, size=5))
    assert resp.pages == 0
