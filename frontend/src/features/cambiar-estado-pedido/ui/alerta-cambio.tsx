import type { ReactNode } from 'react';
import type { ClaseErrorCambioEstado } from '@/entities/pedido';
import type { ApiError } from '@/shared/api';
import { Icon } from '@/shared/ui';

function textoDe(clase: ClaseErrorCambioEstado, error: ApiError): { titulo: string; texto: string } | null {
  switch (clase) {
    case 'sin-stock':
      return { titulo: 'No se pudo confirmar', texto: `${error.detail} El pedido sigue pendiente.` };
    case 'transicion':
      return { titulo: 'El pedido cambió mientras lo mirabas', texto: `${error.detail} Ya actualizamos el pedido para que veas su estado actual.` };
    case 'conexion':
      return { titulo: 'No se guardó el cambio', texto: error.status === null ? `${error.detail} Revisá tu conexión y probá de nuevo.` : error.detail };
    case 'sin-permiso':
      return { titulo: 'No tenés permiso para cambiar este pedido', texto: 'Tu cuenta no puede hacer este cambio.' };
    case 'no-existe':
      return { titulo: 'Este pedido ya no existe', texto: 'Puede que lo hayan eliminado. Volvé al listado.' };
    case 'otro':
      return { titulo: 'No se guardó el cambio', texto: error.detail };
    case 'motivo':
      return null;
  }
}

/** Rechazo del servidor dentro del diálogo (`role="alert"`); el error del campo `motivo` no va acá sino en el campo. */
export function AlertaCambio({ clase, error, children }: { clase: ClaseErrorCambioEstado; error: ApiError; children?: ReactNode }) {
  const contenido = textoDe(clase, error);
  if (contenido === null) return null;
  return (
    <div className="dlg-alert" role="alert">
      <Icon name="alerta" />
      <div>
        <span>
          <strong>{contenido.titulo}</strong>
          {contenido.texto}
        </span>
        {children}
      </div>
    </div>
  );
}
