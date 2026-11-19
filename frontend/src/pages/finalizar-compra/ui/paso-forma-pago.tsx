import { useId, type RefObject } from 'react';
import { EtiquetaFormaPago, esConfirmacionManual, FORMAS_PAGO, type FormaPagoCodigo } from '@/entities/pedido';
import { Icon } from '@/shared/ui';

export interface PasoFormaPagoProps {
  valor: FormaPagoCodigo | '';
  onCambiar: (codigo: FormaPagoCodigo) => void;
  /** Grupo de opciones: recibe el foco cuando falta elegir la forma de pago o el servidor la rechazó. */
  grupoRef: RefObject<HTMLFieldSetElement>;
  /** Error de validación o del servidor, asociado al grupo. */
  error?: string;
}

/** Nota que explica qué pasa después según la forma elegida (DD-22: confirmación manual; tarjeta: paso siguiente). */
function NotaFormaPago({ codigo }: { codigo: FormaPagoCodigo }) {
  if (esConfirmacionManual(codigo)) {
    const medio = codigo === 'EFECTIVO' ? 'en efectivo' : 'de la transferencia';
    return (
      <div className="info-box">
        <Icon name="reloj" />
        <div>
          <strong>Confirmación manual</strong>
          {`Tu pedido queda pendiente hasta que el local confirme el pago ${medio}. Te avisamos en «Mis pedidos» cuando pase a confirmado. No necesitás cargar ninguna tarjeta.`}
        </div>
      </div>
    );
  }
  return (
    <div className="info-box">
      <Icon name="tarjeta" />
      <div>
        <strong>Pago en el paso siguiente</strong>
        El pago con tarjeta lo hacés en el paso siguiente, con el formulario seguro de Mercado Pago. Primero creamos el pedido y se confirma cuando se aprueba el pago.
      </div>
    </div>
  );
}

/** Paso 2 del checkout: forma de pago, sin ninguna elegida al abrir. No pide datos de tarjeta (los carga el paso siguiente, C-20). */
export function PasoFormaPago({ valor, onCambiar, grupoRef, error }: PasoFormaPagoProps) {
  const idTitulo = useId();
  const idGrupo = useId();
  const idError = `${idGrupo}-error`;
  return (
    <section className={error === undefined ? 'step' : 'step is-invalid'} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>
        <span className="step-num" aria-hidden="true">
          2
        </span>
        Forma de pago
      </h2>
      <fieldset className="sel" ref={grupoRef} tabIndex={-1} {...(error === undefined ? {} : { 'aria-describedby': idError })}>
        <legend className="sr-only">¿Cómo pagás?</legend>
        <div className="pay-opts">
          {FORMAS_PAGO.map((forma) => (
            <label key={forma.codigo} className={valor === forma.codigo ? 'opt is-checked' : 'opt'}>
              <input type="radio" name={idGrupo} checked={valor === forma.codigo} onChange={() => onCambiar(forma.codigo)} />
              <span>
                <EtiquetaFormaPago codigo={forma.codigo} />
                <small>{forma.descripcion}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error === undefined ? null : (
        <p className="field-err" id={idError}>
          <Icon name="alerta" />
          {error}
        </p>
      )}
      {valor === '' ? null : <NotaFormaPago codigo={valor} />}
    </section>
  );
}
