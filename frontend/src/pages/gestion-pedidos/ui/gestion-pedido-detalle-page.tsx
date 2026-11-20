import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BadgeEstado, fechaLocal, horaLocal, LineaTiempoHistorial, pedidoQueries, type PedidoDetalle } from '@/entities/pedido';
import { CambioEstadoPedido, type SolicitudCambio } from '@/features/cambiar-estado-pedido';
import { aApiError } from '@/shared/api';
import { INTERVALO_ACTUALIZACION_MS, RUTAS } from '@/shared/config';
import { claseBoton, EstadoError, Icon, MarcaActualizacion } from '@/shared/ui';
import { AccionesPedido } from './acciones-pedido';
import { TarjetaEntrega, TarjetaProductos } from './tarjetas-pedido';

const CONTENEDOR = 'mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

/** Filtros del listado con los que se abrió el pedido (`?estado=…`), para que «Volver a pedidos» vuelva al mismo lugar. */
function busquedaDeOrigen(estado: unknown): string {
  if (typeof estado !== 'object' || estado === null || !('volverA' in estado)) return '';
  const { volverA } = estado as { volverA: unknown };
  return typeof volverA === 'string' && volverA.startsWith('?') ? volverA : '';
}

function EnlaceVolver({ busqueda }: { busqueda: string }) {
  return (
    <Link className="back-link" to={{ pathname: RUTAS.gestionPedidos, search: busqueda }}>
      <Icon name="volver" />
      Volver a pedidos
    </Link>
  );
}

function EstadoUnico({ icono, titulo, texto, busqueda, children }: { icono: 'pedidos' | 'candado'; titulo: string; texto: string; busqueda: string; children?: React.ReactNode }) {
  return (
    <div className={CONTENEDOR}>
      <section className="state empty" aria-labelledby="detalle-estado-titulo">
        <span className="badge-ico" aria-hidden="true">
          <Icon name={icono} className="h-[30px] w-[30px]" />
        </span>
        <h1 id="detalle-estado-titulo" tabIndex={-1} className="text-xl">
          {titulo}
        </h1>
        <p>{texto}</p>
        {children}
        <Link className={claseBoton('primario')} to={{ pathname: RUTAS.gestionPedidos, search: busqueda }}>
          <Icon name="volver" />
          Volver a pedidos
        </Link>
      </section>
    </div>
  );
}

function EsqueletoDetalle({ busqueda }: { busqueda: string }) {
  const tarjeta = (lineas: number) => (
    <div className="ocard skel-card">
      {Array.from({ length: lineas }, (_, indice) => (
        <span key={indice} className="skel skel-line" style={{ width: `${40 + ((indice * 17) % 50)}%` }} />
      ))}
    </div>
  );
  return (
    <div className={CONTENEDOR}>
      <EnlaceVolver busqueda={busqueda} />
      <div className="od-head" role="status" aria-busy="true" aria-label="Cargando pedido">
        <div className="od-title">
          <span className="skel" style={{ width: 260, height: 32 }} />
          <span className="skel skel-line" style={{ width: 200 }} />
        </div>
      </div>
      <div className="od">
        <div className="od-main">
          {tarjeta(4)}
          {tarjeta(5)}
        </div>
        <div className="od-side">
          {tarjeta(2)}
          {tarjeta(4)}
        </div>
      </div>
    </div>
  );
}

