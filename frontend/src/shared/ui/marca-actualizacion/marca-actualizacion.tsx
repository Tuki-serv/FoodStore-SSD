import { claseBoton } from '../button/button-styles';
import { Icon } from '../icon/icon';

const dos = (numero: number): string => String(numero).padStart(2, '0');

/** `HH:MM` en hora local de una marca de tiempo en ms. */
const horaDe = (marcaMs: number): string => {
  const fecha = new Date(marcaMs);
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
};

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
      <button type="button" className={claseBoton('fantasma', { compacto: true })} disabled={actualizando} aria-busy={actualizando} onClick={onActualizar}>
        {actualizando ? (
          <>
            <span className="spin" aria-hidden="true" />
            Actualizando…
          </>
        ) : (
          <>
            <Icon name="reintentar" />
            <span className="lbl-m">Actualizar</span>
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
