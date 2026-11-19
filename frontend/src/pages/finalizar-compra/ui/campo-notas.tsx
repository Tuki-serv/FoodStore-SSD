import { useId, useState } from 'react';
import { Campo, Icon } from '@/shared/ui';

/** Largo máximo de las notas (el backend no limita: tope propuesto en OQ-4). */
export const MAXIMO_NOTAS = 300;

export interface CampoNotasProps {
  valor: string;
  onCambiar: (valor: string) => void;
}

/** Notas opcionales para el local: colapsadas detrás de «Agregar una nota» para no alargar el formulario en mobile. */
export function CampoNotas({ valor, onCambiar }: CampoNotasProps) {
  const [abierto, setAbierto] = useState(valor !== '');
  const idTitulo = useId();

  if (!abierto) {
    return (
      <button type="button" className="nota-toggle" aria-expanded="false" onClick={() => setAbierto(true)}>
        <Icon name="mas" />
        Agregar una nota para el local
      </button>
    );
  }

  return (
    <section className="step" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>
        <span className="step-num" aria-hidden="true">
          3
        </span>
        Notas <small className="step-opt">(opcional)</small>
      </h2>
      <Campo etiqueta="Notas para el local" ayuda="Aclaraciones para la entrega o la preparación." contador={`${valor.length}/${MAXIMO_NOTAS}`}>
        {(control) => (
          <textarea {...control} className="input" name="notas" maxLength={MAXIMO_NOTAS} value={valor} onChange={(evento) => onCambiar(evento.target.value)} />
        )}
      </Campo>
    </section>
  );
}
