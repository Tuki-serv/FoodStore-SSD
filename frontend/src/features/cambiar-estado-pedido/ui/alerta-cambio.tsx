import type { ReactNode } from 'react';
import type { ClaseErrorCambioEstado } from '@/entities/pedido';
import type { ApiError } from '@/shared/api';
import { Icon } from '@/shared/ui';

export type DestinatarioCambio = 'gestion' | 'cliente';

/** Textos del cliente que cancela su pedido: más cortos y en segunda persona; el resto de las clases cae en los de gestión. */
function textoDelCliente(clase: ClaseErrorCambioEstado, error: ApiError): { titulo: string; texto: string } | null | undefined {
  switch (clase) {
    case 'transicion':
      return { titulo: 'Tu pedido ya avanzó y no se puede cancelar', texto: 'Ya actualizamos el pedido para que veas su estado actual.' };
    case 'sin-permiso':
    case 'no-existe':
      return { titulo: 'Este pedido no está disponible', texto: 'Puede que ya no sea tuyo o que no exista. Volvé a tus pedidos.' };
    case 'conexion':
      return { titulo: 'No se canceló el pedido', texto: error.status === null ? `${error.detail} Revisá tu conexión y probá de nuevo.` : error.detail };
    case 'otro':
      return { titulo: 'No se canceló el pedido', texto: error.detail };
    default:
      return undefined;
  }
}

function textoDe(clase: ClaseErrorCambioEstado, error: ApiError, destinatario: DestinatarioCambio): { titulo: string; texto: string } | null {
  const propio = destinatario === 'cliente' ? textoDelCliente(clase, error) : undefined;
  if (propio !== undefined) return propio;
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
export function AlertaCambio({ clase, error, destinatario = 'gestion', children }: { clase: ClaseErrorCambioEstado; error: ApiError; destinatario?: DestinatarioCambio; children?: ReactNode }) {
  const contenido = textoDe(clase, error, destinatario);
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
