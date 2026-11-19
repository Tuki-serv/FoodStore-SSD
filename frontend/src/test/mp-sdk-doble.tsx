import { useEffect } from 'react';

/**
 * Doble de `@mercadopago/sdk-react` para los tests (el único módulo que se simula: es de terceros). Uso en cada test:
 * `vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'))`.
 * No dibuja campos de tarjeta: expone botones que invocan los callbacks reales del brick con datos fijos.
 */

export interface DatosSimulados {
  token: string;
  issuer_id: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: { email: string; identification: { type: string; number: string } };
}

export const DATOS_SIMULADOS: DatosSimulados = {
  token: 'tok_1',
  issuer_id: '310',
  payment_method_id: 'visa',
  transaction_amount: 2850,
  installments: 3,
  payer: { email: 'comprador@test.com', identification: { type: 'DNI', number: '12345678' } },
};

/** Lo que recibió el doble: se vacía con `reiniciarEspia()` antes de cada test. */
export const espia = {
  inicializaciones: [] as { clave: string; opciones: unknown }[],
  montajes: 0,
  montos: [] as number[],
  locales: [] as (string | undefined)[],
};

export function reiniciarEspia(): void {
  espia.inicializaciones = [];
  espia.montajes = 0;
  espia.montos = [];
  espia.locales = [];
}

export function initMercadoPago(clave: string, opciones?: unknown): void {
  espia.inicializaciones.push({ clave, opciones });
}

interface PropsCardPayment {
  initialization: { amount: number };
  locale?: string;
  onSubmit: (datos: DatosSimulados, adicional?: { paymentTypeId?: string }) => Promise<void>;
  onReady?: () => void;
  onError?: (error: { type: string; message: string }) => void;
}

export function CardPayment({ initialization, locale, onSubmit, onReady, onError }: PropsCardPayment) {
  useEffect(() => {
    espia.montajes += 1;
    espia.montos.push(initialization.amount);
    espia.locales.push(locale);
    // Se registra solo cuando cambia lo que define el montaje; el espía cuenta montajes reales del brick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-testid="brick-simulado">
      <button type="button" onClick={() => onReady?.()}>
        Simular brick listo
      </button>
      <button type="button" onClick={() => onError?.({ type: 'non_critical', message: 'fallo simulado' })}>
        Simular error del brick
      </button>
      <button type="button" onClick={() => void onSubmit(DATOS_SIMULADOS, { paymentTypeId: 'credit_card' })}>
        Simular pago
      </button>
    </div>
  );
}
