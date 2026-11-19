import { Icon, type IconName } from '@/shared/ui';
import { FORMAS_PAGO, type FormaPagoCodigo } from '../model';

const ICONOS: Record<FormaPagoCodigo, IconName> = { MERCADOPAGO: 'tarjeta', EFECTIVO: 'efectivo', TRANSFERENCIA: 'transferencia' };

/** Ícono y nombre de una forma de pago; un código desconocido se muestra tal cual, sin ícono propio. */
export function EtiquetaFormaPago({ codigo }: { codigo: string }) {
  const forma = FORMAS_PAGO.find((candidata) => candidata.codigo === codigo);
  return (
    <span className="pay-lbl">
      {forma === undefined ? null : <Icon name={ICONOS[forma.codigo]} />}
      {forma === undefined ? codigo : forma.etiqueta}
    </span>
  );
}
