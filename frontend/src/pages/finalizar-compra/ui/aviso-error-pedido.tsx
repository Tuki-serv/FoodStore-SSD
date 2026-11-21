import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { clasificarErrorCreacion, type ClaseErrorCreacion } from '@/entities/pedido';
import type { ApiError } from '@/shared/api';
import { RUTAS } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

export interface AvisoErrorPedidoProps {
  error: ApiError;
  /** Vuelve a enviar el mismo pedido (falla de conexión o 5xx). */
  onReintentar: () => void;
  /** Lleva el foco al grupo de forma de pago. */
  onElegirOtraFormaPago: () => void;
  /** Lleva el foco al paso de entrega (las direcciones ya se volvieron a pedir). */
  onElegirOtraEntrega: () => void;
}

const AYUDA: Record<ClaseErrorCreacion, string> = {
  productos: 'Revisá el carrito: puede que un producto se haya agotado, ya no esté a la venta o haya cambiado. Tu carrito sigue intacto.',
  'forma-pago': 'Elegí otra forma de pago y volvé a confirmar.',
  entrega: 'Elegí otra entrega y volvé a confirmar.',
  conexion: 'Revisá tu conexión. Si el pedido no llegó a crearse, podés reintentar con los mismos datos.',
  'sin-permiso': 'Solo las cuentas de cliente pueden hacer pedidos.',
  otro: 'Revisá tu pedido y volvé a confirmar.',
};

/** Aviso de rechazo al crear el pedido: muestra el mensaje del servidor, recibe el foco y ofrece la acción que corresponde al caso. */
export function AvisoErrorPedido({ error, onReintentar, onElegirOtraFormaPago, onElegirOtraEntrega }: AvisoErrorPedidoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const clase = clasificarErrorCreacion(error);

  // Cada rechazo nuevo (incluido el mismo mensaje otra vez) vuelve a llevar el foco al aviso.
  useEffect(() => {
    ref.current?.focus();
  }, [error]);

  return (
    <div className="form-alert" role="alert" tabIndex={-1} ref={ref}>
      <Icon name="alerta" />
      <div>
        <strong>No pudimos crear el pedido</strong>
        <p>
          <span>{error.detail}</span>
          {error.detail.endsWith('.') ? '' : '.'} {AYUDA[clase]}
        </p>
        <div className="alert-actions">
          {clase === 'productos' ? (
            <Link className={claseBoton('secundario', { compacto: true })} to={RUTAS.carrito}>
              <Icon name="carrito" />
              Revisar carrito
            </Link>
          ) : null}
          {clase === 'entrega' ? (
            <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={onElegirOtraEntrega}>
              Elegí otra entrega
            </button>
          ) : null}
          {clase === 'forma-pago' ? (
            <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={onElegirOtraFormaPago}>
              Elegí otra forma de pago
            </button>
          ) : null}
          {clase === 'conexion' ? (
            <button type="button" className={claseBoton('secundario', { compacto: true })} onClick={onReintentar}>
              <Icon name="reintentar" />
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
