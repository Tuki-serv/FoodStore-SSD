import type { ClaseErrorCambioEstado } from '@/entities/pedido';
import { claseBoton, Icon, type IconName } from '@/shared/ui';

/** Rechazos tras los que reintentar no sirve: el pie queda solo con «Cerrar». */
const SOLO_CERRAR: readonly ClaseErrorCambioEstado[] = ['sin-stock', 'transicion', 'sin-permiso', 'no-existe'];

export interface PieDialogoProps {
  clase: ClaseErrorCambioEstado | null;
  pendiente: boolean;
  etiqueta: string;
  icono: IconName;
  peligro?: boolean;
  /** Texto del botón mientras se envía (por defecto «Guardando…»). */
  etiquetaPendiente?: string;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/** Acciones del diálogo: «Volver» + acción principal («Guardando…» al enviar, «Reintentar» si falló la conexión) o solo «Cerrar» tras un rechazo. */
export function PieDialogo({ clase, pendiente, etiqueta, icono, peligro = false, etiquetaPendiente = 'Guardando…', onConfirmar, onCerrar }: PieDialogoProps) {
  if (clase !== null && SOLO_CERRAR.includes(clase)) {
    return (
      <div className="modal-actions">
        <button type="button" className={claseBoton(clase === 'transicion' ? 'primario' : 'secundario')} onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    );
  }
  const variante = peligro ? 'peligro' : 'primario';
  return (
    <div className="modal-actions">
      <button type="button" className={claseBoton('fantasma')} disabled={pendiente} onClick={onCerrar}>
        Volver
      </button>
      {pendiente ? (
        <button type="button" className={`${claseBoton(variante)} is-busy${peligro ? ' is-danger' : ''}`} disabled aria-busy="true">
          <span className="spin" aria-hidden="true" />
          {etiquetaPendiente}
        </button>
      ) : (
        <button type="button" className={claseBoton(variante)} onClick={onConfirmar}>
          <Icon name={clase === 'conexion' ? 'reintentar' : icono} />
          {clase === 'conexion' ? 'Reintentar' : etiqueta}
        </button>
      )}
    </div>
  );
}
