import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscarCategoria, categoriaQueries, raices } from '@/entities/categoria';
import { productoQueries } from '@/entities/producto';
import { useMediaQuery } from '@/shared/lib';
import { EncabezadoPagina, Paginacion } from '@/shared/ui';
import { aParametrosApi, contarFiltros, filtrosAUrl, filtrosDesdeUrl, hayCategoriaEnUrl, useBusqueda, type FiltrosUrl } from '../model';
import { BarraBusqueda } from './barra-busqueda';
import { BarraCategorias } from './barra-categorias';
import { BotonFiltros } from './boton-filtros';
import { ChipsFiltros, filtrosQuitables, type FiltroQuitable } from './chips-filtros';
import { CatalogoVacio, ErrorCatalogo, SinResultados } from './estados-catalogo';
import { EsqueletoProductos, GrillaProductos } from './grilla-productos';
import { FiltroStock } from './filtro-stock';
import { HojaFiltros } from './hoja-filtros';
import { PopoverPrecio } from './popover-precio';

const textoTotal = (total: number): string => `${total} ${total === 1 ? 'producto' : 'productos'}`;

/** Desde este ancho los filtros van en la barra superior (categorías, «Precio», «Solo con stock»); debajo, chips y una hoja «Filtros». */
const CONSULTA_DESKTOP = '(min-width: 1024px)';

