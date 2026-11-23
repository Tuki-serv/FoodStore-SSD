import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UsuarioAdmin } from '@/entities/usuario';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { ListaUsuarios } from '../ui/lista-usuarios';

const ana: UsuarioAdmin = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Gómez',
  email: 'ana@example.com',
  celular: null,
  roles: [
    { codigo: 'ADMIN', nombre: 'Administrador' },
    { codigo: 'CLIENT', nombre: 'Cliente' },
  ],
};
const beto: UsuarioAdmin = { ...ana, id: 2, nombre: 'Beto', email: 'beto@example.com', roles: [{ codigo: 'STOCK', nombre: 'Gestor de stock' }] };

function renderizar() {
  return render(<ListaUsuarios usuarios={[ana, beto]} sesionId={1} resaltadoId={null} onEditar={() => undefined} onDesactivar={() => undefined} />);
}

describe('ListaUsuarios: roles y metadatos como texto (spec «Badges solo para estados»)', () => {
  it.each([
    ['Ana Gómez', ['Administrador', 'Cliente']],
    ['Beto Gómez', ['Gestor de stock']],
  ])('los roles de %s se muestran como texto, sin clases de badge', (nombre, roles) => {
    renderizar();

    const lista = screen.getByRole('list', { name: `Roles de ${nombre}` });
    const items = within(lista).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(roles);
    for (const item of items) expect(item.className).not.toMatch(/\bbadge\b|\bb-[a-z-]+\b/);
  });

  it('la marca «Vos» de la fila propia es texto de metadato, no un badge', () => {
    renderizar();

    const vos = screen.getByText('Vos');
    expect(vos.className).not.toMatch(/\bbadge\b|\bb-[a-z-]+\b/);
    expect(screen.getAllByText('Vos')).toHaveLength(1);
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderizar();

    await esperarSinViolacionesA11y(container);
  });
});
