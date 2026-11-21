import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { NotFoundPage } from '../ui/not-found-page';

const montar = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <NotFoundPage />
    </MemoryRouter>,
  );

describe('NotFoundPage', () => {
  it('muestra el título, la ruta pedida y el enlace al catálogo', () => {
    montar('/no-existe');

    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByText('/no-existe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalogo');
  });

  it('muestra la otra ruta cuando cambia', () => {
    montar('/x/y');

    expect(screen.getByText('/x/y')).toBeInTheDocument();
  });

  it('el título usa el tamaño del mockup aprobado de C-13a (2rem), que a 390 px lo parte en dos líneas', () => {
    montar('/no-existe');

    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-[2rem]');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveClass('text-2xl');
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = montar('/no-existe');

    await esperarSinViolacionesA11y(container);
  });
});
