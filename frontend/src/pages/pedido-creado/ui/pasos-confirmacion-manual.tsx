export interface PasosConfirmacionManualProps {
  /** `EFECTIVO` o `TRANSFERENCIA`: lo que cambia es el primer paso. */
  formaPago: string;
}

/** «¿Qué sigue?» de un pedido que el local confirma a mano (DD-22): sin formulario de tarjeta ni acción de pago. */
export function PasosConfirmacionManual({ formaPago }: PasosConfirmacionManualProps) {
  const efectivo = formaPago === 'EFECTIVO';
  return (
    <section className="pcard" aria-labelledby="sig-titulo">
      <h2 id="sig-titulo">¿Qué sigue?</h2>
      <ol className="next">
        <li className="is-now">
          <div>
            <strong>{efectivo ? 'El local confirma tu pago en efectivo' : 'Transferí y el local confirma el pago'}</strong>
            <span>
              {efectivo
                ? 'Pagás al recibirlo o al retirarlo. Mientras tanto, el pedido figura como pendiente.'
                : 'El local te indica los datos para transferir. Cuando acredite el pago, lo confirma a mano.'}
            </span>
          </div>
        </li>
        <li>
          <div>
            <strong>El pedido pasa a «Confirmado» y se prepara</strong>
            <span>La confirmación es manual: la hace el equipo del local, no es automática.</span>
          </div>
        </li>
        <li>
          <div>
            <strong>Seguilo en «Mis pedidos»</strong>
            <span>Vas a ver cada cambio de estado hasta la entrega.</span>
          </div>
        </li>
      </ol>
    </section>
  );
}
