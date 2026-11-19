import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '@/shared/api';
import type { RespuestaCrearPago } from '@/entities/payment';
import { espia, reiniciarEspia } from '@/test/mp-sdk-doble';
import { crearEstadoPagos, handlersPagos, type EstadoPagos } from '@/test/msw/pagos';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { FormularioTarjeta } from '../index';

vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'));

function montar(pagos?: Partial<EstadoPagos>) {
  const estado = crearEstadoPagos(pagos);
  server.use(...handlersPagos(estado));
  const resultados: RespuestaCrearPago[] = [];
  const errores: ApiError[] = [];
  const Envoltorio = envolverConQuery(crearQueryClientDePrueba());
  render(
    <Envoltorio>
      <FormularioTarjeta pedidoId={58} total="2850.00" onResultado={(r) => resultados.push(r)} onError={(e) => errores.push(e)} />
    </Envoltorio>,
  );
  return { estado, resultados, errores, usuario: userEvent.setup() };
}

describe('FormularioTarjeta · montaje', () => {
  beforeEach(reiniciarEspia);

  it('con la clave del backend inicializa el SDK con ella y es-AR, y monta el brick con el monto 2850', async () => {
    montar();

    await screen.findByRole('button', { name: 'Simular pago' });

    expect(espia.inicializaciones).toEqual([{ clave: 'APP_USR-clave-publica-de-prueba', opciones: { locale: 'es-AR' } }]);
    expect(espia.montos).toEqual([2850]);
    expect(espia.locales).toEqual(['es-AR']);
  });

  it('pasa el monto numérico de otro total (1300.50 → 1300.5)', async () => {
    reiniciarEspia();
    const estado = crearEstadoPagos();
    server.use(...handlersPagos(estado));
    const Envoltorio = envolverConQuery(crearQueryClientDePrueba());
    render(
      <Envoltorio>
        <FormularioTarjeta pedidoId={7} total="1300.50" onResultado={() => undefined} onError={() => undefined} />
      </Envoltorio>,
    );

    await screen.findByRole('button', { name: 'Simular pago' });

    expect(espia.montos).toEqual([1300.5]);
  });

  it('muestra «Cargando el formulario de tarjeta…» hasta que el brick avisa que está listo', async () => {
    const { usuario } = montar();

    expect(await screen.findByText('Cargando el formulario de tarjeta…')).toBeInTheDocument();
    await usuario.click(await screen.findByRole('button', { name: 'Simular brick listo' }));

    expect(screen.queryByText('Cargando el formulario de tarjeta…')).not.toBeInTheDocument();
  });

  it('con GET /pagos/config en 503 avisa que no está disponible y no monta el brick', async () => {
    montar({ clavePublica: null });

    expect(await screen.findByText('El pago con tarjeta no está disponible en este momento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(espia.montajes).toBe(0);
    expect(espia.inicializaciones).toEqual([]);
  });

  it('sin respuesta de GET /pagos/config también avisa que no está disponible', async () => {
    montar({ clavePublica: 'red' });

    expect(await screen.findByText('El pago con tarjeta no está disponible en este momento')).toBeInTheDocument();
    expect(espia.montajes).toBe(0);
  });
});

describe('FormularioTarjeta · envío', () => {
  beforeEach(reiniciarEspia);

  it('«Simular pago» llama POST /pagos/crear con el cuerpo exacto y avisa el resultado', async () => {
    const { estado, resultados, usuario } = montar({ resultados: [{ estado: 'rechazado', mp_status_detail: 'insufficient_amount' }] });

    await usuario.click(await screen.findByRole('button', { name: 'Simular pago' }));

    await waitFor(() => expect(resultados).toHaveLength(1));
    expect(estado.creaciones).toEqual([
      {
        pedido_id: 58,
        token: 'tok_1',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 3,
        issuer_id: 310,
        payer: { email: 'comprador@test.com', identification: { type: 'DNI', number: '12345678' } },
      },
    ]);
    expect(resultados[0]).toMatchObject({ pedido_id: 58, estado: 'rechazado', mp_status_detail: 'insufficient_amount' });
  });

  it('muestra «Procesando el pago…» mientras espera y un segundo envío no hace otro POST', async () => {
    const { estado, resultados, usuario } = montar({ demoraCrear: 150 });
    const boton = await screen.findByRole('button', { name: 'Simular pago' });

    await usuario.click(boton);
    await usuario.click(boton);

    expect(await screen.findByText('Procesando el pago…')).toBeInTheDocument();
    await waitFor(() => expect(resultados).toHaveLength(1));
    expect(estado.creaciones).toHaveLength(1);
    expect(screen.queryByText('Procesando el pago…')).not.toBeInTheDocument();
  });

  it('un error de la API se informa con su status y se puede volver a enviar', async () => {
    const { estado, errores, resultados, usuario } = montar({ resultados: [{ status: 502, detail: 'MercadoPago no respondió' }, { estado: 'aprobado' }] });
    const boton = await screen.findByRole('button', { name: 'Simular pago' });

    await usuario.click(boton);
    await waitFor(() => expect(errores).toHaveLength(1));
    await usuario.click(boton);
    await waitFor(() => expect(resultados).toHaveLength(1));

    expect(errores[0]?.status).toBe(502);
    expect(estado.creaciones).toHaveLength(2);
  });
});

describe('FormularioTarjeta · error del brick', () => {
  beforeEach(reiniciarEspia);

  it('muestra «No pudimos cargar el formulario de tarjeta» y «Reintentar» vuelve a montarlo', async () => {
    const { usuario } = montar();

    await usuario.click(await screen.findByRole('button', { name: 'Simular error del brick' }));
    expect(screen.getByText('No pudimos cargar el formulario de tarjeta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: 'Simular pago' })).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar el formulario de tarjeta')).not.toBeInTheDocument();
    expect(espia.montajes).toBe(2);
  });
});
