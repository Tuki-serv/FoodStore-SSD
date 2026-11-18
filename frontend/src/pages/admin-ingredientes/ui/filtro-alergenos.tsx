import type { FiltroAlergeno } from '../model';

const OPCIONES: readonly { valor: FiltroAlergeno; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'si', etiqueta: 'Alérgenos' },
  { valor: 'no', etiqueta: 'No alérgenos' },
];

export interface FiltroAlergenosProps {
  filtro: FiltroAlergeno;
  onCambiar: (filtro: FiltroAlergeno) => void;
}

/** Control segmentado Todos / Alérgenos / No alérgenos (botones con `aria-pressed`). */
export function FiltroAlergenos({ filtro, onCambiar }: FiltroAlergenosProps) {
  return (
    <div className="seg" role="group" aria-label="Filtrar por alérgeno">
      {OPCIONES.map(({ valor, etiqueta }) => (
        <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => onCambiar(valor)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