/** Detalle operativo de un pedido (`/gestion-pedidos/:pedidoId`, `PEDIDOS`/`ADMIN`): entrega, ítems, acciones e historial. */
export function GestionPedidoDetallePage() {
  const { pedidoId } = useParams();
  const id = Number(pedidoId);
  const idValido = Number.isInteger(id) && id > 0;
  const busqueda = busquedaDeOrigen(useLocation().state);
  const consulta = useQuery({ ...pedidoQueries.detalle(id), enabled: idValido, refetchInterval: INTERVALO_ACTUALIZACION_MS, refetchIntervalInBackground: false });
  const consultaHistorial = useQuery({ ...pedidoQueries.historial(id), enabled: idValido, refetchInterval: INTERVALO_ACTUALIZACION_MS, refetchIntervalInBackground: false });
  const pedido: PedidoDetalle | undefined = consulta.data;
  const [solicitud, setSolicitud] = useState<SolicitudCambio | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  /** Estado desde el que se guardó un cambio: cuando el detalle ya muestra otro y el diálogo cerró, el foco pasa a la acción nueva. */
  const estadoPrevio = useRef<string | null>(null);
  const estadoActual = pedido?.estado_codigo;

  useEffect(() => {
    if (estadoPrevio.current === null || solicitud !== null || estadoActual === undefined || estadoActual === estadoPrevio.current) return;
    estadoPrevio.current = null;
    const siguiente = document.querySelector<HTMLElement>('[data-foco="avance"], [data-foco="confirmar-pago"]');
    (siguiente ?? tituloRef.current)?.focus();
  }, [estadoActual, solicitud]);

  const actualizar = (): void => {
    void consulta.refetch();
    void consultaHistorial.refetch();
  };

  if (!idValido) return <EstadoUnico icono="pedidos" titulo="No encontramos este pedido" texto="Puede que el número esté mal. Volvé al listado para buscarlo." busqueda={busqueda} />;
  if (pedido === undefined) {
    if (consulta.isError) {
      const error = aApiError(consulta.error);
      if (error.status === 404) return <EstadoUnico icono="pedidos" titulo="No encontramos este pedido" texto="Puede que el número esté mal. Volvé al listado para buscarlo." busqueda={busqueda} />;
      if (error.status === 403) return <EstadoUnico icono="candado" titulo="No tenés permiso para ver este pedido" texto="Tu cuenta no puede abrir este pedido." busqueda={busqueda} />;
      return (
        <div className={CONTENEDOR}>
          <EnlaceVolver busqueda={busqueda} />
          <EstadoError titulo="No pudimos cargar el pedido" detalle={error.detail} onReintentar={actualizar} />
        </div>
      );
    }
    return <EsqueletoDetalle busqueda={busqueda} />;
  }

  return (
    <div className={CONTENEDOR}>
      <EnlaceVolver busqueda={busqueda} />
      <div className="od-head">
        <div className="od-title">
          <h1 ref={tituloRef} tabIndex={-1}>
            {`Pedido #${pedido.id}`}
            <BadgeEstado codigo={pedido.estado_codigo} />
          </h1>
          <p>{`Creado el ${fechaLocal(pedido.created_at)} a las ${horaLocal(pedido.created_at)}`}</p>
        </div>
        <MarcaActualizacion actualizadoEn={consulta.dataUpdatedAt} actualizando={consulta.isFetching || consultaHistorial.isFetching} onActualizar={actualizar} />
      </div>
      <div className="od">
        <div className="od-main">
          <TarjetaEntrega pedido={pedido} />
          <TarjetaProductos pedido={pedido} />
        </div>
        <div className="od-side">
          <AccionesPedido pedido={pedido} onAccion={(accion) => setSolicitud({ pedido, accion })} />
          <section className="ocard historial" aria-labelledby="historial-titulo">
            <h2 id="historial-titulo">Historial</h2>
            {consultaHistorial.data !== undefined ? (
              <LineaTiempoHistorial eventos={consultaHistorial.data} />
            ) : consultaHistorial.isError ? (
              <div className="hist-err" role="alert">
                <strong>
                  <Icon name="alerta" />
                  No pudimos cargar el historial
                </strong>
                <p>El resto del pedido está al día. Probá de nuevo en un momento.</p>
                <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={() => void consultaHistorial.refetch()}>
                  <Icon name="reintentar" />
                  Reintentar
                </button>
              </div>
            ) : (
              <span className="skel skel-line" role="status" aria-label="Cargando historial" />
            )}
          </section>
        </div>
      </div>
      {solicitud === null ? null : (
        <CambioEstadoPedido
          solicitud={solicitud}
          onCerrar={() => setSolicitud(null)}
          onExito={() => {
            estadoPrevio.current = solicitud.pedido.estado_codigo;
            setSolicitud(null);
          }}
        />
      )}
    </div>
  );
}
