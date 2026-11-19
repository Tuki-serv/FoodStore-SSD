import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { textoPrecio } from './chips-filtros';
import { FormularioPrecio } from './formulario-precio';

export interface PopoverPrecioProps {
  min: number | undefined;
  max: number | undefined;
  onAplicar: (min: number | undefined, max: number | undefined) => void;
}

/**
 * Botón «Precio» (con el rango aplicado como resumen) y su panel no modal con el formulario de rango. Escape, un clic afuera o un
 * rango válido aplicado lo cierran; Escape y aplicar devuelven el foco al botón. Un rango inválido lo deja abierto con el error.
 */
export function PopoverPrecio({ min, max, onAplicar }: PopoverPrecioProps) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const envoltorio = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const conRango = min !== undefined || max !== undefined;

  useEffect(() => {
    if (!abierto) return undefined;
    envoltorio.current?.querySelector('input')?.focus();
    const cerrarAfuera = (evento: PointerEvent): void => {
      if (evento.target instanceof Node && envoltorio.current?.contains(evento.target) !== true) setAbierto(false);
    };
    document.addEventListener('pointerdown', cerrarAfuera);
    return () => document.removeEventListener('pointerdown', cerrarAfuera);
  }, [abierto]);

  const cerrarConFoco = (): void => {
    setAbierto(false);
    boton.current?.focus();
  };
  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>): void => {
    if (evento.key !== 'Escape' || !abierto) return;
    evento.stopPropagation();
    cerrarConFoco();
  };

  return (
    <div className="pop-wrap" ref={envoltorio} onKeyDown={alTeclear}>
      <button
        type="button"
        ref={boton}
        className={`pill tool${conRango ? ' is-active' : ''}`}
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        onClick={() => setAbierto((previo) => !previo)}
      >
        {conRango ? `Precio: ${textoPrecio(min, max)}` : 'Precio'}
        <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {abierto ? (
        <div className="popover" id={`${id}-panel`} role="dialog" aria-label="Precio">
          <p className="pop-title" aria-hidden="true">Precio</p>
          <FormularioPrecio
            key={`${min ?? ''}-${max ?? ''}`}
            min={min}
            max={max}
            ayuda="Pesos enteros. Enter también aplica."
            onAplicar={(nuevoMin, nuevoMax) => {
              onAplicar(nuevoMin, nuevoMax);
              cerrarConFoco();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
