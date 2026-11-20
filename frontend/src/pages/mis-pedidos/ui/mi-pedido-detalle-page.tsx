import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { pagoQueries, vistaPagoDelPedido } from '@/entities/payment';
import { autorEventoCliente, BadgeEstado, esEstadoTerminal, fechaLocal, horaLocal, LineaTiempoHistorial, pedidoQueries, puedeCancelarCliente, type EventoHistorial } from '@/entities/pedido';
import { useSesion } from '@/entities/session';
import { CancelarMiPedido } from '@/features/cambiar-estado-pedido';

import { aApiError } from '@/shared/api';
import { INTERVALO_ACTUALIZACION_MS, RUTAS } from '@/shared/config';
import { claseBoton, EstadoError, Icon, MarcaActualizacion } from '@/shared/ui';
import { AccionesMiPedido } from './acciones-mi-pedido';
import { ProgresoPedido } from './progreso-pedido';
import { BloquePago, TarjetaEntregaYPago, TarjetaProductosMiPedido } from './tarjetas-mi-pedido';

const CONTENEDOR = 'mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-5 lg:px-5 lg:py-6';

/** Filtro del listado con el que se abrió el pedido (`?estado=…&page=…`), para que «Volver a mis pedidos» vuelva al mismo lugar. */
function busquedaDeOrigen(estado: unknown): string {
  if (typeof estado !== 'object' || estado === null || !('volverA' in estado)) return '';
  const { volverA } = estado as { volverA: unknown };
  return typeof volverA === 'string' && volverA.startsWith('?') ? volverA : '';
}

function EnlaceVolver({ busqueda }: { busqueda: string }) {
  return (
    <Link className="back-link" to={{ pathname: RUTAS.misPedidos, search: busqueda }}>
      <Icon name="volver" />
      Volver a mis pedidos
    </Link>
  );
}

/** Pedido inexistente o ajeno (404, 403 o de otro usuario): mismo texto, sin datos del pedido. */
function PedidoNoEncontrado({ busqueda }: { busqueda: string }) {
  return (
    <div className={CONTENEDOR}>
      <section className="state empty" aria-labelledby="no-encontrado-titulo">
        <span className="badge-ico" aria-hidden="true">
          <Icon name="pedidos" className="h-[30px] w-[30px]" />
        </span>
        <h1 id="no-encontrado-titulo" tabIndex={-1} className="text-xl">
          No encontramos este pedido
        </h1>
        <p>Puede que el enlace esté mal o que el pedido no sea de tu cuenta.</p>
        <Link className={claseBoton('primario')} to={{ pathname: RUTAS.misPedidos, search: busqueda }}>
          <Icon name="volver" />
          Volver a mis pedidos
        </Link>
      </section>
    </div>
  );
}

function EsqueletoDetalle({ busqueda }: { busqueda: string }) {
  const tarjeta = (lineas: number, clase: string) => (
    <div className={`ocard skel-card ${clase}`}>
      {Array.from({ length: lineas }, (_, indice) => (
        <span key={indice} className="skel skel-line" style={{ width: `${40 + ((indice * 17) % 50)}%` }} />
      ))}
    </div>
  );
  return (
    <div className={CONTENEDOR}>
      <EnlaceVolver busqueda={busqueda} />
      <div className="od-head" role="status" aria-busy="true" aria-label="Cargando el pedido">
        <div className="od-title">
          <span className="skel" style={{ width: 240, height: 32 }} />
          <span className="skel skel-line" style={{ width: 200 }} />
        </div>
      </div>
      <div className="od">
        <div className="od-main">
          {tarjeta(3, 'c-seg')}
          {tarjeta(4, 'c-ent')}
          {tarjeta(5, 'c-prod')}
        </div>
        <div className="od-side">
          {tarjeta(2, 'c-acc')}
          {tarjeta(4, 'c-hist')}
        </div>
      </div>
    </div>
  );
}

const sinActualizarSiTermino = (estado: string | undefined) => (esEstadoTerminal(estado) ? false : INTERVALO_ACTUALIZACION_MS);

