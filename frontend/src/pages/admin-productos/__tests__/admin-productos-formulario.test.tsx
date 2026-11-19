import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminProductos, escriturasProductos, pedidosProductos } from '@/test/msw/admin-productos';
import { API, server } from '@/test/msw/server';
import { montarAdminProductos } from '@/test/render-admin';

/** «Burger Vegana» con tres ingredientes (en «u»), uno removible, para probar la edición. */
function estadoConIngredientes() {
  const estado = crearEstadoAdminProductos();
  const vegana = estado.productos[2];
  if (vegana !== undefined) {
    vegana.ingredientes = [
      { id: 1, nombre: 'Pan Brioche', es_alergeno: true, es_removible: false, cantidad: '1.000', unidad_medida_id: 5 },
      { id: 4, nombre: 'Medallón Vegano', es_alergeno: false, es_removible: false, cantidad: '1.000', unidad_medida_id: 5 },
      { id: 7, nombre: 'Lechuga', es_alergeno: false, es_removible: true, cantidad: '2.000', unidad_medida_id: 5 },
    ];
  }
  return estado;
}

async function abrirAlta() {
  const app = montarAdminProductos('/admin/productos');
  await app.usuario.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
  await screen.findByRole('heading', { name: 'Nuevo producto', level: 2 });
  await screen.findByRole('checkbox', { name: 'Hamburguesas' });
  return app;
}

async function abrirEdicion(estado = estadoConIngredientes()) {
  const app = montarAdminProductos('/admin/productos', { estado });
  await app.usuario.click(await screen.findByRole('button', { name: 'Editar Burger Vegana' }));
  await screen.findByRole('heading', { name: 'Editar «Burger Vegana»' });
  await screen.findByRole('checkbox', { name: 'Hamburguesas' });
  return app;
}

type Usuario = Awaited<ReturnType<typeof abrirAlta>>['usuario'];

async function completarBasico(usuario: Usuario, nombre = 'Burger Doble', precio = '2500') {
  await usuario.type(screen.getByLabelText('Nombre'), nombre);
  await usuario.type(screen.getByLabelText('Precio'), precio);
  await usuario.click(screen.getByRole('checkbox', { name: 'Hamburguesas' }));
}

const guardar = (nombre: 'Crear producto' | 'Guardar cambios') => screen.getByRole('button', { name: nombre });

