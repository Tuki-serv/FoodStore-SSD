import type { Ref } from 'react';
import { Campo } from '@/shared/ui';
import { MAXIMO_MOTIVO } from '../model';

export interface CampoTextoProps {
  etiqueta: string;
  opcional?: boolean;
  valor: string;
  onCambiar: (valor: string) => void;
  error?: string;
  deshabilitado?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  placeholder: string;
}

/** Texto libre de hasta 300 caracteres con contador (observación o motivo: ambos quedan en el historial). */
export function CampoTexto({ etiqueta, opcional = false, valor, onCambiar, error, deshabilitado = false, inputRef, placeholder }: CampoTextoProps) {
  return (
    <Campo etiqueta={etiqueta} opcional={opcional} ayuda="Queda en el historial del pedido." contador={`${valor.length}/${MAXIMO_MOTIVO}`} {...(error === undefined ? {} : { error })}>
      {(control) => (
        <textarea
          {...control}
          ref={inputRef}
          className="input"
          data-autofocus
          maxLength={MAXIMO_MOTIVO}
          placeholder={placeholder}
          disabled={deshabilitado}
          value={valor}
          onChange={(evento) => onCambiar(evento.target.value.slice(0, MAXIMO_MOTIVO))}
        />
      )}
    </Campo>
  );
}
