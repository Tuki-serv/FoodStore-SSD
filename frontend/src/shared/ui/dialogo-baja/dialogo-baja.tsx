import type { ReactNode } from 'react';
import { claseBoton } from '../button/button-styles';
import { Dialogo } from '../dialogo';
import { Icon } from '../icon/icon';

export interface AvisoBaja {
  titulo: string;
  detalle?: string;
  /** Error o impedimento (rojo, `role="alert"`); sin esto es una advertencia previa (ámbar). */
  peligro?: boolean;
}

export interface DialogoBajaProps {
  titulo: string;
  descripcion?: string;
  aviso?: AvisoBaja;
  /** Nombres que acompañan al aviso (por ejemplo, las subcategorías que bloquean la baja). */
  lista?: readonly string[];
  /** La baja está en curso: «Eliminando…» deshabilitado y el diálogo no se cierra. */
  pendiente?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
  /** Reemplaza a «Cancelar» / «Eliminar» (por ejemplo, «Entendido» o «Cerrar» + un enlace). */
  acciones?: ReactNode;
}

/** Diálogo de baja: confirmación con aviso opcional, error dentro del diálogo y estado «Eliminando…» (categorías e ingredientes). */
export function DialogoBaja({ titulo, descripcion, aviso, lista, pendiente = false, onConfirmar, onCerrar, acciones }: DialogoBajaProps) {
  return (
    <Dialogo titulo={titulo} {...(descripcion === undefined ? {} : { descripcion })} onCerrar={pendiente ? () => undefined : onCerrar}>
      {aviso === undefined ? null : (
        <div className={aviso.peligro === true ? 'warn is-danger' : 'warn'} {...(aviso.peligro === true ? { role: 'alert' } : {})}>
          <Icon name="alerta" />
          <span>
            {aviso.titulo}
            {aviso.detalle === undefined ? null : <small>{aviso.detalle}</small>}
          </span>
        </div>
      )}
      {lista === undefined ? null : (
        <ul className="mlist">
          {lista.map((nombre) => (
            <li key={nombre}>{nombre}</li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        {acciones ?? (
          <>
            <button type="button" className={claseBoton('fantasma')} data-autofocus disabled={pendiente} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className={claseBoton('peligro')} disabled={pendiente} onClick={onConfirmar}>
              {pendiente ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        )}
      </div>
    </Dialogo>
  );
}
