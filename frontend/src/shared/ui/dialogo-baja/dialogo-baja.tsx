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
  /** La baja está en curso: el botón de confirmar queda deshabilitado con su texto de espera y el diálogo no se cierra. */
  pendiente?: boolean;
  /** Texto del botón de confirmar (por defecto «Eliminar»; usuarios: «Desactivar»). */
  etiquetaConfirmar?: string;
  /** Texto del botón de confirmar mientras la baja está en curso (por defecto «Eliminando…»). */
  etiquetaPendiente?: string;
  /** Contenido propio entre el título y el aviso (por ejemplo, a quién se le da de baja y qué pasa). */
  cuerpo?: ReactNode;
  onConfirmar: () => void;
  onCerrar: () => void;
  /** Reemplaza a «Cancelar» / «Eliminar» (por ejemplo, «Entendido» o «Cerrar» + un enlace). */
  acciones?: ReactNode;
  /** Contenido propio entre el aviso y las acciones (por ejemplo, un campo de motivo). */
  children?: ReactNode;
}

/** Diálogo de baja: confirmación con aviso opcional, error dentro del diálogo y estado de espera (categorías, ingredientes y usuarios). */
export function DialogoBaja({
  titulo,
  descripcion,
  aviso,
  lista,
  pendiente = false,
  etiquetaConfirmar = 'Eliminar',
  etiquetaPendiente = 'Eliminando…',
  cuerpo,
  onConfirmar,
  onCerrar,
  acciones,
  children,
}: DialogoBajaProps) {
  return (
    <Dialogo titulo={titulo} {...(descripcion === undefined ? {} : { descripcion })} onCerrar={pendiente ? () => undefined : onCerrar}>
      {cuerpo}
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
      {children}
      <div className="modal-actions">
        {acciones ?? (
          <>
            <button type="button" className={claseBoton('fantasma')} data-autofocus disabled={pendiente} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className={claseBoton('peligro')} disabled={pendiente} onClick={onConfirmar}>
              {pendiente ? (
                <>
                  <span className="spin" aria-hidden="true" />
                  {etiquetaPendiente}
                </>
              ) : (
                etiquetaConfirmar
              )}
            </button>
          </>
        )}
      </div>
    </Dialogo>
  );
}
