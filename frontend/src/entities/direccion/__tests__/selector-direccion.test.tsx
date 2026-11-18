import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoDirecciones, direccionDto, handlersDirecciones, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba } from '@/test/query';
import { SelectorDireccion } from '../index';

const casa = direccionDto({ id: 1, alias: 'Casa', linea1: 'Av. San Martín 1234', ciudad: 'Mendoza' });
const trabajo = direccionDto({ id: 2, alias: 'Trabajo', linea1: 'Belgrano 455', ciudad: 'Godoy Cruz', es_principal: true });

interface ContenedorProps {
  valorInicial?: number | null | undefined;
  permitirRetiro?: boolean;
  onCambiar: (valor: number | null) => void;
}

/** Contenedor controlado, como lo usará el checkout. */
function Contenedor({ valorInicial, permitirRetiro, onCambiar }: ContenedorProps) {
  const [valor, setValor] = useState<number | null | undefined>(valorInicial);
  return (
    <SelectorDireccion
      valor={valor}
      {...(permitirRetiro === undefined ? {} : { permitirRetiro })}
      onCambiar={(nuevo) => {
        onCambiar(nuevo);
        setValor(nuevo);
      }}
    />
  );
}

function montar(direcciones: ReturnType<typeof direccionDto>[], props: Omit<ContenedorProps, 'onCambiar'> = {}) {
  const estado = crearEstadoDirecciones(direcciones);
  server.use(...handlersDirecciones(estado));
  const onCambiar = vi.fn<(valor: number | null) => void>();
  const usuario = userEvent.setup();
  const vista = render(
    <QueryClientProvider client={crearQueryClientDePrueba()}>
      <MemoryRouter>
        <Contenedor {...props} onCambiar={onCambiar} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { estado, onCambiar, usuario, ...vista };
}

describe('SelectorDireccion: preselección', () => {
  it('sin elección previa y con «Trabajo» principal la preselecciona una sola vez y es el grupo «¿Dónde lo recibís?»', async () => {
    const { estado, onCambiar } = montar([casa, trabajo]);

    const radio = await screen.findByRole('radio', { name: /Trabajo/ });

    expect(radio).toBeChecked();
    expect(onCambiar).toHaveBeenCalledTimes(1);
    expect(onCambiar).toHaveBeenCalledWith(2);
    expect(screen.getByRole('group', { name: '¿Dónde lo recibís?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Casa/ })).not.toBeChecked();
    expect(pedidosDe(estado, 'GET', '/')[0]?.busqueda).toBe('?page=1&size=100');
  });

  it('sin principal elige la primera de la lista', async () => {
    const { onCambiar } = montar([direccionDto({ id: 5, alias: 'Trabajo' }), direccionDto({ id: 9, alias: 'Oficina' })]);

    expect(await screen.findByRole('radio', { name: /Trabajo/ })).toBeChecked();

    expect(onCambiar).toHaveBeenCalledTimes(1);
    expect(onCambiar).toHaveBeenCalledWith(5);
    expect(screen.getByRole('radio', { name: /Oficina/ })).not.toBeChecked();
  });

  it('con un valor ya elegido no llama a onCambiar al cargar y lo respeta', async () => {
    const { onCambiar } = montar([casa, trabajo], { valorInicial: 1 });

    expect(await screen.findByRole('radio', { name: /Casa/ })).toBeChecked();

    expect(onCambiar).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Trabajo/ })).not.toBeChecked();
  });

  it('con un id que ya no existe se preselecciona la dirección por defecto', async () => {
    const { onCambiar } = montar([casa, trabajo], { valorInicial: 99 });

    expect(await screen.findByRole('radio', { name: /Trabajo/ })).toBeChecked();

    expect(onCambiar).toHaveBeenCalledTimes(1);
    expect(onCambiar).toHaveBeenCalledWith(2);
  });

  it('el valor null (retiro) ya elegido se respeta cuando el retiro está habilitado', async () => {
    const { onCambiar } = montar([casa, trabajo], { valorInicial: null });

    expect(await screen.findByRole('radio', { name: /Retiro en el local/ })).toBeChecked();

    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('con valor null pero sin retiro habilitado se preselecciona la dirección por defecto', async () => {
    const { onCambiar } = montar([casa, trabajo], { valorInicial: null, permitirRetiro: false });

    expect(await screen.findByRole('radio', { name: /Trabajo/ })).toBeChecked();

    expect(onCambiar).toHaveBeenCalledWith(2);
  });
});

describe('SelectorDireccion: opciones y teclado', () => {
  it('«Retiro en el local» informa null', async () => {
    const { onCambiar, usuario } = montar([casa, trabajo]);
    await screen.findByRole('radio', { name: /Trabajo/ });

    await usuario.click(screen.getByRole('radio', { name: /Retiro en el local/ }));

    expect(onCambiar).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Trabajo/ })).not.toBeChecked();
  });

  it('con permitirRetiro en false no ofrece «Retiro en el local»', async () => {
    montar([casa, trabajo], { permitirRetiro: false });
    await screen.findByRole('radio', { name: /Trabajo/ });

    expect(screen.queryByRole('radio', { name: /Retiro en el local/ })).not.toBeInTheDocument();
  });

  it('elegir una dirección con clic informa su id', async () => {
    const { onCambiar, usuario } = montar([casa, trabajo]);
    await screen.findByRole('radio', { name: /Trabajo/ });

    await usuario.click(screen.getByRole('radio', { name: /Casa/ }));

    expect(onCambiar).toHaveBeenLastCalledWith(1);
  });

  it('las flechas del teclado cambian la opción elegida', async () => {
    const { onCambiar, usuario } = montar([casa, trabajo]);
    const trabajoRadio = await screen.findByRole('radio', { name: /Trabajo/ });
    trabajoRadio.focus();

    // El servidor entrega primero la principal: el orden visual es Trabajo, Casa, Retiro.
    await usuario.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: /Casa/ })).toBeChecked();
    expect(onCambiar).toHaveBeenLastCalledWith(1);
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(onCambiar).toHaveBeenLastCalledWith(null);
    await usuario.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: /Casa/ })).toBeChecked();
    expect(onCambiar).toHaveBeenLastCalledWith(1);
  });

  it('con más direcciones que las que trae la página avisa cuántas se muestran', async () => {
    const muchas = Array.from({ length: 101 }, (_, i) => direccionDto({ id: i + 1, alias: `Dir ${i + 1}`, es_principal: i === 0 }));
    montar(muchas);

    expect(await screen.findByText('Mostrando 100 de 101 direcciones.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(101);
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = montar([casa, trabajo]);
    await screen.findByRole('radio', { name: /Trabajo/ });

    await esperarSinViolacionesA11y(container);
  });
});

