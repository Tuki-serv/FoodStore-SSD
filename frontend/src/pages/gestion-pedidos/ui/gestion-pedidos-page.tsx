import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { etiquetaEstado, pedidoQueries } from '@/entities/pedido';
import { CambioEstadoPedido, type SolicitudCambio } from '@/features/cambiar-estado-pedido';
import { aApiError } from '@/shared/api';
import { INTERVALO_ACTUALIZACION_MS } from '@/shared/config';
import { AvisoActualizacionFallida, claseBoton, EncabezadoPagina, EstadoError, EstadoVacio, MarcaActualizacion, Paginacion, type FiltroActivo } from '@/shared/ui';
import { aParametros, leerFiltrosPedidos, TAMANO_PAGINA, type FiltrosUrl } from '../model';
import { AccionFila } from './accion-fila';
import { FiltrosPedidos } from './filtros-pedidos';
import { EsqueletoPedidos, TablaPedidos } from './tabla-pedidos';

const aFecha = (iso: string): string => iso.split('-').reverse().join('/');

/** Complemento de la línea de conteo: el período pedido (con la aclaración del día UTC del servidor) o, con solo estado, «con estos filtros». */
function describirFiltros({ estado, desde, hasta }: FiltrosUrl): string {
  const periodo =
    desde !== '' && hasta !== ''
      ? desde === hasta
        ? `del ${aFecha(desde)}`
        : `del ${aFecha(desde)} al ${aFecha(hasta)}`
      : desde !== ''
        ? `desde ${aFecha(desde)}`
        : hasta !== ''
          ? `hasta ${aFecha(hasta)}`
          : '';
  if (periodo !== '') return `${periodo} · día del servidor, UTC`;
  return estado === null ? '' : 'con estos filtros';
}

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

  const filtrosActivos: FiltroActivo[] = [
    ...(filtros.estado === null ? [] : [{ id: 'estado', etiqueta: etiquetaEstado(filtros.estado), onQuitar: () => irA({ ...filtros, estado: null, page: 1 }) }]),
    ...(filtros.desde === '' ? [] : [{ id: 'desde', etiqueta: `Desde ${aFecha(filtros.desde)}`, onQuitar: () => irA({ ...filtros, desde: '', page: 1 }) }]),
    ...(filtros.hasta === '' ? [] : [{ id: 'hasta', etiqueta: `Hasta ${aFecha(filtros.hasta)}`, onQuitar: () => irA({ ...filtros, hasta: '', page: 1 }) }]),
  ];

  const notaDeConteo = describirFiltros(filtros);

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoPagina
        fijo
        eyebrow="Operación"
        titulo="Gestión de pedidos"
        tituloRef={tituloRef}
        subtitulo="Confirmá los pagos en efectivo o transferencia y llevá cada pedido hasta la entrega."
        acciones={data === undefined ? undefined : <MarcaActualizacion actualizadoEn={consulta.dataUpdatedAt} actualizando={consulta.isFetching} onActualizar={reintentar} />}
        herramientas={<FiltrosPedidos filtros={filtros} onCambiar={(cambios) => irA({ ...filtros, ...cambios, page: 1 })} />}
        {...(data === undefined
          ? {}
          : { filtrosActivos: { conteo: (
                <>
                  {`${data.total} ${data.total === 1 ? 'pedido' : 'pedidos'}`}
                  {notaDeConteo === '' ? null : <small>{` ${notaDeConteo}`}</small>}
                </>
              ), filtros: filtrosActivos, onLimpiar: limpiar } })}
      />
      <div className="page-body flex flex-col gap-5">
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
    </div>
  );
}
