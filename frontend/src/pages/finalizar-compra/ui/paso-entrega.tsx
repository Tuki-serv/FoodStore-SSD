import { SelectorDireccion } from '@/entities/direccion';
import { useId } from 'react';

export interface PasoEntregaProps {
  /** Dirección elegida: id, `null` = retiro en el local, `undefined` = todavía sin elegir. */
  valor: number | null | undefined;
  onCambiar: (valor: number | null) => void;
  error?: string;
}

/** Paso 1 del checkout: dónde se recibe el pedido (direcciones del cliente o retiro en el local, vía `SelectorDireccion`). */
export function PasoEntrega({ valor, onCambiar, error }: PasoEntregaProps) {
  const idTitulo = useId();
  return (
    <section className="step" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>
        <span className="step-num" aria-hidden="true">
          1
        </span>
        Entrega
      </h2>
      <SelectorDireccion valor={valor} onCambiar={onCambiar} />
      {error === undefined ? null : (
        <p className="field-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
