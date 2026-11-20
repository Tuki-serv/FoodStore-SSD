import { useRef, useState } from 'react';
import { DialogoBaja, Icon } from '@/shared/ui';
import { useEnvioCambio } from '../api';
import { armarCambio } from '../model';
import { AlertaCambio } from './alerta-cambio';
import { CampoTexto } from './campo-texto';
import type { PedidoParaCambio } from './dialogo-cambio-estado';
import { PieDialogo } from './pie-dialogo';

export interface DialogoCancelarPedidoProps {
  pedido: PedidoParaCambio;
  /** Motivo ya escrito (por ejemplo, «Sin stock» al venir de un rechazo por stock). */
  motivoInicial?: string;
  onCerrar: () => void;
  onExito: () => void;
}

const MENSAJE_SIN_MOTIVO = 'Escribí el motivo de la cancelación';

/** Cancelar un pedido: el motivo es obligatorio; avisa si el stock vuelve y si el reintegro de Mercado Pago es aparte. */
export function DialogoCancelarPedido({ pedido, motivoInicial = '', onCerrar, onExito }: DialogoCancelarPedidoProps) {
  const [motivo, setMotivo] = useState(motivoInicial);
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const envio = useEnvioCambio(pedido.id, onExito);
  const devuelveStock = pedido.estado_codigo === 'CONFIRMADO' || pedido.estado_codigo === 'EN_PREP';
  const conMercadoPago = devuelveStock && pedido.forma_pago_codigo === 'MERCADOPAGO';

  const enviar = (): void => {
    if (motivo.trim() === '') {
      setErrorCampo(MENSAJE_SIN_MOTIVO);
      campoRef.current?.focus();
      return;
    }
    setErrorCampo(null);
    envio.enviar(armarCambio('CANCELADO', motivo));
  };
  const mensajeCampo = errorCampo ?? (envio.clase === 'motivo' && envio.error !== null ? envio.error.detail : null);

  return (
    <DialogoBaja
      titulo={`Cancelar el pedido #${pedido.id}`}
      pendiente={envio.pendiente}
      onConfirmar={enviar}
      onCerrar={onCerrar}
      acciones={<PieDialogo clase={envio.clase} pendiente={envio.pendiente} etiqueta="Cancelar pedido" icono="cerrar" peligro onConfirmar={enviar} onCerrar={onCerrar} />}
    >
      {envio.error === null || envio.clase === null ? null : <AlertaCambio clase={envio.clase} error={envio.error} />}
      <div className="warn is-danger">
        <Icon name="alerta" />
        <span>
          La cancelación no se puede deshacer.
          {devuelveStock ? <small>El stock de sus productos se devuelve.</small> : null}
        </span>
      </div>
      {conMercadoPago ? (
        <div className="warn is-info">
          <Icon name="tarjeta" />
          <span>Si el cliente ya pagó con tarjeta, el reintegro se gestiona aparte en Mercado Pago.</span>
        </div>
      ) : null}
      <CampoTexto
        etiqueta="Motivo"
        valor={motivo}
        onCambiar={(texto) => {
          setMotivo(texto);
          setErrorCampo(null);
        }}
        placeholder="Por ejemplo: el cliente no responde"
        deshabilitado={envio.clase === 'transicion' || envio.pendiente}
        inputRef={campoRef}
        {...(mensajeCampo === null ? {} : { error: mensajeCampo })}
      />
    </DialogoBaja>
  );
}
