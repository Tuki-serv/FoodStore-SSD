import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { pedidosAdmin, pedidosDeEscritura, respuestaError } from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { montarAdmin } from '@/test/render-admin';

/** Abre el formulario de edición de una categoría desde su fila. */
async function abrirEdicion(nombre: string) {
  const app = montarAdmin('/admin/categorias');
  await app.usuario.click(await screen.findByRole('button', { name: `Editar ${nombre}` }));
  return app;
}

const opciones = (): (string | null)[] => within(screen.getByLabelText('Categoría padre (opcional)')).getAllByRole('option').map((o) => o.textContent);

describe('formulario de categoría: alta', () => {
  it('«Agregar subcategoría» en Bebidas abre el formulario de alta (título del mockup aprobado: «Nueva subcategoría») con ese padre; guardar «Aguas» envía el POST, avisa y la muestra bajo Bebidas', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');

    await usuario.click(await screen.findByRole('button', { name: 'Agregar subcategoría a Bebidas' }));

    expect(screen.getByRole('heading', { name: 'Nueva subcategoría' })).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría padre (opcional)')).toHaveDisplayValue('Bebidas');
    await usuario.type(screen.getByLabelText('Nombre'), 'Aguas');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByText('Categoría creada')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'POST', '/categorias/')).toHaveLength(1);
    expect(pedidosAdmin(estado, 'POST', '/categorias/')[0]?.cuerpo).toEqual({ nombre: 'Aguas', parent_id: 2, descripcion: null, imagen_url: '' });
    const hijas = await screen.findByRole('list', { name: 'Subcategorías de Bebidas' });
    expect(within(hijas).getByRole('group', { name: 'Aguas' })).toBeInTheDocument();
  });

  it('«Nueva categoría» abre el alta de una raíz: sin padre, con descripción e imagen recortadas en el cuerpo', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');

    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    expect(screen.getByRole('heading', { name: 'Nueva categoría' })).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría padre (opcional)')).toHaveDisplayValue('Sin padre (categoría raíz)');
    await usuario.type(screen.getByLabelText('Nombre'), '  Ensaladas ');
    await usuario.type(screen.getByLabelText('Descripción (opcional)'), ' Frescas ');
    await usuario.type(screen.getByLabelText('URL de imagen (opcional)'), 'https://x.test/e.png');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByRole('group', { name: 'Ensaladas' })).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'POST', '/categorias/')[0]?.cuerpo).toEqual({
      nombre: 'Ensaladas',
      parent_id: null,
      descripcion: 'Frescas',
      imagen_url: 'https://x.test/e.png',
    });
  });

  it('con el nombre en blanco no envía nada y «Nombre» muestra «Ingresá un nombre.» con el foco puesto ahí', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('un nombre de más de 100 caracteres muestra «Máximo 100 caracteres.» y no envía', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'a'.repeat(101));
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByText('Máximo 100 caracteres.')).toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('un nombre repetido (409 DUPLICATE_VALUE) se muestra en «Nombre» y conserva lo escrito', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Gaseosas');
    await usuario.type(screen.getByLabelText('Descripción (opcional)'), 'Bebidas con gas');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByText('Ya existe una categoría con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gaseosas');
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Bebidas con gas');
    expect(screen.getByRole('heading', { name: 'Nueva categoría' })).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'POST', '/categorias/')).toHaveLength(1);
  });

  it('un 404 (padre eliminado mientras se editaba) se muestra como alerta general con el detalle y conserva los datos', async () => {
    const { usuario } = montarAdmin('/admin/categorias');
    server.use(http.post(`${API}/categorias/`, () => respuestaError(404, 'HTTP_404', 'Categoría padre no encontrada')));
    await usuario.click(await screen.findByRole('button', { name: 'Agregar subcategoría a Bebidas' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Aguas');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos guardar la categoría');
    expect(alerta).toHaveTextContent('Categoría padre no encontrada');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Aguas');
  });

  it('con la red caída muestra la alerta general de conexión y conserva lo escrito', async () => {
    const { usuario } = montarAdmin('/admin/categorias');
    server.use(http.post(`${API}/categorias/`, () => HttpResponse.error()));
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Aguas');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Aguas');
    expect(screen.getByRole('button', { name: 'Crear categoría' })).toBeEnabled();
  });

  it('«Cancelar» y «Volver a Categorías» vuelven al árbol sin enviar nada', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Aguas');

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva categoría' })).toHaveFocus();
    await usuario.click(screen.getByRole('button', { name: 'Nueva categoría' }));
    await usuario.click(screen.getByRole('button', { name: 'Volver a Categorías' }));
    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('el formulario no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('formulario de categoría: edición', () => {
  it('editar «Hamburguesas»: el selector de padre no ofrece ella ni sus subcategorías', async () => {
    await abrirEdicion('Hamburguesas');

    expect(screen.getByRole('heading', { name: 'Editar «Hamburguesas»' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Hamburguesas');
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Nuestras burgers artesanales');
    expect(opciones()).toEqual(['Sin padre (categoría raíz)', 'Bebidas', '— Gaseosas', 'Postres']);
  });

  it('editar una hoja («Veganas») ofrece todas menos ella', async () => {
    await abrirEdicion('Veganas');

    expect(opciones()).toEqual(['Sin padre (categoría raíz)', 'Bebidas', '— Gaseosas', 'Hamburguesas', '— Sin TACC', 'Postres']);
    expect(screen.getByLabelText('Categoría padre (opcional)')).toHaveDisplayValue('Hamburguesas');
  });

  it('guardar sin cambios vuelve al árbol sin enviar ningún pedido', async () => {
    const { estado, usuario } = await abrirEdicion('Postres');

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Postres' })).toHaveFocus();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('cambiar solo el nombre envía un PATCH con ese campo, avisa y refleja el cambio', async () => {
    const { estado, usuario } = await abrirEdicion('Hamburguesas');

    await usuario.clear(screen.getByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Burgers');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Categoría actualizada')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'PATCH', '/categorias/1')[0]?.cuerpo).toEqual({ nombre: 'Burgers' });
    expect(await screen.findByRole('group', { name: 'Burgers' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Hamburguesas' })).not.toBeInTheDocument();
  });

  it('mover «Veganas» a «Bebidas» envía solo parent_id y la muestra bajo su nuevo padre', async () => {
    const { estado, usuario } = await abrirEdicion('Veganas');

    await usuario.selectOptions(screen.getByLabelText('Categoría padre (opcional)'), 'Bebidas');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const hijas = await screen.findByRole('list', { name: 'Subcategorías de Bebidas' });
    expect(await within(hijas).findByRole('group', { name: 'Veganas' })).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'PATCH', '/categorias/4')[0]?.cuerpo).toEqual({ parent_id: 2 });
  });

  it('un 400 de ciclo del servidor se muestra como alerta general y conserva los datos', async () => {
    const { usuario } = await abrirEdicion('Hamburguesas');
    server.use(http.patch(`${API}/categorias/1`, () => respuestaError(400, 'HTTP_400', 'La categoría no puede ser su propio padre ni descendiente de sí misma')));

    await usuario.selectOptions(screen.getByLabelText('Categoría padre (opcional)'), 'Bebidas');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La categoría no puede ser su propio padre ni descendiente de sí misma');
    expect(screen.getByLabelText('Categoría padre (opcional)')).toHaveDisplayValue('Bebidas');
  });

  it('renombrar a un nombre existente muestra el 409 en «Nombre»', async () => {
    const { usuario } = await abrirEdicion('Postres');

    await usuario.clear(screen.getByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Bebidas');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ya existe una categoría con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });
});
