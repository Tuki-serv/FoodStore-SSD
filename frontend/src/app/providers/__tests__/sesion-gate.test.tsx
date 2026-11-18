import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { useUiStore } from '@/shared/model';
import { handlerMe, handlerRefreshOk } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba } from '@/test/query';
import { SesionGate } from '../sesion-gate';

function renderGate(cliente: QueryClient = crearQueryClientDePrueba(), { estricto = false } = {}) {
  const arbol = (
    <QueryClientProvider client={cliente}>
      <SesionGate>
        <p>Contenido de la app</p>
      </SesionGate>
    </QueryClientProvider>
  );
  render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol);
  return cliente;
}

describe('SesionGate: espera de la sesión', () => {
  it('muestra la pantalla de carga y no el contenido hasta que la rehidratación responde', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        await delay(40);
        return HttpResponse.json({ detail: 'Sin sesión', code: 'HTTP_401', field: null }, { status: 401 });
      }),
    );

    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByText('Contenido de la app')).not.toBeInTheDocument();
    expect(await screen.findByText('Contenido de la app')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('con sesión recuperable muestra el contenido con la sesión autenticada', async () => {
    server.use(handlerRefreshOk('A1'), handlerMe(['ADMIN']));

    renderGate();

    expect(await screen.findByText('Contenido de la app')).toBeInTheDocument();
    expect(selectEstado(useAuthStore.getState())).toBe('autenticada');
  });

  it('en modo estricto (doble montaje) hace un solo POST /auth/refresh', async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return HttpResponse.json({ detail: 'Sin sesión', code: 'HTTP_401', field: null }, { status: 401 });
      }),
    );

    renderGate(crearQueryClientDePrueba(), { estricto: true });

    expect(await screen.findByText('Contenido de la app')).toBeInTheDocument();
    expect(refreshes).toBe(1);
  });
});

describe('SesionGate: limpieza de la caché al perder la sesión', () => {
  beforeEach(() => {
    server.use(handlerRefreshOk('A1'), handlerMe(['CLIENT']));
  });

  async function conSesionYCache() {
    const cliente = renderGate();
    await screen.findByText('Contenido de la app');
    cliente.setQueryData(['pedidos', 'lista', {}], [{ id: 1 }]);
    cliente.setQueryData(['productos', 'lista', {}], [{ id: 9 }]);
    return cliente;
  }

  it('al cerrar la sesión (logout) descarta los datos privados y conserva los públicos', async () => {
    const cliente = await conSesionYCache();

    act(() => useAuthStore.getState().cerrarLocal({ motivo: 'logout' }));

    expect(cliente.getQueryData(['pedidos', 'lista', {}])).toBeUndefined();
    expect(cliente.getQueryData(['productos', 'lista', {}])).toEqual([{ id: 9 }]);
  });

  it('al perder la sesión por vencimiento hace lo mismo', async () => {
    const cliente = await conSesionYCache();

    act(() => useAuthStore.getState().expirarSesion('A1'));

    expect(cliente.getQueryData(['pedidos', 'lista', {}])).toBeUndefined();
    expect(cliente.getQueryData(['productos', 'lista', {}])).toEqual([{ id: 9 }]);
  });

  it('no descarta la consulta de la sesión misma', async () => {
    const cliente = await conSesionYCache();

    act(() => useAuthStore.getState().cerrarLocal());

    expect(cliente.getQueryData(['sesion', 'rehidratar'])).toBe(true);
  });

  it('mientras la sesión sigue autenticada no toca la caché', async () => {
    const cliente = await conSesionYCache();

    act(() => useAuthStore.getState().establecerAccess('A2'));

    expect(cliente.getQueryData(['pedidos', 'lista', {}])).toEqual([{ id: 1 }]);
  });
});

describe('SesionGate: limpieza de la UI transitoria al perder la sesión', () => {
  beforeEach(() => {
    server.use(handlerRefreshOk('A1'), handlerMe(['CLIENT']));
  });

  async function conSesion() {
    renderGate();
    await screen.findByText('Contenido de la app');
  }

  it('al cerrar la sesión con una confirmación abierta la descarta sin ejecutar su acción', async () => {
    await conSesion();
    const accion = vi.fn();
    act(() => useUiStore.getState().pedirConfirmacion({ titulo: 'Eliminar', mensaje: 'x', onConfirmar: accion }));

    act(() => useAuthStore.getState().cerrarLocal({ motivo: 'logout' }));

    expect(useUiStore.getState().confirmModal).toBeNull();
    expect(accion).not.toHaveBeenCalled();
  });

  it('al vencer la sesión se vacían las notificaciones del usuario anterior y se conserva el panel colapsado', async () => {
    await conSesion();
    act(() => {
      useUiStore.getState().toggleSidebarCollapsed();
      useUiStore.getState().notificar({ tipo: 'success', titulo: 'Dirección eliminada' });
    });

    act(() => useAuthStore.getState().expirarSesion('A1'));

    expect(useUiStore.getState().toasts).toEqual([]);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('mientras la sesión sigue autenticada no toca toasts ni confirmación', async () => {
    await conSesion();
    act(() => {
      useUiStore.getState().notificar({ tipo: 'info', titulo: 'Hola' });
      useUiStore.getState().pedirConfirmacion({ titulo: 'T', mensaje: 'm', onConfirmar: vi.fn() });
    });

    act(() => useAuthStore.getState().establecerAccess('A2'));

    expect(useUiStore.getState().toasts).toHaveLength(1);
    expect(useUiStore.getState().confirmModal).not.toBeNull();
  });
});