/** Catálogo público (US-007): listado paginado de productos con búsqueda, categorías, precio y stock; los filtros viven en la URL. */
export function CatalogoPage() {
  const [parametros, setParametros] = useSearchParams();
  const esDesktop = useMediaQuery(CONSULTA_DESKTOP);
  const arbolConsulta = useQuery(categoriaQueries.arbol());
  const arbol = arbolConsulta.data;
  const filtros = filtrosDesdeUrl(parametros, arbol);
  const consulta = useQuery(productoQueries.lista(aParametrosApi(filtros, arbol)));
  const { data } = consulta;
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const resultadosRef = useRef<HTMLParagraphElement>(null);

  /** Cambia filtros conservando el resto; cualquier cambio de filtro vuelve a la página 1 (salvo que se pida otra). */
  const actualizar = useCallback(
    (cambios: Partial<FiltrosUrl>, { replace = false }: { replace?: boolean } = {}): void => {
      setParametros((previos) => filtrosAUrl({ ...filtrosDesdeUrl(previos), page: 1, ...cambios }), { replace });
    },
    [setParametros],
  );

  const escribirBusqueda = useCallback((q: string): void => actualizar({ q: q === '' ? undefined : q }, { replace: true }), [actualizar]);
  const busqueda = useBusqueda(filtros.q ?? '', escribirBusqueda);

  // Una categoría de la URL que el árbol no conoce se quita (sin sumar una entrada al historial).
  const categoriaDesconocida = arbol !== undefined && hayCategoriaEnUrl(parametros) && filtros.categoria === undefined;
  useEffect(() => {
    if (categoriaDesconocida) setParametros((previos) => filtrosAUrl(filtrosDesdeUrl(previos, arbol)), { replace: true });
  }, [categoriaDesconocida, arbol, setParametros]);

  // Una página fuera de rango (por ejemplo, tras filtrar o eliminar productos) vuelve a la última que existe.
  const fueraDeRango = data !== undefined && !consulta.isPlaceholderData && data.items.length === 0 && data.total > 0 && data.page > data.pages;
  const ultimaPagina = data?.pages ?? 1;
  useEffect(() => {
    if (fueraDeRango) actualizar({ page: ultimaPagina }, { replace: true });
  }, [fueraDeRango, ultimaPagina, actualizar]);

  const irAPagina = (page: number): void => {
    actualizar({ page });
    window.scrollTo({ top: 0 });
    resultadosRef.current?.focus();
  };

  const limpiar = (): void => setParametros({});
  const quitar = (filtro: FiltroQuitable): void => {
    if (filtro === 'categoria') actualizar({ categoria: undefined });
    else if (filtro === 'q') actualizar({ q: undefined });
    else if (filtro === 'precio') actualizar({ min: undefined, max: undefined });
    else actualizar({ stock: false });
  };

  const cantidadFiltros = contarFiltros(filtros);
  const nombreCategoria = filtros.categoria === undefined || arbol === undefined ? undefined : buscarCategoria(arbol, filtros.categoria)?.nombre;
  const raizActual = filtros.categoria === undefined || arbol === undefined ? null : (raices(arbol).find((raiz) => buscarCategoria([raiz], filtros.categoria ?? 0) !== undefined)?.id ?? null);
  const contenido = {
    arbol: arbolConsulta,
    filtros,
    onElegirCategoria: (id: number | null) => actualizar({ categoria: id ?? undefined }),
    onAplicarPrecio: (min: number | undefined, max: number | undefined) => actualizar({ min, max }),
    onCambiarStock: (activo: boolean) => actualizar({ stock: activo }),
  };
  const chips = <ChipsFiltros filtros={filtros} nombreCategoria={nombreCategoria} onQuitar={quitar} />;
  const sinResultados = data !== undefined && data.total === 0 && cantidadFiltros > 0;

  const conteo = data === undefined ? '' : (
    <>
      {textoTotal(data.total)}
      {nombreCategoria === undefined ? null : <small> en {nombreCategoria}</small>}
    </>
  );
  // Sin resultados los chips los muestra el propio estado vacío (con su «Limpiar filtros»), no el encabezado.
  const filtrosActivos = data === undefined || data.total === 0 ? [] : filtrosQuitables(filtros, nombreCategoria, quitar);
  const herramientas = (
    <>
      <BarraBusqueda texto={busqueda.texto} onCambiar={busqueda.setTexto} onBorrar={busqueda.borrar} />
      <BarraCategorias variante={esDesktop ? 'escritorio' : 'mobile'} arbol={arbolConsulta} categoriaActual={filtros.categoria ?? null} raizActual={raizActual} onElegirCategoria={contenido.onElegirCategoria}>
        {esDesktop ? (
          <div className="desk-tools">
            <PopoverPrecio min={filtros.min} max={filtros.max} onAplicar={contenido.onAplicarPrecio} />
            <FiltroStock compacto activo={filtros.stock} onCambiar={contenido.onCambiarStock} />
          </div>
        ) : (
          <BotonFiltros aplicados={cantidadFiltros} onAbrir={() => setHojaAbierta(true)} />
        )}
      </BarraCategorias>
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        eyebrow="Tienda"
        titulo="Catálogo"
        subtitulo="Elegí lo que tengas ganas y sumalo al carrito."
        herramientas={herramientas}
        filtrosActivos={{ conteo, filtros: filtrosActivos, onLimpiar: limpiar, conteoRef: resultadosRef }}
      />
      <div className="page-body cat-main">
        <h2 className="sr-only">Resultados</h2>
        {data === undefined && !consulta.isError ? <EsqueletoProductos /> : null}
        {data === undefined && consulta.isError ? <ErrorCatalogo error={consulta.error} onReintentar={() => void consulta.refetch()} /> : null}
        {data !== undefined ? (
          data.total === 0 ? (
            sinResultados ? (
              <SinResultados q={filtros.q} filtros={chips} onLimpiar={limpiar} />
            ) : (
              <CatalogoVacio />
            )
          ) : (
            <>
              <GrillaProductos productos={data.items} actualizando={consulta.isPlaceholderData} {...(filtros.categoria === undefined ? {} : { categoriaActiva: filtros.categoria })} />
              <Paginacion etiqueta="Paginación del catálogo" page={data.page} pages={data.pages} onCambiar={irAPagina} />
            </>
          )
        ) : null}
      </div>
      {hojaAbierta && !esDesktop ? (
        <HojaFiltros {...contenido} total={data?.total} onLimpiar={limpiar} onCerrar={() => setHojaAbierta(false)} />
      ) : null}
    </div>
  );
}
