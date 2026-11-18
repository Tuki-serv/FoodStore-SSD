import { useState } from 'react';
import { resumenUso, useEliminarIngrediente, type Ingrediente } from '@/entities/ingrediente';
import { esApiError, type ApiError } from '@/shared/api';
import { avisarExito } from '@/shared/model';
import { DialogoBaja } from '@/shared/ui';

export interface DialogoBajaIngredienteProps {
  ingrediente: Ingrediente;
  onCerrar: () => void;
  /** La baja salió bien (el diálogo ya puede desmontarse). */
  onEliminado: () => void;
}

const DESCRIPCION = 'Deja de ofrecerse al armar productos. Podés volver a crearlo con el mismo nombre más adelante.';

/** Baja de un ingrediente: confirmación con aviso de los productos que lo usan y errores del servidor dentro del diálogo. */
export function DialogoBajaIngrediente({ ingrediente, onCerrar, onEliminado }: DialogoBajaIngredienteProps) {
  const eliminar = useEliminarIngrediente();
  const [error, setError] = useState<ApiError | null>(null);
  const uso = resumenUso(ingrediente.productos);

  const confirmar = async (): Promise<void> => {
    setError(null);
    try {
      await eliminar.mutateAsync(ingrediente.id);
    } catch (fallo) {
      if (!esApiError(fallo)) throw fallo;
      setError(fallo);
      return;
    }
    avisarExito('Ingrediente eliminado', `«${ingrediente.nombre}»`);
    onEliminado();
  };

  const aviso =
    error !== null
      ? { titulo: 'No pudimos eliminar el ingrediente', detalle: error.detail, peligro: true }
      : uso === null
        ? undefined
        : { titulo: uso, detalle: 'Revisalos después en Productos y stock.' };

  return (
    <DialogoBaja
      titulo={`¿Eliminar «${ingrediente.nombre}»?`}
      descripcion={DESCRIPCION}
      {...(aviso === undefined ? {} : { aviso })}
      pendiente={eliminar.isPending}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  );
}
