import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cuerpoDesdeBrick,
  montoDesdeTotal,
  pagoQueries,
  selectPagoEnCurso,
  useCrearPago,
  usePaymentStore,
  type AdicionalBrick,
  type DatosBrick,
  type RespuestaCrearPago,
} from '@/entities/payment';
import { aApiError, type ApiError } from '@/shared/api';
import { claseBoton, Icon } from '@/shared/ui';

export interface FormularioTarjetaProps {
  pedidoId: number;
  /** Total del pedido según el servidor (decimal en texto): es el monto del brick. */
  total: string;
  /** El backend respondió el cobro (aprobado, rechazado, pendiente o a devolver). */
  onResultado: (respuesta: RespuestaCrearPago) => void;
  /** El cobro falló (409, 400, 502, 503, red…): la página decide qué mostrar según `clasificarErrorPago`. */
  onError: (error: ApiError) => void;
}

interface BrickProps extends FormularioTarjetaProps {
  clave: string;
}

/** Brick montado con la clave ya conocida. Callbacks e `initialization` estables: el SDK remonta el brick si cambian. */
function BrickTarjeta({ pedidoId, total, clave, onResultado, onError }: BrickProps) {
  const [listo, setListo] = useState(false);
  const [errorBrick, setErrorBrick] = useState(false);
  const [montaje, setMontaje] = useState(0);
  const procesando = usePaymentStore(selectPagoEnCurso);
  const { mutateAsync: crearPago } = useCrearPago();

  const manejadores = useRef({ onResultado, onError });
  useEffect(() => {
    manejadores.current = { onResultado, onError };
  }, [onResultado, onError]);

  useMemo(() => initMercadoPago(clave, { locale: 'es-AR' }), [clave]);
  const inicializacion = useMemo(() => ({ amount: montoDesdeTotal(total) }), [total]);

  useEffect(() => {
    // Un intento que quedó a medias (la página se cerró) no debe bloquear el nuevo formulario; el resultado queda al desmontar.
    usePaymentStore.getState().reset();
  }, []);

  const alEnviar = useCallback(
    async (datos: DatosBrick, adicional?: AdicionalBrick): Promise<void> => {
      if (selectPagoEnCurso(usePaymentStore.getState())) return;
      const cuerpo = cuerpoDesdeBrick(pedidoId, datos, adicional);
      const pago = usePaymentStore.getState();
      pago.iniciar(pedidoId);
      try {
        const respuesta = await crearPago(cuerpo);
        pago.registrarResultado({ estado: respuesta.estado, mpPaymentId: respuesta.mp_payment_id, statusDetail: respuesta.mp_status_detail });
        manejadores.current.onResultado(respuesta);
      } catch (causa) {
        const error = aApiError(causa);
        pago.registrarError(error.detail);
        manejadores.current.onError(error);
      }
    },
    [pedidoId, crearPago],
  );
  const alEstarListo = useCallback(() => setListo(true), []);
  const alFallar = useCallback(() => setErrorBrick(true), []);

  if (errorBrick) {
    return (
      <div className="form-alert" role="alert">
        <Icon name="alerta" />
        <div>
          <strong>No pudimos cargar el formulario de tarjeta</strong>
          <p>Puede ser un problema de conexión. Intentá de nuevo.</p>
          <div className="alert-actions">
            <button
              type="button"
              className={claseBoton('secundario', { compacto: true })}
              onClick={() => {
                setErrorBrick(false);
                setListo(false);
                setMontaje((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={procesando ? 'mp-area mp-busy' : 'mp-area'}>
      {listo ? null : <CargandoFormulario />}
      <div key={montaje}>
        <CardPayment initialization={inicializacion} locale="es-AR" onSubmit={alEnviar} onReady={alEstarListo} onError={alFallar} />
      </div>
      {procesando ? (
        <div className="mp-veil">
          <div className="veil-box">
            <span className="spinner" aria-hidden="true" />
            <span role="status">Procesando el pago…</span>
            <span className="sec-note">No cierres ni recargues esta página.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CargandoFormulario() {
  return (
    <div className="mp-load" role="status" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <span>Cargando el formulario de tarjeta…</span>
    </div>
  );
}

/**
 * Formulario de tarjeta de Mercado Pago (brick `CardPayment`, PCI SAQ-A): los datos de la tarjeta los recibe el SDK y a
 * Food Store solo llega un token. Único módulo que importa `@mercadopago/sdk-react`. Pide la clave pública al backend
 * (`GET /pagos/config`); sin ella no monta el brick.
 */
export function FormularioTarjeta(props: FormularioTarjetaProps) {
  const configuracion = useQuery(pagoQueries.configuracion());

  if (configuracion.isError) {
    return (
      <div className="form-alert" role="alert">
        <Icon name="alerta" />
        <div>
          <strong>El pago con tarjeta no está disponible en este momento</strong>
          <p>Tu pedido está creado y sigue pendiente. Probá de nuevo en unos minutos.</p>
        </div>
      </div>
    );
  }
  if (configuracion.data === undefined) return <CargandoFormulario />;
  return <BrickTarjeta {...props} clave={configuracion.data} />;
}
