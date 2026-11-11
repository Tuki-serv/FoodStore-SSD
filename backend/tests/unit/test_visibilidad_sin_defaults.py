"""Los parámetros de visibilidad de los services son keyword-only y obligatorios: olvidarlos falla con TypeError
en vez de mostrar datos eliminados o no disponibles."""
import inspect

import pytest

from app.core.pagination import PageParams
from app.core.service import base_service
from app.modules.categorias.service import CategoriaService
from app.modules.ingredientes.service import IngredienteService
from app.modules.productos.service import ProductoService
from app.modules.unidades_medida.service import UnidadMedidaService

# (método sin enlazar, argumentos posicionales válidos salvo la visibilidad, parámetros de visibilidad obligatorios)
CASOS = [
    pytest.param(base_service.get_by_id, (1,), {"ver_eliminados"}, id="base_service.get_by_id"),
    pytest.param(UnidadMedidaService.get_all_unidades, (PageParams(),), {"ver_eliminados"}, id="unidades.get_all_unidades"),
    pytest.param(CategoriaService.get_all_categorias, (PageParams(),), {"ver_eliminados"}, id="categorias.get_all_categorias"),
    pytest.param(CategoriaService.get_by_id_full, (1,), {"ver_eliminados"}, id="categorias.get_by_id_full"),
    pytest.param(IngredienteService.get_all_ingredientes, (PageParams(),), {"ver_eliminados"}, id="ingredientes.get_all_ingredientes"),
    pytest.param(IngredienteService.get_by_id_full, (1,), {"ver_eliminados"}, id="ingredientes.get_by_id_full"),
    pytest.param(
        ProductoService.get_all_productos, (PageParams(),), {"ver_no_disponibles", "ver_eliminados"}, id="productos.get_all_productos"
    ),
    pytest.param(
        ProductoService.get_by_id_full, (1,), {"ver_no_disponibles", "ver_eliminados"}, id="productos.get_by_id_full"
    ),
]


@pytest.mark.parametrize(("metodo", "posicionales", "visibilidad"), CASOS)
def test_service_sin_argumentos_de_visibilidad_falla_con_type_error(metodo, posicionales, visibilidad) -> None:
    with pytest.raises(TypeError, match="ver_"):
        metodo(object(), *posicionales)


@pytest.mark.parametrize(("metodo", "posicionales", "visibilidad"), CASOS)
def test_service_declara_la_visibilidad_keyword_only_sin_default(metodo, posicionales, visibilidad) -> None:
    parametros = inspect.signature(metodo).parameters

    for nombre in visibilidad:
        assert parametros[nombre].kind is inspect.Parameter.KEYWORD_ONLY
        assert parametros[nombre].default is inspect.Parameter.empty
