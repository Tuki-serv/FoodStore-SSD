import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pedidoQueries, type PedidoDetalle } from '@/entities/pedido';
import {
  clasificarErrorPago,
  intervaloSeguimiento,
  motivoRechazo,
  pagoQueries,
  TOPE_SEGUIMIENTO_MS,
  vistaPago,
  usePaymentStore,
  type EstadoPagoPedido,
  type RespuestaCrearPago,
  type VistaPago,
} from '@/entities/payment';
import { formatearPrecio } from '@/entities/producto';
import { FormularioTarjeta } from '@/features/pagar-con-tarjeta';
import type { ApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { claseBoton, EstadoError, Icon } from '@/shared/ui';
import { ResumenPago } from './resumen-pago';
import {
  AvisoErrorPago,
  AvisoTransicion,
  CabeceraPago,
  CONTENEDOR,
  EnlaceVerPedido,
  EstadoUnico,
  MotivoRechazo,
  PagoADevolver,
  PagoAprobado,
  PagoDemorando,
  PagoPendiente,
  TarjetaPago,
  VerificandoPago,
} from './vistas-pago';

/** Fallos de `crear` que reemplazan al formulario por un aviso (el resto se resuelve con la caché o no es un aviso). */
type ErrorCobro = 'desconocido' | 'no-disponible' | 'conexion' | 'no-encontrado';

const NOTA_SEGURIDAD = 'Los datos de la tarjeta los recibe Mercado Pago directamente; Food Store no los ve ni los guarda.';

function estadoRechazadoGenerico(pedidoId: number): EstadoPagoPedido {
  return { pedido_id: pedidoId, pago_id: null, estado: 'rechazado', mp_status: null, mp_status_detail: null };
}

function PedidoNoEncontrado({ foco }: { foco: React.Ref<HTMLHeadingElement> }) {
  return (
    <EstadoUnico icono="pedidos" titulo="No encontramos este pedido" texto="Puede que el enlace esté mal o que el pedido no sea de tu cuenta." foco={foco}>
      <Link className={claseBoton('primario')} to={RUTAS.misPedidos}>
        Ver mis pedidos
      </Link>
    </EstadoUnico>
  );
}

function ErrorDeCobro({ clase, pedidoId, reintentar }: { clase: Exclude<ErrorCobro, 'no-encontrado'>; pedidoId: number; reintentar: () => void }) {
  if (clase === 'desconocido') {
    return (
      <AvisoErrorPago
        titulo="No pudimos confirmar el resultado con Mercado Pago"
        texto="Es posible que el pago esté en proceso. Reintentá: si ya se hubiera cobrado, no se cobra dos veces. Vas a tener que cargar la tarjeta de nuevo."
        reintentar={reintentar}
      />
    );
  }
  if (clase === 'no-disponible') {
    return (
      <AvisoErrorPago titulo="El pago con tarjeta no está disponible en este momento" texto={`Tu pedido #${pedidoId} está creado y sigue pendiente. Probá de nuevo en unos minutos.`}>
        <EnlaceVerPedido pedidoId={pedidoId} />
      </AvisoErrorPago>
    );
  }
  return <AvisoErrorPago titulo="No pudimos conectarnos. Revisá tu conexión e intentá de nuevo." texto={`Tu pedido #${pedidoId} sigue pendiente.`} reintentar={reintentar} />;
}

/**
 * Página de pago con tarjeta (`/finalizar-compra/pedido/:pedidoId/pago`, solo `CLIENT`). La vista sale del pedido y del
 * último resultado de pago en la caché de TanStack Query (`vistaPago`); el cobro lo hace `FormularioTarjeta`.
 */
export function PagoPedidoPage() {
  const { pedidoId } = useParams();
  const id = Number(pedidoId);
  const idValido = Number.isInteger(id) && id > 0;
  const cliente = useQueryClient();
  const consultaPedido = useQuery({ ...pedidoQueries.detalle(id), enabled: idValido });
  const pedido: PedidoDetalle | undefined = consultaPedido.data;
  const pagaConTarjeta = pedido?.forma_pago_codigo === 'MERCADOPAGO';
  // Seguimiento acotado: pasados 2 min con el pago todavía pendiente se deja de consultar (D2).
  const [agotado, setAgotado] = useState(false);
  const consultaPago = useQuery({
    ...pagoQueries.estado(id),
    enabled: pagaConTarjeta,
    refetchInterval: (consulta) => intervaloSeguimiento(consulta.state.data?.estado, agotado),
    refetchIntervalInBackground: false,
  });
  const numeroOperacion = usePaymentStore((estado) => (estado.pedidoId === id ? estado.mpPaymentId : null));
  const [errorCobro, setErrorCobro] = useState<ErrorCobro | null>(null);
  const [reintento, setReintento] = useState(false);

  const foco = useRef<HTMLHeadingElement>(null);
  const vistaPrevia = useRef<string | null>(null);

  const alResultado = useCallback(
    (respuesta: RespuestaCrearPago) => {
      setErrorCobro(null);
      setReintento(false);
      if (respuesta.estado === 'aprobado' || respuesta.estado === 'a_devolver') {
        void cliente.invalidateQueries({ queryKey: pedidoQueries.todas() });
      }
    },
    [cliente],
  );

  const alError = useCallback(
    (error: ApiError) => {
      const clase = clasificarErrorPago(error);
      setReintento(false);
      if (clase === 'rechazado-datos') {
        setErrorCobro(null);
        cliente.setQueryData(pagoQueries.estado(id).queryKey, estadoRechazadoGenerico(id));
      } else if (clase === 'no-permitido') {
        setErrorCobro(null);
        void Promise.allSettled([
          cliente.invalidateQueries({ queryKey: pedidoQueries.todas() }),
          cliente.fetchQuery({ ...pagoQueries.estado(id), staleTime: 0 }),
        ]).then(([, pago]) => {
          if (pago.status === 'rejected') setErrorCobro('conexion');
        });
      } else {
        setErrorCobro(clase);
      }
    },
    [cliente, id],
  );

  const vistaBase = pedido === undefined ? null : vistaPago(pedido, consultaPago.data ?? null);
  const vista = vistaBase === 'rechazado' && reintento ? 'formulario' : vistaBase;
  const demorando = vista === 'pendiente' && agotado;
  const claveVista = vista === null ? null : `${vista}:${errorCobro ?? ''}:${demorando ? 'demora' : ''}`;

  // Aviso al pasar de pendiente a un resultado (ajuste de estado durante el render, sin efecto).
  const [vistaAnterior, setVistaAnterior] = useState<VistaPago | null>(null);
  const [transicion, setTransicion] = useState<'aprobado' | 'rechazado' | null>(null);
  if (vista !== vistaAnterior) {
    setVistaAnterior(vista);
    setTransicion(vistaAnterior === 'pendiente' && (vista === 'aprobado' || vista === 'rechazado') ? vista : null);
  }

  // Tope de espera: mientras la vista es pendiente corre el reloj de 2 min; al salir de pendiente se reinicia.
  const pendiente = vista === 'pendiente';
  useEffect(() => {
    if (!pendiente) return undefined;
    const reloj = setTimeout(() => setAgotado(true), TOPE_SEGUIMIENTO_MS);
    return () => {
      clearTimeout(reloj);
      setAgotado(false);
    };
  }, [pendiente]);

  // Al llegar el resultado de un pendiente (aprobado, rechazado o a_devolver) el pedido cambió en el servidor.
  const veniaPendiente = useRef(false);
  useEffect(() => {
    if (vista === 'pendiente') veniaPendiente.current = true;
    else if (vista !== null) {
      if (veniaPendiente.current && (vista === 'aprobado' || vista === 'a-devolver' || vista === 'rechazado')) {
        void cliente.invalidateQueries({ queryKey: pedidoQueries.todas() });
      }
      veniaPendiente.current = false;
    }
  }, [vista, cliente]);

  // Cada cambio de vista (no la primera) mueve el foco al título del resultado.
  useEffect(() => {
    if (claveVista === null) return;
    if (vistaPrevia.current !== null && vistaPrevia.current !== claveVista) foco.current?.focus();
    vistaPrevia.current = claveVista;
  }, [claveVista]);

  if (!idValido) return <PedidoNoEncontrado foco={foco} />;
  if (consultaPedido.isError) {
    if (consultaPedido.error.status === 403 || consultaPedido.error.status === 404) return <PedidoNoEncontrado foco={foco} />;
    return (
      <div className={CONTENEDOR}>
        <EstadoError titulo="No pudimos cargar el pedido" detalle={consultaPedido.error.detail} onReintentar={() => void consultaPedido.refetch()} />
      </div>
    );
  }
  if (pedido === undefined || vista === null) {
    return (
      <div className={CONTENEDOR}>
        <div role="status" aria-busy="true" aria-label="Cargando el pedido" className="grid gap-3">
          <div className="skel h-[56px]" />
          <div className="skel h-[180px]" />
        </div>
      </div>
    );
  }
  if (errorCobro === 'no-encontrado') return <PedidoNoEncontrado foco={foco} />;

  const total = formatearPrecio(pedido.total);
  const cabeceraPagar = (
    <CabeceraPago
      tono="normal"
      icono="tarjeta"
      titulo={`Pagar pedido #${pedido.id}`}
      texto={
        <>
          Total a pagar: <b>{total}</b>. El pedido queda confirmado cuando Mercado Pago aprueba el pago.
        </>
      }
      foco={foco}
    />
  );

  // Antes de saber si ya hay un pago no se monta el formulario (D1).
  if (pagaConTarjeta && consultaPago.data === undefined) {
    return (
      <div className={CONTENEDOR}>
        <div className="done">
          {cabeceraPagar}
          <div className="done-grid">
            <div className="done-col">
              <TarjetaPago titulo="Pagá con tarjeta">
                {consultaPago.isError ? (
                  <AvisoErrorPago
                    titulo="No pudimos conectarnos. Revisá tu conexión e intentá de nuevo."
                    texto={`No mostramos el formulario hasta saber si ya hay un pago. Tu pedido #${pedido.id} sigue pendiente.`}
                    reintentar={() => void consultaPago.refetch()}
                  />
                ) : (
                  <VerificandoPago />
                )}
              </TarjetaPago>
            </div>
            <ResumenPago pedido={pedido} />
          </div>
        </div>
      </div>
    );
  }

  if (vista === 'no-tarjeta') {
    return (
      <EstadoUnico icono="efectivo" titulo="Este pedido no se paga con tarjeta" texto={`El pedido #${pedido.id} se paga en efectivo o por transferencia y lo confirma el local.`} foco={foco}>
        <EnlaceVerPedido pedidoId={pedido.id} />
      </EstadoUnico>
    );
  }
  if (vista === 'no-pagable') {
    return (
      <EstadoUnico icono="info" titulo="Este pedido ya no se puede pagar" texto={`El pedido #${pedido.id} ya no está pendiente de pago.`} foco={foco}>
        <EnlaceVerPedido pedidoId={pedido.id} />
      </EstadoUnico>
    );
  }

  let cabecera = cabeceraPagar;
  let cuerpo: React.ReactNode;
  if (vista === 'aprobado') {
    cabecera = <CabeceraPago tono="ok" icono="exito" titulo="¡Pago aprobado!" texto={`Mercado Pago aprobó el pago y tu pedido #${pedido.id} quedó confirmado.`} foco={foco} />;
    cuerpo = (
      <>
        {transicion === 'aprobado' ? <AvisoTransicion tono="ok" icono="exito" texto="Mercado Pago confirmó tu pago." /> : null}
        <PagoAprobado pedido={pedido} numeroOperacion={numeroOperacion} />
      </>
    );
  } else if (vista === 'a-devolver') {
    cabecera = (
      <CabeceraPago
        tono="warn"
        icono="alerta"
        titulo="Tu pago se aprobó, pero no pudimos confirmar el pedido"
        texto={`Algún producto se quedó sin stock mientras se procesaba el pago, así que el pedido #${pedido.id} se canceló.`}
        foco={foco}
      />
    );
    cuerpo = <PagoADevolver pedido={pedido} />;
  } else if (vista === 'pendiente' && demorando) {
    cabecera = (
      <CabeceraPago tono="wait" icono="reloj" titulo="La confirmación está demorando" texto={`Todavía no recibimos la confirmación de Mercado Pago para el pedido #${pedido.id}.`} foco={foco} />
    );
    cuerpo = <PagoDemorando pedido={pedido} actualizando={consultaPago.isFetching} onActualizar={() => void consultaPago.refetch()} />;
  } else if (vista === 'pendiente') {
    cabecera = (
      <CabeceraPago tono="wait" icono="reloj" titulo="Estamos esperando la confirmación de Mercado Pago" texto={`Tu pedido #${pedido.id} se confirma cuando Mercado Pago apruebe el pago.`} foco={foco} />
    );
    cuerpo = <PagoPendiente pedido={pedido} />;
  } else if (vista === 'rechazado') {
    cabecera = (
      <CabeceraPago
        tono="bad"
        icono="alerta"
        titulo="El pago fue rechazado"
        texto={`No se cobró nada. Tu pedido #${pedido.id} sigue pendiente y podés intentar de nuevo con otra tarjeta.`}
        foco={foco}
      />
    );
    cuerpo = (
      <TarjetaPago titulo="Pagá con tarjeta">
        {transicion === 'rechazado' ? <AvisoTransicion tono="warn" icono="alerta" texto="Mercado Pago no aprobó el pago." /> : null}
        <MotivoRechazo motivo={motivoRechazo(consultaPago.data?.mp_status_detail)} />
        <div className="pay-actions">
          <button type="button" className={claseBoton('primario')} onClick={() => setReintento(true)}>
            <Icon name="tarjeta" />
            Intentar de nuevo
          </button>
        </div>
        <p className="sec-note">Al intentar de nuevo se vuelve a cargar el formulario de Mercado Pago, vacío.</p>
      </TarjetaPago>
    );
  } else {
    cuerpo = (
      <TarjetaPago titulo="Pagá con tarjeta">
        {errorCobro === null ? (
          <>
            <FormularioTarjeta pedidoId={pedido.id} total={pedido.total} onResultado={alResultado} onError={alError} />
            <p className="secure">
              <Icon name="candado" />
              {NOTA_SEGURIDAD}
            </p>
          </>
        ) : (
          <ErrorDeCobro clase={errorCobro} pedidoId={pedido.id} reintentar={() => setErrorCobro(null)} />
        )}
      </TarjetaPago>
    );
  }

  return (
    <div className={CONTENEDOR}>
      <div className="done">
        {cabecera}
        <div className="done-grid">
          <div className="done-col">{cuerpo}</div>
          <ResumenPago pedido={pedido} />
        </div>
      </div>
    </div>
  );
}
