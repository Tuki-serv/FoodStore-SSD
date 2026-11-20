import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pedidoQueries } from '@/entities/pedido';
import { CambioEstadoPedido, type SolicitudCambio } from '@/features/cambiar-estado-pedido';
import { aApiError } from '@/shared/api';
import { INTERVALO_ACTUALIZACION_MS } from '@/shared/config';
import { AvisoActualizacionFallida, claseBoton, EstadoError, EstadoVacio, MarcaActualizacion, Paginacion } from '@/shared/ui';
import { aParametros, leerFiltrosPedidos, TAMANO_PAGINA, type FiltrosUrl } from '../model';
import { AccionFila } from './accion-fila';
import { FiltrosPedidos } from './filtros-pedidos';
import { EsqueletoPedidos, TablaPedidos } from './tabla-pedidos';

const SIN_FILTROS: FiltrosUrl = { estado: null, desde: '', hasta: '', page: 1 };

/** Gestión de pedidos (`/gestion-pedidos`, `PEDIDOS`/`ADMIN`): todos los pedidos, con filtros en la URL y actualización periódica. */
export function GestionPedidosPage() {
  const [parametros, setParametros] = useSearchParams();
  const filtros = leerFiltrosPedidos(parametros);
  const consulta = useQuery({
    ...pedidoQueries.lista({
      ...(filtros.estado === null ? {} : { estado: filtros.estado }),
      ...(filtros.desde === '' ? {} : { desde: filtros.desde }),
      ...(filtros.hasta === '' ? {} : { hasta: filtros.hasta }),
      page: filtros.page,
      size: TAMANO_PAGINA,
    }),
    refetchInterval: INTERVALO_ACTUALIZACION_MS,
    refetchIntervalInBackground: false,
  });
  const { data } = consulta;
  const [solicitud, setSolicitud] = useState<SolicitudCambio | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  /** Pedido y estado desde el que se guardó un cambio: cuando el listado ya lo muestra distinto y el diálogo cerró, el foco vuelve a su fila. */
  const guardado = useRef<{ id: number; estado: string } | null>(null);

  useEffect(() => {
    const previo = guardado.current;
    const fila = previo === null ? undefined : data?.items.find((pedido) => pedido.id === previo.id);
    if (previo === null || solicitud !== null || fila === undefined || fila.estado_codigo === previo.estado) return;
    guardado.current = null;
    const boton = document.querySelector<HTMLElement>(`[data-foco="fila-${previo.id}"]`);
    (boton ?? tituloRef.current)?.focus();
  }, [data, solicitud]);

  const irA = (siguiente: FiltrosUrl): void => setParametros(aParametros(siguiente));
  const hayFiltros = filtros.estado !== null || filtros.desde !== '' || filtros.hasta !== '';
  const reintentar = (): void => void consulta.refetch();
  const limpiar = (): void => irA(SIN_FILTROS);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6">
      <header className="page-head">
        <h1 ref={tituloRef} tabIndex={-1} className="text-2xl">
          Gestión de pedidos
        </h1>
        <p>Confirmá los pagos en efectivo o transferencia y llevá cada pedido hasta la entrega.</p>
      </header>
      <FiltrosPedidos filtros={filtros} onCambiar={(cambios) => irA({ ...filtros, ...cambios, page: 1 })} onLimpiar={limpiar} />
      {data === undefined ? null : (
        <div className="gp-bar">
          <p className="admin-summary" role="status">
            <strong>{`${data.total} ${data.total === 1 ? 'pedido' : 'pedidos'}`}</strong>
            {hayFiltros ? ' con estos filtros' : ''}
          </p>
          <MarcaActualizacion actualizadoEn={consulta.dataUpdatedAt} actualizando={consulta.isFetching} onActualizar={reintentar} />
        </div>
      )}
      {consulta.isError && data !== undefined ? <AvisoActualizacionFallida actualizadoEn={consulta.dataUpdatedAt} onReintentar={reintentar} /> : null}
      {data === undefined ? (
        consulta.isError ? (
          <EstadoError titulo="No pudimos cargar los pedidos" detalle={aApiError(consulta.error).detail} onReintentar={reintentar} />
        ) : (
          <EsqueletoPedidos />
        )
      ) : data.total === 0 ? (
        hayFiltros ? (
          <EstadoVacio icono="buscar" titulo="No hay pedidos con estos filtros" texto="Probá con otro estado u otras fechas.">
            <button type="button" className={claseBoton('secundario')} onClick={limpiar}>
              Limpiar filtros
            </button>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono="pedidos" titulo="Todavía no hay pedidos" texto="Cuando un cliente haga un pedido va a aparecer acá. La lista se actualiza sola cada 30 segundos." />
        )
      ) : (
        <>
          <TablaPedidos pedidos={data.items} accion={(pedido) => <AccionFila pedido={pedido} onAccion={(accion) => setSolicitud({ pedido, accion })} />} desactualizada={consulta.isPlaceholderData} />
          <div className="gp-foot">
            <span className="admin-summary">{`Mostrando ${(data.page - 1) * data.size + 1}–${(data.page - 1) * data.size + data.items.length} de ${data.total}`}</span>
            <Paginacion etiqueta="Paginación de pedidos" page={data.page} pages={data.pages} onCambiar={(page) => irA({ ...filtros, page })} />
          </div>
        </>
      )}
      {solicitud === null ? null : (
        <CambioEstadoPedido
          solicitud={solicitud}
          onCerrar={() => setSolicitud(null)}
          onExito={() => {
            guardado.current = { id: solicitud.pedido.id, estado: solicitud.pedido.estado_codigo };
            setSolicitud(null);
          }}
        />
      )}
    </div>
  );
}
