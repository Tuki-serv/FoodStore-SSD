import { horaLocal } from '@/entities/pedido';
import { claseBoton, Icon } from '@/shared/ui';

const horaDe = (marcaMs: number): string => horaLocal(new Date(marcaMs).toISOString());

export interface MarcaActualizacionProps {
  /** Cuándo llegaron por última vez los datos (`dataUpdatedAt`, ms); `0` si todavía no llegaron. */
  actualizadoEn: number;
  /** Hay un pedido al servidor en curso (la vista que se ve no se vacía). */
  actualizando: boolean;
  onActualizar: () => void;
}

/** «Actualizado a las HH:MM» y el botón «Actualizar» (gira mientras se pide); no muestra la hora antes de la primera respuesta. */
export function MarcaActualizacion({ actualizadoEn, actualizando, onActualizar }: MarcaActualizacionProps) {
  return (
    <div className="refresh">
      {actualizadoEn === 0 ? null : (
        <span className="when" aria-live="polite">
          <Icon name="reloj" />
          {`Actualizado a las ${horaDe(actualizadoEn)}`}
        </span>
      )}
      <button type="button" className={claseBoton('secundario', { compacto: true })} disabled={actualizando} aria-busy={actualizando} onClick={onActualizar}>
        {actualizando ? (
          <>
            <span className="spin" aria-hidden="true" />
            Actualizando…
          </>
        ) : (
          <>
            <Icon name="reintentar" />
            Actualizar
          </>
        )}
      </button>
    </div>
  );
}

/** Aviso discreto: una actualización falló y se sigue mostrando lo último que llegó (se vuelve a intentar solo). */
export function AvisoActualizacionFallida({ actualizadoEn, onReintentar }: { actualizadoEn: number; onReintentar: () => void }) {
  return (
    <div className="refresh-fail" role="status">
      <Icon name="alerta" />
      No pudimos actualizar
      <span>{`Mostramos los pedidos de las ${horaDe(actualizadoEn)}. Se vuelve a intentar solo en 30 segundos.`}</span>
      <button type="button" className="link-btn" onClick={onReintentar}>
        Reintentar ahora
      </button>
    </div>
  );
}
