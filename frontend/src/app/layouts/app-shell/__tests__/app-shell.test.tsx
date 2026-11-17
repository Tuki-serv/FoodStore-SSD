import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CLAVE_UI_STORAGE, useUiStore } from '@/shared/model';
import { setViewport } from '@/test/viewport';
import { AppShell } from '../app-shell';

function renderShell(ruta: string, props: Parameters<typeof AppShell>[0] = {}) {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell {...props} />,
        children: [
          { path: '/catalogo', element: <h1>Catálogo</h1> },
          { path: '/ingresar', element: <h1>Ingresar</h1> },
        ],
      },
    ],
    { initialEntries: [ruta] },
  );
  return render(<RouterProvider router={router} />);
}

const sidebar = (): HTMLElement | null => document.getElementById('sidebar');
const shell = (): Element | null => document.querySelector('.shell');

describe('AppShell sin sesión en desktop', () => {
  it('muestra la navegación Principal con Catálogo, Ingresar y Registrarse, y el contenido en main', () => {
    setViewport(1440);
    renderShell('/catalogo');

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').map((enlace) => enlace.textContent)).toEqual([
      'Catálogo',
      'Ingresar',
      'Registrarse',
    ]);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Catálogo', level: 1 }));
  });

  it('marca solo la página actual con aria-current="page"', () => {
    setViewport(1440);
    renderShell('/catalogo');

    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Ingresar' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Registrarse' })).not.toHaveAttribute('aria-current');
  });

  it('no muestra pie de usuario', () => {
    setViewport(1440);
    renderShell('/catalogo');

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });
});

describe('AppShell colapsable en desktop', () => {
  it('colapsa y expande con el botón del encabezado, conservando el nombre de los enlaces', async () => {
    setViewport(1440);
    const usuario = userEvent.setup();
    renderShell('/catalogo');

    await usuario.click(screen.getByRole('button', { name: 'Colapsar panel' }));

    const expandir = screen.getByRole('button', { name: 'Expandir panel' });
    expect(expandir).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('title', 'Catálogo');
    expect(sidebar()).toHaveClass('is-collapsed');

    await usuario.click(expandir);

    expect(screen.getByRole('button', { name: 'Colapsar panel' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Catálogo' })).not.toHaveAttribute('title');
    expect(sidebar()).not.toHaveClass('is-collapsed');
  });

  it('con la preferencia guardada arranca colapsado y sin transiciones hasta después de los frames', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      window.localStorage.setItem(CLAVE_UI_STORAGE, '{"state":{"sidebarCollapsed":true},"version":1}');
      void useUiStore.persist.rehydrate();
      setViewport(1440);

      renderShell('/catalogo');

      expect(sidebar()).toHaveClass('is-collapsed');
      expect(screen.getByRole('button', { name: 'Expandir panel' })).toBeInTheDocument();
      expect(shell()).not.toHaveClass('is-ready');

      act(() => {
        vi.advanceTimersByTime(40);
      });

      expect(shell()).toHaveClass('is-ready');
    } finally {
      vi.useRealTimers();
    }
  });

  it('con roles ADMIN y usuario muestra el grupo Administración con 5 enlaces y el pie con el nombre', () => {
    setViewport(1440);
    renderShell('/catalogo', { roles: ['ADMIN'], usuario: { nombre: 'Ana Gómez', rolPrincipal: 'ADMIN' } });

    const grupo = screen.getByRole('list', { name: 'Administración' });
    expect(within(grupo).getAllByRole('link').map((enlace) => enlace.textContent)).toEqual([
      'Categorías',
      'Ingredientes',
      'Productos y stock',
      'Usuarios',
      'Dashboard',
    ]);
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('AG')).toBeInTheDocument();
  });

  it('solo muestra «Cerrar sesión» si se provee la acción', () => {
    setViewport(1440);
    const usuarioShell = { nombre: 'Ana Gómez', rolPrincipal: 'ADMIN' };
    const { unmount } = renderShell('/catalogo', { roles: ['ADMIN'], usuario: usuarioShell });
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    unmount();

    renderShell('/catalogo', { roles: ['ADMIN'], usuario: usuarioShell, onCerrarSesion: () => undefined });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});

describe('AppShell drawer en mobile', () => {
  it('«Abrir menú» abre el drawer y mueve el foco a «Cerrar menú»', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');

    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus();
    expect(shell()).toHaveClass('drawer-open');
  });

  it('Escape cierra el drawer y devuelve el foco a «Abrir menú»', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');
    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    await usuario.keyboard('{Escape}');

    expect(shell()).not.toHaveClass('drawer-open');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('el botón «Cerrar menú» cierra y devuelve el foco a «Abrir menú»', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');
    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    await usuario.click(screen.getByRole('button', { name: 'Cerrar menú' }));

    expect(shell()).not.toHaveClass('drawer-open');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('un clic en el scrim cierra el drawer y devuelve el foco', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');
    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    await usuario.click(screen.getByTestId('scrim'));

    expect(shell()).not.toHaveClass('drawer-open');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('elegir «Ingresar» navega y cierra el drawer', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');
    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    await usuario.click(screen.getByRole('link', { name: 'Ingresar' }));

    expect(screen.getByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(shell()).not.toHaveClass('drawer-open');
  });

  it('abrir y pasar a ancho desktop cierra el drawer', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');
    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    act(() => setViewport(1440));

    expect(shell()).not.toHaveClass('drawer-open');
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('el drawer abierto no se persiste y bloquea el scroll del documento hasta cerrarse', async () => {
    setViewport(390);
    const usuario = userEvent.setup();
    renderShell('/catalogo');

    await usuario.click(screen.getByRole('button', { name: 'Abrir menú' }));

    expect(window.localStorage.getItem(CLAVE_UI_STORAGE) ?? '').not.toContain('sidebarOpen');
    expect(document.documentElement.style.overflow).toBe('hidden');

    await usuario.keyboard('{Escape}');

    expect(document.documentElement.style.overflow).toBe('');
  });

  it('en mobile el colapso guardado no se aplica al panel', () => {
    window.localStorage.setItem(CLAVE_UI_STORAGE, '{"state":{"sidebarCollapsed":true},"version":1}');
    void useUiStore.persist.rehydrate();
    setViewport(390);

    renderShell('/catalogo');

    expect(sidebar()).not.toHaveClass('is-collapsed');
  });
});
