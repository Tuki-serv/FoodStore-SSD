import { ResumenDireccion, useDireccionPorId } from '@/entities/direccion';
import { Icon } from '@/shared/ui';

/** Dónde se entrega el pedido: la dirección guardada (alias, calle, ciudad) o «Retiro en el local» si no tiene dirección. */
export function EntregaPedido({ direccionId }: { direccionId: number | null }) {
  const { direccion, cargando } = useDireccionPorId(direccionId);
  if (direccionId === null) {
    return (
      <span className="pay-lbl">
        <Icon name="tienda" />
        Retiro en el local
      </span>
    );
  }
  if (cargando) return <span className="skel entrega-skel" role="status" aria-label="Cargando la dirección" />;
  if (direccion === undefined) return <span>{`Dirección #${direccionId}`}</span>;
  return <ResumenDireccion direccion={direccion} conMarca={false} />;
}
