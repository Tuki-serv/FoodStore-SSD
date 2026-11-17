import { act, render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { crearRouterDePrueba } from './router';

function renderRouter() {
  const router = crearRouterDePrueba([{ path: '/', element: <p>Inicio</p> }, { path: '/otra', element: <p>Otra</p> }], ['/']);
  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
  return router;
}

describe('stub de Request del entorno de tests', () => {
  it('un test que restaura todos los globales no deja sin stub a los siguientes (primero)', async () => {
    vi.unstubAllGlobals();
    expect(true).toBe(true);
  });

  it('el router navega después de un unstubAllGlobals de otro test', async () => {
    const router = renderRouter();
    expect(await screen.findByText('Inicio')).toBeInTheDocument();

    await act(() => router.navigate('/otra'));

    expect(await screen.findByText('Otra')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/otra');
  });
});
