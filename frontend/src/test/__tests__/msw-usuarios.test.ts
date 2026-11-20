import { describe, expect, it } from 'vitest';
import { apiClient } from '@/shared/api';
import { crearEstadoUsuarios, handlersUsuarios, pedidosUsuarios } from '../msw/usuarios';
import { server } from '../msw/server';

describe('handlers de /admin/usuarios', () => {
  it('filtra por rol_codigo, pagina y registra el pedido; un rol desconocido responde 400', async () => {
    const estado = crearEstadoUsuarios();
    server.use(...handlersUsuarios(estado));

    const { data } = await apiClient.get<{ items: { id: number }[]; total: number; pages: number }>('/admin/usuarios/', { params: { rol_codigo: 'STOCK', page: 1, size: 1 } });
    const rechazo = await apiClient.get('/admin/usuarios/', { params: { rol_codigo: 'COCINA' } }).catch((error: unknown) => error);

    expect(data).toMatchObject({ total: 2, pages: 2, items: [{ id: 2 }] });
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/')[0]?.busqueda).toBe('?rol_codigo=STOCK&page=1&size=1');
    expect(rechazo).toMatchObject({ status: 400 });
  });

  it('el alta con un email repetido responde 409 sin campo y la baja de un inexistente 404', async () => {
    const estado = crearEstadoUsuarios();
    server.use(...handlersUsuarios(estado));

    const repetido = await apiClient
      .post('/admin/usuarios/createUser', { nombre: 'X', apellido: 'Y', email: 'ANA@example.com', celular: null, password: 'clave1234', roles_codigos: ['CLIENT'] })
      .catch((error: unknown) => error);
    const inexistente = await apiClient.delete('/admin/usuarios/99').catch((error: unknown) => error);

    expect(repetido).toMatchObject({ status: 409, field: null });
    expect(inexistente).toMatchObject({ status: 404 });
  });
});
