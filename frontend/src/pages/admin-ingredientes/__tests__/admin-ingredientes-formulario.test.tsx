import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import {
  crearEstadoAdminCatalogo,
  handlersAdminCatalogo,
  ingredientesSeed,
  pedidosAdmin,
  pedidosDeEscritura,
  type IngredienteDto,
} from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { montarAdmin } from '@/test/render-admin';

const ES_ALERGENO = /Es alérgeno/;

async function abrirAlta() {
  const app = montarAdmin('/admin/ingredientes');
  await app.usuario.click(await screen.findByRole('button', { name: 'Nuevo ingrediente' }));
  return app;
}

async function abrirEdicion(nombre: string) {
  const app = montarAdmin('/admin/ingredientes');
  await app.usuario.click(await screen.findByRole('button', { name: `Editar ${nombre}` }));
  return app;
}

describe('formulario de ingrediente: alta', () => {
  it('crear «Maní» como alérgeno en «Gramo (g)» envía el cuerpo exacto, avisa «Ingrediente creado» y lo muestra', async () => {
    const { estado, usuario } = await abrirAlta();

    expect(await screen.findByRole('heading', { name: 'Nuevo ingrediente' })).toBeInTheDocument();
    await usuario.type(screen.getByLabelText('Nombre'), 'Maní');
    await usuario.selectOptions(screen.getByLabelText('Unidad de medida'), 'Gramo (g)');
    await usuario.click(screen.getByRole('checkbox', { name: ES_ALERGENO }));
    await usuario.click(screen.getByRole('button', { name: 'Crear ingrediente' }));

    expect(await screen.findByText('Ingrediente creado')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'POST', '/ingredientes/')[0]?.cuerpo).toEqual({ nombre: 'Maní', descripcion: null, es_alergeno: true, unidad_medida_id: 2 });
    const mani = await screen.findByRole('group', { name: 'Maní' });
    expect(within(mani).getByText('Alérgeno')).toBeInTheDocument();
    expect(mani).toHaveTextContent('Gramo (g)');
  });

  it('la unidad por defecto es «Unidad (u)» (por símbolo, no por el id 1 del backend) y la descripción se recorta', async () => {
    const { estado, usuario } = await abrirAlta();

    const unidad = await screen.findByLabelText('Unidad de medida');
    expect(unidad).toHaveDisplayValue('Unidad (u)');
    expect(within(unidad).getAllByRole('option')).toHaveLength(7);
    expect(screen.getByRole('checkbox', { name: ES_ALERGENO })).not.toBeChecked();
    await usuario.type(screen.getByLabelText('Nombre'), '  Harina ');
    await usuario.type(screen.getByLabelText('Descripción (opcional)'), ' 000 ');
    await usuario.click(screen.getByRole('button', { name: 'Crear ingrediente' }));

    await screen.findByRole('group', { name: 'Harina' });
    expect(pedidosAdmin(estado, 'POST', '/ingredientes/')[0]?.cuerpo).toEqual({ nombre: 'Harina', descripcion: '000', es_alergeno: false, unidad_medida_id: 5 });
  });

  it('con el nombre en blanco no envía nada y «Nombre» muestra «Ingresá un nombre.»', async () => {
    const { estado, usuario } = await abrirAlta();
    await screen.findByLabelText('Unidad de medida');

    await usuario.click(screen.getByRole('button', { name: 'Crear ingrediente' }));

    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('un nombre repetido (409 DUPLICATE_VALUE) se muestra en «Nombre» y conserva lo escrito', async () => {
    const { usuario } = await abrirAlta();

    await usuario.type(await screen.findByLabelText('Nombre'), 'Lechuga');
    await usuario.type(screen.getByLabelText('Descripción (opcional)'), 'Lechuga morada');
    await usuario.click(screen.getByRole('button', { name: 'Crear ingrediente' }));

    expect(await screen.findByText('Ya existe un ingrediente con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Lechuga');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Lechuga morada');
  });

  it('con la red caída muestra la alerta general y conserva lo escrito', async () => {
    const { usuario } = await abrirAlta();
    server.use(http.post(`${API}/ingredientes/`, () => HttpResponse.error()));

    await usuario.type(await screen.findByLabelText('Nombre'), 'Maní');
    await usuario.click(screen.getByRole('button', { name: 'Crear ingrediente' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos guardar el ingrediente');
    expect(alerta).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Maní');
  });

  it('«Cancelar» y «Volver a Ingredientes» vuelven al listado sin enviar nada', async () => {
    const { estado, usuario } = await abrirAlta();
    await usuario.type(await screen.findByLabelText('Nombre'), 'Maní');

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo ingrediente' })).toHaveFocus();
    await usuario.click(screen.getByRole('button', { name: 'Nuevo ingrediente' }));
    await usuario.click(await screen.findByRole('button', { name: 'Volver a Ingredientes' }));
    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('si no cargan las unidades muestra el error con «Reintentar» y, al recuperarse, el formulario', async () => {
    const { estado, usuario } = montarAdmin('/admin/ingredientes');
    server.use(http.get(`${API}/unidades-medida/`, () => HttpResponse.error()));
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo ingrediente' }));

    expect(await screen.findByText('No pudimos cargar las unidades de medida')).toBeInTheDocument();
    server.use(...handlersAdminCatalogo(estado));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByLabelText('Unidad de medida')).toHaveDisplayValue('Unidad (u)');
  });

  it('el formulario no tiene violaciones de accesibilidad', async () => {
    await abrirAlta();
    await screen.findByLabelText('Unidad de medida');

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('formulario de ingrediente: edición', () => {
  it('editar «Mayonesa» y desmarcar «Es alérgeno» envía PATCH solo con es_alergeno false y la fila deja de mostrar «Alérgeno»', async () => {
    const { estado, usuario } = await abrirEdicion('Mayonesa');

    expect(await screen.findByRole('heading', { name: 'Editar «Mayonesa»' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Mayonesa');
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Mayo artesanal');
    expect(screen.getByLabelText('Unidad de medida')).toHaveDisplayValue('Unidad (u)');
    expect(screen.getByRole('checkbox', { name: ES_ALERGENO })).toBeChecked();
    await usuario.click(screen.getByRole('checkbox', { name: ES_ALERGENO }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ingrediente actualizado')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'PATCH', '/ingredientes/12')[0]?.cuerpo).toEqual({ es_alergeno: false });
    const mayonesa = await screen.findByRole('group', { name: 'Mayonesa' });
    await waitFor(() => expect(within(mayonesa).queryByText('Alérgeno')).not.toBeInTheDocument());
  });

  it('cambiar el nombre y la descripción envía solo esos campos', async () => {
    const { estado, usuario } = await abrirEdicion('Tomate');

    await usuario.clear(await screen.findByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Tomate cherry');
    await usuario.clear(screen.getByLabelText('Descripción (opcional)'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByRole('group', { name: 'Tomate cherry' });
    expect(pedidosAdmin(estado, 'PATCH', '/ingredientes/8')[0]?.cuerpo).toEqual({ nombre: 'Tomate cherry', descripcion: null });
  });

  it('guardar sin cambios vuelve al listado sin enviar ningún pedido', async () => {
    const { estado, usuario } = await abrirEdicion('Tomate');

    await usuario.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('group', { name: 'Tomate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Tomate' })).toHaveFocus();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('renombrar a un nombre existente muestra el 409 en «Nombre»', async () => {
    const { usuario } = await abrirEdicion('Tomate');

    await usuario.clear(await screen.findByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Lechuga');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ya existe un ingrediente con ese nombre.')).toBeInTheDocument();
  });

  it('la edición preelige la unidad actual («Gramo (g)») y no ofrece «Sin cambios»', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.ingredientes.push({ ...(ingredientesSeed[0] as IngredienteDto), id: 50, nombre: 'Maní', es_alergeno: true, unidad_medida_id: 2, productos: [] });
    const app = montarAdmin('/admin/ingredientes', { estado });
    await app.usuario.click(await screen.findByRole('button', { name: 'Editar Maní' }));

    const unidad = await screen.findByLabelText('Unidad de medida');

    expect(unidad).toHaveDisplayValue('Gramo (g)');
    expect(within(unidad).queryByRole('option', { name: 'Sin cambios' })).not.toBeInTheDocument();
    expect(within(unidad).getAllByRole('option')).toHaveLength(7);
  });

  it('cambiar la unidad de «Maní» a «Kilogramo (kg)» envía solo el unidad_medida_id y la fila lo muestra', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.ingredientes.push({ ...(ingredientesSeed[0] as IngredienteDto), id: 50, nombre: 'Maní', es_alergeno: true, unidad_medida_id: 2, productos: [] });
    const app = montarAdmin('/admin/ingredientes', { estado });
    await app.usuario.click(await screen.findByRole('button', { name: 'Editar Maní' }));

    await app.usuario.selectOptions(await screen.findByLabelText('Unidad de medida'), 'Kilogramo (kg)');
    await app.usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ingrediente actualizado')).toBeInTheDocument();
    expect(pedidosAdmin(app.estado, 'PATCH', '/ingredientes/50')[0]?.cuerpo).toEqual({ unidad_medida_id: 1 });
    expect(await screen.findByRole('group', { name: 'Maní' })).toHaveTextContent('Kilogramo (kg)');
  });
});

describe('formulario de ingrediente: marca de alérgeno', () => {
  it('la tarjeta «Es alérgeno» se resalta (is-on) solo mientras está marcada', async () => {
    const { usuario } = await abrirAlta();
    const casilla = await screen.findByRole('checkbox', { name: ES_ALERGENO });
    const tarjeta = casilla.closest('label');

    expect(tarjeta).not.toHaveClass('is-on');
    await usuario.click(casilla);
    expect(tarjeta).toHaveClass('is-on');
    await usuario.click(casilla);
    expect(tarjeta).not.toHaveClass('is-on');
  });
});
