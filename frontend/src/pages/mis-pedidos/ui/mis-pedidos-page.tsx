import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { etiquetaEstado, pedidoQueries } from '@/entities/pedido';
import { aApiError } from '@/shared/api';
import { INTERVALO_ACTUALIZACION_MS, RUTAS } from '@/shared/config';
import { AvisoActualizacionFallida, claseBoton, EstadoError, EstadoVacio, Icon, MarcaActualizacion, Paginacion } from '@/shared/ui';
import { aParametros, debeActualizarLista, leerFiltroMisPedidos, TAMANO_PAGINA, type FiltroMisPedidos as Filtro } from '../model';
import { FiltroMisPedidos } from './filtro-mis-pedidos';
import { EsqueletoMisPedidos, ListaMisPedidos } from './lista-mis-pedidos';

const SIN_FILTRO: Filtro = { estado: null, page: 1 };

/** «Mis pedidos» (`/mis-pedidos`, cualquier sesión): solo los pedidos propios, con filtro por estado en la URL y actualización periódica. */
export function MisPedidosPage() {
  const [parametros, setParametros] = useSearchParams();
  const filtro = leerFiltroMisPedidos(parametros);
  const consulta = useQuery({
    ...pedidoQueries.lista({ propios: true, ...(filtro.estado === null ? {} : { estado: filtro.estado }), page: filtro.page, size: TAMANO_PAGINA }),
    refetchInterval: (query) => (debeActualizarLista(query.state.data?.items) ? INTERVALO_ACTUALIZACION_MS : false),
    refetchIntervalInBackground: false,
  });
  const { data } = consulta;
  const irA = (siguiente: Filtro): void => setParametros(aParametros(siguiente));
  const actualizar = (): void => void consulta.refetch();
  const limpiar = (): void => irA(SIN_FILTRO);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6">
      <header className="page-head">
        <h1 tabIndex={-1} className="text-2xl">
          Mis pedidos
        </h1>
        <p>Seguí cada pedido y cancelalo mientras esté pendiente o confirmado.</p>
      </header>
      <FiltroMisPedidos estado={filtro.estado} onCambiar={(estado) => irA({ estado, page: 1 })} onLimpiar={limpiar} />
      {data === undefined ? null : (
        <div className="gp-bar">
          <p className="admin-summary" role="status">
            <strong>{`${data.total} ${data.total === 1 ? 'pedido' : 'pedidos'}`}</strong>
            {filtro.estado === null ? '' : ` en ${etiquetaEstado(filtro.estado)}`}
          </p>
          <MarcaActualizacion actualizadoEn={consulta.dataUpdatedAt} actualizando={consulta.isFetching} onActualizar={actualizar} />
        </div>
      )}
      {consulta.isError && data !== undefined ? <AvisoActualizacionFallida actualizadoEn={consulta.dataUpdatedAt} onReintentar={actualizar} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar tus pedidos" detalle={aApiError(consulta.error).detail} onReintentar={actualizar} />
        ) : (
          <EsqueletoMisPedidos />
        )
      ) : data.total === 0 ? (
        filtro.estado === null ? (
          <EstadoVacio icono="pedidos" titulo="Todavía no hiciste pedidos" texto="Cuando hagas tu primer pedido lo vas a poder seguir desde acá.">
            <Link className={claseBoton('primario')} to={RUTAS.catalogo}>
              <Icon name="catalogo" />
              Ver catálogo
            </Link>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono="buscar" titulo="No tenés pedidos en ese estado" texto="Probá con otro estado o mirá todos tus pedidos.">
            <button type="button" className={claseBoton('secundario')} onClick={limpiar}>
              Limpiar filtro
            </button>
          </EstadoVacio>
        )
      ) : (
        <>
          <ListaMisPedidos pedidos={data.items} desactualizada={consulta.isPlaceholderData} />
          <div className="gp-foot">
            <span className="admin-summary">{`Mostrando ${(data.page - 1) * data.size + 1}–${(data.page - 1) * data.size + data.items.length} de ${data.total}`}</span>
            <Paginacion etiqueta="Paginación de mis pedidos" page={data.page} pages={data.pages} onCambiar={(page) => irA({ ...filtro, page })} />
          </div>
        </>
      )}
    </div>
  );
}
