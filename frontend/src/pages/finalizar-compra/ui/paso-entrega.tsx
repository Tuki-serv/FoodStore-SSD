import { SelectorDireccion } from '@/entities/direccion';
import { useId, type Ref } from 'react';

export interface PasoEntregaProps {
  /** Dirección elegida: id, `null` = retiro en el local, `undefined` = todavía sin elegir. */
  valor: number | null | undefined;
  onCambiar: (valor: number | null, origen: 'usuario' | 'automatico') => void;
  /** Apagado tras rechazar la dirección: el cliente debe elegir otra a propósito. */
  autoSeleccionar?: boolean;
  error?: string;
  /** Para llevar el foco al paso (tras un rechazo de la dirección). */
  seccionRef?: Ref<HTMLElement>;
}

/** Paso 1 del checkout: dónde se recibe el pedido (direcciones del cliente o retiro en el local, vía `SelectorDireccion`). */
export function PasoEntrega({ valor, onCambiar, autoSeleccionar, error, seccionRef }: PasoEntregaProps) {
  const idTitulo = useId();
  return (
    <section className="step" aria-labelledby={idTitulo} tabIndex={-1} ref={seccionRef}>
      <h2 id={idTitulo}>
        <span className="step-num" aria-hidden="true">
          1
        </span>
        Entrega
      </h2>
      <SelectorDireccion valor={valor} onCambiar={onCambiar} {...(autoSeleccionar === undefined ? {} : { autoSeleccionar })} />
      {error === undefined ? null : (
        <p className="field-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