describe('formulario de producto: alta', () => {
  it('crea «Burger Doble» con categoría e ingrediente en un solo POST con el cuerpo exacto, avisa y muestra la fila nueva', async () => {
    const { estado, usuario } = await abrirAlta();

    await completarBasico(usuario);
    await usuario.clear(screen.getByLabelText('Stock inicial'));
    await usuario.type(screen.getByLabelText('Stock inicial'), '10');
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 1'), 'Tomate');
    expect(screen.getByLabelText('Unidad')).toHaveDisplayValue('Unidad (u)');
    await usuario.clear(screen.getByLabelText('Cantidad'));
    await usuario.type(screen.getByLabelText('Cantidad'), '2');
    await usuario.click(screen.getByRole('checkbox', { name: 'Se puede quitar' }));
    await usuario.click(guardar('Crear producto'));

    expect(await screen.findByText('Producto creado')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'POST', '/productos/')).toHaveLength(1);
    expect(pedidosProductos(estado, 'POST', '/productos/')[0]?.cuerpo).toEqual({
      nombre: 'Burger Doble',
      descripcion: null,
      precio_base: '2500.00',
      stock_cantidad: 10,
      disponible: true,
      categoria_ids: [1],
      ingredientes: [{ ingrediente_id: 8, cantidad: '2', unidad_medida_id: 5, es_removible: true }],
    });
    const fila = await screen.findByRole('group', { name: 'Burger Doble' });
    expect(fila).toHaveTextContent('Hamburguesas');
    expect(fila).toHaveTextContent('1 ingrediente');
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toHaveFocus();
  });

  it('un alérgeno se marca en la lista de opciones y en la fila; la unidad se propone con la del ingrediente', async () => {
    const { usuario } = await abrirAlta();

    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    const opcionPan = within(screen.getByLabelText('Ingrediente 1')).getByRole('option', { name: 'Pan Brioche (alérgeno)' });
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 1'), opcionPan);

    expect(screen.getByText('Alérgeno').closest('.label-row')).toContainElement(screen.getByText('Ingrediente 1'));
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1');
    expect(screen.getByLabelText('Unidad')).toHaveDisplayValue('Unidad (u)');
  });

  it('con datos inválidos no envía nada, avisa qué corregir y lleva el foco al primer campo con error', async () => {
    const { estado, usuario } = await abrirAlta();
    await usuario.type(screen.getByLabelText('Precio'), '12,345');
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 1'), 'Tomate');
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 2'), 'Tomate');

    await usuario.click(guardar('Crear producto'));

    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá un precio desde 0 con hasta 2 decimales.')).toBeInTheDocument();
    expect(screen.getByText('Elegí al menos una categoría.')).toBeInTheDocument();
    expect(screen.getByText('Este ingrediente ya está en la lista.')).toBeInTheDocument();
    expect(screen.getByText('Revisá los datos marcados')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(escriturasProductos(estado)).toEqual([]);
  });

  it('una vez intentado guardar, los errores se corrigen campo por campo', async () => {
    const { usuario } = await abrirAlta();
    await usuario.click(guardar('Crear producto'));
    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Nombre'), 'Burger Doble');

    expect(screen.queryByText('Ingresá un nombre.')).not.toBeInTheDocument();
    expect(screen.getByText('Elegí al menos una categoría.')).toBeInTheDocument();
  });

  it('con «Veganas» como principal, categoria_ids lleva su id primero', async () => {
    const { estado, usuario } = await abrirAlta();
    await completarBasico(usuario);

    await usuario.click(screen.getByRole('checkbox', { name: 'Veganas' }));
    expect(screen.getByLabelText('Categoría principal')).toHaveDisplayValue('Hamburguesas');
    await usuario.selectOptions(screen.getByLabelText('Categoría principal'), 'Veganas');
    await usuario.click(guardar('Crear producto'));

    await screen.findByText('Producto creado');
    expect(pedidosProductos(estado, 'POST', '/productos/')[0]?.cuerpo).toMatchObject({ categoria_ids: [4, 1] });
  });

  it('al desmarcar la principal pasa a la siguiente marcada, y sin ninguna el selector queda deshabilitado', async () => {
    const { usuario } = await abrirAlta();
    await usuario.click(screen.getByRole('checkbox', { name: 'Hamburguesas' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Veganas' }));

    await usuario.click(screen.getByRole('checkbox', { name: 'Hamburguesas' }));
    expect(screen.getByLabelText('Categoría principal')).toHaveDisplayValue('Veganas');
    await usuario.click(screen.getByRole('checkbox', { name: 'Veganas' }));

    expect(screen.getByLabelText('Categoría principal')).toBeDisabled();
  });

  it('«Quitar» saca la fila del ingrediente y deja los demás', async () => {
    const { usuario } = await abrirAlta();
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 1'), 'Tomate');
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.selectOptions(screen.getByLabelText('Ingrediente 2'), 'Lechuga');

    await usuario.click(screen.getByRole('button', { name: 'Quitar Tomate' }));

    expect(screen.queryByRole('button', { name: 'Quitar Tomate' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ingrediente 1')).toHaveDisplayValue('Lechuga');
  });

  it('un nombre repetido (409) se muestra en «Nombre» y conserva todo lo escrito', async () => {
    const { usuario } = await abrirAlta();

    await completarBasico(usuario, 'Burger BBQ Bacon', '1600');
    await usuario.click(guardar('Crear producto'));

    expect(await screen.findByText('Ya existe un producto con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Burger BBQ Bacon');
    expect(screen.getByLabelText('Precio')).toHaveValue('1600');
    expect(screen.getByRole('checkbox', { name: 'Hamburguesas' })).toBeChecked();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('un 404 (categoría eliminada) muestra la alerta general y conserva lo escrito', async () => {
    const { usuario } = await abrirAlta();
    server.use(http.post(`${API}/productos/`, () => HttpResponse.json({ detail: 'Categoría no encontrada', code: 'HTTP_404', field: null }, { status: 404 })));

    await completarBasico(usuario);
    await usuario.click(guardar('Crear producto'));

    const alerta = await screen.findByText('No pudimos guardar el producto');
    expect(alerta.closest('[role="alert"]')).toHaveTextContent('Categoría no encontrada');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Burger Doble');
  });

  it('con la red caída muestra la alerta general y conserva lo escrito', async () => {
    const { usuario } = await abrirAlta();
    server.use(http.post(`${API}/productos/`, () => HttpResponse.error()));

    await completarBasico(usuario);
    await usuario.click(guardar('Crear producto'));

    const alerta = await screen.findByText('No pudimos guardar el producto');
    expect(alerta.closest('[role="alert"]')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(screen.getByLabelText('Precio')).toHaveValue('2500');
    expect(guardar('Crear producto')).toBeEnabled();
  });

  it('«Cancelar» y «Volver a Productos y stock» vuelven al listado sin enviar nada', async () => {
    const { estado, usuario } = await abrirAlta();
    await usuario.type(screen.getByLabelText('Nombre'), 'Algo');

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toHaveFocus();
    await usuario.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    await usuario.click(await screen.findByRole('button', { name: 'Volver a Productos y stock' }));
    expect(await screen.findByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(escriturasProductos(estado)).toEqual([]);
  });

  it('no tiene violaciones de accesibilidad (alta con errores)', async () => {
    const { usuario } = await abrirAlta();
    await usuario.click(screen.getByRole('button', { name: 'Agregar ingrediente' }));
    await usuario.click(guardar('Crear producto'));
    await screen.findByText('Ingresá un nombre.');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});

describe('formulario de producto: edición', () => {
  it('carga los datos, las categorías con su principal y los ingredientes; no muestra stock ni «Disponible»', async () => {
    await abrirEdicion();

    expect(screen.getByLabelText('Nombre')).toHaveValue('Burger Vegana');
    expect(screen.getByLabelText('Precio')).toHaveValue('1800.00');
    expect(screen.getByRole('checkbox', { name: 'Hamburguesas' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Veganas' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Postres' })).not.toBeChecked();
    expect(screen.getByLabelText('Categoría principal')).toHaveDisplayValue('Hamburguesas');
    expect(screen.getByLabelText('Ingrediente 1')).toHaveDisplayValue('Pan Brioche (alérgeno)');
    expect(screen.getByLabelText('Ingrediente 3')).toHaveDisplayValue('Lechuga');
    expect(screen.getAllByLabelText('Cantidad').map((campo) => (campo as HTMLInputElement).value)).toEqual(['1', '1', '2']);
    expect(screen.getAllByRole('checkbox', { name: 'Se puede quitar' }).map((c) => (c as HTMLInputElement).checked)).toEqual([false, false, true]);
    expect(screen.queryByLabelText('Stock inicial')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText(/Se cambian desde la lista de productos/)).toBeInTheDocument();
  });

  it('cambiar solo el precio envía un PUT solo con precio_base (sin ingredientes ni categorías) y avisa', async () => {
    const { estado, usuario } = await abrirEdicion();

    await usuario.clear(screen.getByLabelText('Precio'));
    await usuario.type(screen.getByLabelText('Precio'), '1900');
    await usuario.click(guardar('Guardar cambios'));

    expect(await screen.findByText('Producto actualizado')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'PUT', '/productos/3')[0]?.cuerpo).toEqual({ precio_base: '1900.00' });
    expect(await screen.findByRole('group', { name: 'Burger Vegana' })).toHaveTextContent('$ 1.900');
    expect(screen.getByRole('button', { name: 'Editar Burger Vegana' })).toHaveFocus();
  });

  it('editar solo el nombre no incluye ingredientes en el pedido', async () => {
    const { estado, usuario } = await abrirEdicion();

    await usuario.clear(screen.getByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Burger Vegana XL');
    await usuario.click(guardar('Guardar cambios'));

    await screen.findByRole('group', { name: 'Burger Vegana XL' });
    expect(pedidosProductos(estado, 'PUT', '/productos/3')[0]?.cuerpo).toEqual({ nombre: 'Burger Vegana XL' });
  });

  it('cambiar una cantidad envía la lista completa de ingredientes', async () => {
    const { estado, usuario } = await abrirEdicion();

    await usuario.clear(screen.getAllByLabelText('Cantidad')[2] as HTMLElement);
    await usuario.type(screen.getAllByLabelText('Cantidad')[2] as HTMLElement, '3');
    await usuario.click(guardar('Guardar cambios'));

    await screen.findByText('Producto actualizado');
    expect(pedidosProductos(estado, 'PUT', '/productos/3')[0]?.cuerpo).toEqual({
      ingredientes: [
        { ingrediente_id: 1, cantidad: '1', unidad_medida_id: 5, es_removible: false },
        { ingrediente_id: 4, cantidad: '1', unidad_medida_id: 5, es_removible: false },
        { ingrediente_id: 7, cantidad: '3', unidad_medida_id: 5, es_removible: true },
      ],
    });
  });

  it('marcar «Se puede quitar» en un ingrediente y quitar otro envía la lista nueva; cambiar la principal envía categoria_ids', async () => {
    const { estado, usuario } = await abrirEdicion();

    await usuario.click(screen.getAllByRole('checkbox', { name: 'Se puede quitar' })[0] as HTMLElement);
    await usuario.click(screen.getByRole('button', { name: 'Quitar Medallón Vegano' }));
    await usuario.selectOptions(screen.getByLabelText('Categoría principal'), 'Veganas');
    await usuario.click(guardar('Guardar cambios'));

    await screen.findByText('Producto actualizado');
    expect(pedidosProductos(estado, 'PUT', '/productos/3')[0]?.cuerpo).toEqual({
      categoria_ids: [4, 1],
      ingredientes: [
        { ingrediente_id: 1, cantidad: '1', unidad_medida_id: 5, es_removible: true },
        { ingrediente_id: 7, cantidad: '2', unidad_medida_id: 5, es_removible: true },
      ],
    });
  });

  it('guardar sin cambios vuelve al listado sin enviar ningún pedido', async () => {
    const { estado, usuario } = await abrirEdicion();

    await usuario.click(guardar('Guardar cambios'));

    expect(await screen.findByRole('group', { name: 'Burger Vegana' })).toBeInTheDocument();
    expect(escriturasProductos(estado)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Editar Burger Vegana' })).toHaveFocus();
  });

  it('renombrar a un nombre existente muestra el 409 en «Nombre» y conserva lo escrito', async () => {
    const { usuario } = await abrirEdicion();

    await usuario.clear(screen.getByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Burger BBQ Bacon');
    await usuario.click(guardar('Guardar cambios'));

    expect(await screen.findByText('Ya existe un producto con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Burger BBQ Bacon');
  });

  it('un 422 muestra la alerta general con el detalle del servidor', async () => {
    const { usuario } = await abrirEdicion();
    server.use(http.put(`${API}/productos/:id`, () => HttpResponse.json({ detail: 'Datos inválidos', code: 'VALIDATION_ERROR', field: null }, { status: 422 })));

    await usuario.clear(screen.getByLabelText('Precio'));
    await usuario.type(screen.getByLabelText('Precio'), '1900');
    await usuario.click(guardar('Guardar cambios'));

    const alerta = await screen.findByText('No pudimos guardar el producto');
    expect(alerta.closest('[role="alert"]')).toHaveTextContent('Datos inválidos');
  });

  it('si no se puede cargar el producto muestra el error con «Reintentar»', async () => {
    const app = montarAdminProductos('/admin/productos', { estado: estadoConIngredientes() });
    server.use(http.get(`${API}/productos/3`, () => HttpResponse.json({ detail: 'Falla', code: 'HTTP_500', field: null }, { status: 500 }), { once: true }));

    await app.usuario.click(await screen.findByRole('button', { name: 'Editar Burger Vegana' }));
    expect(await screen.findByText('No pudimos cargar el formulario')).toBeInTheDocument();
    await app.usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Editar «Burger Vegana»' })).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad', async () => {
    await abrirEdicion();

    await waitFor(() => esperarSinViolacionesA11y(screen.getByRole('main')));
  });
});
