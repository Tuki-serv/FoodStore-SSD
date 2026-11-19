import { useId, useState, type FormEvent } from 'react';
import { Campo, claseBoton } from '@/shared/ui';
import { validarRangoPrecio } from '../model';

export interface FormularioPrecioProps {
  min: number | undefined;
  max: number | undefined;
  onAplicar: (min: number | undefined, max: number | undefined) => void;
  /** Texto breve junto a «Aplicar» (y su descripción accesible); sin él, «Aplicar» ocupa todo el ancho. */
  ayuda?: string;
}

/**
 * «Precio mínimo» / «Precio máximo» en pesos enteros: se aplican con «Aplicar» (o Enter), no al tipear, para no pedir por
 * cada dígito. Los errores se muestran junto al campo y el rango inválido no se aplica.
 */
export function FormularioPrecio({ min, max, onAplicar, ayuda }: FormularioPrecioProps) {
  const idAyuda = useId();
  const [textoMin, setTextoMin] = useState(min === undefined ? '' : String(min));
  const [textoMax, setTextoMax] = useState(max === undefined ? '' : String(max));
  const [errores, setErrores] = useState<{ min?: string; max?: string }>({});

  const aplicar = (evento: FormEvent<HTMLFormElement>): void => {
    evento.preventDefault();
    const resultado = validarRangoPrecio(textoMin, textoMax);
    if (!resultado.ok) {
      setErrores(resultado.errores);
      return;
    }
    setErrores({});
    onAplicar(resultado.min, resultado.max);
  };

  return (
    <form className="range" noValidate onSubmit={aplicar}>
      <Campo etiqueta="Precio mínimo" {...(errores.min === undefined ? {} : { error: errores.min })}>
        {(control) => (
          <div className="input-money">
            <span aria-hidden="true">$</span>
            <input {...control} className="input" inputMode="numeric" autoComplete="off" placeholder="0" value={textoMin} onChange={(evento) => setTextoMin(evento.target.value)} />
          </div>
        )}
      </Campo>
      <Campo etiqueta="Precio máximo" {...(errores.max === undefined ? {} : { error: errores.max })}>
        {(control) => (
          <div className="input-money">
            <span aria-hidden="true">$</span>
            <input {...control} className="input" inputMode="numeric" autoComplete="off" placeholder="Sin tope" value={textoMax} onChange={(evento) => setTextoMax(evento.target.value)} />
          </div>
        )}
      </Campo>
      {ayuda === undefined ? (
        <button type="submit" className={`${claseBoton('secundario', { compacto: true })} range-aplicar`}>
          Aplicar
        </button>
      ) : (
        <div className="range-acciones">
          <span className="range-ayuda" id={idAyuda}>
            {ayuda}
          </span>
          <button type="submit" className={claseBoton('secundario', { compacto: true })} aria-describedby={idAyuda}>
            Aplicar
          </button>
        </div>
      )}
    </form>
  );
}
