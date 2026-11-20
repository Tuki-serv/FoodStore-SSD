import { useId, type ReactNode } from 'react';
import { claseBoton } from '../button/button-styles';
import { Icon, type IconName } from '../icon/icon';

export interface EsqueletoFilasProps {
  /** Nombre accesible del indicador (por ejemplo, «Cargando categorías»). */
  etiqueta: string;
  filas: number;
}

/** Esqueleto de filas de un listado: `role="status"` con `aria-busy`. */
export function EsqueletoFilas({ etiqueta, filas }: EsqueletoFilasProps) {
  return (
    <div className="skel-rows" role="status" aria-busy="true" aria-label={etiqueta}>
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="skel-row">
          <span className="skel sq" />
          <span className="ln">
            <span className="skel skel-line" style={{ width: `${30 + ((indice * 13) % 30)}%` }} />
            <span className="skel skel-line" style={{ width: `${45 + ((indice * 7) % 25)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export interface EstadoVacioProps {
  icono: IconName;
  titulo: string;
  texto: string;
  /** Acción principal del estado (botón). */
  children?: ReactNode;
  /** `false` lo dibuja sin ser una región con nombre: para varios estados vacíos con el mismo título en una misma pantalla (axe `landmark-unique`). */
  region?: boolean;
}

/** Estado vacío de un listado: ícono, título, texto y una acción. */
export function EstadoVacio({ icono, titulo, texto, children, region = true }: EstadoVacioProps) {
  const idTitulo = useId();
  const Contenedor = region ? 'section' : 'div';
  return (
    <Contenedor className="state empty" {...(region ? { 'aria-labelledby': idTitulo } : {})}>
      <span className="badge-ico" aria-hidden="true">
        <Icon name={icono} className="h-[30px] w-[30px]" />
      </span>
      <h2 id={idTitulo}>{titulo}</h2>
      <p>{texto}</p>
      {children}
    </Contenedor>
  );
}

export interface EstadoErrorProps {
  titulo: string;
  detalle: string;
  onReintentar: () => void;
}

/** Error de carga de un listado, con «Reintentar». */
export function EstadoError({ titulo, detalle, onReintentar }: EstadoErrorProps) {
  return (
    <div className="state empty is-error" role="alert">
      <span className="badge-ico" aria-hidden="true">
        <Icon name="alerta" className="h-[30px] w-[30px]" />
      </span>
      <h2>{titulo}</h2>
      <p>{detalle}</p>
      <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
        <Icon name="reintentar" />
        Reintentar
      </button>
    </div>
  );
}

/** Aviso no bloqueante: el listado que se ve es el último que llegó y no se pudo actualizar. */
export function AvisoDesactualizado({ texto, onReintentar }: { texto: string; onReintentar: () => void }) {
  return (
    <div className="form-alert" role="alert">
      <Icon name="alerta" />
      <div>
        {texto}
        <p>Lo que ves puede estar desactualizado.</p>
        <button type="button" className={claseBoton('secundario')} onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
