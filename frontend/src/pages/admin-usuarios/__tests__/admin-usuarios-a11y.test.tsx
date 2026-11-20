import { screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { montarUsuarios } from '@/test/render-usuarios';

describe('accesibilidad de Usuarios', () => {
  it('el listado con datos no tiene violaciones', async () => {
    montarUsuarios('/admin/usuarios');
    await screen.findByRole('group', { name: 'Carla Gómez' });

    await esperarSinViolacionesA11y(document.body);
  });

  it('el formulario de alta con errores no tiene violaciones', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    await usuario.click(screen.getByRole('checkbox', { name: /^Cliente/ }));
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await screen.findByText('Ingresá el nombre');
    await screen.findByText('Elegí al menos un rol.');

    await esperarSinViolacionesA11y(document.body);
  });

  it('el formulario de edición propia (casilla bloqueada) no tiene violaciones', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Editar Ana Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Ana Gómez', level: 2 });

    await esperarSinViolacionesA11y(document.body);
  });

  it('el diálogo de desactivación no tiene violaciones', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Desactivar Carla Gómez' }));
    await screen.findByRole('dialog', { name: '¿Desactivar a Carla Gómez?' });

    await esperarSinViolacionesA11y(document.body);
  });
});
