import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminCatalogo, ingredientesSeed, pedidosAdmin, pedidosDeEscritura, respuestaError, type IngredienteDto } from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { esperarTitulo, montarAdmin } from '@/test/render-admin';

const sinUso = (): IngredienteDto => ({ ...(ingredientesSeed[0] as IngredienteDto), id: 50, nombre: 'Huevo', es_alergeno: false, productos: [] });

describe('baja de ingrediente', () => {
  it('«Eliminar Pan Brioche» avisa que lo usan 3 productos; confirmar envía el DELETE, avisa y la fila desaparece', async () => {
    const { estado, usuario } = montarAdmin('/admin/ingredientes');

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Pan Brioche' }));

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Pan Brioche»?' });
    expect(dialogo).toHaveTextContent('Deja de ofrecerse al armar productos. Podés volver a crearlo con el mismo nombre más adelante.');
    expect(dialogo).toHaveTextContent('Lo usan 3 productos');
    expect(dialogo).toHaveTextContent('Revisalos después en Productos y stock.');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Ingrediente eliminado')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'DELETE', '/ingredientes/1')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Pan Brioche' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await esperarTitulo('Ingredientes');
    expect(screen.getByRole('heading', { name: 'Ingredientes', level: 1 })).toHaveFocus();
  });

  it('un ingrediente sin uso se confirma sin aviso', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.ingredientes.push(sinUso());
    const { usuario } = montarAdmin('/admin/ingredientes', { estado });

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Huevo' }));

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Huevo»?' });
    expect(dialogo).not.toHaveTextContent('Lo usa');
    expect(dialogo.querySelector('.warn')).toBeNull();
  });

  it('«Cancelar» cierra el diálogo, devuelve el foco al botón y no envía nada', async () => {
    const { estado, usuario } = montarAdmin('/admin/ingredientes');
    const boton = await screen.findByRole('button', { name: 'Eliminar Pan Brioche' });
    await usuario.click(boton);

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('mientras se elimina muestra «Eliminando…» deshabilitado', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.demoras.DELETE = 200;
    const { usuario } = montarAdmin('/admin/ingredientes', { estado });
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Pan Brioche' }));

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('button', { name: 'Eliminando…' })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('un error del servidor se muestra dentro del diálogo, que sigue abierto', async () => {
    const { usuario } = montarAdmin('/admin/ingredientes');
    server.use(http.delete(`${API}/ingredientes/:id`, () => respuestaError(500, 'HTTP_500', 'Falló la base')));
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Pan Brioche' }));

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const alerta = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos eliminar el ingrediente');
    expect(alerta).toHaveTextContent('Falló la base');
    expect(screen.getByRole('group', { name: 'Pan Brioche' })).toBeInTheDocument();
  });

  it('con la red caída muestra el error dentro del diálogo', async () => {
    const { usuario } = montarAdmin('/admin/ingredientes');
    server.use(http.delete(`${API}/ingredientes/:id`, () => HttpResponse.error()));
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Lechuga' }));

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
  });

  it('el diálogo no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarAdmin('/admin/ingredientes');
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Pan Brioche' }));

    await esperarSinViolacionesA11y(screen.getByRole('dialog'));
  });
});
