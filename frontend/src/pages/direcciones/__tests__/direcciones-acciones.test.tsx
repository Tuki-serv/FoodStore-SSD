import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { direccionDto, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { montarDirecciones } from '@/test/render-direcciones';

const casa = direccionDto({ id: 1, alias: 'Casa', linea1: 'Av. San Martín 1234', ciudad: 'Mendoza', es_principal: true });
const trabajo = direccionDto({ id: 2, alias: 'Trabajo', linea1: 'Belgrano 455', ciudad: 'Godoy Cruz' });

const items = () => within(screen.getByRole('list', { name: 'Tus direcciones' })).getAllByRole('listitem');

describe('marcar como principal', () => {
  it('«Marcar Trabajo como principal» envía PATCH /direcciones/2/principal, Trabajo pasa primera con «Principal», Casa pierde la marca y se avisa', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);

    await usuario.click(await screen.findByRole('button', { name: 'Marcar Trabajo como principal' }));

    expect(await screen.findByText('Dirección principal actualizada')).toBeInTheDocument();
    expect(pedidosDe(estado, 'PATCH', '/2/principal')).toHaveLength(1);
    await waitFor(() => expect(items()[0]).toHaveTextContent('Trabajo'));
    expect(items()[0]).toHaveTextContent('Principal');
    expect(items()[1]).toHaveTextContent('Casa');
    expect(items()[1]).not.toHaveTextContent('Principal');
  });

  it('el botón queda deshabilitado mientras el PATCH demora y un segundo clic no envía otro pedido', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    estado.demoras.PATCH = 200;
    const boton = await screen.findByRole('button', { name: 'Marcar Trabajo como principal' });

    await usuario.click(boton);

    await waitFor(() => expect(boton).toBeDisabled());
    await usuario.click(boton);
    await screen.findByText('Dirección principal actualizada');
    expect(pedidosDe(estado, 'PATCH', '/2/principal')).toHaveLength(1);
  });

  it('un 404 avisa «Esa dirección ya no está disponible» como error y vuelve a pedir el listado', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    const boton = await screen.findByRole('button', { name: 'Marcar Trabajo como principal' });
    estado.direcciones = estado.direcciones.filter((d) => d.id !== 2);

    await usuario.click(boton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa dirección ya no está disponible');
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText('Trabajo')).not.toBeInTheDocument());
  });

  it('un 403 tiene el mismo resultado que un 404', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    server.use(
      http.patch(`${API}/direcciones/:id/principal`, () =>
        HttpResponse.json({ detail: 'No tenés permiso', code: 'HTTP_403', field: null }, { status: 403 }),
      ),
    );

    await usuario.click(await screen.findByRole('button', { name: 'Marcar Trabajo como principal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa dirección ya no está disponible');
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
  });

  it('otro error (503) avisa «No pudimos completar la acción» con el detalle', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    server.use(http.patch(`${API}/direcciones/:id/principal`, () => new HttpResponse(null, { status: 503 })));

    await usuario.click(await screen.findByRole('button', { name: 'Marcar Trabajo como principal' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos completar la acción');
    expect(alerta).toHaveTextContent('Ocurrió un error inesperado. Probá de nuevo.');
  });
});

describe('eliminar con confirmación', () => {
  it('«Eliminar Trabajo» pide confirmar con el título «¿Eliminar «Trabajo»?»; confirmar envía un DELETE, la saca del listado y avisa «Dirección eliminada»', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Trabajo' }));

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Trabajo»?' });
    expect(dialogo).toHaveTextContent('Belgrano 455');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Dirección eliminada')).toBeInTheDocument();
    expect(pedidosDe(estado, 'DELETE', '/2')).toHaveLength(1);
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(screen.queryByText('Trabajo')).not.toBeInTheDocument();
  });

  it('«Cancelar» no envía ningún DELETE y la dirección sigue en el listado', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Trabajo' }));

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidosDe(estado, 'DELETE', '/2')).toHaveLength(0);
    expect(items()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Eliminar Trabajo' })).toHaveFocus();
  });

  it('eliminar la principal habiendo otras avisa que ninguna quedará principal y, al confirmar, la página muestra «Ninguna dirección es principal»', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Casa' }));

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Casa»?' });
    expect(dialogo).toHaveAccessibleDescription(/ninguna quedará como principal/i);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Ninguna dirección es principal')).toBeInTheDocument();
    expect(pedidosDe(estado, 'DELETE', '/1')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Marcar Trabajo como principal' })).toBeInTheDocument();
  });

  it('eliminar una no principal no menciona la marca de principal', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Trabajo' }));

    expect(screen.getByRole('dialog')).not.toHaveAccessibleDescription(/principal/i);
  });

  it('eliminar la única dirección de la página 2 vuelve a la página 1', async () => {
    const muchas = Array.from({ length: 21 }, (_, i) => direccionDto({ id: i + 1, alias: `Dir ${i + 1}`, es_principal: i === 0 }));
    const { estado, usuario } = montarDirecciones(muchas, '/direcciones?page=2');
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Dir 21' }));

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Dir 1')).toBeInTheDocument();
    expect(pedidosDe(estado, 'DELETE', '/21')).toHaveLength(1);
    expect(items()).toHaveLength(20);
    expect(screen.queryByText('Página 2 de 2')).not.toBeInTheDocument();
  });

  it('un 404 al eliminar avisa «Esa dirección ya no está disponible» y vuelve a pedir el listado', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Trabajo' }));
    estado.direcciones = estado.direcciones.filter((d) => d.id !== 2);

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa dirección ya no está disponible');
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
  });

  it('el diálogo de eliminación no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Casa' }));

    await esperarSinViolacionesA11y(screen.getByRole('dialog'));
  });
});
