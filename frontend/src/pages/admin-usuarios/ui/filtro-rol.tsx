import { NOMBRE_ROL, ROLES, type Rol } from '@/shared/config';

export interface FiltroRolProps {
  /** Rol elegido, o `null` para «Todos». */
  rol: Rol | null;
  onCambiar: (rol: Rol | null) => void;
}

const OPCIONES: readonly { valor: Rol | null; etiqueta: string }[] = [{ valor: null, etiqueta: 'Todos' }, ...ROLES.map((rol) => ({ valor: rol, etiqueta: NOMBRE_ROL[rol] }))];

/** Control segmentado Todos / un rol (botones con `aria-pressed`); en mobile se reparte en filas. */
export function FiltroRol({ rol, onCambiar }: FiltroRolProps) {
  return (
    <div className="seg seg-wrap" role="group" aria-label="Filtrar por rol">
      {OPCIONES.map(({ valor, etiqueta }) => (
        <button key={etiqueta} type="button" aria-pressed={rol === valor} onClick={() => onCambiar(valor)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
