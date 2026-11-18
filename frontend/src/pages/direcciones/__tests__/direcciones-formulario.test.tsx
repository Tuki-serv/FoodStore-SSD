import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { direccionDto, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { montarDirecciones } from '@/test/render-direcciones';

const casa = direccionDto({ id: 1, alias: 'Casa', linea1: 'Av. San Martín 1234', ciudad: 'Mendoza', es_principal: true });
const trabajo = direccionDto({
  id: 2,
  alias: 'Trabajo',
  linea1: 'Belgrano 455',
  linea2: 'oficina 4',
  ciudad: 'Godoy Cruz',
  provincia: 'Mendoza',
  codigo_postal: '5501',
});

const items = () => within(screen.getByRole('list', { name: 'Tus direcciones' })).getAllByRole('listitem');
const campo = (nombre: string) => screen.getByLabelText(nombre);
const formularioAbierto = () => screen.queryByRole('heading', { name: /^(Nueva|Editar) dirección$/ });

describe('formulario de alta', () => {
  it('un usuario sin direcciones agrega «Casa»: envía el cuerpo normalizado, cierra el formulario, la lista la marca «Principal» y avisa «Dirección guardada»', async () => {
    const { estado, usuario } = montarDirecciones([]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    await usuario.type(campo('Alias (opcional)'), ' Casa ');
    await usuario.type(campo('Calle y número'), 'Av. Siempre Viva 742');
    await usuario.type(campo('Ciudad'), 'Mendoza');
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByText('Dirección guardada')).toBeInTheDocument();
    expect(pedidosDe(estado, 'POST', '/')[0]?.cuerpo).toEqual({
      alias: 'Casa',
      linea1: 'Av. Siempre Viva 742',
      linea2: null,
      ciudad: 'Mendoza',
      provincia: null,
      codigo_postal: null,
    });
    expect(formularioAbierto()).not.toBeInTheDocument();
    expect(items()[0]).toHaveTextContent('Casa');
    expect(items()[0]).toHaveTextContent('Principal');
  });

  it('el encabezado del formulario recibe el foco al abrirlo', async () => {
    const { usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    expect(screen.getByRole('heading', { name: 'Nueva dirección' })).toHaveFocus();
  });

  it('una segunda dirección «Trabajo» no le quita la marca a «Casa»', async () => {
    const { usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    await usuario.type(campo('Alias (opcional)'), 'Trabajo');
    await usuario.type(campo('Calle y número'), 'Belgrano 455');
    await usuario.type(campo('Ciudad'), 'Godoy Cruz');
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    await waitFor(() => expect(items()).toHaveLength(2));
    expect(items()[0]).toHaveTextContent('Casa');
    expect(items()[0]).toHaveTextContent('Principal');
    expect(items()[1]).toHaveTextContent('Trabajo');
    expect(items()[1]).not.toHaveTextContent('Principal');
  });
});

describe('formulario: validación', () => {
  it('guardar con los obligatorios vacíos muestra dos errores y no envía ningún pedido', async () => {
    const { estado, usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    await usuario.type(campo('Calle y número'), '   ');
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByText('Ingresá la calle y el número')).toBeInTheDocument();
    expect(screen.getByText('Ingresá la ciudad')).toBeInTheDocument();
    expect(campo('Calle y número')).toHaveAttribute('aria-invalid', 'true');
    expect(campo('Calle y número')).toHaveAccessibleDescription('Ingresá la calle y el número');
    expect(pedidosDe(estado, 'POST', '/')).toHaveLength(0);
    expect(formularioAbierto()).toBeInTheDocument();
  });

  it('salir del código postal con 11 caracteres marca el error solo en ese campo', async () => {
    const { usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    await usuario.type(campo('Código postal (opcional)'), 'M5500ABCDEF');
    await usuario.tab();

    expect(await screen.findByText('Máximo 10 caracteres')).toBeInTheDocument();
    expect(campo('Código postal (opcional)')).toHaveAttribute('aria-invalid', 'true');
    expect(campo('Calle y número')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Ingresá la ciudad')).not.toBeInTheDocument();
  });

  it('un código postal de 10 caracteres no muestra error', async () => {
    const { usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));

    await usuario.type(campo('Código postal (opcional)'), 'M5500ABCDE');
    await usuario.tab();

    expect(screen.queryByText('Máximo 10 caracteres')).not.toBeInTheDocument();
    expect(campo('Código postal (opcional)')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('el formulario con errores no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarDirecciones([casa]);
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));
    await screen.findByText('Ingresá la ciudad');

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('formulario: errores del servidor', () => {
  it('un 422 con field codigo_postal muestra el mensaje junto al campo y conserva lo escrito', async () => {
    const { usuario } = montarDirecciones([casa]);
    server.use(
      http.post(`${API}/direcciones/`, () =>
        HttpResponse.json({ detail: 'Código postal no válido', code: 'VALIDATION_ERROR', field: 'codigo_postal' }, { status: 422 }),
      ),
    );
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    await usuario.type(campo('Calle y número'), 'Belgrano 455');
    await usuario.type(campo('Ciudad'), 'Godoy Cruz');
    await usuario.type(campo('Código postal (opcional)'), '55');

    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByText('Código postal no válido')).toBeInTheDocument();
    expect(campo('Código postal (opcional)')).toHaveAttribute('aria-invalid', 'true');
    expect(campo('Calle y número')).toHaveValue('Belgrano 455');
    expect(campo('Ciudad')).toHaveValue('Godoy Cruz');
    expect(formularioAbierto()).toBeInTheDocument();
  });

  it('el mensaje del servidor desaparece al editar ese campo y se puede reenviar', async () => {
    const { estado, usuario } = montarDirecciones([casa]);
    server.use(
      http.post(`${API}/direcciones/`, () =>
        HttpResponse.json({ detail: 'Código postal no válido', code: 'VALIDATION_ERROR', field: 'codigo_postal' }, { status: 422 }),
        { once: true },
      ),
    );
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    await usuario.type(campo('Calle y número'), 'Belgrano 455');
    await usuario.type(campo('Ciudad'), 'Godoy Cruz');
    await usuario.type(campo('Código postal (opcional)'), '55');
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));
    await screen.findByText('Código postal no válido');

    await usuario.type(campo('Código postal (opcional)'), '01');
    expect(screen.queryByText('Código postal no válido')).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByText('Dirección guardada')).toBeInTheDocument();
    expect(pedidosDe(estado, 'POST', '/')[0]?.cuerpo).toMatchObject({ codigo_postal: '5501' });
  });

  it('sin respuesta del servidor muestra «No pudimos conectar con el servidor.» y deja el formulario abierto', async () => {
    const { usuario } = montarDirecciones([casa]);
    server.use(http.post(`${API}/direcciones/`, () => HttpResponse.error()));
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    await usuario.type(campo('Calle y número'), 'Belgrano 455');
    await usuario.type(campo('Ciudad'), 'Godoy Cruz');

    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(formularioAbierto()).toBeInTheDocument();
    expect(campo('Ciudad')).toHaveValue('Godoy Cruz');
  });

  it('mientras el POST demora el botón queda deshabilitado con «Guardando…» y un segundo clic no envía otro pedido', async () => {
    const { estado, usuario } = montarDirecciones([casa]);
    estado.demoras.POST = 150;
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    await usuario.type(campo('Calle y número'), 'Belgrano 455');
    await usuario.type(campo('Ciudad'), 'Godoy Cruz');

    await usuario.click(screen.getByRole('button', { name: 'Guardar dirección' }));

    const guardando = await screen.findByRole('button', { name: 'Guardando…' });
    expect(guardando).toBeDisabled();
    await usuario.click(guardando);
    await screen.findByText('Dirección guardada');
    expect(pedidosDe(estado, 'POST', '/')).toHaveLength(1);
  });
});

describe('formulario de edición', () => {
  it('«Editar Trabajo» abre el formulario con sus datos; cambiar la ciudad envía PATCH /direcciones/2 con el objeto completo y el listado la muestra', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Editar Trabajo' }));

    expect(screen.getByRole('heading', { name: 'Editar dirección' })).toHaveFocus();
    expect(campo('Alias (opcional)')).toHaveValue('Trabajo');
    expect(campo('Piso, depto. (opcional)')).toHaveValue('oficina 4');
    await usuario.clear(campo('Ciudad'));
    await usuario.type(campo('Ciudad'), 'Godoy Cruz Centro');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Dirección guardada')).toBeInTheDocument();
    expect(pedidosDe(estado, 'PATCH', '/2')[0]?.cuerpo).toEqual({
      alias: 'Trabajo',
      linea1: 'Belgrano 455',
      linea2: 'oficina 4',
      ciudad: 'Godoy Cruz Centro',
      provincia: 'Mendoza',
      codigo_postal: '5501',
    });
    expect(items()[1]).toHaveTextContent('Godoy Cruz Centro, Mendoza');
  });

  it('vaciar «Piso, depto.» en una edición envía linea2: null', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Editar Trabajo' }));

    await usuario.clear(campo('Piso, depto. (opcional)'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByText('Dirección guardada');
    expect(pedidosDe(estado, 'PATCH', '/2')[0]?.cuerpo).toMatchObject({ linea2: null });
  });

  it('«Cancelar» no envía pedidos, deja el listado como estaba y devuelve el foco al botón que abrió el formulario', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Editar Trabajo' }));
    await usuario.clear(campo('Ciudad'));
    await usuario.type(campo('Ciudad'), 'Otra ciudad');

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(formularioAbierto()).not.toBeInTheDocument();
    expect(pedidosDe(estado, 'PATCH', '/2')).toHaveLength(0);
    expect(items()[1]).toHaveTextContent('Godoy Cruz, Mendoza');
    expect(screen.getByRole('button', { name: 'Editar Trabajo' })).toHaveFocus();
  });

  it('un 404 al guardar avisa «Esa dirección ya no está disponible», cierra el formulario y vuelve a pedir el listado', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Editar Trabajo' }));
    estado.direcciones = estado.direcciones.filter((d) => d.id !== 2);

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Esa dirección ya no está disponible')).toBeInTheDocument();
    expect(formularioAbierto()).not.toBeInTheDocument();
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText('Trabajo')).not.toBeInTheDocument());
  });
});

