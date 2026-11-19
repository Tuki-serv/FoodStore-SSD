import { useState } from 'react';
import { useEliminarProducto, type Producto } from '@/entities/producto';
import { aApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { DialogoBaja } from '@/shared/ui';

export interface DialogoBajaProductoProps {
  producto: Producto;
  onCerrar: () => void;
  /** La baja salió bien (el diálogo ya puede desmontarse). */
  onEliminado: () => void;
}

const DESCRIPCION =
  'Deja de verse en el catálogo y ya no se puede pedir. Los pedidos anteriores lo conservan. Podés volver a crear un producto con el mismo nombre más adelante.';

/** Baja de un producto: confirmación y errores del servidor dentro del diálogo. */
export function DialogoBajaProducto({ producto, onCerrar, onEliminado }: DialogoBajaProductoProps) {
  const eliminar = useEliminarProducto();
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (): Promise<void> => {
    setError(null);
    try {
      await eliminar.mutateAsync(producto.id);
    } catch (fallo) {
      setError(aApiError(fallo).detail);
      return;
    }
    avisarExito('Producto eliminado', `«${producto.nombre}»`);
    onEliminado();
  };

  return (
    <DialogoBaja
      titulo={`¿Eliminar «${producto.nombre}»?`}
      descripcion={DESCRIPCION}
      {...(error === null ? {} : { aviso: { titulo: 'No pudimos eliminar el producto', detalle: error, peligro: true } })}
      pendiente={eliminar.isPending}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  );
}
