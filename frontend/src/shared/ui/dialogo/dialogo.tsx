import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../icon/icon';

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogoProps {
  titulo: string;
  /** Texto que amplía el título; se asocia con `aria-describedby`. */
  descripcion?: ReactNode;
  /** Escape o un clic en el scrim piden cerrar. */
  onCerrar: () => void;
  /** Contenido y acciones. El control con `data-autofocus` recibe el foco al abrirse. */
  children?: ReactNode;
  /** Hoja con cuerpo desplazable, botón de cerrar y `pie` fijo (filtros en mobile). Sin esta prop el diálogo no cambia. */
  desplazable?: boolean;
  /** Acciones fijas al pie de la hoja; solo con `desplazable`. */
  pie?: ReactNode;
}

/**
 * Diálogo modal accesible: `role="dialog"`, `aria-modal`, foco atrapado, Escape y scrim.
 * Al abrirse enfoca `[data-autofocus]` (o el propio diálogo); al cerrarse devuelve el foco a quien lo tenía.
 * No usa `<dialog>` nativo: `showModal` no es fiable en jsdom.
 */
export function Dialogo({ titulo, descripcion, onCerrar, children, desplazable = false, pie }: DialogoProps) {
  const idTitulo = useId();
  const idDescripcion = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement;
    const dialogo = dialogoRef.current;
    (dialogo?.querySelector<HTMLElement>('[data-autofocus]') ?? dialogo)?.focus();
    return () => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, []);

  const alPresionarTecla = (evento: KeyboardEvent<HTMLDivElement>): void => {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onCerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const focusables = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLES));
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    if (primero === undefined || ultimo === undefined) {
      evento.preventDefault();
      return;
    }
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || activo === evento.currentTarget)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  return (
    <div className="modal-scrim" data-scrim onClick={(evento) => evento.target === evento.currentTarget && onCerrar()}>
      <div
        ref={dialogoRef}
        className={desplazable ? 'modal sheet' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion === undefined ? undefined : idDescripcion}
        tabIndex={-1}
        onKeyDown={alPresionarTecla}
      >
        {desplazable ? (
          <>
            <div className="grab" aria-hidden="true" />
            <div className="sheet-head">
              <h2 id={idTitulo}>{titulo}</h2>
              <button type="button" className="icon-btn" aria-label={`Cerrar ${titulo.toLowerCase()}`} onClick={onCerrar}>
                <Icon name="cerrar" className="h-[18px] w-[18px]" />
              </button>
            </div>
            {descripcion === undefined ? null : <p id={idDescripcion}>{descripcion}</p>}
            <div className="sheet-body">{children}</div>
            {pie === undefined ? null : <div className="sheet-foot">{pie}</div>}
          </>
        ) : (
          <>
            <h2 id={idTitulo}>{titulo}</h2>
            {descripcion === undefined ? null : <p id={idDescripcion}>{descripcion}</p>}
            {children}
          </>
        )}
      </div>
    </div>
  );
}