/** Detalle de un pedido propio (`/mis-pedidos/:pedidoId`): seguimiento, pago, entrega, productos, historial y cancelación. */
export function MiPedidoDetallePage() {
  const { pedidoId } = useParams();
  const id = Number(pedidoId);
  const idValido = Number.isInteger(id) && id > 0;
  const busqueda = busquedaDeOrigen(useLocation().state);
  const { usuario } = useSesion();
  const consulta = useQuery({
    ...pedidoQueries.detalle(id),
    enabled: idValido,
    refetchInterval: (query) => sinActualizarSiTermino(query.state.data?.estado_codigo),
    refetchIntervalInBackground: false,
  });
  const pedido = consulta.data;
  const consultaHistorial = useQuery({
    ...pedidoQueries.historial(id),
    enabled: idValido,
    refetchInterval: () => sinActualizarSiTermino(pedido?.estado_codigo),
    refetchIntervalInBackground: false,
  });
  const esDelUsuario = pedido !== undefined && usuario !== null && pedido.usuario_id === usuario.id;
  const pagaConTarjeta = esDelUsuario && pedido.forma_pago_codigo === 'MERCADOPAGO';
  const consultaPago = useQuery({
    ...pagoQueries.estado(id),
    enabled: pagaConTarjeta,
    refetchInterval: () => (pedido?.estado_codigo === 'PENDIENTE' ? INTERVALO_ACTUALIZACION_MS : false),
    refetchIntervalInBackground: false,
  });

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [cancelando, setCancelando] = useState(false);
  /** Se cerró el diálogo de cancelación: si el pedido ya no se puede cancelar, el botón no existe más y el foco pasa al título. */
  const devolverFoco = useRef(false);
  const estadoActual = pedido?.estado_codigo;
  useEffect(() => {
    if (!devolverFoco.current || cancelando || estadoActual === undefined || puedeCancelarCliente(estadoActual)) return;
    devolverFoco.current = false;
    tituloRef.current?.focus();
  }, [cancelando, estadoActual]);
  const cerrarCancelacion = (): void => {
    devolverFoco.current = true;
    setCancelando(false);
  };

  const actualizar = (): void => {
    void consulta.refetch();
    void consultaHistorial.refetch();
    if (pagaConTarjeta) void consultaPago.refetch();
  };

  if (!idValido) return <PedidoNoEncontrado busqueda={busqueda} />;
  if (pedido === undefined) {
    if (consulta.isError) {
      const error = aApiError(consulta.error);
      if (error.status === 404 || error.status === 403) return <PedidoNoEncontrado busqueda={busqueda} />;
      return (
        <div className={CONTENEDOR}>
          <EnlaceVolver busqueda={busqueda} />
          <EstadoError titulo="No pudimos cargar el pedido" detalle={error.detail} onReintentar={actualizar} />
        </div>
      );
    }
    return <EsqueletoDetalle busqueda={busqueda} />;
  }
  if (usuario === null || pedido.usuario_id !== usuario.id) return <PedidoNoEncontrado busqueda={busqueda} />;

  const pago = consultaPago.data ?? null;
  const vistaPago = vistaPagoDelPedido(pedido, pago, { consultando: pagaConTarjeta && consultaPago.isPending });
  const historial: readonly EventoHistorial[] | undefined = consultaHistorial.data;

  return (
    <div className={CONTENEDOR}>
      <EnlaceVolver busqueda={busqueda} />
      <div className="od-head">
        <div className="od-title">
          <h1 ref={tituloRef} tabIndex={-1}>
            {`Pedido #${pedido.id}`}
            <BadgeEstado codigo={pedido.estado_codigo} />
          </h1>
          <p>{`Hecho el ${fechaLocal(pedido.created_at)} a las ${horaLocal(pedido.created_at)}`}</p>
        </div>
        {esEstadoTerminal(pedido.estado_codigo) ? null : (
          <MarcaActualizacion actualizadoEn={consulta.dataUpdatedAt} actualizando={consulta.isFetching || consultaHistorial.isFetching} onActualizar={actualizar} />
        )}
      </div>
      <div className="od">
        <div className="od-main">
          <section className="ocard c-seg" aria-labelledby="seguimiento-titulo">
            <h2 id="seguimiento-titulo">Seguimiento</h2>
            <ProgresoPedido pedido={pedido} historial={historial} />
            <BloquePago pedido={pedido} vista={vistaPago} />
          </section>
          <TarjetaEntregaYPago pedido={pedido} pago={pago} />
          <TarjetaProductosMiPedido pedido={pedido} />
        </div>
        <div className="od-side">
          <AccionesMiPedido pedido={pedido} onCancelar={() => setCancelando(true)} />
          <section className="ocard c-hist" aria-labelledby="historial-titulo">
            <h2 id="historial-titulo">Historial</h2>
            {historial !== undefined ? (
              <LineaTiempoHistorial eventos={historial} autor={(evento) => autorEventoCliente(evento, usuario.id)} />
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
      {cancelando ? <CancelarMiPedido pedido={pedido} onCerrar={cerrarCancelacion} onCancelado={cerrarCancelacion} /> : null}
    </div>
  );
}
