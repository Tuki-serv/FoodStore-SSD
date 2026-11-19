import { useId, type ReactNode } from 'react';

/** Atributos que el control (`<input>`, `<select>`…) debe recibir para quedar asociado a su etiqueta, ayuda y error. */
export interface PropsControlCampo {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export interface CampoProps {
  etiqueta: string;
  /** Agrega «(opcional)» a la etiqueta. */
  opcional?: boolean;
  ayuda?: string;
  /** Mensaje de error ya decidido por quien usa el campo (por ejemplo, solo tras tocarlo); puede incluir un enlace. */
  error?: ReactNode;
  /** Contador a la derecha de la etiqueta (por ejemplo, «12/100»); decorativo para lectores de pantalla. */
  contador?: string;
  /** Marca junto a la etiqueta (por ejemplo, «Alérgeno»); a diferencia del contador, la leen los lectores de pantalla. */
  marca?: ReactNode;
  /** Clase del contenedor (por ejemplo, columnas de una grilla). */
  className?: string;
  /** Dibuja el control con las propiedades de accesibilidad que le corresponden. */
  children: (control: PropsControlCampo) => ReactNode;
}

/** Etiqueta + control + ayuda + error, con `aria-invalid` y `aria-describedby` coherentes (design system: `.field`). */
export function Campo({ etiqueta, opcional = false, ayuda, error, contador, marca, className, children }: CampoProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripciones = [ayuda === undefined ? null : idAyuda, error === undefined ? null : idError].filter((valor): valor is string => valor !== null);
  const control: PropsControlCampo = {
    id,
    ...(error === undefined ? {} : { 'aria-invalid': true as const }),
    ...(descripciones.length === 0 ? {} : { 'aria-describedby': descripciones.join(' ') }),
  };
  return (
    <div className={className === undefined ? 'field' : `field ${className}`}>
      {contador === undefined && marca === undefined ? (
        etiquetaDe(id, etiqueta, opcional)
      ) : (
        <div className="label-row">
          {etiquetaDe(id, etiqueta, opcional)}
          {marca}
          {contador === undefined ? null : (
            <span className="counter" aria-hidden="true">
              {contador}
            </span>
          )}
        </div>
      )}
      {children(control)}
      {ayuda === undefined ? null : (
        <span id={idAyuda} className="hint">
          {ayuda}
        </span>
      )}
      {error === undefined ? null : (
        <span id={idError} className="err">
          {error}
        </span>
      )}
    </div>
  );
}

function etiquetaDe(id: string, etiqueta: string, opcional: boolean): ReactNode {
  return (
    <label htmlFor={id}>
      {etiqueta}
      {opcional ? <> <small>(opcional)</small></> : null}
    </label>
  );
}
