import { Icon } from '@/shared/ui';
import { lineasDireccion, type DireccionPedido } from '../model';

/** Dónde se entrega un pedido: la dirección (alias, calle y zona) o «Retiro en el local» si no tiene dirección. */
export function EntregaDelPedido({ direccion }: { direccion: DireccionPedido | null }) {
  if (direccion === null) {
    return (
      <span className="pay-lbl">
        <Icon name="tienda" />
        Retiro en el local
      </span>
    );
  }
  const { alias, calle, zona } = lineasDireccion(direccion);
  return (
    <div className="deliv">
      {alias === '' ? null : <strong>{alias}</strong>}
      <span>{calle}</span>
      <span className="addr-sub">{zona}</span>
    </div>
  );
}