describe('SelectorDireccion: sin direcciones, carga y error', () => {
  it('vacío muestra «No tenés direcciones guardadas» con enlace a /direcciones y elige retiro', async () => {
    const { onCambiar } = montar([]);

    expect(await screen.findByText('No tenés direcciones guardadas')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Agregar dirección' })).toHaveAttribute('href', '/direcciones');
    expect(onCambiar).toHaveBeenCalledTimes(1);
    expect(onCambiar).toHaveBeenCalledWith(null);
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
  });

  it('vacío y sin retiro no informa ninguna elección ni ofrece opciones', async () => {
    const { onCambiar } = montar([], { permitirRetiro: false });

    expect(await screen.findByText('No tenés direcciones guardadas')).toBeInTheDocument();

    expect(onCambiar).not.toHaveBeenCalled();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agregar dirección' })).toBeInTheDocument();
  });

  it('mientras carga muestra un indicador con aria-busy', async () => {
    const { estado } = montar([casa]);
    estado.demoras.GET = 150;
    expect(await screen.findByRole('status', { name: 'Cargando direcciones' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('radio', { name: /Casa/ });
  });

  it('un 503 muestra «No pudimos cargar tus direcciones» y «Reintentar» recupera la lista', async () => {
    let llamadas = 0;
    const { usuario } = montar([]);
    server.use(
      http.get(`${API}/direcciones/`, () => {
        llamadas += 1;
        return llamadas === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ items: [casa], total: 1, page: 1, size: 100, pages: 1 });
      }),
    );

    expect(await screen.findByText('No pudimos cargar tus direcciones')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('radio', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar tus direcciones')).not.toBeInTheDocument();
  });
});
