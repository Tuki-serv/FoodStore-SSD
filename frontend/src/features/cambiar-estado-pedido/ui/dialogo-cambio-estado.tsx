import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BadgeEstado, EntregaDelPedido, etiquetaEstado, iconoAccion, pedidoQueries, type AccionPedido, type PedidoResumen } from '@/entities/pedido';
import { Dialogo, Icon, claseBoton } from '@/shared/ui';
import { useCambiarEstadoPedido, useEnvioCambio } from '../api';
import { armarCambio } from '../model';
import { AlertaCambio } from './alerta-cambio';
import { CampoTexto } from './campo-texto';
import { PieDialogo } from './pie-dialogo';

export type PedidoParaCambio = Pick<PedidoResumen, 'id' | 'estado_codigo' | 'forma_pago_codigo'>;

export interface DialogoCambioEstadoProps {
  pedido: PedidoParaCambio;
  accion: AccionPedido;
  onCerrar: () => void;
  onExito: () => void;
  /** Tras «sin stock»: pasa a cancelar el pedido con el motivo «Sin stock». */
  onCancelarPorStock: () => void;
}

function ayudaDe(pedido: PedidoParaCambio, accion: AccionPedido): string | null {
  if (accion.tipo === 'confirmar-pago') {
    const como = pedido.forma_pago_codigo === 'TRANSFERENCIA' ? 'por transferencia' : 'en efectivo';
    return `Confirmás que el local recibió el pago ${como}. Al confirmar se descuenta el stock de los productos.`;
  }
  return accion.destino === 'ENTREGADO' ? 'El pedido queda terminado y ya no admite cambios.' : null;
}

function tituloDe(pedido: PedidoParaCambio, accion: AccionPedido): string {
  return accion.tipo === 'confirmar-pago' ? `Confirmar pago del pedido #${pedido.id}` : `${accion.etiqueta} el pedido #${pedido.id}`;
}

function EntregaEnDialogo({ pedidoId }: { pedidoId: number }) {
  const consulta = useQuery(pedidoQueries.detalle(pedidoId));
  if (consulta.data === undefined) return consulta.isError ? null : <span className="skel skel-line" role="status" aria-label="Cargando entrega" />;
  return (
    <div className="dlg-deliv">
      <Icon name={consulta.data.direccion === null ? 'tienda' : 'direcciones'} />
      <div>
        <small>{consulta.data.direccion === null ? 'Entrega' : 'Entregar en'}</small>
        <EntregaDelPedido direccion={consulta.data.direccion} />
      </div>
    </div>
  );
}

/** Diálogo de un avance del pedido (confirmar pago, pasar a preparación, despachar, marcar entregado) con observación opcional. */
export function DialogoCambioEstado({ pedido, accion, onCerrar, onExito, onCancelarPorStock }: DialogoCambioEstadoProps) {
  const [observacion, setObservacion] = useState('');
  const envio = useEnvioCambio(useCambiarEstadoPedido(pedido.id), onExito);
  const ayuda = ayudaDe(pedido, accion);
  const enviar = (): void => envio.enviar(armarCambio(accion.destino, observacion));
  const desde = etiquetaEstado(pedido.estado_codigo);
  const hacia = etiquetaEstado(accion.destino);

  return (
    <Dialogo titulo={tituloDe(pedido, accion)} onCerrar={envio.pendiente ? () => undefined : onCerrar}>
      <p className="trans">
        <BadgeEstado codigo={pedido.estado_codigo} />
        <Icon name="flecha" />
        <BadgeEstado codigo={accion.destino} />
        <span className="sr-only">{`${desde} → ${hacia}`}</span>
      </p>
      {envio.error === null || envio.clase === null ? null : (
        <AlertaCambio clase={envio.clase} error={envio.error}>
          {envio.clase === 'sin-stock' ? (
            <button type="button" className={claseBoton('peligroContorno', { compacto: true })} onClick={onCancelarPorStock}>
              <Icon name="cerrar" />
              Cancelar por falta de stock
            </button>
          ) : null}
        </AlertaCambio>
      )}
      {ayuda === null ? null : <p className="help">{ayuda}</p>}
      {accion.destino === 'EN_CAMINO' ? <EntregaEnDialogo pedidoId={pedido.id} /> : null}
      <CampoTexto
        etiqueta="Observación"
        opcional
        valor={observacion}
        onCambiar={setObservacion}
        placeholder="Por ejemplo: sale en 20 minutos"
        deshabilitado={envio.clase === 'transicion' || envio.pendiente}
        {...(envio.clase === 'motivo' && envio.error !== null ? { error: envio.error.detail } : {})}
      />
      <PieDialogo clase={envio.clase} pendiente={envio.pendiente} etiqueta={accion.etiqueta} icono={iconoAccion(accion)} onConfirmar={enviar} onCerrar={onCerrar} />
    </Dialogo>
  );
}
