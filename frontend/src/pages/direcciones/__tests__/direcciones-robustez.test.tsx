import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { direccionDto, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { montarDirecciones } from '@/test/render-direcciones';

const casa = direccionDto({ id: 1, alias: 'Casa', linea1: 'Av. San Martín 1234', ciudad: 'Mendoza', es_principal: true });
const trabajo = direccionDto({ id: 2, alias: 'Trabajo', linea1: 'Belgrano 455', ciudad: 'Godoy Cruz' });
const abuela = direccionDto({ id: 3, alias: 'Abuela', linea1: 'Rivadavia 90', ciudad: 'Luján' });

const titulo = () => screen.getByRole('heading', { name: 'Direcciones', level: 1 });
const confirmar = async (usuario: ReturnType<typeof montarDirecciones>['usuario'], nombre: string) => {
  await usuario.click(await screen.findByRole('button', { name: `Eliminar ${nombre}` }));
  await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
};
const falla503 = () => HttpResponse.json({ detail: 'Servicio no disponible', code: 'HTTP_503', field: null }, { status: 503 });

describe('foco tras eliminar', () => {
  it('al confirmar y desaparecer la dirección el foco pasa al título «Direcciones» y no se pierde en <body>', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);

    await confirmar(usuario, 'Trabajo');

    await waitFor(() => expect(screen.queryByText('Trabajo')).not.toBeInTheDocument());
    await waitFor(() => expect(titulo()).toHaveFocus());
  });

  it('eliminando la última dirección (estado vacío) el foco también queda en el título', async () => {
    const { usuario } = montarDirecciones([casa]);

    await confirmar(usuario, 'Casa');

    expect(await screen.findByText('Todavía no tenés direcciones')).toBeInTheDocument();
    await waitFor(() => expect(titulo()).toHaveFocus());
  });

  it('con Escape el foco vuelve al botón «Eliminar» que abrió el diálogo', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Trabajo' }));

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Trabajo' })).toHaveFocus();
  });

  it('si el DELETE falla (503) el foco vuelve al botón de eliminar, que sigue existiendo', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    server.use(http.delete(`${API}/direcciones/:id`, falla503));

    await confirmar(usuario, 'Trabajo');

    await screen.findByText('No pudimos completar la acción');
    expect(screen.getByRole('button', { name: 'Eliminar Trabajo' })).toHaveFocus();
  });
});

describe('listado desactualizado tras un refetch fallido', () => {
  it('eliminar bien y fallar el refetch (503) muestra el aviso con «Reintentar» sin ocultar el listado', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    await screen.findByText('Trabajo');
    server.use(http.get(`${API}/direcciones/`, falla503, { once: true }));

    await confirmar(usuario, 'Trabajo');

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No pudimos actualizar tus direcciones');
    expect(within(aviso).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tus direcciones' })).toBeInTheDocument();
  });

  it('«Reintentar» con respuesta 200 quita el aviso y el listado refleja la eliminación', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo]);
    await screen.findByText('Trabajo');
    server.use(http.get(`${API}/direcciones/`, falla503, { once: true }));
    await confirmar(usuario, 'Trabajo');

    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.queryByText('No pudimos actualizar tus direcciones')).not.toBeInTheDocument());
    expect(screen.queryByText('Trabajo')).not.toBeInTheDocument();
    expect(pedidosDe(estado, 'GET', '/').length).toBeGreaterThanOrEqual(2);
  });

  it('si el reintento vuelve a fallar el aviso sigue visible', async () => {
    const { usuario } = montarDirecciones([casa, trabajo]);
    await screen.findByText('Trabajo');
    server.use(http.get(`${API}/direcciones/`, falla503, { once: true }), http.get(`${API}/direcciones/`, falla503, { once: true }));
    await confirmar(usuario, 'Trabajo');

    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByText('No pudimos actualizar tus direcciones')).toBeInTheDocument();
  });

  it('con el listado al día no hay aviso', async () => {
    montarDirecciones([casa, trabajo]);

    await screen.findByText('Trabajo');

    expect(screen.queryByText('No pudimos actualizar tus direcciones')).not.toBeInTheDocument();
  });
});

describe('dos eliminaciones superpuestas', () => {
  it('cada una avisa su éxito aunque la segunda se confirme con la primera todavía en curso', async () => {
    const { estado, usuario } = montarDirecciones([casa, trabajo, abuela]);
    estado.demoras.DELETE = 150;

    await confirmar(usuario, 'Trabajo');
    await confirmar(usuario, 'Abuela');

    await waitFor(() => expect(screen.getAllByText('Dirección eliminada')).toHaveLength(2));
    expect(pedidosDe(estado, 'DELETE', '/2')).toHaveLength(1);
    expect(pedidosDe(estado, 'DELETE', '/3')).toHaveLength(1);
  });

  it('si la primera falla y la segunda sale bien, hay un aviso de error y uno de éxito', async () => {
    const { usuario } = montarDirecciones([casa, trabajo, abuela]);
    server.use(
      http.delete(`${API}/direcciones/:id`, async ({ params }) => {
        if (params.id === '2') {
          await delay(150);
          return falla503();
        }
        await delay(30);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await confirmar(usuario, 'Trabajo');
    await confirmar(usuario, 'Abuela');

    expect(await screen.findByText('Dirección eliminada')).toBeInTheDocument();
    expect(await screen.findByText('No pudimos completar la acción')).toBeInTheDocument();
    expect(screen.getAllByText('Dirección eliminada')).toHaveLength(1);
  });
});
